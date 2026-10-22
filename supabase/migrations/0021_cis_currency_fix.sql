-- ===========================================================================
-- 0021 · Fix monedhe për faturat nga CIS
-- CIS i jep TotPrice / TotVATAmt NË LEKË edhe kur fatura është në valutë
-- (p.sh. 374.120 ALL = 4.000 EUR × 93,53). Importi i ruante si currency=EUR me
-- kursin → shfaqje "€" dhe grafiku (subtotal × kurs) i fryrë ~94 herë.
-- Tani: currency = ALL, exchange_rate = 1; monedha/kursi origjinal në kolona më vete.
-- ===========================================================================
alter table public.invoices
  add column if not exists original_currency      char(3),
  add column if not exists original_exchange_rate numeric(12,6);

comment on column public.invoices.original_currency is 'Monedha e faturës kur ndryshon nga ALL (shumat e rreshtit janë në currency)';

-- Korrigjimi i të dhënave ekzistuese të importuara nga CIS
update public.invoices
   set original_currency = currency,
       original_exchange_rate = exchange_rate,
       currency = 'ALL',
       exchange_rate = 1
 where source = 'connector' and currency <> 'ALL';

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
          original_currency, original_exchange_rate,
          source, import_batch_id, raw, synced_at)
        values (
          p_company_id, p_direction, v_type,
          coalesce(nullif(v_inv ->> 'InvNum', ''), v_inv ->> 'InvOrdNum'),
          v_fic, nullif(v_inv ->> 'IIC', ''), nullif(v_inv ->> 'EIC', ''),
          v_issue, (v_inv ->> 'PayDeadline')::date,
          v_party ->> 'Name', nullif(v_party ->> 'IDNum', ''),
          'ALL', 1,  -- CIS i jep shumat në lekë; monedha origjinale ruhet më poshtë
          v_sub, v_vat, v_total, v_breakdown,
          case when v_method in ('cash', 'card') then 'paid'::public.payment_status else 'unpaid'::public.payment_status end,
          v_method,
          case when v_method in ('cash', 'card') then abs(v_total) else 0 end,
          case when v_method in ('cash', 'card') then v_issue else null end,
          nullif(v_inv ->> 'TCRCode', ''), nullif(v_inv ->> 'BusinUnitCode', ''), nullif(v_inv ->> 'OperatorCode', ''),
          case lower(coalesce(v_inv ->> 'IsEinvoice', '')) when 'true' then true when 'false' then false else null end,
          nullif(nullif(v_inv -> 'Currency' ->> 'Code', ''), 'ALL'),
          case when nullif(nullif(v_inv -> 'Currency' ->> 'Code', ''), 'ALL') is not null then (v_inv -> 'Currency' ->> 'ExRate')::numeric end,
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
          currency = 'ALL', exchange_rate = 1,
          original_currency = nullif(nullif(v_inv -> 'Currency' ->> 'Code', ''), 'ALL'),
          original_exchange_rate = case when nullif(nullif(v_inv -> 'Currency' ->> 'Code', ''), 'ALL') is not null then (v_inv -> 'Currency' ->> 'ExRate')::numeric end,
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
