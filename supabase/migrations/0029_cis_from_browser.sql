-- 0029 · Faturat nga CIS direkt nga TUFA (pa agjentin TUFA Sync)
--
-- Shfletuesi i përdoruesit nënshkruan kërkesat me certifikatën (çelës i pa-eksportueshëm që nuk
-- largohet nga kompjuteri), TUFA i përcjell te CIS dhe shfletuesi importon përgjigjen me sesionin e
-- përdoruesit. Këto funksione janë rruga e importit për përdoruesit e kyçur:
--   * kontrollojnë të drejtën invoices.write për subjektin;
--   * pranojnë vetëm fatura ku NIPT-i i subjektit është shitësi ose blerësi (të tjerat anashkalohen);
--   * logjika e importit mbetet ajo e import_cis_invoices (service_role), e pandryshuar.

create or replace function public.import_cis_invoices_user(
  p_company_id uuid,
  p_direction  public.invoice_direction,
  p_invoices   jsonb,
  p_label      text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_nipt text; v_own jsonb; v_foreign int;
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
  return public.import_cis_invoices(p_company_id, p_direction, v_own, p_label)
         || jsonb_build_object('foreign_skipped', v_foreign);
end $$;

revoke all on function public.import_cis_invoices_user(uuid, public.invoice_direction, jsonb, text) from public, anon;
grant execute on function public.import_cis_invoices_user(uuid, public.invoice_direction, jsonb, text) to authenticated, service_role;

-- Regjistrat (operatorët, njësitë, pajisjet) nga shfletuesi, me të drejtën invoices.write.
create or replace function public.set_company_registry(p_company_id uuid, p_kind text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_clean jsonb;
begin
  if not app.has_permission(p_company_id, 'invoices', 'write') then
    raise exception 'Nuk ke të drejtë për regjistrat e këtij subjekti' using errcode = '42501';
  end if;
  if p_kind not in ('operators', 'units', 'tcrs') then
    raise exception 'Lloj regjistri i panjohur: %', p_kind using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'rows: array me maksimumi 5000 rreshta' using errcode = '22023';
  end if;
  v_clean := app.registry_clean(p_kind, p_rows);
  insert into public.company_registry (company_id, kind, rows, synced_at)
  values (p_company_id, p_kind, v_clean, now())
  on conflict (company_id, kind) do update set rows = excluded.rows, synced_at = excluded.synced_at;
  return jsonb_build_object('kind', p_kind, 'rows', jsonb_array_length(v_clean));
end $$;

revoke all on function public.set_company_registry(uuid, text, jsonb) from public, anon;
grant execute on function public.set_company_registry(uuid, text, jsonb) to authenticated, service_role;
