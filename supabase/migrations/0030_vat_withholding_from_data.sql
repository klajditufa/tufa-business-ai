-- 0030 · Statusi i TVSH-së nga fiskalizimi dhe tatimi në burim vetëm kur subjekti e ka
--
--  * TVSH: çdo faturë shitjeje nga CIS mban IsIssuerInVAT (a është lëshuesi në TVSH në atë moment).
--    Pas çdo importi të shitjeve, statusi i subjektit merret nga fatura më e fundit; deklarimet e TVSH-së
--    të paprekura për muajt pasi subjekti ka dalë nga TVSH-ja hiqen. Burimi ruhet te settings.
--  * Tatimi në burim: CIS nuk e tregon dhe C@TS nuk lexohet nga serveri. Deklarimi mujor gjenerohet
--    vetëm për subjektet që e mbajnë (withholding_agent): aktivizohet vetë kur regjistrohet një qira me
--    tatim në burim, ose kur deklarimi është shënuar ndonjëherë si i dorëzuar; përndryshe nga Cilësimet.

alter table public.companies add column if not exists withholding_agent boolean not null default false;
comment on column public.companies.withholding_agent is 'Subjekti mban tatim në burim (qira, dividend, shërbime) → deklarimi mujor';

-- Deklarimet që i takojnë subjektit: TVSH vetëm në TVSH, tatimi në burim vetëm kur e mban.
create or replace function app.declaration_kinds_for(p_company_id uuid)
returns table (kind public.declaration_kind, due_day integer) language sql stable security definer set search_path = public as $$
  select k.kind, k.due_day
  from public.companies c
  cross join lateral (values
    ('vat'::public.declaration_kind, 14, c.vat_registered),
    ('payroll_esig25'::public.declaration_kind, 20, true),
    ('withholding'::public.declaration_kind, 20, c.withholding_agent)
  ) as k(kind, due_day, applies)
  where c.id = p_company_id and k.applies;
$$;

-- Deklarim "i paprekur": i gjeneruar automatikisht dhe askush s'ka punuar mbi të.
create or replace function app.declaration_untouched(d public.tax_declarations)
returns boolean language sql immutable as $$
  select d.status = 'pending' and d.declared_at is null and d.notes is null and d.source_document_id is null
     and d.official = '{}'::jsonb and d.assigned_to is null;
$$;

-- Statusi i TVSH-së nga shitjet e fundit në CIS (IsIssuerInVAT). Pa fatura shitjeje: i pandryshuar.
create or replace function app.vat_status_from_cis(p_company_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_latest text; v_latest_date date; v_last_in date; v_in boolean; v_prev boolean; v_removed int := 0;
begin
  select raw ->> 'IsIssuerInVAT', issue_date into v_latest, v_latest_date
    from public.invoices
   where company_id = p_company_id and direction = 'sale' and deleted_at is null and raw ? 'IsIssuerInVAT'
   order by issue_date desc, created_at desc
   limit 1;
  if v_latest is null then
    return jsonb_build_object('vat_status', 'unknown');
  end if;
  v_in := lower(v_latest) = 'true';
  select vat_registered into v_prev from public.companies where id = p_company_id;
  update public.companies
     set vat_registered = v_in,
         settings = settings || jsonb_build_object('vat_status_source', 'cis', 'vat_status_as_of', v_latest_date, 'vat_status_checked_at', now())
   where id = p_company_id
     and (vat_registered is distinct from v_in or settings ->> 'vat_status_as_of' is distinct from v_latest_date::text);
  if not v_in then
    select max(issue_date) into v_last_in from public.invoices
     where company_id = p_company_id and direction = 'sale' and deleted_at is null and raw ->> 'IsIssuerInVAT' = 'true';
    delete from public.tax_declarations d
     using public.fiscal_periods fp
     where fp.id = d.period_id and d.company_id = p_company_id and d.kind = 'vat' and app.declaration_untouched(d)
       and make_date(fp.year, fp.month, 1) > coalesce(date_trunc('month', v_last_in)::date, date '1900-01-01');
    get diagnostics v_removed = row_count;
  end if;
  return jsonb_build_object('vat_registered', v_in, 'vat_changed', v_in is distinct from v_prev, 'vat_as_of', v_latest_date,
                            'vat_declarations_removed', v_removed);
end $$;
revoke all on function app.vat_status_from_cis(uuid) from public, anon, authenticated;

-- Importi nga shfletuesi: pas shitjeve përditëson statusin e TVSH-së.
create or replace function public.import_cis_invoices_user(
  p_company_id uuid,
  p_direction  public.invoice_direction,
  p_invoices   jsonb,
  p_label      text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_nipt text; v_own jsonb; v_foreign int; v_result jsonb;
begin
  if not app.has_permission(p_company_id, 'invoices', 'write') then
    raise exception 'Nuk ke të drejtë të importosh fatura për këtë subjekt' using errcode = '42501';
  end if;
  if jsonb_typeof(p_invoices) <> 'array' or jsonb_array_length(p_invoices) > 2000 then
    raise exception 'invoices: array me maksimumi 2000 fatura' using errcode = '22023';
  end if;
  select upper(nipt::text) into v_nipt from public.companies where id = p_company_id and deleted_at is null;
  if v_nipt is null then
    raise exception 'Subjekti nuk u gjet' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(i), '[]'::jsonb) into v_own
    from jsonb_array_elements(p_invoices) i
   where upper(coalesce(i -> 'Seller' ->> 'IDNum', '')) = v_nipt
      or upper(coalesce(i -> 'Buyer' ->> 'IDNum', '')) = v_nipt;
  v_foreign := jsonb_array_length(p_invoices) - jsonb_array_length(v_own);
  v_result := public.import_cis_invoices(p_company_id, p_direction, v_own, p_label) || jsonb_build_object('foreign_skipped', v_foreign);
  if p_direction = 'sale' then
    v_result := v_result || app.vat_status_from_cis(p_company_id);
  end if;
  return v_result;
end $$;

-- Agjenti TUFA Sync: e njëjta gjë pas shitjeve.
create or replace function public.sync_cis_invoices(
  p_key text, p_direction public.invoice_direction, p_invoices jsonb, p_label text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_company uuid; v_result jsonb;
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
  v_result := jsonb_build_object('company_id', v_company) || public.import_cis_invoices(v_company, p_direction, p_invoices, p_label);
  if p_direction = 'sale' then
    v_result := v_result || app.vat_status_from_cis(v_company);
  end if;
  return v_result;
end $$;

-- Tatimi në burim: aktivizohet vetë me qiranë e parë me tatim në burim.
create or replace function app.rent_marks_withholding_agent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.companies set withholding_agent = true where id = new.company_id and not withholding_agent;
  return new;
end $$;
create trigger trg_rent_withholding_agent after insert on public.rent_withholdings
  for each row execute function app.rent_marks_withholding_agent();

-- Gjendja ekzistuese: mbajtës janë ata me qira ose me deklarim tatimi në burim të punuar.
update public.companies c set withholding_agent = true
 where exists (select 1 from public.rent_withholdings r where r.company_id = c.id)
    or exists (select 1 from public.tax_declarations d where d.company_id = c.id and d.kind = 'withholding' and not app.declaration_untouched(d));

delete from public.tax_declarations d
 using public.companies c
 where c.id = d.company_id and d.kind = 'withholding' and not c.withholding_agent and app.declaration_untouched(d);

-- Statusi i TVSH-së nga faturat që janë tashmë në TUFA.
select app.vat_status_from_cis(c.id) from public.companies c where c.deleted_at is null;
