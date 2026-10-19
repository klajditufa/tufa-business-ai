-- 0002 · Tenancy, përdorues, anëtarësi, leje dhe funksionet e aksesit
-- Modeli: organization → company → membership(role). Tenant-i i izolimit = company.

-- ---------------------------------------------------------------------------
-- Funksione të përbashkëta
-- ---------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(name) between 2 and 120),
  type          public.organization_type not null default 'single',
  settings      jsonb not null default '{}'::jsonb,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create trigger trg_organizations_updated before update on public.organizations
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- users (profil; autentikimi jeton te auth.users)
-- ---------------------------------------------------------------------------
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         citext not null unique,
  full_name     text not null default '',
  locale        text not null default 'sq' check (locale in ('sq', 'en')),
  is_super_admin boolean not null default false,
  mfa_enabled   boolean not null default false,
  last_company_id uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_users_updated before update on public.users
  for each row execute function app.set_updated_at();

-- Krijon profilin automatikisht kur regjistrohet një auth user
create or replace function app.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- companies (subjekti me NIPT)
-- ---------------------------------------------------------------------------
create table public.companies (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete restrict,
  nipt               public.nipt not null,
  legal_name         text not null check (length(legal_name) between 2 and 200),
  trade_name         text,
  legal_form         public.legal_form not null default 'shpk',
  administrator_name text,
  address            text,
  city               text,
  nace_code          text,
  activity           text,
  tax_regime         public.tax_regime not null default 'standard',
  vat_registered     boolean not null default true,
  base_currency      public.currency_code not null default 'ALL',
  fiscal_year_start  smallint not null default 1 check (fiscal_year_start between 1 and 12),
  email              citext,
  phone              text,
  status             text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  settings           jsonb not null default '{}'::jsonb,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  unique (nipt)
);
create index companies_org_idx on public.companies (organization_id) where deleted_at is null;
create trigger trg_companies_updated before update on public.companies
  for each row execute function app.set_updated_at();

alter table public.users
  add constraint users_last_company_fk foreign key (last_company_id)
  references public.companies(id) on delete set null;

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  role            public.org_role not null,
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index org_memberships_user_idx on public.organization_memberships (user_id);

create table public.company_memberships (
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  role        public.company_role not null,
  created_at  timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index company_memberships_user_idx on public.company_memberships (user_id);

-- Ftesa me email (për përdorues që ende nuk kanë llogari)
create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  company_id      uuid references public.companies(id) on delete cascade,
  email           citext not null,
  org_role        public.org_role,
  company_role    public.company_role,
  token           text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by      uuid references public.users(id),
  expires_at      timestamptz not null default now() + interval '7 days',
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  check (organization_id is not null or company_id is not null),
  check (org_role is not null or company_role is not null)
);

-- ---------------------------------------------------------------------------
-- permissions · matrica rol × modul × veprim
-- ---------------------------------------------------------------------------
create table public.permissions (
  role    text not null,
  module  text not null,
  action  text not null check (action in ('read', 'write', 'approve', 'close', 'admin')),
  allowed boolean not null default true,
  primary key (role, module, action)
);

-- ---------------------------------------------------------------------------
-- Funksionet e aksesit (SECURITY DEFINER, thirren nga policies)
-- ---------------------------------------------------------------------------

-- Super admin? (lexohet nga profili, jo nga JWT, që të mos falsifikohet nga klienti)
create or replace function app.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_super_admin from public.users where id = auth.uid()), false);
$$;

-- Organizatat ku përdoruesi është owner
create or replace function app.user_org_ids(p_role public.org_role default null)
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.organization_memberships
  where user_id = auth.uid() and (p_role is null or role = p_role);
$$;

-- Kompanitë ku përdoruesi ka akses: anëtarësi direkte ose org_owner i organizatës
create or replace function app.user_company_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select company_id from public.company_memberships where user_id = auth.uid()
  union
  select c.id from public.companies c
  join public.organization_memberships om on om.organization_id = c.organization_id
  where om.user_id = auth.uid() and om.role = 'org_owner' and c.deleted_at is null;
$$;

-- Roli efektiv i përdoruesit në një kompani (org_owner trajtohet si company_admin + accountant)
create or replace function app.company_role(p_company_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select 'org_owner' from public.companies c
       join public.organization_memberships om on om.organization_id = c.organization_id
      where c.id = p_company_id and om.user_id = auth.uid() and om.role = 'org_owner'),
    (select role::text from public.company_memberships
      where company_id = p_company_id and user_id = auth.uid())
  );
$$;

