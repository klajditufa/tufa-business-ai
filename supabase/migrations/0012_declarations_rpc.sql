-- 0012 · Deklarimet: gjenerimi automatik sipas regjimit dhe ndryshimi i statusit me audit

-- Cilat deklarime i takojnë një kompanie për një muaj (rregull i thjeshtë, i zgjerueshëm me tax_rules më vonë)
create or replace function app.declaration_kinds_for(p_company_id uuid)
returns table (kind public.declaration_kind, due_day integer) language sql stable security definer set search_path = public as $$
  select k.kind, k.due_day
  from public.companies c
  cross join lateral (values
    ('vat'::public.declaration_kind, 14, c.vat_registered),
    ('payroll_esig25'::public.declaration_kind, 20, true),
    ('withholding'::public.declaration_kind, 20, true)
  ) as k(kind, due_day, applies)
  where c.id = p_company_id and k.applies;
$$;

-- Siguron që ekzistojnë rreshtat e deklarimeve për periudhën (idempotent). Afati = dita X e muajit pasardhës.
create or replace function public.ensure_declarations(p_company_id uuid, p_year integer, p_month integer)
returns setof public.tax_declarations language plpgsql security definer set search_path = public as $$
declare v_period uuid;
begin
  if not app.has_permission(p_company_id, 'declarations', 'read') then
    raise exception 'insufficient privileges' using errcode = '42501';
  end if;
  v_period := app.period_for_date(p_company_id, make_date(p_year, p_month, 1));
  if app.has_permission(p_company_id, 'declarations', 'write') then
    insert into public.tax_declarations (company_id, period_id, kind, status, due_date)
    select p_company_id, v_period, k.kind, 'pending',
           (make_date(p_year, p_month, 1) + interval '1 month' + (k.due_day - 1) * interval '1 day')::date
    from app.declaration_kinds_for(p_company_id) k
    on conflict (company_id, period_id, kind) do nothing;
  end if;
  return query select * from public.tax_declarations where company_id = p_company_id and period_id = v_period order by kind;
end $$;

-- Ndryshon statusin; 'declared' vendos declared_at/by. Audit vjen nga trigger-i i tabelës.
create or replace function public.set_declaration_status(p_id uuid, p_status public.declaration_status, p_notes text default null)
returns public.tax_declarations language plpgsql security definer set search_path = public as $$
declare v_row public.tax_declarations;
begin
  select * into v_row from public.tax_declarations where id = p_id;
  if v_row.id is null then raise exception 'declaration not found'; end if;
  if not app.has_permission(v_row.company_id, 'declarations', 'write') then
    raise exception 'insufficient privileges' using errcode = '42501';
  end if;
  if p_status = 'late' then raise exception 'statusi late llogaritet automatikisht'; end if;
  update public.tax_declarations
     set status = p_status,
         notes = coalesce(p_notes, notes),
         declared_at = case when p_status = 'declared' then now() else null end,
         declared_by = case when p_status = 'declared' then auth.uid() else null end
   where id = p_id
   returning * into v_row;
  return v_row;
end $$;

-- Matrica e studios: të gjitha kompanitë që sheh përdoruesi × deklarimet e muajit (krijon rreshtat që mungojnë)
create or replace function public.studio_declaration_matrix(p_year integer, p_month integer)
returns table (
  company_id uuid, company_name text, nipt text, vat_registered boolean,
  declaration_id uuid, kind public.declaration_kind, status public.declaration_status,
  effective_status public.declaration_status, due_date date, declared_at timestamptz, assigned_to uuid
) language plpgsql security definer set search_path = public as $$
declare c record;
begin
  for c in select id from public.companies where id in (select app.user_company_ids()) and deleted_at is null loop
    perform public.ensure_declarations(c.id, p_year, p_month);
  end loop;
  return query
    select co.id, coalesce(co.trade_name, co.legal_name), co.nipt::text, co.vat_registered,
           d.id, d.kind, d.status,
           case when d.status <> 'declared' and d.due_date < current_date then 'late'::public.declaration_status else d.status end,
           d.due_date, d.declared_at, d.assigned_to
    from public.companies co
    join public.fiscal_periods fp on fp.company_id = co.id and fp.year = p_year and fp.month = p_month
    join public.tax_declarations d on d.company_id = co.id and d.period_id = fp.id
    where co.id in (select app.user_company_ids()) and co.deleted_at is null
    order by coalesce(co.trade_name, co.legal_name), d.kind;
end $$;

revoke execute on function public.ensure_declarations(uuid, integer, integer) from public, anon;
revoke execute on function public.set_declaration_status(uuid, public.declaration_status, text) from public, anon;
revoke execute on function public.studio_declaration_matrix(integer, integer) from public, anon;
grant execute on function public.ensure_declarations(uuid, integer, integer) to authenticated;
grant execute on function public.set_declaration_status(uuid, public.declaration_status, text) to authenticated;
grant execute on function public.studio_declaration_matrix(integer, integer) to authenticated;
