-- ===========================================================================
-- 0020 · Gjendja e klientëve / furnitorëve (security invoker → RLS aktive)
--   party_balances(company, 'sale'|'purchase', as_of)
--     një rresht për çdo palë me fatura: faturuar, paguar, mbetja, fatura e fundit,
--     fatura më e vjetër e papaguar, ditë vonesë (nga due_date ose issue_date).
--   Faturat pa palë të lidhur (pa NIPT) grupohen sipas emrit me party_id = null.
-- ===========================================================================
create or replace function public.party_balances(
  p_company_id uuid, p_direction public.invoice_direction, p_as_of date default current_date)
returns table (
  party_id uuid, name text, nipt text, invoices bigint,
  invoiced numeric, paid numeric, outstanding numeric,
  last_invoice date, oldest_unpaid date, days_overdue integer)
language sql stable security invoker set search_path = public as $$
  with inv as (
    select coalesce(i.customer_id, i.supplier_id) as pid,
           i.counterparty_name, i.counterparty_nipt, i.issue_date, i.due_date,
           i.total, least(i.paid_amount, abs(i.total)) * sign(i.total) as paid, i.payment_status
      from public.invoices i
     where i.company_id = p_company_id and i.direction = p_direction
       and i.deleted_at is null and i.type <> 'cancelled' and i.issue_date <= p_as_of
  )
  select inv.pid,
         coalesce(max(c.name), max(s.name), max(inv.counterparty_name), '—'),
         coalesce(max(c.nipt), max(s.nipt), max(inv.counterparty_nipt)),
         count(*),
         sum(inv.total), sum(inv.paid), sum(inv.total) - sum(inv.paid),
         max(inv.issue_date),
         min(coalesce(inv.due_date, inv.issue_date)) filter (where inv.payment_status in ('unpaid', 'partial') and inv.total > 0),
         greatest(0, p_as_of - min(coalesce(inv.due_date, inv.issue_date)) filter (where inv.payment_status in ('unpaid', 'partial') and inv.total > 0))
    from inv
    left join public.customers c on p_direction = 'sale' and c.id = inv.pid
    left join public.suppliers s on p_direction = 'purchase' and s.id = inv.pid
   group by inv.pid, case when inv.pid is null then inv.counterparty_name end
   order by 7 desc, 2;
$$;

revoke all on function public.party_balances(uuid, public.invoice_direction, date) from public, anon;
grant execute on function public.party_balances(uuid, public.invoice_direction, date) to authenticated;
