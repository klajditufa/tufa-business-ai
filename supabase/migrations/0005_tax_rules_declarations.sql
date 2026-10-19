-- 0005 · Rregullat tatimore (sipas datës), deklarimet, detyrimet, kalendari fiskal

-- ---------------------------------------------------------------------------
-- tax_rules · normat jetojnë këtu, jo në kod
-- params shembuj:
--   vat_rate:            {"code":"standard","rate":20,"label":"Norma standarde"}
--   vat_rate:            {"code":"reduced_tourism","rate":6}
--   vat_rate:            {"code":"zero","rate":0,"label":"Eksport / 0%"}
--   vat_exempt:          {"code":"exempt","label":"Pa TVSH (i përjashtuar)"}
--   social_contrib:      {"employee":9.5,"employer":15}
--   health_contrib:      {"employee":1.7,"employer":1.7}
--   min_wage:            {"amount":40000,"currency":"ALL"}
--   payroll_tax_bracket: {"brackets":[{"from":0,"to":50000,"rate":0},...]}
-- ---------------------------------------------------------------------------
create table public.tax_rules (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null default 'global' check (scope in ('global', 'company')),
  company_id  uuid references public.companies(id) on delete cascade,
  kind        public.tax_rule_kind not null,
  code        text not null default 'default',
  params      jsonb not null,
  valid_from  date not null,
  valid_to    date,
  source      text,            -- referenca ligjore (ligj, VKM, udhëzim)
  confirmed   boolean not null default false,   -- konfirmuar nga kontabilisti/administratori i platformës
  created_by  uuid,
  created_at  timestamptz not null default now(),
  check ((scope = 'global' and company_id is null) or (scope = 'company' and company_id is not null)),
  check (valid_to is null or valid_to >= valid_from)
);
create index tax_rules_lookup_idx on public.tax_rules (kind, code, valid_from desc);
create index tax_rules_company_idx on public.tax_rules (company_id) where company_id is not null;

-- Rregulli në fuqi për një datë: i kompanisë ka përparësi mbi globalin
create or replace function public.effective_tax_rule(
  p_kind public.tax_rule_kind, p_date date, p_code text default 'default', p_company_id uuid default null
) returns jsonb language sql stable security definer set search_path = public as $$
  select params from public.tax_rules
  where kind = p_kind and code = p_code
    and valid_from <= p_date and (valid_to is null or valid_to >= p_date)
    and (company_id is null or company_id = p_company_id)
  order by (company_id is not null) desc, valid_from desc
  limit 1;
$$;
grant execute on function public.effective_tax_rule(public.tax_rule_kind, date, text, uuid) to authenticated;

-- Të gjitha normat e TVSH-së në fuqi për një datë (për dropdown-e dhe llogaritje)
create or replace function public.vat_rates_at(p_date date, p_company_id uuid default null)
returns table (code text, rate numeric, label text) language sql stable security definer set search_path = public as $$
  select distinct on (code) code, (params ->> 'rate')::numeric, params ->> 'label'
  from public.tax_rules
  where kind = 'vat_rate'
    and valid_from <= p_date and (valid_to is null or valid_to >= p_date)
    and (company_id is null or company_id = p_company_id)
  order by code, (company_id is not null) desc, valid_from desc;