-- A ka përdoruesi të drejtën (modul, veprim) në kompani?
create or replace function app.has_permission(p_company_id uuid, p_module text, p_action text)
returns boolean language sql stable security definer set search_path = public as $$
  select app.is_super_admin()
      or exists (
        select 1 from public.permissions p
        where p.role = app.company_role(p_company_id)
          and p.module = p_module and p.action = p_action and p.allowed
      );
$$;

-- A mund të administrojë përdoruesi organizatën?
create or replace function app.is_org_owner(p_org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select app.is_super_admin() or exists (
    select 1 from public.organization_memberships
    where organization_id = p_org_id and user_id = auth.uid() and role = 'org_owner'
  );
$$;

grant usage on schema app to authenticated, service_role;
grant execute on all functions in schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.companies enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.company_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.permissions enable row level security;

-- organizations: sheh ato ku është anëtar ose ku ka një kompani; ndryshon vetëm owner
create policy org_select on public.organizations for select to authenticated
  using (
    app.is_super_admin()
    or id in (select app.user_org_ids())
    or id in (select organization_id from public.companies where id in (select app.user_company_ids()))
  );
create policy org_insert on public.organizations for insert to authenticated
  with check (created_by = auth.uid());
create policy org_update on public.organizations for update to authenticated
  using (app.is_org_owner(id)) with check (app.is_org_owner(id));

-- users: profili i vet + profilet e kolegëve në të njëjtat kompani (vetëm lexim)
create policy users_select on public.users for select to authenticated
  using (
    id = auth.uid() or app.is_super_admin()
    or id in (select user_id from public.company_memberships where company_id in (select app.user_company_ids()))
    or id in (select user_id from public.organization_memberships where organization_id in (select app.user_org_ids()))
  );
create policy users_update_self on public.users for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_super_admin = (select is_super_admin from public.users where id = auth.uid()));

-- companies
create policy companies_select on public.companies for select to authenticated
  using (app.is_super_admin() or id in (select app.user_company_ids()));
create policy companies_insert on public.companies for insert to authenticated
  with check (app.is_org_owner(organization_id));
create policy companies_update on public.companies for update to authenticated
  using (app.has_permission(id, 'companies', 'admin'))
  with check (app.has_permission(id, 'companies', 'admin'));

-- memberships: owner i organizatës menaxhon; anëtari sheh të vetat dhe kolegët
create policy org_memb_select on public.organization_memberships for select to authenticated
  using (user_id = auth.uid() or app.is_org_owner(organization_id));
create policy org_memb_all on public.organization_memberships for all to authenticated
  using (app.is_org_owner(organization_id)) with check (app.is_org_owner(organization_id));

create policy comp_memb_select on public.company_memberships for select to authenticated
  using (user_id = auth.uid() or company_id in (select app.user_company_ids()));
create policy comp_memb_all on public.company_memberships for all to authenticated
  using (app.has_permission(company_id, 'companies', 'admin'))
  with check (app.has_permission(company_id, 'companies', 'admin'));

create policy invitations_all on public.invitations for all to authenticated
  using (
    (organization_id is not null and app.is_org_owner(organization_id))
    or (company_id is not null and app.has_permission(company_id, 'companies', 'admin'))
  )
  with check (
    (organization_id is not null and app.is_org_owner(organization_id))
    or (company_id is not null and app.has_permission(company_id, 'companies', 'admin'))
  );

