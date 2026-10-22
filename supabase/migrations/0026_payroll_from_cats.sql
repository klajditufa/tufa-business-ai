-- ===========================================================================
-- 0026 · Listëpagesa nga C@TS (e-Filing) në vend të futjes manuale
--   Hiqet moduli manual i 0025 (punonjës + llogaritje), sepse vlerat zyrtare vijnë nga
--   eksporti Excel i e-Filing: "Listëpagesa të Dorëzuara" (një rresht për muaj) dhe
--   "Shfaq Detajet" (E-SIG 025, fushat [9]–[31], një rresht për punonjës).
--   * payroll_declarations       · përmbledhja mujore siç është në C@TS
--   * payroll_declaration_lines  · rreshtat e punonjësve (opsional, nga detajet)
--   * import_payroll_declarations / import_payroll_lines · upsert me kontroll të drejte
--   * Sinkronizim: deklarimi "payroll_esig25" i muajit → declared (me datën e dorëzimit),
--     detyrimet zyrtare (shoqërore, shëndetësore, TAP) me afatin nga C@TS.
-- ===========================================================================

-- 1) Heqja e modulit manual (nuk ka të dhëna reale; vetëm një draft bosh)
alter table public.tax_obligations drop column if exists payroll_run_id;
drop function if exists public.generate_payroll(uuid, integer, integer);
drop function if exists public.update_payroll_line(uuid, numeric, integer);
drop function if exists public.remove_payroll_line(uuid);
drop function if exists public.finalize_payroll(uuid);
drop function if exists public.reopen_payroll(uuid);
drop function if exists app.payroll_apply(uuid);
drop function if exists app.payroll_refresh_totals(uuid);
drop function if exists app.payroll_calc(uuid, date, numeric, public.employee_kind);
drop table if exists public.payroll_lines;
drop table if exists public.payroll_runs;
drop table if exists public.employees;
drop type if exists public.payroll_status;
drop type if exists public.employee_kind;

-- 2) Përmbledhja mujore nga C@TS
create table public.payroll_declarations (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  period_id     uuid not null references public.fiscal_periods(id) on delete restrict,
  model         text not null default 'Normal',          -- Normal / Ndryshim nga Tatimpaguesi / …
  submitted_on  date,                                    -- Data e Dorëzimit
  due_date      date,                                    -- Data e Pritshme e Deklaratës
  employees     integer not null default 0,              -- Nr. i Punëmarrësve
  gross         numeric(16,2) not null default 0,        -- Pagat
  social        numeric(16,2) not null default 0,        -- Kontributet e Sigurimeve Shoqërore
  health        numeric(16,2) not null default 0,        -- Kontributet e Sigurimeve Shëndetësore
  income_tax    numeric(16,2) not null default 0,        -- Totali i TAP
  cats_status   text,                                    -- Statusi në e-Filing
  issh_status   text,                                    -- Statusi i Dërgimit në ISSH
  issh_sent_on  date,
  source        text not null default 'cats_excel',
  imported_at   timestamptz not null default now(),
  imported_by   uuid references public.users(id),
  raw           jsonb
);
create unique index payroll_decl_uq on public.payroll_declarations (company_id, period_id, model, coalesce(submitted_on, date '1900-01-01'));
create index payroll_decl_company_idx on public.payroll_declarations (company_id, period_id);
create trigger audit_payroll_declarations after insert or update or delete on public.payroll_declarations
  for each row execute function app.audit_row();

-- 3) Rreshtat e punonjësve (E-SIG 025)
create table public.payroll_declaration_lines (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,
  period_id          uuid not null references public.fiscal_periods(id) on delete restrict,
  nid                text not null,          -- [9]
  full_name          text,                   -- [10]
  profession         text,                   -- [11]
  category           text,                   -- [12]
  days_absent        integer,                -- [13]
  days_worked        integer,                -- [14]
  gross              numeric(14,2) not null default 0,  -- [15]
  social_base        numeric(14,2) not null default 0,  -- [16]
  social_employer    numeric(14,2) not null default 0,  -- [17]
  social_employee    numeric(14,2) not null default 0,  -- [18]
  social_total       numeric(14,2) not null default 0,  -- [19]
  supp_employer      numeric(14,2) not null default 0,  -- [20]
  supp_employee      numeric(14,2) not null default 0,  -- [21]
  supp_total         numeric(14,2) not null default 0,  -- [22]
  social_all         numeric(14,2) not null default 0,  -- [23]
  health_base        numeric(14,2) not null default 0,  -- [24]
  health_total       numeric(14,2) not null default 0,  -- [25]
  pension_voluntary  numeric(14,2) not null default 0,  -- [26]
  tax_deduction      numeric(14,2) not null default 0,  -- [27]
  tax_base           numeric(14,2) not null default 0,  -- [28]
  income_tax         numeric(14,2) not null default 0,  -- [29]
  personal_status    text,                   -- [30]
  notes              text,                   -- [31]
  imported_at        timestamptz not null default now(),
  unique (company_id, period_id, nid)
);
create index payroll_lines_period_idx on public.payroll_declaration_lines (company_id, period_id);
create trigger audit_payroll_declaration_lines after insert or update or delete on public.payroll_declaration_lines
  for each row execute function app.audit_row();