$$;
grant execute on function public.vat_rates_at(date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- tax_declarations · statuset e panelit (Në pritje → Në proces → Për kontroll → E deklaruar / Pezull / Me vonesë)
-- ---------------------------------------------------------------------------
create table public.tax_declarations (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  period_id           uuid not null references public.fiscal_periods(id) on delete restrict,
  kind                public.declaration_kind not null,
  status              public.declaration_status not null default 'pending',
  due_date            date not null,
  declared_at         timestamptz,
  declared_by         uuid references public.users(id),
  source_document_id  uuid,               -- FK te documents (0006)
  computed            jsonb not null default '{}'::jsonb,   -- llogaritja orientuese e sistemit
  official            jsonb not null default '{}'::jsonb,   -- vlerat nga dokumenti zyrtar (C@TS)
  notes               text,
  assigned_to         uuid references public.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (company_id, period_id, kind)
);
create index tax_decl_company_due_idx on public.tax_declarations (company_id, due_date);
create index tax_decl_status_idx on public.tax_declarations (status, due_date);
create trigger trg_tax_decl_updated before update on public.tax_declarations for each row execute function app.set_updated_at();
create trigger audit_tax_declarations after insert or update or delete on public.tax_declarations
  for each row execute function app.audit_row();

-- ---------------------------------------------------------------------------
-- tax_obligations · zyrtare (confirmed_official) vs orientuese
-- ---------------------------------------------------------------------------
create table public.tax_obligations (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  declaration_id      uuid references public.tax_declarations(id) on delete set null,
  kind                public.obligation_kind not null,
  description         text,
  amount              numeric(18,2) not null check (amount >= 0),
  currency            public.currency_code not null default 'ALL',
  due_date            date not null,
  confirmed_official  boolean not null default false,
  paid_amount         numeric(18,2) not null default 0 check (paid_amount >= 0),
  paid_at             date,
  payment_order_document_id uuid,         -- FK te documents (0006)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index tax_oblig_company_due_idx on public.tax_obligations (company_id, due_date) where paid_amount < amount;
create trigger trg_tax_oblig_updated before update on public.tax_obligations for each row execute function app.set_updated_at();
create trigger audit_tax_obligations after insert or update or delete on public.tax_obligations
  for each row execute function app.audit_row();

-- ---------------------------------------------------------------------------
-- tax_calendar_items · afatet (globale ose të kompanisë)
-- ---------------------------------------------------------------------------
create table public.tax_calendar_items (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies(id) on delete cascade,   -- null = global
  kind        public.declaration_kind not null,
  title       text not null,
  due_date    date not null,
  recurrence  text check (recurrence in ('monthly', 'quarterly', 'yearly', 'once')),
  applies_to  jsonb not null default '{}'::jsonb,  -- p.sh. {"vat_registered":true}
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now()
);
create index tax_cal_due_idx on public.tax_calendar_items (due_date);
create index tax_cal_company_idx on public.tax_calendar_items (company_id) where company_id is not null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tax_rules enable row level security;
alter table public.tax_declarations enable row level security;
alter table public.tax_obligations enable row level security;
alter table public.tax_calendar_items enable row level security;

-- tax_rules: globalet lexohen nga të gjithë; të kompanisë nga kush ka vat.read; shkruhen nga vat.approve
create policy tax_rules_select on public.tax_rules for select to authenticated
  using (company_id is null or app.has_permission(company_id, 'vat', 'read'));
create policy tax_rules_write_company on public.tax_rules for all to authenticated
  using (company_id is not null and app.has_permission(company_id, 'vat', 'approve'))
  with check (company_id is not null and app.has_permission(company_id, 'vat', 'approve'));
-- Globalet: vetëm super admin (përmes service_role ose is_super_admin)
create policy tax_rules_write_global on public.tax_rules for all to authenticated
  using (company_id is null and app.is_super_admin())
  with check (company_id is null and app.is_super_admin());

create policy tax_decl_select on public.tax_declarations for select to authenticated
  using (app.has_permission(company_id, 'declarations', 'read'));
create policy tax_decl_write on public.tax_declarations for all to authenticated
  using (app.has_permission(company_id, 'declarations', 'write'))
  with check (app.has_permission(company_id, 'declarations', 'write'));

create policy tax_oblig_select on public.tax_obligations for select to authenticated
  using (app.has_permission(company_id, 'obligations', 'read'));
create policy tax_oblig_write on public.tax_obligations for all to authenticated
  using (app.has_permission(company_id, 'obligations', 'write'))
  with check (app.has_permission(company_id, 'obligations', 'write'));

create policy tax_cal_select on public.tax_calendar_items for select to authenticated
  using (company_id is null or app.has_permission(company_id, 'declarations', 'read'));
create policy tax_cal_write on public.tax_calendar_items for all to authenticated
  using (
    (company_id is not null and app.has_permission(company_id, 'declarations', 'write'))
    or (company_id is null and app.is_super_admin())
  )
  with check (
    (company_id is not null and app.has_permission(company_id, 'declarations', 'write'))
    or (company_id is null and app.is_super_admin())
  );

-- ---------------------------------------------------------------------------
-- Statusi "late" llogaritet, nuk ruhet: pamje që e mbivendos
-- ---------------------------------------------------------------------------
create or replace view public.tax_declarations_view
with (security_invoker = true) as
select d.*,
       case when d.status not in ('declared') and d.due_date < current_date then 'late'::public.declaration_status
            else d.status end as effective_status,
       fp.year, fp.month
from public.tax_declarations d
join public.fiscal_periods fp on fp.id = d.period_id;