-- permissions: të lexueshme nga të gjithë të autentikuarit; shkruhen vetëm nga service_role
create policy permissions_read on public.permissions for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Matrica e lejeve (seed i domosdoshëm; pjesë e migrations që të jetë gjithmonë prezente)
-- module: companies, invoices, documents, vat, declarations, obligations, payroll, accounting, reports, studio
-- ---------------------------------------------------------------------------
insert into public.permissions (role, module, action) values
  -- org_owner: gjithçka
  ('org_owner','companies','read'),('org_owner','companies','write'),('org_owner','companies','admin'),
  ('org_owner','invoices','read'),('org_owner','invoices','write'),('org_owner','invoices','close'),
  ('org_owner','documents','read'),('org_owner','documents','write'),
  ('org_owner','vat','read'),('org_owner','vat','write'),('org_owner','vat','approve'),
  ('org_owner','declarations','read'),('org_owner','declarations','write'),('org_owner','declarations','approve'),
  ('org_owner','obligations','read'),('org_owner','obligations','write'),('org_owner','obligations','approve'),
  ('org_owner','payroll','read'),('org_owner','payroll','write'),('org_owner','payroll','approve'),
  ('org_owner','accounting','read'),('org_owner','accounting','write'),('org_owner','accounting','close'),
  ('org_owner','reports','read'),('org_owner','studio','read'),('org_owner','studio','write'),
  -- accountant: përpunon gjithçka, administron anëtarët e kompanisë
  ('accountant','companies','read'),('accountant','companies','write'),('accountant','companies','admin'),
  ('accountant','invoices','read'),('accountant','invoices','write'),('accountant','invoices','close'),
  ('accountant','documents','read'),('accountant','documents','write'),
  ('accountant','vat','read'),('accountant','vat','write'),('accountant','vat','approve'),
  ('accountant','declarations','read'),('accountant','declarations','write'),('accountant','declarations','approve'),
  ('accountant','obligations','read'),('accountant','obligations','write'),('accountant','obligations','approve'),
  ('accountant','payroll','read'),('accountant','payroll','write'),('accountant','payroll','approve'),
  ('accountant','accounting','read'),('accountant','accounting','write'),('accountant','accounting','close'),
  ('accountant','reports','read'),('accountant','studio','read'),('accountant','studio','write'),
  -- company_admin: biznesi i vet; nuk mbyll periudha, nuk ndryshon statusin e deklarimeve
  ('company_admin','companies','read'),('company_admin','companies','write'),('company_admin','companies','admin'),
  ('company_admin','invoices','read'),('company_admin','invoices','write'),
  ('company_admin','documents','read'),('company_admin','documents','write'),
  ('company_admin','vat','read'),('company_admin','declarations','read'),('company_admin','declarations','approve'),
  ('company_admin','obligations','read'),('company_admin','obligations','approve'),
  ('company_admin','payroll','read'),('company_admin','accounting','read'),('company_admin','reports','read'),
  -- finance_manager: lexon dhe miraton
  ('finance_manager','companies','read'),('finance_manager','invoices','read'),('finance_manager','documents','read'),
  ('finance_manager','vat','read'),('finance_manager','declarations','read'),
  ('finance_manager','obligations','read'),('finance_manager','obligations','approve'),
  ('finance_manager','payroll','read'),('finance_manager','accounting','read'),('finance_manager','reports','read'),
  -- operator: fut dokumente dhe shpenzime
  ('operator','companies','read'),('operator','invoices','read'),('operator','invoices','write'),
  ('operator','documents','read'),('operator','documents','write'),('operator','reports','read'),
  -- viewer
  ('viewer','companies','read'),('viewer','invoices','read'),('viewer','documents','read'),
  ('viewer','vat','read'),('viewer','declarations','read'),('viewer','obligations','read'),('viewer','reports','read');

-- ---------------------------------------------------------------------------
-- RPC: krijon organizatë + kompani të parë + anëtarësi owner në një transaksion
-- (thirret nga onboarding-u; shmang ciklin "nuk ka organizatë → nuk ka RLS që lejon insert")
-- ---------------------------------------------------------------------------
create or replace function public.create_organization_with_company(
  p_org_name text,
  p_org_type public.organization_type,
  p_company jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_company uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_org_type = 'demo' then raise exception 'demo organizations are created only by seed'; end if;

  insert into public.organizations (name, type, created_by)
  values (p_org_name, p_org_type, auth.uid()) returning id into v_org;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (v_org, auth.uid(), 'org_owner');

  insert into public.companies (
    organization_id, nipt, legal_name, trade_name, legal_form, administrator_name,
    address, city, tax_regime, vat_registered, base_currency, created_by
  ) values (
    v_org,
    upper(p_company ->> 'nipt'),
    p_company ->> 'legal_name',
    p_company ->> 'trade_name',
    coalesce((p_company ->> 'legal_form')::public.legal_form, 'shpk'),
    p_company ->> 'administrator_name',
    p_company ->> 'address',
    p_company ->> 'city',
    coalesce((p_company ->> 'tax_regime')::public.tax_regime, 'standard'),
    coalesce((p_company ->> 'vat_registered')::boolean, true),
    coalesce(p_company ->> 'base_currency', 'ALL'),
    auth.uid()
  ) returning id into v_company;

  update public.users set last_company_id = v_company where id = auth.uid();
  return v_company;
end $$;

grant execute on function public.create_organization_with_company(text, public.organization_type, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC publike për UI: roli dhe lejet e përdoruesit aktual (lexojnë vetëm identitetin e vet)
-- ---------------------------------------------------------------------------
create or replace function public.my_company_role(p_company_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select app.company_role(p_company_id);
$$;
create or replace function public.my_permissions(p_company_id uuid)
returns table (module text, action text) language sql stable security definer set search_path = public as $$
  select p.module, p.action from public.permissions p
  where p.allowed and (app.is_super_admin() or p.role = app.company_role(p_company_id));
$$;
grant execute on function public.my_company_role(uuid) to authenticated;
grant execute on function public.my_permissions(uuid) to authenticated;
