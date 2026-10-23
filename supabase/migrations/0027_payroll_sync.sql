-- ===========================================================================
-- 0027 · Dërgimi direkt i listëpagesave nga cis-client-2 (kapja e faqes në e-Filing)
--   * app.ensure_declarations_core · krijimi i deklarimeve pa kontroll sesioni (për rrugët me çelës)
--   * app.payroll_import_* · logjika e importit; public.import_payroll_* kontrollojnë të drejtën
--     e përdoruesit dhe e thërrasin; public.sync_payroll e thërret pasi verifikon çelësin + NIPT-in
--   * çelësat API marrin edhe të drejtën "sync:payroll"
-- ===========================================================================

create or replace function app.ensure_declarations_core(p_company_id uuid, p_year integer, p_month integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_period uuid;
begin
  v_period := app.period_for_date(p_company_id, make_date(p_year, p_month, 1));
  insert into public.tax_declarations (company_id, period_id, kind, status, due_date)
  select p_company_id, v_period, k.kind, 'pending',
         (make_date(p_year, p_month, 1) + interval '1 month' + (k.due_day - 1) * interval '1 day')::date
    from app.declaration_kinds_for(p_company_id) k
  on conflict (company_id, period_id, kind) do nothing;
  return v_period;
end $$;

create or replace function public.ensure_declarations(p_company_id uuid, p_year integer, p_month integer)
returns setof public.tax_declarations language plpgsql security definer set search_path = public as $$
declare v_period uuid;
begin
  if not app.has_permission(p_company_id, 'declarations', 'read') then
    raise exception 'insufficient privileges' using errcode = '42501';
  end if;
  if app.has_permission(p_company_id, 'declarations', 'write') then
    v_period := app.ensure_declarations_core(p_company_id, p_year, p_month);
  else
    v_period := app.period_for_date(p_company_id, make_date(p_year, p_month, 1));
  end if;
  return query select * from public.tax_declarations where company_id = p_company_id and period_id = v_period order by kind;
end $$;

create or replace function app.payroll_import_declarations(p_company_id uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; v_period uuid; v_id uuid; v_existing uuid; v_decl uuid;
  v_imported int := 0; v_updated int := 0; v_marked int := 0;
  v_year int; v_month int; v_sub date; v_due date; v_status text; v_paid boolean;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'rows: array me maksimumi 1000 rreshta' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_year := (r ->> 'year')::int; v_month := (r ->> 'month')::int;
    if v_year is null or v_month not between 1 and 12 then continue; end if;
    v_sub := nullif(r ->> 'submitted_on', '')::date;
    v_due := nullif(r ->> 'due_date', '')::date;
    v_status := nullif(btrim(r ->> 'cats_status'), '');
    v_period := app.period_for_date(p_company_id, make_date(v_year, v_month, 1));

    select id into v_existing from public.payroll_declarations
     where company_id = p_company_id and period_id = v_period
       and model = coalesce(nullif(btrim(r ->> 'model'), ''), 'Normal')
       and coalesce(submitted_on, date '1900-01-01') = coalesce(v_sub, date '1900-01-01');

    if v_existing is null then
      insert into public.payroll_declarations (company_id, period_id, model, submitted_on, due_date, employees, gross, social, health,
                                               income_tax, cats_status, issh_status, issh_sent_on, imported_by, raw)
      values (p_company_id, v_period, coalesce(nullif(btrim(r ->> 'model'), ''), 'Normal'), v_sub, v_due,
              app.jnum(r, 'employees')::int, app.jnum(r, 'gross'), app.jnum(r, 'social'), app.jnum(r, 'health'),
              app.jnum(r, 'income_tax'), v_status, nullif(btrim(r ->> 'issh_status'), ''),
              nullif(r ->> 'issh_sent_on', '')::date, auth.uid(), r)
      returning id into v_id;
      v_imported := v_imported + 1;
    else
      update public.payroll_declarations set
        due_date = v_due, employees = app.jnum(r, 'employees')::int, gross = app.jnum(r, 'gross'),
        social = app.jnum(r, 'social'), health = app.jnum(r, 'health'), income_tax = app.jnum(r, 'income_tax'),
        cats_status = v_status, issh_status = nullif(btrim(r ->> 'issh_status'), ''),
        issh_sent_on = nullif(r ->> 'issh_sent_on', '')::date, imported_at = now(), imported_by = auth.uid(), raw = r
      where id = v_existing;
      v_id := v_existing;
      v_updated := v_updated + 1;
    end if;

    -- Deklarimi i muajit në TUFA: i dorëzuar në C@TS → "declared" (përveç kur është refuzuar)
    if v_status is null or v_status !~* 'refuz' then
      perform app.ensure_declarations_core(p_company_id, v_year, v_month);
      update public.tax_declarations
         set status = 'declared',
             declared_at = coalesce(v_sub::timestamptz, declared_at, now()),
             official = official || jsonb_build_object('source', 'cats', 'employees', app.jnum(r, 'employees'),
                          'gross', app.jnum(r, 'gross'), 'social', app.jnum(r, 'social'), 'health', app.jnum(r, 'health'),
                          'income_tax', app.jnum(r, 'income_tax'), 'cats_status', v_status)
       where company_id = p_company_id and period_id = v_period and kind = 'payroll_esig25'
       returning id into v_decl;
      if v_decl is not null then v_marked := v_marked + 1; end if;

      -- Detyrimet zyrtare nga C@TS (rishkruhen në çdo import të këtij rreshti)
      v_paid := v_status ~* '(rikonsil|aprovuar dhe paguar)';
      delete from public.tax_obligations where payroll_declaration_id = v_id;
      insert into public.tax_obligations (company_id, declaration_id, payroll_declaration_id, kind, description, amount,
                                          due_date, confirmed_official, paid_amount, paid_at)
      select p_company_id, v_decl, v_id, k.kind, k.descr, k.amount,
             coalesce(v_due, (make_date(v_year, v_month, 1) + interval '1 month 19 days')::date), true,
             case when v_paid then k.amount else 0 end, case when v_paid then v_sub end
        from (values
          ('social'::public.obligation_kind, 'Sigurime shoqërore (C@TS)', app.jnum(r, 'social')),
          ('health'::public.obligation_kind, 'Sigurime shëndetësore (C@TS)', app.jnum(r, 'health')),
          ('income_tax'::public.obligation_kind, 'TAP (C@TS)', app.jnum(r, 'income_tax'))
        ) as k(kind, descr, amount)
       where k.amount > 0;
    end if;
  end loop;

  return jsonb_build_object('imported', v_imported, 'updated', v_updated, 'declarations_marked', v_marked);
end $$;

create or replace function app.payroll_import_lines(p_company_id uuid, p_year integer, p_month integer, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_period uuid; v_n int;
begin
  if p_month not between 1 and 12 or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'Të dhëna të pavlefshme' using errcode = '22023';
  end if;
  v_period := app.period_for_date(p_company_id, make_date(p_year, p_month, 1));
  delete from public.payroll_declaration_lines where company_id = p_company_id and period_id = v_period;
  insert into public.payroll_declaration_lines (
    company_id, period_id, nid, full_name, profession, category, days_absent, days_worked, gross, social_base,
    social_employer, social_employee, social_total, supp_employer, supp_employee, supp_total, social_all,
    health_base, health_total, pension_voluntary, tax_deduction, tax_base, income_tax, personal_status, notes)
  select p_company_id, v_period, upper(btrim(r ->> 'nid')), r ->> 'full_name', r ->> 'profession', r ->> 'category',
         nullif(app.jnum(r, 'days_absent'), 0)::int, app.jnum(r, 'days_worked')::int,
         app.jnum(r, 'gross'), app.jnum(r, 'social_base'), app.jnum(r, 'social_employer'), app.jnum(r, 'social_employee'),
         app.jnum(r, 'social_total'), app.jnum(r, 'supp_employer'), app.jnum(r, 'supp_employee'), app.jnum(r, 'supp_total'),
         app.jnum(r, 'social_all'), app.jnum(r, 'health_base'), app.jnum(r, 'health_total'), app.jnum(r, 'pension_voluntary'),
         app.jnum(r, 'tax_deduction'), app.jnum(r, 'tax_base'), app.jnum(r, 'income_tax'), r ->> 'personal_status', r ->> 'notes'
    from jsonb_array_elements(p_rows) r
   where nullif(btrim(r ->> 'nid'), '') is not null
  on conflict (company_id, period_id, nid) do nothing;
  get diagnostics v_n = row_count;
  return jsonb_build_object('lines', v_n);
end $$;

create or replace function public.import_payroll_declarations(p_company_id uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not app.has_permission(p_company_id, 'payroll', 'write') then
    raise exception 'Nuk ke të drejtë për listëpagesat e këtij subjekti' using errcode = '42501';
  end if;
  return app.payroll_import_declarations(p_company_id, p_rows);
end $$;

create or replace function public.import_payroll_lines(p_company_id uuid, p_year integer, p_month integer, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not app.has_permission(p_company_id, 'payroll', 'write') then
    raise exception 'Nuk ke të drejtë për listëpagesat e këtij subjekti' using errcode = '42501';
  end if;
  return app.payroll_import_lines(p_company_id, p_year, p_month, p_rows);
end $$;

-- Çelësat: edhe listëpagesat
alter table public.company_api_keys alter column scopes set default array['sync:invoices', 'sync:payroll'];
update public.company_api_keys set scopes = scopes || array['sync:payroll'] where not ('sync:payroll' = any (scopes));

-- p_kind: 'summary' (Listëpagesa të Dorëzuara) | 'lines' (detajet E-SIG 025 të një muaji)
-- p_nipt: NIPT-i i verifikuar nga faqja e kapur; duhet të jetë i subjektit të çelësit
create or replace function public.sync_payroll(p_key text, p_nipt text, p_kind text, p_year integer, p_month integer, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_company uuid; v_nipt text;
begin
  if coalesce(p_key, '') !~ '^tba_[0-9a-f]{48}$' then
    raise exception 'Çelës API i pavlefshëm' using errcode = '28000';
  end if;
  select r.company_id into v_company from public.resolve_api_key(p_key, 'sync:payroll') r;
  if v_company is null then
    raise exception 'Çelës API i pavlefshëm, i revokuar ose pa të drejtë për listëpagesat' using errcode = '28000';
  end if;
  select upper(nipt::text) into v_nipt from public.companies where id = v_company;
  if upper(coalesce(btrim(p_nipt), '')) <> v_nipt then
    raise exception 'NIPT-i i faqes (%) nuk përputhet me subjektin e çelësit (%)', p_nipt, v_nipt using errcode = '22023';
  end if;
  if p_kind = 'summary' then
    return jsonb_build_object('company_id', v_company) || app.payroll_import_declarations(v_company, p_rows);
  elsif p_kind = 'lines' then
    if p_year is null or p_month is null then
      raise exception 'Muaji i listëpagesës mungon' using errcode = '22023';
    end if;
    return jsonb_build_object('company_id', v_company) || app.payroll_import_lines(v_company, p_year, p_month, p_rows);
  end if;
  raise exception 'Lloj i panjohur: %', p_kind using errcode = '22023';
end $$;

revoke all on function public.sync_payroll(text, text, text, integer, integer, jsonb) from public;
grant execute on function public.sync_payroll(text, text, text, integer, integer, jsonb) to anon, authenticated, service_role;
revoke all on function app.payroll_import_declarations(uuid, jsonb) from public, anon, authenticated;
revoke all on function app.payroll_import_lines(uuid, integer, integer, jsonb) from public, anon, authenticated;
revoke all on function app.ensure_declarations_core(uuid, integer, integer) from public, anon, authenticated;
