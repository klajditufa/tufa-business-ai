-- 0008 · Funksionet agregate (NUMERIC, SECURITY INVOKER → RLS e tabelave zbatohet)
-- Dashboard-i, raportet dhe (në Fazën 3) AI Advisor thërrasin VETËM këto.
-- Çdo funksion kthen edhe periudhën dhe burimin, që shifra të jetë e gjurmueshme.

-- ---------------------------------------------------------------------------
-- company_turnover · xhiro (shitje), blerje, TVSH shitje/blerje, fitim bruto i përafërt
-- ---------------------------------------------------------------------------
create or replace function public.company_turnover(p_company_id uuid, p_from date, p_to date)
returns table (
  sales_net numeric, sales_vat numeric, sales_total numeric, sales_count bigint,
  purchases_net numeric, purchases_vat numeric, purchases_total numeric, purchases_count bigint,
  vat_balance numeric, gross_margin numeric,
  period_from date, period_to date, source text
) language sql stable security invoker set search_path = public as $$
  with s as (
    select coalesce(sum(case when type = 'cancelled' then 0 else subtotal end), 0) as net,
           coalesce(sum(case when type = 'cancelled' then 0 else vat_amount end), 0) as vat,
           coalesce(sum(case when type = 'cancelled' then 0 else total end), 0) as tot,
           count(*) filter (where type <> 'cancelled') as cnt
    from public.invoices
    where company_id = p_company_id and direction = 'sale' and deleted_at is null
      and issue_date between p_from and p_to
  ), p as (
    select coalesce(sum(case when type = 'cancelled' then 0 else subtotal end), 0) as net,
           coalesce(sum(case when type = 'cancelled' then 0 else vat_amount end), 0) as vat,
           coalesce(sum(case when type = 'cancelled' then 0 else total end), 0) as tot,
           count(*) filter (where type <> 'cancelled') as cnt
    from public.invoices
    where company_id = p_company_id and direction = 'purchase' and deleted_at is null
      and issue_date between p_from and p_to
  )
  select s.net, s.vat, s.tot, s.cnt, p.net, p.vat, p.tot, p.cnt,
         s.vat - p.vat, s.net - p.net, p_from, p_to, 'invoices'
  from s, p;
$$;

-- ---------------------------------------------------------------------------
-- monthly_series · 12 muaj për grafikun (shitje, blerje) — vlera në monedhën bazë (ALL)
-- ---------------------------------------------------------------------------
create or replace function public.monthly_series(p_company_id uuid, p_months integer default 12)
returns table (month date, sales_net numeric, purchases_net numeric, sales_vat numeric, purchases_vat numeric)
language sql stable security invoker set search_path = public as $$
  with months as (
    select (date_trunc('month', current_date) - (n || ' months')::interval)::date as m
    from generate_series(0, greatest(p_months, 1) - 1) as n
  )
  select m.m,
         coalesce(sum(case when i.direction = 'sale' then i.subtotal * i.exchange_rate end), 0),
         coalesce(sum(case when i.direction = 'purchase' then i.subtotal * i.exchange_rate end), 0),
         coalesce(sum(case when i.direction = 'sale' then i.vat_amount * i.exchange_rate end), 0),
         coalesce(sum(case when i.direction = 'purchase' then i.vat_amount * i.exchange_rate end), 0)
  from months m
  left join public.invoices i
    on i.company_id = p_company_id and i.deleted_at is null and i.type <> 'cancelled'
   and date_trunc('month', i.issue_date)::date = m.m
  group by m.m
  order by m.m;
$$;

-- ---------------------------------------------------------------------------
-- vat_summary · përmbledhja e TVSH-së për një periudhë sipas normave (bazë + TVSH)
-- ---------------------------------------------------------------------------
create or replace function public.vat_summary(p_company_id uuid, p_period_id uuid)
returns table (direction public.invoice_direction, vat_rate numeric, base_amount numeric, vat_amount numeric, invoice_count bigint)
language sql stable security invoker set search_path = public as $$
  select i.direction,
         coalesce((b ->> 'rate')::numeric, case when i.vat_amount = 0 then 0 else round(i.vat_amount / nullif(i.subtotal, 0) * 100) end) as vat_rate,
         sum(coalesce((b ->> 'base')::numeric, i.subtotal)) as base_amount,
         sum(coalesce((b ->> 'vat')::numeric, i.vat_amount)) as vat_amount,
         count(distinct i.id)
  from public.invoices i
  left join lateral jsonb_array_elements(case when jsonb_typeof(i.vat_breakdown) = 'array' and jsonb_array_length(i.vat_breakdown) > 0 then i.vat_breakdown else null end) as b on true
  where i.company_id = p_company_id and i.period_id = p_period_id and i.deleted_at is null and i.type <> 'cancelled'
  group by 1, 2
  order by 1, 2 desc;
