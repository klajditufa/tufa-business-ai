-- ===========================================================================
-- 0025 · Listëpagesa (E-SIG 025)
--   employees       · punonjësit e subjektit (dhe pronari i vetëpunësuar)
--   payroll_runs    · një listëpagesë për subjekt/muaj (draft → final)
--   payroll_lines   · rreshti për punonjës me llogaritjen dhe vlerat e rregullave të përdorura
--   app.payroll_calc(...) · llogaritja e pastër nga tax_rules (asnjë normë në kod):
--       sigurime shoqërore: baza = bruto e kufizuar [paga min, paga max]
--       sigurime shëndetësore: baza = max(bruto, paga min); tavan vetëm nëse health_contrib.params.capped = true
--       TAP: sipas payroll_tax_bracket (fixed + rate% × (bruto − base_from))
--       pronar i vetëpunësuar: kontribute self_employed mbi max(bruto, paga min), pa TAP
--   finalize_payroll → krijon detyrimet orientuese (shoqërore, shëndetësore, TAP) me afatin e
--   deklarimit të listëpagesës; reopen_payroll i heq ato që s'janë paguar.
-- ===========================================================================

create type public.employee_kind as enum ('employee', 'owner');
create type public.payroll_status as enum ('draft', 'final');

create table public.employees (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  kind         public.employee_kind not null default 'employee',
  first_name   text not null,
  last_name    text not null,
  personal_no  text,                       -- nr. personal (NID), për E-SIG 025
  position     text,
  gross_salary numeric(14,2) not null default 0 check (gross_salary >= 0),
  start_date   date not null,
  end_date     date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create unique index employees_company_nid_uq on public.employees (company_id, upper(personal_no)) where personal_no is not null;
create index employees_company_idx on public.employees (company_id, last_name);
create trigger trg_employees_updated before update on public.employees for each row execute function app.set_updated_at();
create trigger audit_employees after insert or update or delete on public.employees for each row execute function app.audit_row();

create table public.payroll_runs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  period_id    uuid not null references public.fiscal_periods(id) on delete restrict,
  status       public.payroll_status not null default 'draft',
  totals       jsonb not null default '{}'::jsonb,
  finalized_at timestamptz,
  finalized_by uuid references public.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_id, period_id)
);
create trigger trg_payroll_runs_updated before update on public.payroll_runs for each row execute function app.set_updated_at();
create trigger audit_payroll_runs after insert or update or delete on public.payroll_runs for each row execute function app.audit_row();

create table public.payroll_lines (
  id               uuid primary key default gen_random_uuid(),
  run_id           uuid not null references public.payroll_runs(id) on delete cascade,
  company_id       uuid not null references public.companies(id) on delete cascade,
  employee_id      uuid not null references public.employees(id) on delete restrict,
  days_worked      integer not null default 26 check (days_worked between 0 and 31),
  gross            numeric(14,2) not null check (gross >= 0),
  social_base      numeric(14,2) not null default 0,
  social_employee  numeric(14,2) not null default 0,
  social_employer  numeric(14,2) not null default 0,
  health_base      numeric(14,2) not null default 0,
  health_employee  numeric(14,2) not null default 0,
  health_employer  numeric(14,2) not null default 0,
  income_tax       numeric(14,2) not null default 0,
  net              numeric(14,2) not null default 0,
  rules            jsonb not null default '{}'::jsonb,   -- vlerat e rregullave të përdorura (gjurmë)
  unique (run_id, employee_id)
);
create index payroll_lines_run_idx on public.payroll_lines (run_id);
create trigger audit_payroll_lines after insert or update or delete on public.payroll_lines for each row execute function app.audit_row();

