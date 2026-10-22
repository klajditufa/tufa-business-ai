-- ===========================================================================
-- 0022 · Raporti vjetor (security invoker → RLS aktive)
--   annual_report(company, year) → jsonb:
--     months[12]  {month, s_count, s_net, s_vat, s_total, p_count, p_net, p_vat, p_total}
--     totals      të njëjtat fusha për vitin
--     top_customers / top_suppliers (10, sipas vlerës pa TVSH)
--     thresholds  pragjet nga tax_rules (TVSH, biznes i vogël) me burimin dhe "confirmed"
--   Shumat në monedhën bazë (subtotal × exchange_rate). Faturat e anuluara përjashtohen.
-- ===========================================================================
create or replace function public.annual_report(p_company_id uuid, p_year integer)
returns jsonb language sql stable security invoker set search_path = public as $$
  with inv as (
    select i.direction, date_trunc('month', i.issue_date)::date m,
           i.subtotal * i.exchange_rate net, i.vat_amount * i.exchange_rate vat, i.total * i.exchange_rate tot,
           coalesce(i.customer_id, i.supplier_id) pid, i.counterparty_name, i.counterparty_nipt
      from public.invoices i
     where i.company_id = p_company_id and i.deleted_at is null and i.type <> 'cancelled'
       and i.issue_date >= make_date(p_year, 1, 1) and i.issue_date < make_date(p_year + 1, 1, 1)
  ),
  months as (
    select gs::date m from generate_series(make_date(p_year, 1, 1), make_date(p_year, 12, 1), interval '1 month') gs
  ),
  per_month as (
    select mo.m,
           count(inv.*) filter (where direction = 'sale') s_count,
           coalesce(sum(net) filter (where direction = 'sale'), 0) s_net,
           coalesce(sum(vat) filter (where direction = 'sale'), 0) s_vat,
           coalesce(sum(tot) filter (where direction = 'sale'), 0) s_total,
           count(inv.*) filter (where direction = 'purchase') p_count,
           coalesce(sum(net) filter (where direction = 'purchase'), 0) p_net,
           coalesce(sum(vat) filter (where direction = 'purchase'), 0) p_vat,
           coalesce(sum(tot) filter (where direction = 'purchase'), 0) p_total
      from months mo left join inv on inv.m = mo.m
     group by mo.m
  ),
  tops as (
    select direction, coalesce(max(counterparty_name), '—') name, max(counterparty_nipt) nipt, pid,
           count(*) n, sum(net) net, sum(tot) tot,
           row_number() over (partition by direction order by sum(net) desc) rn
      from inv
     group by direction, pid, case when pid is null then counterparty_name end
  ),
  rule as (
    select r.kind, r.code, r.params, r.source, r.confirmed, r.valid_from, r.valid_to, r.company_id
      from public.tax_rules r
     where (r.kind, r.code) in (('vat_exempt'::public.tax_rule_kind, 'threshold'), ('simplified_tax'::public.tax_rule_kind, 'small'))
       and r.valid_from <= make_date(p_year, 12, 31) and (r.valid_to is null or r.valid_to >= make_date(p_year, 1, 1))
       and (r.company_id is null or r.company_id = p_company_id)
  )
  select jsonb_build_object(
    'year', p_year,
    'months', (select jsonb_agg(to_jsonb(pm) order by pm.m) from per_month pm),
    'totals', (select jsonb_build_object(
                 's_count', sum(s_count), 's_net', sum(s_net), 's_vat', sum(s_vat), 's_total', sum(s_total),
                 'p_count', sum(p_count), 'p_net', sum(p_net), 'p_vat', sum(p_vat), 'p_total', sum(p_total))
               from per_month),
    'top_customers', coalesce((select jsonb_agg(jsonb_build_object('party_id', pid, 'name', name, 'nipt', nipt, 'invoices', n, 'net', net, 'total', tot) order by rn)
                                 from tops where direction = 'sale' and rn <= 10), '[]'::jsonb),
    'top_suppliers', coalesce((select jsonb_agg(jsonb_build_object('party_id', pid, 'name', name, 'nipt', nipt, 'invoices', n, 'net', net, 'total', tot) order by rn)
                                 from tops where direction = 'purchase' and rn <= 10), '[]'::jsonb),
    'thresholds', coalesce((select jsonb_agg(jsonb_build_object(
                                  'kind', kind, 'code', code,
                                  'amount', coalesce((params ->> 'annual_turnover')::numeric, (params ->> 'turnover_max')::numeric),
                                  'label', params ->> 'label', 'source', source, 'confirmed', confirmed)
                                order by kind)
                              from (select distinct on (kind, code) * from rule order by kind, code, (company_id is not null) desc, valid_from desc) x), '[]'::jsonb)
  );
$$;

revoke all on function public.annual_report(uuid, integer) from public, anon;
grant execute on function public.annual_report(uuid, integer) to authenticated;
