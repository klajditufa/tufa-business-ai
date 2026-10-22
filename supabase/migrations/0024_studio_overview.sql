-- ===========================================================================
-- 0024 · Pasqyra e studios: një rresht për çdo subjekt të përdoruesit për një muaj
--   sinkronizimi CIS, shitje/blerje të muajit, TVSH (për pagesë / kredi dalëse),
--   arkëtime të papaguara (+ mbi 30 ditë), xhiro e vitit deri në fund të muajit kundrejt
--   pragjeve (nga tax_rules), deklarime të papërfunduara / me vonesë.
--   security invoker: RLS vlen për çdo lexim; vetëm subjektet ku përdoruesi ka akses.
-- ===========================================================================
create or replace function public.studio_overview(p_year integer, p_month integer)
returns table (
  company_id uuid, name text, nipt text, vat_registered boolean,
  last_sync_at timestamptz, sync_status text,
  sales_count bigint, sales_net numeric, purchases_net numeric,
  vat_payable numeric, vat_credit_cf numeric,
  receivables numeric, overdue_30 numeric,
  ytd_turnover numeric, vat_threshold numeric, small_threshold numeric,
  decl_open integer, decl_late integer)
language plpgsql stable security invoker set search_path = public as $$
declare
  c record;
  v_from date := make_date(p_year, p_month, 1);
  v_to   date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
  v_pos  jsonb;
begin
  if p_month not between 1 and 12 then raise exception 'muaj i pavlefshëm' using errcode = '22023'; end if;

  for c in
    select co.id, coalesce(co.trade_name, co.legal_name) as nm, co.nipt::text as np, co.vat_registered as vr
      from public.companies co
     where co.id in (select app.user_company_ids()) and co.deleted_at is null
     order by 2
  loop
    company_id := c.id; name := c.nm; nipt := c.np; vat_registered := c.vr;

    select i.last_sync_at, i.status::text into last_sync_at, sync_status
      from public.integrations i where i.company_id = c.id and i.provider = 'selfcare';

    select count(*) filter (where direction = 'sale'),
           coalesce(sum(subtotal * exchange_rate) filter (where direction = 'sale'), 0),
           coalesce(sum(subtotal * exchange_rate) filter (where direction = 'purchase'), 0)
      into sales_count, sales_net, purchases_net
      from public.invoices
     where invoices.company_id = c.id and deleted_at is null and type <> 'cancelled'
       and issue_date between v_from and v_to;

    if c.vr then
      v_pos := public.vat_position(c.id, p_year, p_month);
      vat_payable := (v_pos ->> 'payable')::numeric;
      vat_credit_cf := (v_pos ->> 'credit_cf')::numeric;
    else
      vat_payable := null; vat_credit_cf := null;
    end if;

    select coalesce(sum(total - least(paid_amount, total)), 0),
           coalesce(sum(total - least(paid_amount, total)) filter (where coalesce(due_date, issue_date) < current_date - 30), 0)
      into receivables, overdue_30
      from public.invoices
     where invoices.company_id = c.id and direction = 'sale' and deleted_at is null and type <> 'cancelled'
       and payment_status in ('unpaid', 'partial') and total > 0;

    select coalesce(sum(subtotal * exchange_rate), 0) into ytd_turnover
      from public.invoices
     where invoices.company_id = c.id and direction = 'sale' and deleted_at is null and type <> 'cancelled'
       and issue_date between make_date(p_year, 1, 1) and v_to;

    vat_threshold   := (public.effective_tax_rule('vat_exempt', v_to, 'threshold', c.id) ->> 'annual_turnover')::numeric;
    small_threshold := (public.effective_tax_rule('simplified_tax', v_to, 'small', c.id) ->> 'turnover_max')::numeric;

    select count(*) filter (where d.status <> 'declared'),
           count(*) filter (where d.effective_status = 'late')
      into decl_open, decl_late
      from public.tax_declarations_view d
     where d.company_id = c.id and d.year = p_year and d.month = p_month;

    return next;
  end loop;
end $$;

revoke all on function public.studio_overview(integer, integer) from public, anon;
grant execute on function public.studio_overview(integer, integer) to authenticated;