alter table public.tax_obligations add column if not exists payroll_run_id uuid references public.payroll_runs(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- RLS: moduli "payroll"
-- ---------------------------------------------------------------------------
alter table public.employees enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_lines enable row level security;

create policy employees_select on public.employees for select to authenticated using (app.has_permission(company_id, 'payroll', 'read'));
create policy employees_write  on public.employees for all to authenticated
  using (app.has_permission(company_id, 'payroll', 'write')) with check (app.has_permission(company_id, 'payroll', 'write'));
create policy payroll_runs_select on public.payroll_runs for select to authenticated using (app.has_permission(company_id, 'payroll', 'read'));
create policy payroll_lines_select on public.payroll_lines for select to authenticated using (app.has_permission(company_id, 'payroll', 'read'));
-- Shkrimi në runs/lines vetëm përmes RPC-ve (SECURITY DEFINER me kontroll)

grant select, insert, update, delete on public.employees to authenticated;
grant select on public.payroll_runs, public.payroll_lines to authenticated;
grant all on public.employees, public.payroll_runs, public.payroll_lines to service_role;

-- ---------------------------------------------------------------------------
-- Llogaritja (e pastër, nga rregullat në fuqi në datën e periudhës)
-- ---------------------------------------------------------------------------
create or replace function app.payroll_calc(p_company_id uuid, p_date date, p_gross numeric, p_kind public.employee_kind)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_min    numeric := (public.effective_tax_rule('min_wage', p_date, 'default', p_company_id) ->> 'amount')::numeric;
  v_max    numeric := (public.effective_tax_rule('max_wage', p_date, 'default', p_company_id) ->> 'amount')::numeric;
  v_soc    jsonb   := public.effective_tax_rule('social_contrib', p_date, 'default', p_company_id);
  v_hea    jsonb   := public.effective_tax_rule('health_contrib', p_date, 'default', p_company_id);
  v_tap    jsonb   := public.effective_tax_rule('payroll_tax_bracket', p_date, 'default', p_company_id);
  v_gross  numeric := round(coalesce(p_gross, 0), 2);
  v_sbase  numeric; v_hbase numeric;
  v_se numeric := 0; v_sr numeric := 0; v_he numeric := 0; v_hr numeric := 0; v_tax numeric := 0;
  b jsonb;
begin
  if v_min is null or v_soc is null or v_hea is null then
    raise exception 'Mungojnë rregullat e pagës minimale ose të kontributeve për %', p_date using errcode = 'P0002';
  end if;

  if p_kind = 'owner' then
    v_sbase := greatest(v_gross, v_min);
    v_hbase := v_sbase;
    v_se := round(v_sbase * (v_soc ->> 'self_employed')::numeric / 100);
    v_he := round(v_hbase * (v_hea ->> 'self_employed')::numeric / 100);
  else
    v_sbase := greatest(v_gross, v_min);
    if v_max is not null then v_sbase := least(v_sbase, v_max); end if;
    v_hbase := greatest(v_gross, v_min);
    if coalesce((v_hea ->> 'capped')::boolean, false) and v_max is not null then v_hbase := least(v_hbase, v_max); end if;
    v_se := round(v_sbase * (v_soc ->> 'employee')::numeric / 100);
    v_sr := round(v_sbase * (v_soc ->> 'employer')::numeric / 100);
    v_he := round(v_hbase * (v_hea ->> 'employee')::numeric / 100);
    v_hr := round(v_hbase * (v_hea ->> 'employer')::numeric / 100);

    if v_tap is not null then
      for b in select * from jsonb_array_elements(v_tap -> 'brackets') loop
        if v_gross >= coalesce((b ->> 'from')::numeric, 0)
           and (b -> 'to' is null or jsonb_typeof(b -> 'to') = 'null' or v_gross <= (b ->> 'to')::numeric) then
          v_tax := round(coalesce((b ->> 'fixed')::numeric, 0)
                   + coalesce((b ->> 'rate')::numeric, 0) / 100
                     * greatest(v_gross - coalesce((b ->> 'base_from')::numeric, (b ->> 'from')::numeric, 0), 0));
          exit;
        end if;
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'gross', v_gross, 'social_base', v_sbase, 'social_employee', v_se, 'social_employer', v_sr,
    'health_base', v_hbase, 'health_employee', v_he, 'health_employer', v_hr, 'income_tax', v_tax,
    'net', case when p_kind = 'owner' then 0 else v_gross - v_se - v_he - v_tax end,
    'rules', jsonb_build_object('date', p_date, 'min_wage', v_min, 'max_wage', v_max,
                                'social', v_soc - 'label', 'health', v_hea - 'label'));
end $$;

