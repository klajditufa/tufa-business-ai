-- ===========================================================================
-- 0016 · Importi i faturave nga CIS (FiscalizationDataService e DPT-së)
--
-- Rruga A: agjenti lokal "TUFA Sync" (cis-client) lexon faturat nga CIS me
-- certifikatën e biznesit, e cila NUK largohet kurrë nga kompjuteri i klientit,
-- dhe i dërgon në TUFA me një çelës API për subjekt. Këtu:
--   * fusha shtesë në invoices për identifikuesit e fiskalizimit
--   * company_api_keys (vetëm hash-i i çelësit; vlera shfaqet një herë)
--   * import_cis_invoices(...) – RPC vetëm për service_role (thirret nga API-ja)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- invoices · identifikuesit e CIS. Mapimi: FIC -> nivf, IIC -> nslf
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists eic                text,      -- kodi i e-faturës
  add column if not exists tcr_code           text,
  add column if not exists business_unit_code text,
  add column if not exists operator_code      text,
  add column if not exists is_einvoice        boolean,
  add column if not exists synced_at          timestamptz;

create index if not exists invoices_company_nslf_idx on public.invoices (company_id, nslf) where nslf is not null;

-- ---------------------------------------------------------------------------
-- company_api_keys · çelësat e agjentit lokal. Ruhet vetëm sha256(çelës).
-- ---------------------------------------------------------------------------
create table public.company_api_keys (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  name         text not null,
  key_prefix   text not null,                  -- 12 karakteret e para, për identifikim në UI
  key_hash     text not null unique,           -- sha256 hex i çelësit të plotë
  scopes       text[] not null default array['sync:invoices'],
  created_by   uuid references public.users(id),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index company_api_keys_company_idx on public.company_api_keys (company_id, created_at desc);
create trigger audit_company_api_keys after insert or update or delete on public.company_api_keys
  for each row execute function app.audit_row();

alter table public.company_api_keys enable row level security;
-- Lexim: kush administron kompaninë. Asnjë insert/update/delete direkt – vetëm RPC.
create policy company_api_keys_select on public.company_api_keys for select to authenticated
  using (app.has_permission(company_id, 'companies', 'admin'));

grant select on public.company_api_keys to authenticated;
grant all on public.company_api_keys to service_role;

-- Gjeneron një çelës të ri; vlera e plotë kthehet VETËM nga kjo thirrje.
create or replace function public.create_api_key(p_company_id uuid, p_name text)
returns table (id uuid, key text, key_prefix text)
language plpgsql security definer set search_path = public as $$
declare
  v_key  text;
  v_id   uuid;
begin
  if not app.has_permission(p_company_id, 'companies', 'admin') then
    raise exception 'Nuk ke të drejtë të krijosh çelësa API për këtë subjekt' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Emri i çelësit është i detyrueshëm' using errcode = '22023';
  end if;
  v_key := 'tba_' || encode(gen_random_bytes(24), 'hex');  -- 52 karaktere
  insert into public.company_api_keys (company_id, name, key_prefix, key_hash, created_by)
  values (p_company_id, btrim(p_name), left(v_key, 12), encode(digest(v_key, 'sha256'), 'hex'), auth.uid())
  returning company_api_keys.id into v_id;
  return query select v_id, v_key, left(v_key, 12);
end $$;

create or replace function public.revoke_api_key(p_key_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  select company_id into v_company from public.company_api_keys where id = p_key_id;
  if v_company is null then
    raise exception 'Çelësi nuk u gjet' using errcode = 'P0002';
  end if;
  if not app.has_permission(v_company, 'companies', 'admin') then
    raise exception 'Nuk ke të drejtë' using errcode = '42501';
  end if;
  update public.company_api_keys set revoked_at = now() where id = p_key_id and revoked_at is null;
end $$;

revoke all on function public.create_api_key(uuid, text) from public, anon;
revoke all on function public.revoke_api_key(uuid) from public, anon;
grant execute on function public.create_api_key(uuid, text) to authenticated;
grant execute on function public.revoke_api_key(uuid) to authenticated;

-- Verifikimi i çelësit (vetëm service_role, nga API-ja e serverit)
create or replace function public.resolve_api_key(p_key text, p_scope text)
returns table (company_id uuid, key_id uuid)
language plpgsql security definer set search_path = public as $$
declare v_hash text := encode(digest(coalesce(p_key, ''), 'sha256'), 'hex');
begin
  return query
    update public.company_api_keys k
       set last_used_at = now()
     where k.key_hash = v_hash and k.revoked_at is null and p_scope = any (k.scopes)
    returning k.company_id, k.id;
end $$;
revoke all on function public.resolve_api_key(text, text) from public, anon, authenticated;
grant execute on function public.resolve_api_key(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Ndihmës: metoda e pagesës CIS -> enum-i ynë
-- ---------------------------------------------------------------------------
create or replace function app.cis_payment_method(p_type text)
returns public.payment_method language sql immutable as $$
  select case upper(coalesce(p_type, ''))
    when 'BANKNOTE'     then 'cash'
    when 'CARD'         then 'card'
    when 'ACCOUNT'      then 'bank'
    when 'TRANSFER'     then 'bank'
    when 'ORDER'        then 'bank'
    when 'COMPENSATION' then 'compensation'
    when ''             then 'unknown'
    else 'other'
  end::public.payment_method;
$$;

-- ---------------------------------------------------------------------------
-- import_cis_invoices · upsert i faturave nga CIS për një subjekt
--   p_invoices: jsonb array me objektet e CIS (Inv) siç i kthen cis-client
--   Kthen: {batch_id, imported, updated, skipped, errors:[{fic, message}]}
--   Vetëm service_role (API-ja e serverit pasi verifikon çelësin).
-- ---------------------------------------------------------------------------
create or replace function public.import_cis_invoices(
  p_company_id uuid,
  p_direction  public.invoice_direction,
  p_invoices   jsonb,
  p_label      text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_batch     uuid;
  v_inv       jsonb;
  v_party     jsonb;
  v_pay       jsonb;
  v_fic       text;
  v_total     numeric(18,2);
  v_vat       numeric(18,2);
  v_sub       numeric(18,2);
  v_breakdown jsonb;
  v_type      public.invoice_type;
  v_method    public.payment_method;
  v_issue     date;
  v_existing  uuid;
  v_imported  int := 0;
  v_updated   int := 0;
  v_skipped   int := 0;
  v_errors    jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_invoices) <> 'array' then
    raise exception 'p_invoices duhet të jetë një array' using errcode = '22023';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id and deleted_at is null) then
    raise exception 'Subjekti nuk u gjet' using errcode = 'P0002';
  end if;

  insert into public.import_batches (company_id, direction, format, file_name, rows_total, status)
  values (p_company_id, p_direction, 'json', coalesce(p_label, 'CIS ' || p_direction::text), jsonb_array_length(p_invoices), 'importing')
  returning id into v_batch;

  for v_inv in select * from jsonb_array_elements(p_invoices) loop
    begin
      v_fic := nullif(btrim(v_inv ->> 'FIC'), '');
      if v_fic is null then
        v_skipped := v_skipped + 1;
        v_errors := v_errors || jsonb_build_object('fic', null, 'message', 'Fatura pa FIC');
        continue;
      end if;

      v_total := (v_inv ->> 'TotPrice')::numeric;
      v_vat   := coalesce((v_inv ->> 'TotVATAmt')::numeric, 0);
      v_sub   := coalesce((v_inv ->> 'TotPriceWoVAT')::numeric, v_total - v_vat);
      -- garanton kontrollin total = subtotal + vat edhe me rrumbullakime të CIS
      v_sub   := v_total - v_vat;
      v_issue := ((v_inv ->> 'IssueDateTime')::timestamptz at time zone 'Europe/Tirane')::date;

      v_party := case when p_direction = 'sale' then v_inv -> 'Buyer' else v_inv -> 'Seller' end;
      v_pay   := case when jsonb_typeof(v_inv -> 'PayMethods') = 'array' then v_inv -> 'PayMethods' -> 0 else null end;
      v_method := app.cis_payment_method(v_pay ->> 'Type');

      v_type := case
        when v_inv -> 'CorrectiveInv' is not null then 'corrective'::public.invoice_type
        when v_inv -> 'SumInvIICRefs' is not null then 'summary'::public.invoice_type
        else 'normal'::public.invoice_type end;

      -- Ndarja sipas normave: SameTaxes kur vjen (fatura e plotë), ndryshe një rresht nga totalet
      if jsonb_typeof(v_inv -> 'SameTaxes') = 'array' and jsonb_array_length(v_inv -> 'SameTaxes') > 0 then
        select jsonb_agg(jsonb_build_object(
                 'rate', coalesce((t ->> 'VATRate')::numeric, 0),
                 'base', (t ->> 'PriceBefVAT')::numeric,
                 'vat',  coalesce((t ->> 'VATAmt')::numeric, 0)))
          into v_breakdown
          from jsonb_array_elements(v_inv -> 'SameTaxes') t;
      else
        v_breakdown := jsonb_build_array(jsonb_build_object(
          'rate', case when v_sub = 0 or v_vat = 0 then 0 else round(v_vat / v_sub * 100) end,
          'base', v_sub, 'vat', v_vat));
      end if;

      select id into v_existing from public.invoices
       where company_id = p_company_id and direction = p_direction and nivf = v_fic and deleted_at is null;

      if v_existing is null then
        insert into public.invoices (
          company_id, direction, type, number, nivf, nslf, eic, issue_date, due_date,
          counterparty_name, counterparty_nipt, currency, exchange_rate,
          subtotal, vat_amount, total, vat_breakdown,
          payment_status, payment_method, paid_amount, paid_at,
          tcr_code, business_unit_code, operator_code, is_einvoice,
          source, import_batch_id, raw, synced_at)
        values (
          p_company_id, p_direction, v_type,
          coalesce(nullif(v_inv ->> 'InvNum', ''), v_inv ->> 'InvOrdNum'),
          v_fic, nullif(v_inv ->> 'IIC', ''), nullif(v_inv ->> 'EIC', ''),
          v_issue, (v_inv ->> 'PayDeadline')::date,
          v_party ->> 'Name', nullif(v_party ->> 'IDNum', ''),
          coalesce(nullif(v_inv -> 'Currency' ->> 'Code', ''), 'ALL'),
          coalesce((v_inv -> 'Currency' ->> 'ExRate')::numeric, 1),
          v_sub, v_vat, v_total, v_breakdown,
          case when v_method in ('cash', 'card') then 'paid'::public.payment_status else 'unpaid'::public.payment_status end,
          v_method,
          case when v_method in ('cash', 'card') then abs(v_total) else 0 end,
          case when v_method in ('cash', 'card') then v_issue else null end,
          nullif(v_inv ->> 'TCRCode', ''), nullif(v_inv ->> 'BusinUnitCode', ''), nullif(v_inv ->> 'OperatorCode', ''),
          case lower(coalesce(v_inv ->> 'IsEinvoice', '')) when 'true' then true when 'false' then false else null end,
          'connector', v_batch, v_inv, now());
        v_imported := v_imported + 1;
      else
        -- Përditësim i të dhënave fiskale; statusi i pagesës i vendosur nga përdoruesi nuk preket.
        update public.invoices set
          type = v_type,
          number = coalesce(nullif(v_inv ->> 'InvNum', ''), v_inv ->> 'InvOrdNum', number),
          nslf = coalesce(nullif(v_inv ->> 'IIC', ''), nslf),
          eic = coalesce(nullif(v_inv ->> 'EIC', ''), eic),
          issue_date = v_issue,
          due_date = coalesce((v_inv ->> 'PayDeadline')::date, due_date),
          counterparty_name = coalesce(v_party ->> 'Name', counterparty_name),
          counterparty_nipt = coalesce(nullif(v_party ->> 'IDNum', ''), counterparty_nipt),
          subtotal = v_sub, vat_amount = v_vat, total = v_total,
          vat_breakdown = case when jsonb_typeof(v_inv -> 'SameTaxes') = 'array' then v_breakdown else vat_breakdown end,
          payment_method = case when payment_method = 'unknown' then v_method else payment_method end,
          tcr_code = coalesce(nullif(v_inv ->> 'TCRCode', ''), tcr_code),
          business_unit_code = coalesce(nullif(v_inv ->> 'BusinUnitCode', ''), business_unit_code),
          operator_code = coalesce(nullif(v_inv ->> 'OperatorCode', ''), operator_code),
          is_einvoice = coalesce(case lower(coalesce(v_inv ->> 'IsEinvoice', '')) when 'true' then true when 'false' then false end, is_einvoice),
          source = 'connector', import_batch_id = v_batch,
          raw = case when v_inv ? 'Items' or raw is null then v_inv else raw || v_inv end,
          synced_at = now()
        where id = v_existing;
        v_updated := v_updated + 1;
      end if;
    exception when others then
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_object('fic', v_fic, 'message', sqlerrm);
    end;
  end loop;

  update public.import_batches
     set rows_imported = v_imported + v_updated, rows_duplicate = 0, rows_error = v_skipped,
         status = case when v_skipped > 0 and v_imported + v_updated = 0 then 'failed'::public.import_status else 'done'::public.import_status end,
         errors = v_errors, finished_at = now()
   where id = v_batch;

  -- Integrimi "selfcare" (të dhënat e DPT-së) bëhet funksional me sinkronizimin e parë
  update public.integrations
     set status = 'functional', last_sync_at = now(), last_error = null,
         config = config || jsonb_build_object('method', 'cis_data_service', 'agent', 'tufa-sync')
   where company_id = p_company_id and provider = 'selfcare';

  return jsonb_build_object(
    'batch_id', v_batch, 'imported', v_imported, 'updated', v_updated,
    'skipped', v_skipped, 'errors', v_errors);
end $$;

revoke all on function public.import_cis_invoices(uuid, public.invoice_direction, jsonb, text) from public, anon, authenticated;
grant execute on function public.import_cis_invoices(uuid, public.invoice_direction, jsonb, text) to service_role;

-- Përmbledhja e sinkronizimit për UI (lexohet me RLS normale)
create or replace function public.invoice_sync_status(p_company_id uuid)
returns table (last_sync_at timestamptz, status public.integration_status, sales_count bigint, purchases_count bigint, last_batch jsonb)
language sql stable security invoker set search_path = public as $$
  select i.last_sync_at, i.status,
         (select count(*) from public.invoices v where v.company_id = p_company_id and v.direction = 'sale' and v.source = 'connector' and v.deleted_at is null),
         (select count(*) from public.invoices v where v.company_id = p_company_id and v.direction = 'purchase' and v.source = 'connector' and v.deleted_at is null),
         (select to_jsonb(b) from public.import_batches b where b.company_id = p_company_id and b.format = 'json' order by b.created_at desc limit 1)
  from public.integrations i
  where i.company_id = p_company_id and i.provider = 'selfcare';
$$;
grant execute on function public.invoice_sync_status(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Pikat hyrëse për agjentin (pa service_role në app-in web):
-- çelësi API ËSHTË autorizimi; verifikohet me hash brenda funksionit.
-- Thirren me çelësin publik (anon). Çelës 192-bit → brute force i pamundur.
-- ---------------------------------------------------------------------------
create or replace function public.sync_check_key(p_key text)
returns table (company_id uuid, nipt text, legal_name text)
language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  if coalesce(p_key, '') !~ '^tba_[0-9a-f]{48}$' then return; end if;
  select r.company_id into v_company from public.resolve_api_key(p_key, 'sync:invoices') r;
  if v_company is null then return; end if;
  return query select c.id, c.nipt::text, c.legal_name from public.companies c where c.id = v_company and c.deleted_at is null;
end $$;

create or replace function public.sync_cis_invoices(
  p_key text, p_direction public.invoice_direction, p_invoices jsonb, p_label text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  if coalesce(p_key, '') !~ '^tba_[0-9a-f]{48}$' then
    raise exception 'Çelës API i pavlefshëm' using errcode = '28000';
  end if;
  select r.company_id into v_company from public.resolve_api_key(p_key, 'sync:invoices') r;
  if v_company is null then
    raise exception 'Çelës API i pavlefshëm ose i revokuar' using errcode = '28000';
  end if;
  if jsonb_typeof(p_invoices) <> 'array' or jsonb_array_length(p_invoices) > 2000 then
    raise exception 'invoices: array me maksimumi 2000 fatura' using errcode = '22023';
  end if;
  return jsonb_build_object('company_id', v_company)
         || public.import_cis_invoices(v_company, p_direction, p_invoices, p_label);
end $$;

revoke all on function public.sync_check_key(text) from public;
revoke all on function public.sync_cis_invoices(text, public.invoice_direction, jsonb, text) from public;
grant execute on function public.sync_check_key(text) to anon, authenticated, service_role;
grant execute on function public.sync_cis_invoices(text, public.invoice_direction, jsonb, text) to anon, authenticated, service_role;
