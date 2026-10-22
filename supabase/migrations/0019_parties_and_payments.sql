-- ===========================================================================
-- 0019 · Palët nga faturat + pagesat
--   * Trigger: fatura me counterparty_nipt lidhet me klientin/furnitorin e kompanisë
--     me të njëjtin NIPT (krijohet nëse mungon). Vlen për importin CIS dhe manualin.
--   * Backfill për faturat ekzistuese.
--   * set_invoices_payment(...) · shënon një ose shumë fatura të paguara / të papaguara.
-- ===========================================================================

create or replace function app.invoices_link_party()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_nipt text;
begin
  v_nipt := nullif(upper(btrim(new.counterparty_nipt)), '');
  if v_nipt is null then return new; end if;

  if new.direction = 'sale' and new.customer_id is null then
    select id into v_id from public.customers
     where company_id = new.company_id and nipt = v_nipt and deleted_at is null;
    if v_id is null then
      insert into public.customers (company_id, nipt, name)
      values (new.company_id, v_nipt, coalesce(nullif(btrim(new.counterparty_name), ''), v_nipt))
      on conflict (company_id, nipt) where nipt is not null and deleted_at is null
      do update set updated_at = now()
      returning id into v_id;
    end if;
    new.customer_id := v_id;
  elsif new.direction = 'purchase' and new.supplier_id is null then
    select id into v_id from public.suppliers
     where company_id = new.company_id and nipt = v_nipt and deleted_at is null;
    if v_id is null then
      insert into public.suppliers (company_id, nipt, name)
      values (new.company_id, v_nipt, coalesce(nullif(btrim(new.counterparty_name), ''), v_nipt))
      on conflict (company_id, nipt) where nipt is not null and deleted_at is null
      do update set updated_at = now()
      returning id into v_id;
    end if;
    new.supplier_id := v_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_invoices_link_party on public.invoices;
create trigger trg_invoices_link_party before insert or update of counterparty_nipt on public.invoices
  for each row execute function app.invoices_link_party();

-- Backfill: krijo palët që mungojnë dhe lidh faturat ekzistuese (pa prekur periudhat e mbyllura)
insert into public.customers (company_id, nipt, name)
select distinct on (i.company_id, upper(btrim(i.counterparty_nipt)))
       i.company_id, upper(btrim(i.counterparty_nipt)), coalesce(nullif(btrim(i.counterparty_name), ''), upper(btrim(i.counterparty_nipt)))
  from public.invoices i
 where i.direction = 'sale' and i.customer_id is null and nullif(btrim(i.counterparty_nipt), '') is not null and i.deleted_at is null
 order by i.company_id, upper(btrim(i.counterparty_nipt)), i.issue_date desc
on conflict (company_id, nipt) where nipt is not null and deleted_at is null do nothing;

insert into public.suppliers (company_id, nipt, name)
select distinct on (i.company_id, upper(btrim(i.counterparty_nipt)))
       i.company_id, upper(btrim(i.counterparty_nipt)), coalesce(nullif(btrim(i.counterparty_name), ''), upper(btrim(i.counterparty_nipt)))
  from public.invoices i
 where i.direction = 'purchase' and i.supplier_id is null and nullif(btrim(i.counterparty_nipt), '') is not null and i.deleted_at is null
 order by i.company_id, upper(btrim(i.counterparty_nipt)), i.issue_date desc
on conflict (company_id, nipt) where nipt is not null and deleted_at is null do nothing;

update public.invoices i set customer_id = c.id
  from public.customers c, public.fiscal_periods fp
 where i.direction = 'sale' and i.customer_id is null and c.company_id = i.company_id
   and c.nipt = upper(btrim(i.counterparty_nipt)) and c.deleted_at is null
   and fp.id = i.period_id and fp.status <> 'closed';

update public.invoices i set supplier_id = s.id
  from public.suppliers s, public.fiscal_periods fp
 where i.direction = 'purchase' and i.supplier_id is null and s.company_id = i.company_id
   and s.nipt = upper(btrim(i.counterparty_nipt)) and s.deleted_at is null
   and fp.id = i.period_id and fp.status <> 'closed';

-- ---------------------------------------------------------------------------
-- set_invoices_payment · p_status: 'paid' | 'unpaid'
--   paid   → paid_amount = |total|, paid_at = p_paid_at (default sot)
--   unpaid → paid_amount = 0, paid_at = null
-- Kthen për çdo faturë: {id, ok, error}. Periudha e mbyllur → gabim për atë faturë.
-- ---------------------------------------------------------------------------
create or replace function public.set_invoices_payment(
  p_ids uuid[], p_status public.payment_status, p_paid_at date default null, p_method public.payment_method default null)
returns table (id uuid, ok boolean, error text)
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_inv public.invoices;
begin
  if p_status not in ('paid', 'unpaid') then
    raise exception 'Statusi duhet të jetë paid ose unpaid' using errcode = '22023';
  end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 or array_length(p_ids, 1) > 1000 then
    raise exception 'Zgjidh 1 deri në 1000 fatura' using errcode = '22023';
  end if;

  foreach v_id in array p_ids loop
    begin
      select * into v_inv from public.invoices where invoices.id = v_id and deleted_at is null;
      if v_inv.id is null then
        id := v_id; ok := false; error := 'Fatura nuk u gjet'; return next; continue;
      end if;
      if not app.has_permission(v_inv.company_id, 'invoices', 'write') then
        id := v_id; ok := false; error := 'Pa të drejtë'; return next; continue;
      end if;
      update public.invoices set
        payment_status = p_status,
        paid_amount    = case when p_status = 'paid' then abs(total) else 0 end,
        paid_at        = case when p_status = 'paid' then coalesce(p_paid_at, current_date) else null end,
        payment_method = coalesce(p_method, payment_method)
      where invoices.id = v_id;
      id := v_id; ok := true; error := null; return next;
    exception when others then
      id := v_id; ok := false; error := sqlerrm; return next;
    end;
  end loop;
end $$;

revoke all on function public.set_invoices_payment(uuid[], public.payment_status, date, public.payment_method) from public, anon;
grant execute on function public.set_invoices_payment(uuid[], public.payment_status, date, public.payment_method) to authenticated;