alter table public.tax_obligations
  add column if not exists payroll_declaration_id uuid references public.payroll_declarations(id) on delete cascade;

-- RLS: lexim me payroll.read; shkrim vetëm përmes RPC-ve
alter table public.payroll_declarations enable row level security;
alter table public.payroll_declaration_lines enable row level security;
create policy payroll_decl_select on public.payroll_declarations for select to authenticated
  using (app.has_permission(company_id, 'payroll', 'read'));
create policy payroll_lines_select on public.payroll_declaration_lines for select to authenticated
  using (app.has_permission(company_id, 'payroll', 'read'));
grant select on public.payroll_declarations, public.payroll_declaration_lines to authenticated;
grant all on public.payroll_declarations, public.payroll_declaration_lines to service_role;

-- ---------------------------------------------------------------------------
-- Ndihmës: vlera numerike nga jsonb ("11,500" | 11500 | null → numeric)
-- ---------------------------------------------------------------------------
create or replace function app.jnum(p jsonb, k text)
returns numeric language sql immutable as $$
  select coalesce(nullif(regexp_replace(coalesce(p ->> k, ''), '[^0-9.\-]', '', 'g'), '')::numeric, 0);
$$;

-- ---------------------------------------------------------------------------
-- import_payroll_declarations(company, rows)
--   rows: [{year, month, model, submitted_on, due_date, employees, gross, social, health,
--           income_tax, cats_status, issh_status, issh_sent_on}]
--   Kthen {imported, updated, declarations_marked}
-- ---------------------------------------------------------------------------
create or replace function public.import_payroll_declarations(p_company_id uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; v_period uuid; v_id uuid; v_existing uuid; v_decl uuid;
  v_imported int := 0; v_updated int := 0; v_marked int := 0;
  v_year int; v_month int; v_sub date; v_due date; v_status text; v_paid boolean;
begin
  if not app.has_permission(p_company_id, 'payroll', 'write') then
    raise exception 'Nuk ke të drejtë për listëpagesat e këtij subjekti' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'rows: array me maksimumi 1000 rreshta' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_year := (r ->> 'year')::int; v_month := (r ->> 'month')::int;
    if v_year is null or v_month not between 1 and 12 then continue; end if;
    v_sub := nullif(r ->> 'submitted_on', '')::date;
    v_due := nullif(r ->> 'due_date', '')::date;
    v_status := nullif(btrim(r ->> 'cats_status'), '');
    v_period := app.period_for_date(p_company_id, make_date(v_year, v_month, 1));

    select id into v_existing from public.payroll_declarations
     where company_id = p_company_id and period_id = v_period
       and model = coalesce(nullif(btrim(r ->> 'model'), ''), 'Normal')
       and coalesce(submitted_on, date '1900-01-01') = coalesce(v_sub, date '1900-01-01');

    if v_existing is null then
      insert into public.payroll_declarations (company_id, period_id, model, submitted_on, due_date, employees, gross, social, health,
                                               income_tax, cats_status, issh_status, issh_sent_on, imported_by, raw)
      values (p_company_id, v_period, coalesce(nullif(btrim(r ->> 'model'), ''), 'Normal'), v_sub, v_due,
              app.jnum(r, 'employees')::int, app.jnum(r, 'gross'), app.jnum(r, 'social'), app.jnum(r, 'health'),
              app.jnum(r, 'income_tax'), v_status, nullif(btrim(r ->> 'issh_status'), ''),
              nullif(r ->> 'issh_sent_on', '')::date, auth.uid(), r)
      returning id into v_id;
      v_imported := v_imported + 1;
    else
      update public.payroll_declarations set
        due_date = v_due, employees = app.jnum(r, 'employees')::int, gross = app.jnum(r, 'gross'),
        social = app.jnum(r, 'social'), health = app.jnum(r, 'health'), income_tax = app.jnum(r, 'income_tax'),
        cats_status = v_status, issh_status = nullif(btrim(r ->> 'issh_status'), ''),
        issh_sent_on = nullif(r ->> 'issh_sent_on', '')::date, imported_at = now(), imported_by = auth.uid(), raw = r
      where id = v_existing;
      v_id := v_existing;
      v_updated := v_updated + 1;
    end if;

    -- Deklarimi i muajit në TUFA: i dorëzuar në C@TS → "declared" (përveç kur është refuzuar)
    if v_status is null or v_status !~* 'refuz' then
      perform public.ensure_declarations(p_company_id, v_year, v_month);
      update public.tax_declarations
         set status = 'declared',
             declared_at = coalesce(v_sub::timestamptz, declared_at, now()),
             official = official || jsonb_build_object('source', 'cats', 'employees', app.jnum(r, 'employees'),
                          'gross', app.jnum(r, 'gross'), 'social', app.jnum(r, 'social'), 'health', app.jnum(r, 'health'),
                          'income_tax', app.jnum(r, 'income_tax'), 'cats_status', v_status)
       where company_id = p_company_id and period_id = v_period and kind = 'payroll_esig25'
       returning id into v_decl;
      if v_decl is not null then v_marked := v_marked + 1; end if;

      -- Detyrimet zyrtare nga C@TS (rishkruhen në çdo import të këtij rreshti)
      v_paid := v_status ~* '(rikonsil|aprovuar dhe paguar)';
      delete from public.tax_obligations where payroll_declaration_id = v_id;
      insert into public.tax_obligations (company_id, declaration_id, payroll_declaration_id, kind, description, amount,
                                          due_date, confirmed_official, paid_amount, paid_at)
      select p_company_id, v_decl, v_id, k.kind, k.descr, k.amount,
             coalesce(v_due, (make_date(v_year, v_month, 1) + interval '1 month 19 days')::date), true,
             case when v_paid then k.amount else 0 end, case when v_paid then v_sub end
        from (values
          ('social'::public.obligation_kind, 'Sigurime shoqërore (C@TS)', app.jnum(r, 'social')),
          ('health'::public.obligation_kind, 'Sigurime shëndetësore (C@TS)', app.jnum(r, 'health')),
          ('income_tax'::public.obligation_kind, 'TAP (C@TS)', app.jnum(r, 'income_tax'))
        ) as k(kind, descr, amount)
       where k.amount > 0;
    end if;
  end loop;

  return jsonb_build_object('imported', v_imported, 'updated', v_updated, 'declarations_marked', v_marked);
end $$;

-- ---------------------------------------------------------------------------
-- import_payroll_lines(company, year, month, rows) · zëvendëson rreshtat e muajit
--   rows: [{nid, full_name, profession, category, days_absent, days_worked, gross, social_base,
--           social_employer, social_employee, social_total, supp_employer, supp_employee, supp_total,
--           social_all, health_base, health_total, pension_voluntary, tax_deduction, tax_base,
--           income_tax, personal_status, notes}]
-- ---------------------------------------------------------------------------
create or replace function public.import_payroll_lines(p_company_id uuid, p_year integer, p_month integer, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_period uuid; v_n int;
begin
  if not app.has_permission(p_company_id, 'payroll', 'write') then
    raise exception 'Nuk ke të drejtë për listëpagesat e këtij subjekti' using errcode = '42501';
  end if;
  if p_month not between 1 and 12 or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'Të dhëna të pavlefshme' using errcode = '22023';
  end if;
  v_period := app.period_for_date(p_company_id, make_date(p_year, p_month, 1));
  delete from public.payroll_declaration_lines where company_id = p_company_id and period_id = v_period;
  insert into public.payroll_declaration_lines (
    company_id, period_id, nid, full_name, profession, category, days_absent, days_worked, gross, social_base,
    social_employer, social_employee, social_total, supp_employer, supp_employee, supp_total, social_all,
    health_base, health_total, pension_voluntary, tax_deduction, tax_base, income_tax, personal_status, notes)
  select p_company_id, v_period, upper(btrim(r ->> 'nid')), r ->> 'full_name', r ->> 'profession', r ->> 'category',
         nullif(app.jnum(r, 'days_absent'), 0)::int, app.jnum(r, 'days_worked')::int,
         app.jnum(r, 'gross'), app.jnum(r, 'social_base'), app.jnum(r, 'social_employer'), app.jnum(r, 'social_employee'),
         app.jnum(r, 'social_total'), app.jnum(r, 'supp_employer'), app.jnum(r, 'supp_employee'), app.jnum(r, 'supp_total'),
         app.jnum(r, 'social_all'), app.jnum(r, 'health_base'), app.jnum(r, 'health_total'), app.jnum(r, 'pension_voluntary'),
         app.jnum(r, 'tax_deduction'), app.jnum(r, 'tax_base'), app.jnum(r, 'income_tax'), r ->> 'personal_status', r ->> 'notes'
    from jsonb_array_elements(p_rows) r
   where nullif(btrim(r ->> 'nid'), '') is not null
  on conflict (company_id, period_id, nid) do nothing;
  get diagnostics v_n = row_count;
  return jsonb_build_object('lines', v_n);
end $$;

revoke all on function public.import_payroll_declarations(uuid, jsonb) from public, anon;
revoke all on function public.import_payroll_lines(uuid, integer, integer, jsonb) from public, anon;
grant execute on function public.import_payroll_declarations(uuid, jsonb) to authenticated;
grant execute on function public.import_payroll_lines(uuid, integer, integer, jsonb) to authenticated;
grant execute on all functions in schema app to authenticated, service_role;
