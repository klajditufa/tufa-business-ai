-- 0028 · Modulet nga cis-client-2: tatimi në burim për qiranë, deklaratat doganore,
-- regjistrat e fiskalizimit (operatorët, njësitë, pajisjet) dhe artikujt e faturave.
--
-- Parimet (si te cis-client-2):
--  * Shumat janë numeric(18,2), llogaritjet bëhen në DB me round() (half-up për pozitivët).
--  * Minimumi referues i qirasë e fut kontabilisti; sistemi nuk e gjen vetë.
--  * Përputhja doganë ↔ faturë është tregues, jo vërtetim i pajtueshmërisë doganore.
--  * Regjistrat vijnë vetëm nga agjenti me certifikatë (TUFA Sync); TUFA nuk mban certifikata.

-- ---------------------------------------------------------------------------
-- 1. Tatimi në burim për qiranë
-- ---------------------------------------------------------------------------
create table public.rent_withholdings (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,
  doc_date           date not null,
  beneficiary_name   text not null check (length(btrim(beneficiary_name)) between 2 and 200),
  beneficiary_id     text check (beneficiary_id is null or length(beneficiary_id) <= 40),
  property           text check (property is null or length(property) <= 300),
  gross              numeric(18,2) not null check (gross >= 0),
  reference_minimum  numeric(18,2) not null default 0 check (reference_minimum >= 0),
  rate               numeric(5,2) not null default 15 check (rate >= 0 and rate < 100),
  reference_reviewed boolean not null default false,
  tax_base           numeric(18,2) generated always as (greatest(gross, reference_minimum)) stored,
  tax                numeric(18,2) generated always as (round(greatest(gross, reference_minimum) * rate / 100, 2)) stored,
  status             text not null default 'draft' check (status in ('draft', 'reviewed', 'submitted')),
  receipt            text check (receipt is null or length(receipt) <= 200),
  notes              text check (notes is null or length(notes) <= 2000),
  created_by         uuid default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Pa rishikuar minimumin referues nuk mbyllet regjistrimi; i dorëzuari ka gjithmonë numër protokolli
  check (status = 'draft' or reference_reviewed),
  check (status <> 'submitted' or coalesce(btrim(receipt), '') <> '')
);
create index rent_withholdings_company_date_idx on public.rent_withholdings (company_id, doc_date desc);

alter table public.rent_withholdings enable row level security;
create policy rent_select on public.rent_withholdings for select to authenticated
  using (app.has_permission(company_id, 'declarations', 'read'));
create policy rent_write on public.rent_withholdings for all to authenticated
  using (app.has_permission(company_id, 'declarations', 'write'))
  with check (app.has_permission(company_id, 'declarations', 'write'));
create trigger trg_rent_audit after insert or update or delete on public.rent_withholdings
  for each row execute function app.audit_row();
create trigger trg_rent_updated before update on public.rent_withholdings
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Deklaratat doganore
-- ---------------------------------------------------------------------------
create table public.customs_declarations (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  reference       text not null check (length(btrim(reference)) between 1 and 100),
  decl_date       date not null,
  taxable_amount  numeric(18,2) not null check (taxable_amount >= 0),
  import_vat      numeric(18,2) not null check (import_vat >= 0),
  duty            numeric(18,2) not null default 0 check (duty >= 0),
  invoice_fic     text check (invoice_fic is null or length(invoice_fic) <= 100),
  status          text not null default 'pending' check (status in ('pending', 'reviewed')),
  source_url      text check (source_url is null or source_url ~ '^https://(www\.)?(dogana\.gov\.al|tatime\.gov\.al|efiling\.tatime\.gov\.al)(/|$)'),
  notes           text check (notes is null or length(notes) <= 2000),
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, reference)
);
create index customs_company_date_idx on public.customs_declarations (company_id, decl_date desc);

alter table public.customs_declarations enable row level security;
create policy customs_select on public.customs_declarations for select to authenticated
  using (app.has_permission(company_id, 'vat', 'read'));
create policy customs_write on public.customs_declarations for all to authenticated
  using (app.has_permission(company_id, 'vat', 'write'))
  with check (app.has_permission(company_id, 'vat', 'write'));
create trigger trg_customs_audit after insert or update or delete on public.customs_declarations
  for each row execute function app.audit_row();
create trigger trg_customs_updated before update on public.customs_declarations
  for each row execute function app.set_updated_at();