$$;

-- ---------------------------------------------------------------------------
-- outstanding_obligations · detyrimet e papaguara (zyrtare dhe orientuese, të ndara)
-- ---------------------------------------------------------------------------
create or replace function public.outstanding_obligations(p_company_id uuid)
returns table (kind public.obligation_kind, confirmed_official boolean, amount_due numeric, next_due_date date, items bigint)
language sql stable security invoker set search_path = public as $$
  select kind, confirmed_official, sum(amount - paid_amount), min(due_date), count(*)
  from public.tax_obligations
  where company_id = p_company_id and paid_amount < amount
  group by kind, confirmed_official
  order by min(due_date);
$$;

-- ---------------------------------------------------------------------------
-- top_debtors · klientët me fatura të papaguara
-- ---------------------------------------------------------------------------
create or replace function public.top_debtors(p_company_id uuid, p_limit integer default 10)
returns table (customer_id uuid, customer_name text, outstanding numeric, invoices bigint, oldest_due date)
language sql stable security invoker set search_path = public as $$
  select i.customer_id, coalesce(c.name, i.counterparty_name, '—'),
         sum(i.total - i.paid_amount), count(*), min(coalesce(i.due_date, i.issue_date))
  from public.invoices i
  left join public.customers c on c.id = i.customer_id
  where i.company_id = p_company_id and i.direction = 'sale' and i.deleted_at is null
    and i.type <> 'cancelled' and i.payment_status in ('unpaid', 'partial')
  group by i.customer_id, coalesce(c.name, i.counterparty_name, '—')
  order by 3 desc
  limit greatest(p_limit, 1);
$$;

-- ---------------------------------------------------------------------------
-- top_creditors · furnitorët që u detyrohemi
-- ---------------------------------------------------------------------------
create or replace function public.top_creditors(p_company_id uuid, p_limit integer default 10)
returns table (supplier_id uuid, supplier_name text, outstanding numeric, invoices bigint, oldest_due date)
language sql stable security invoker set search_path = public as $$
  select i.supplier_id, coalesce(s.name, i.counterparty_name, '—'),
         sum(i.total - i.paid_amount), count(*), min(coalesce(i.due_date, i.issue_date))
  from public.invoices i
  left join public.suppliers s on s.id = i.supplier_id
  where i.company_id = p_company_id and i.direction = 'purchase' and i.deleted_at is null
    and i.type <> 'cancelled' and i.payment_status in ('unpaid', 'partial')
  group by i.supplier_id, coalesce(s.name, i.counterparty_name, '—')
  order by 3 desc
  limit greatest(p_limit, 1);
$$;

-- ---------------------------------------------------------------------------
-- upcoming_deadlines · afatet e radhës (deklarime + kalendar) për dashboard
-- ---------------------------------------------------------------------------
create or replace function public.upcoming_deadlines(p_company_id uuid, p_days integer default 30)
returns table (kind public.declaration_kind, title text, due_date date, days_left integer, status text, source text)
language sql stable security invoker set search_path = public as $$
  select d.kind, d.kind::text, d.due_date, (d.due_date - current_date)::integer, d.effective_status::text, 'declaration'
  from public.tax_declarations_view d
  where d.company_id = p_company_id and d.status <> 'declared'
    and d.due_date <= current_date + p_days
  union all
  select c.kind, c.title, c.due_date, (c.due_date - current_date)::integer, 'calendar', 'calendar'
  from public.tax_calendar_items c
  where (c.company_id = p_company_id or c.company_id is null)
    and c.due_date between current_date and current_date + p_days
  order by 3;
$$;

grant execute on function public.company_turnover(uuid, date, date) to authenticated;
grant execute on function public.monthly_series(uuid, integer) to authenticated;
grant execute on function public.vat_summary(uuid, uuid) to authenticated;
grant execute on function public.outstanding_obligations(uuid) to authenticated;
grant execute on function public.top_debtors(uuid, integer) to authenticated;
grant execute on function public.top_creditors(uuid, integer) to authenticated;
grant execute on function public.upcoming_deadlines(uuid, integer) to authenticated;
