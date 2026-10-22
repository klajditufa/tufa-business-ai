-- ===========================================================================
-- 0017 · Pozicioni mujor i TVSH-së: TVSH e shitjeve − TVSH e blerjeve − kredi e mbartur
--
-- vat_position(...)  · llogaritje orientuese nga faturat (RLS aktive, security invoker).
--   Kredia e mbartur nga muaji i kaluar merret nga vlera ZYRTARE (C@TS) kur kontabilisti
--   e ka regjistruar (tax_declarations.official->>'credit_cf'); përndryshe llogaritet
--   në zinxhir nga muaji i parë me fatura (maksimumi 36 muaj prapa).
-- set_vat_official(...) · regjistron vlerat e deklaruara në C@TS për muajin + ruan
--   pamjen e llogaritjes së sistemit (computed) për krahasim.
-- Asnjë rregull ligjor (rimbursim, afate) nuk ngulitet këtu.
-- ===========================================================================

create or replace function public.vat_position(p_company_id uuid, p_year integer, p_month integer)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_target   date := make_date(p_year, p_month, 1);
  v_start    date;
  v_m        date;
  v_out      numeric(18,2);
  v_in       numeric(18,2);
  v_sbase    numeric(18,2);
  v_pbase    numeric(18,2);
  v_scount   bigint;
  v_pcount   bigint;
  v_bf       numeric(18,2) := 0;
  v_bf_src   text := 'none';
  v_cf       numeric(18,2) := 0;
  v_official jsonb;
  v_prev_off jsonb;
  v_net      numeric(18,2);
begin
  if p_month not between 1 and 12 then
    raise exception 'muaj i pavlefshëm' using errcode = '22023';
  end if;

  select least(coalesce(date_trunc('month', min(issue_date))::date, v_target), v_target)
    into v_start
    from public.invoices
   where company_id = p_company_id and deleted_at is null;
  v_start := greatest(v_start, (v_target - interval '36 months')::date);

  v_m := v_start;
  loop
    -- Kredia e mbartur në hyrje të muajit v_m: zyrtare nga muaji i kaluar nëse ekziston
    select d.official into v_prev_off
      from public.tax_declarations d
      join public.fiscal_periods fp on fp.id = d.period_id
     where d.company_id = p_company_id and d.kind = 'vat'
       and fp.year = extract(year from (v_m - interval '1 month')) and fp.month = extract(month from (v_m - interval '1 month'));
    if v_prev_off ? 'credit_cf' then
      v_bf := coalesce((v_prev_off ->> 'credit_cf')::numeric, 0);
      v_bf_src := 'official';
    else
      v_bf := v_cf;
      v_bf_src := case when v_m = v_start then 'none' else 'computed' end;
    end if;

    select coalesce(sum(vat_amount) filter (where direction = 'sale'), 0),
           coalesce(sum(vat_amount) filter (where direction = 'purchase'), 0),
           coalesce(sum(subtotal)   filter (where direction = 'sale'), 0),
           coalesce(sum(subtotal)   filter (where direction = 'purchase'), 0),
           count(*) filter (where direction = 'sale'),
           count(*) filter (where direction = 'purchase')
      into v_out, v_in, v_sbase, v_pbase, v_scount, v_pcount
      from public.invoices
     where company_id = p_company_id and deleted_at is null and type <> 'cancelled'
       and issue_date >= v_m and issue_date < (v_m + interval '1 month')::date;

    v_net := v_out - v_in - v_bf;
    v_cf  := greatest(-v_net, 0);
    exit when v_m >= v_target;
    v_m := (v_m + interval '1 month')::date;
  end loop;

  select d.official into v_official
    from public.tax_declarations d
    join public.fiscal_periods fp on fp.id = d.period_id
   where d.company_id = p_company_id and d.kind = 'vat' and fp.year = p_year and fp.month = p_month;

  return jsonb_build_object(
    'year', p_year, 'month', p_month,
    'output_vat', v_out, 'input_vat', v_in,
    'sales_base', v_sbase, 'purchases_base', v_pbase,
    'sales_count', v_scount, 'purchases_count', v_pcount,
    'credit_bf', v_bf, 'credit_bf_source', v_bf_src,
    'payable', greatest(v_net, 0), 'credit_cf', v_cf,
    'computed_since', to_char(v_start, 'YYYY-MM'),
    'official', coalesce(v_official, '{}'::jsonb));
end $$;

revoke all on function public.vat_position(uuid, integer, integer) from public, anon;
grant execute on function public.vat_position(uuid, integer, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- set_vat_official · vlerat zyrtare nga C@TS (të gjitha opsionale, numerike >= 0)
--   p_values: {output_vat, input_vat, payable, credit_cf, note}
--   Bosh {} → fshin vlerat zyrtare të muajit.
-- ---------------------------------------------------------------------------
create or replace function public.set_vat_official(p_company_id uuid, p_year integer, p_month integer, p_values jsonb)
returns public.tax_declarations language plpgsql security definer set search_path = public as $$
declare
  v_period uuid;
  v_row    public.tax_declarations;
  v_clean  jsonb := '{}'::jsonb;
  k        text;
  v        numeric;
begin
  if not app.has_permission(p_company_id, 'declarations', 'write') then
    raise exception 'Nuk ke të drejtë të regjistrosh vlerat zyrtare të TVSH-së' using errcode = '42501';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id and vat_registered) then
    raise exception 'Subjekti nuk është i regjistruar në TVSH' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_values, '{}'::jsonb)) <> 'object' then
    raise exception 'p_values duhet të jetë objekt' using errcode = '22023';
  end if;

  foreach k in array array['output_vat', 'input_vat', 'payable', 'credit_cf'] loop
    if p_values ? k and nullif(p_values ->> k, '') is not null then
      begin
        v := (p_values ->> k)::numeric;
      exception when others then
        raise exception 'Vlerë jo numerike për %', k using errcode = '22023';
      end;
      if v < 0 then raise exception '% nuk mund të jetë negative', k using errcode = '22023'; end if;
      v_clean := v_clean || jsonb_build_object(k, round(v, 2));
    end if;
  end loop;
  if nullif(btrim(p_values ->> 'note'), '') is not null then
    v_clean := v_clean || jsonb_build_object('note', left(btrim(p_values ->> 'note'), 500));
  end if;
  if v_clean <> '{}'::jsonb then
    v_clean := v_clean || jsonb_build_object('recorded_by', auth.uid(), 'recorded_at', now());
  end if;

  perform public.ensure_declarations(p_company_id, p_year, p_month);
  v_period := app.period_for_date(p_company_id, make_date(p_year, p_month, 1));

  update public.tax_declarations
     set official = v_clean,
         computed = public.vat_position(p_company_id, p_year, p_month) - 'official'
   where company_id = p_company_id and period_id = v_period and kind = 'vat'
   returning * into v_row;
  if v_row.id is null then
    raise exception 'Deklarimi i TVSH-së për këtë muaj nuk u gjet' using errcode = 'P0002';
  end if;
  return v_row;
end $$;

revoke all on function public.set_vat_official(uuid, integer, integer, jsonb) from public, anon;
grant execute on function public.set_vat_official(uuid, integer, integer, jsonb) to authenticated;