-- Përditëson totalet e listëpagesës
create or replace function app.payroll_refresh_totals(p_run_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.payroll_runs r set totals = (
    select jsonb_build_object(
      'employees', count(*), 'gross', coalesce(sum(gross), 0),
      'social_employee', coalesce(sum(social_employee), 0), 'social_employer', coalesce(sum(social_employer), 0),
      'health_employee', coalesce(sum(health_employee), 0), 'health_employer', coalesce(sum(health_employer), 0),
      'income_tax', coalesce(sum(income_tax), 0), 'net', coalesce(sum(net), 0),
      'to_pay', coalesce(sum(social_employee + social_employer + health_employee + health_employer + income_tax), 0))
    from public.payroll_lines l where l.run_id = p_run_id)
  where r.id = p_run_id;
$$;

create or replace function app.payroll_apply(p_line_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare l record; c jsonb;
begin
  select pl.*, e.kind, make_date(fp.year, fp.month, 1) as d
    into l
    from public.payroll_lines pl
    join public.employees e on e.id = pl.employee_id
    join public.payroll_runs r on r.id = pl.run_id
    join public.fiscal_periods fp on fp.id = r.period_id
   where pl.id = p_line_id;
  c := app.payroll_calc(l.company_id, l.d, l.gross, l.kind);
  update public.payroll_lines set
    social_base = (c ->> 'social_base')::numeric, social_employee = (c ->> 'social_employee')::numeric,
    social_employer = (c ->> 'social_employer')::numeric, health_base = (c ->> 'health_base')::numeric,
    health_employee = (c ->> 'health_employee')::numeric, health_employer = (c ->> 'health_employer')::numeric,
    income_tax = (c ->> 'income_tax')::numeric, net = (c ->> 'net')::numeric, rules = c -> 'rules'
  where id = p_line_id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------
-- Krijon (ose rifreskon) listëpagesën draft të muajit nga punonjësit aktivë.
-- Rreshtat ekzistues ruajnë bruton/ditët e ndryshuara me dorë; shtohen punonjësit e rinj.
create or replace function public.generate_payroll(p_company_id uuid, p_year integer, p_month integer)
returns public.payroll_runs language plpgsql security definer set search_path = public as $$
declare
  v_from date := make_date(p_year, p_month, 1);
  v_to   date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
  v_period uuid; v_run public.payroll_runs; e record; v_line uuid;
begin
  if not app.has_permission(p_company_id, 'payroll', 'write') then
    raise exception 'Nuk ke të drejtë për listëpagesat e këtij subjekti' using errcode = '42501';
  end if;
  v_period := app.period_for_date(p_company_id, v_from);
  insert into public.payroll_runs (company_id, period_id) values (p_company_id, v_period)
  on conflict (company_id, period_id) do nothing;
  select * into v_run from public.payroll_runs where company_id = p_company_id and period_id = v_period;
  if v_run.status = 'final' then
    raise exception 'Listëpagesa e këtij muaji është finalizuar; rihape për ta ndryshuar' using errcode = '22023';
  end if;

  for e in
    select * from public.employees
     where company_id = p_company_id and start_date <= v_to and (end_date is null or end_date >= v_from)
  loop
    insert into public.payroll_lines (run_id, company_id, employee_id, gross)
    values (v_run.id, p_company_id, e.id, e.gross_salary)
    on conflict (run_id, employee_id) do nothing
    returning id into v_line;
    if v_line is not null then perform app.payroll_apply(v_line); end if;
  end loop;

  -- rillogarit edhe rreshtat ekzistues (rregullat mund të jenë konfirmuar/ndryshuar)
  for v_line in select id from public.payroll_lines where run_id = v_run.id loop
    perform app.payroll_apply(v_line);
  end loop;
  perform app.payroll_refresh_totals(v_run.id);
  select * into v_run from public.payroll_runs where id = v_run.id;
  return v_run;
end $$;

create or replace function public.update_payroll_line(p_line_id uuid, p_gross numeric, p_days integer default null)
returns public.payroll_lines language plpgsql security definer set search_path = public as $$
declare v_line public.payroll_lines; v_status public.payroll_status;
begin
  select * into v_line from public.payroll_lines where id = p_line_id;
  select r.status into v_status from public.payroll_runs r where r.id = v_line.run_id;
  if v_line.id is null then raise exception 'Rreshti nuk u gjet' using errcode = 'P0002'; end if;
  if not app.has_permission(v_line.company_id, 'payroll', 'write') then raise exception 'Pa të drejtë' using errcode = '42501'; end if;
  if v_status = 'final' then raise exception 'Listëpagesa është finalizuar' using errcode = '22023'; end if;
  if p_gross is null or p_gross < 0 then raise exception 'Paga bruto e pavlefshme' using errcode = '22023'; end if;
  update public.payroll_lines set gross = round(p_gross, 2), days_worked = coalesce(p_days, days_worked) where id = p_line_id;
  perform app.payroll_apply(p_line_id);
  perform app.payroll_refresh_totals(v_line.run_id);
  select * into v_line from public.payroll_lines where id = p_line_id;
  return v_line;
end $$;

create or replace function public.remove_payroll_line(p_line_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_run uuid; v_company uuid; v_status public.payroll_status;
begin
  select pl.run_id, pl.company_id, r.status into v_run, v_company, v_status
    from public.payroll_lines pl join public.payroll_runs r on r.id = pl.run_id where pl.id = p_line_id;
  if v_run is null then raise exception 'Rreshti nuk u gjet' using errcode = 'P0002'; end if;
  if not app.has_permission(v_company, 'payroll', 'write') then raise exception 'Pa të drejtë' using errcode = '42501'; end if;
  if v_status = 'final' then raise exception 'Listëpagesa është finalizuar' using errcode = '22023'; end if;
  delete from public.payroll_lines where id = p_line_id;
  perform app.payroll_refresh_totals(v_run);
end $$;

-- Finalizon dhe krijon detyrimet orientuese (afati = afati i deklarimit të listëpagesës)
create or replace function public.finalize_payroll(p_run_id uuid)
returns public.payroll_runs language plpgsql security definer set search_path = public as $$
declare v_run public.payroll_runs; v_decl public.tax_declarations; fp record; t jsonb;
begin
  select * into v_run from public.payroll_runs where id = p_run_id for update;
  if v_run.id is null then raise exception 'Listëpagesa nuk u gjet' using errcode = 'P0002'; end if;
  if not app.has_permission(v_run.company_id, 'payroll', 'approve') then raise exception 'Pa të drejtë finalizimi' using errcode = '42501'; end if;
  if v_run.status = 'final' then return v_run; end if;
  if not exists (select 1 from public.payroll_lines where run_id = p_run_id) then
    raise exception 'Listëpagesa është bosh' using errcode = '22023';
  end if;
  select year, month into fp from public.fiscal_periods where id = v_run.period_id;
  perform public.ensure_declarations(v_run.company_id, fp.year, fp.month);
  select * into v_decl from public.tax_declarations where company_id = v_run.company_id and period_id = v_run.period_id and kind = 'payroll_esig25';

  perform app.payroll_refresh_totals(p_run_id);
  select totals into t from public.payroll_runs where id = p_run_id;
  insert into public.tax_obligations (company_id, declaration_id, payroll_run_id, kind, description, amount, due_date, confirmed_official)
  select v_run.company_id, v_decl.id, p_run_id, k.kind, k.descr, k.amount,
         coalesce(v_decl.due_date, (make_date(fp.year, fp.month, 1) + interval '1 month 19 days')::date), false
    from (values
      ('social'::public.obligation_kind, 'Sigurime shoqërore (punëmarrës + punëdhënës)', (t ->> 'social_employee')::numeric + (t ->> 'social_employer')::numeric),
      ('health'::public.obligation_kind, 'Sigurime shëndetësore (punëmarrës + punëdhënës)', (t ->> 'health_employee')::numeric + (t ->> 'health_employer')::numeric),
      ('income_tax'::public.obligation_kind, 'Tatimi mbi të ardhurat nga punësimi (TAP)', (t ->> 'income_tax')::numeric)
    ) as k(kind, descr, amount)
   where k.amount > 0;

  update public.payroll_runs set status = 'final', finalized_at = now(), finalized_by = auth.uid() where id = p_run_id
  returning * into v_run;
  return v_run;
end $$;

create or replace function public.reopen_payroll(p_run_id uuid)
returns public.payroll_runs language plpgsql security definer set search_path = public as $$
declare v_run public.payroll_runs;
begin
  select * into v_run from public.payroll_runs where id = p_run_id for update;
  if v_run.id is null then raise exception 'Listëpagesa nuk u gjet' using errcode = 'P0002'; end if;
  if not app.has_permission(v_run.company_id, 'payroll', 'approve') then raise exception 'Pa të drejtë' using errcode = '42501'; end if;
  if exists (select 1 from public.tax_obligations where payroll_run_id = p_run_id and paid_amount > 0) then
    raise exception 'Ka detyrime të paguara nga kjo listëpagesë; nuk mund të rihapet' using errcode = '22023';
  end if;
  delete from public.tax_obligations where payroll_run_id = p_run_id;
  update public.payroll_runs set status = 'draft', finalized_at = null, finalized_by = null where id = p_run_id
  returning * into v_run;
  return v_run;
end $$;

revoke all on function public.generate_payroll(uuid, integer, integer) from public, anon;
revoke all on function public.update_payroll_line(uuid, numeric, integer) from public, anon;
revoke all on function public.remove_payroll_line(uuid) from public, anon;
revoke all on function public.finalize_payroll(uuid) from public, anon;
revoke all on function public.reopen_payroll(uuid) from public, anon;
grant execute on function public.generate_payroll(uuid, integer, integer) to authenticated;
grant execute on function public.update_payroll_line(uuid, numeric, integer) to authenticated;
grant execute on function public.remove_payroll_line(uuid) to authenticated;
grant execute on function public.finalize_payroll(uuid) to authenticated;
grant execute on function public.reopen_payroll(uuid) to authenticated;
grant execute on all functions in schema app to authenticated, service_role;