-- Përputhja me faturat e blerjes: së pari me NIVF (FIC) të shënuar, pastaj me numrin e faturës = referenca.
-- SECURITY INVOKER: RLS e tabelave zbatohet për përdoruesin që thërret.
create or replace function public.customs_matches(p_company_id uuid, p_from date, p_to date)
returns table (
  id uuid, reference text, decl_date date, taxable_amount numeric, import_vat numeric, duty numeric,
  invoice_fic text, status text, notes text, source_url text,
  invoice_id uuid, invoice_number text, invoice_date date, invoice_supplier text,
  invoice_base numeric, invoice_vat numeric, match_by text, vat_difference numeric
)
language sql stable security invoker set search_path = public as $$
  select c.id, c.reference, c.decl_date, c.taxable_amount, c.import_vat, c.duty,
         c.invoice_fic, c.status, c.notes, c.source_url,
         m.id, m.number, m.issue_date, m.counterparty_name, m.subtotal, m.vat_amount, m.match_by,
         case when m.id is null then null else m.vat_amount - c.import_vat end
  from public.customs_declarations c
  left join lateral (
    select i.id, i.number, i.issue_date, i.counterparty_name, i.subtotal, i.vat_amount,
           case when c.invoice_fic is not null and i.nivf = c.invoice_fic then 'fic' else 'reference' end as match_by
    from public.invoices i
    where i.company_id = c.company_id and i.direction = 'purchase' and i.deleted_at is null
      and ((c.invoice_fic is not null and i.nivf = c.invoice_fic)
           or (c.invoice_fic is null and upper(btrim(i.number)) = upper(btrim(c.reference))))
    order by (c.invoice_fic is not null and i.nivf = c.invoice_fic) desc, i.issue_date desc
    limit 1
  ) m on true
  where c.company_id = p_company_id and c.decl_date between p_from and p_to
  order by c.decl_date desc, c.reference;
$$;
grant execute on function public.customs_matches(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Regjistrat e fiskalizimit (pamje e fundit nga agjenti)
-- ---------------------------------------------------------------------------
create table public.company_registry (
  company_id  uuid not null references public.companies(id) on delete cascade,
  kind        text not null check (kind in ('operators', 'units', 'tcrs')),
  rows        jsonb not null default '[]'::jsonb check (jsonb_typeof(rows) = 'array'),
  row_count   integer generated always as (jsonb_array_length(rows)) stored,
  synced_at   timestamptz not null default now(),
  primary key (company_id, kind)
);
alter table public.company_registry enable row level security;
create policy registry_select on public.company_registry for select to authenticated
  using (app.has_permission(company_id, 'invoices', 'read'));
-- Shkrimi bëhet vetëm nga sync_cis_registry (security definer) — asnjë politikë shkrimi për përdoruesit.

-- Vetëm fushat e njohura të CIS ruhen; çdo gjë tjetër hidhet.
create or replace function app.registry_clean(p_kind text, p_rows jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(
           jsonb_strip_nulls(case p_kind
             when 'operators' then jsonb_build_object(
               'name', left(r->>'name', 200), 'opCode', left(r->>'opCode', 40), 'idNumber', left(r->>'idNumber', 40),
               'validFrom', left(r->>'validFrom', 40), 'validTo', left(r->>'validTo', 40))
             when 'units' then jsonb_build_object(
               'BUCode', left(r->>'BUCode', 40), 'BUName', left(r->>'BUName', 200), 'BUStreetName', left(r->>'BUStreetName', 300),
               'BUSerialNumber', left(r->>'BUSerialNumber', 60), 'BUValidFrom', left(r->>'BUValidFrom', 40), 'BUValidTo', left(r->>'BUValidTo', 40))
             else jsonb_build_object(
               'TCRCode', left(r->>'TCRCode', 40), 'TCRIntID', left(r->>'TCRIntID', 60), 'BusinUnitCode', left(r->>'BusinUnitCode', 40),
               'Type', left(r->>'Type', 40), 'SoftCode', left(r->>'SoftCode', 60), 'MaintainerCode', left(r->>'MaintainerCode', 60),
               'ValidFrom', left(r->>'ValidFrom', 40), 'ValidTo', left(r->>'ValidTo', 40))
           end)), '[]'::jsonb)
  from jsonb_array_elements(p_rows) r
  where jsonb_typeof(r) = 'object';
$$;

create or replace function public.sync_cis_registry(p_key text, p_kind text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_company uuid; v_clean jsonb;
begin
  if coalesce(p_key, '') !~ '^tba_[0-9a-f]{48}$' then
    raise exception 'Çelës API i pavlefshëm' using errcode = '28000';
  end if;
  select r.company_id into v_company from public.resolve_api_key(p_key, 'sync:invoices') r;
  if v_company is null then
    raise exception 'Çelës API i pavlefshëm ose i revokuar' using errcode = '28000';
  end if;
  if p_kind not in ('operators', 'units', 'tcrs') then
    raise exception 'Lloj regjistri i panjohur: %', p_kind using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'rows: array me maksimumi 5000 rreshta' using errcode = '22023';
  end if;
  v_clean := app.registry_clean(p_kind, p_rows);
  insert into public.company_registry (company_id, kind, rows, synced_at)
  values (v_company, p_kind, v_clean, now())
  on conflict (company_id, kind) do update set rows = excluded.rows, synced_at = excluded.synced_at;
  return jsonb_build_object('company_id', v_company, 'kind', p_kind, 'rows', jsonb_array_length(v_clean));
end $$;

revoke all on function public.sync_cis_registry(text, text, jsonb) from public;
grant execute on function public.sync_cis_registry(text, text, jsonb) to anon, authenticated, service_role;
revoke all on function app.registry_clean(text, jsonb) from public, anon, authenticated;

grant select on public.rent_withholdings, public.customs_declarations, public.company_registry to authenticated;
grant insert, update, delete on public.rent_withholdings, public.customs_declarations to authenticated;
grant all on public.rent_withholdings, public.customs_declarations, public.company_registry to service_role;
