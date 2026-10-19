-- Teste RLS dhe integriteti · ekzekutohen me psql (lokalisht) ose në SQL editor të Supabase
-- Kërkon: migrations + seed/03_demo.sql të aplikuara. Çdo dështim ngre exception → CI dështon.
-- Shënim: në Supabase ekzekutoje si postgres (SQL editor); set role authenticated funksionon aty.

\set ON_ERROR_STOP on

create temp table t_results (name text, ok boolean, detail text);
grant all on t_results to authenticated;

create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text default null)
returns void language plpgsql as $$
begin
  insert into t_results values (p_name, p_ok, p_detail);
  if not p_ok then raise notice 'FAIL: % — %', p_name, p_detail; else raise notice 'ok: %', p_name; end if;
end $$;

-- Identitetet demo
\set owner '11111111-1111-4111-8111-111111111111'
\set acc   '22222222-2222-4222-8222-222222222222'
\set cli   '33333333-3333-4333-8333-333333333333'
\set compA 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set compB 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

-- =============================================================================
-- 1. Pa autentikim: zero rreshta
-- =============================================================================
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
select pg_temp.check('anon sheh 0 kompani', (select count(*) from public.companies) = 0);
select pg_temp.check('anon sheh 0 fatura', (select count(*) from public.invoices) = 0);
reset role;

-- =============================================================================
-- 2. Kontabilisti i A: sheh vetëm A
-- =============================================================================
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
select pg_temp.check('accountant sheh vetëm 1 kompani', (select count(*) from public.companies) = 1);
select pg_temp.check('accountant sheh kompaninë A', (select id from public.companies limit 1) = :'compA'::uuid);
select pg_temp.check('accountant sheh 24 fatura të A', (select count(*) from public.invoices) = 24,
                     (select count(*)::text from public.invoices));
select pg_temp.check('accountant nuk sheh fatura të B', (select count(*) from public.invoices where company_id = :'compB'::uuid) = 0);
select pg_temp.check('accountant roli = accountant', app.company_role(:'compA'::uuid) = 'accountant');
select pg_temp.check('accountant ka invoices.close', app.has_permission(:'compA'::uuid, 'invoices', 'close'));
select pg_temp.check('accountant NUK ka akses në B', not app.has_permission(:'compB'::uuid, 'invoices', 'read'));

-- Insert në B duhet të dështojë (RLS with check)
do $$ begin
  insert into public.invoices (company_id, direction, issue_date, subtotal, vat_amount, total)
  values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'sale', current_date, 100, 20, 120);
  perform pg_temp.check('accountant insert në B bllokohet', false, 'insert u lejua!');
exception when insufficient_privilege or others then
  perform pg_temp.check('accountant insert në B bllokohet', sqlstate in ('42501'), sqlstate || ' ' || sqlerrm);
end $$;

-- Dublikata NIVF në A
do $$ begin
  insert into public.invoices (company_id, direction, nivf, issue_date, subtotal, vat_amount, total)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sale', 'DEMO-S-12', current_date, 100, 20, 120);
  perform pg_temp.check('dublikata NIVF bllokohet', false, 'insert u lejua!');
exception when unique_violation then
  perform pg_temp.check('dublikata NIVF bllokohet', true);
end $$;

-- total != subtotal + vat
do $$ begin
  insert into public.invoices (company_id, direction, issue_date, subtotal, vat_amount, total)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sale', current_date, 100, 20, 121);
  perform pg_temp.check('total = subtotal + vat zbatohet', false);
exception when check_violation then
  perform pg_temp.check('total = subtotal + vat zbatohet', true);
end $$;

-- Funksionet agregate kthejnë shumat e A
select pg_temp.check('company_turnover sales_count = 12',
  (select sales_count from public.company_turnover(:'compA'::uuid, (current_date - interval '13 months')::date, current_date)) = 12);
select pg_temp.check('company_turnover sales_net > 0',
  (select sales_net from public.company_turnover(:'compA'::uuid, (current_date - interval '13 months')::date, current_date)) > 0);
select pg_temp.check('top_debtors kthen 1 klient me 2 fatura',
  (select invoices from public.top_debtors(:'compA'::uuid, 5) limit 1) = 2);
select pg_temp.check('monthly_series kthen 12 muaj', (select count(*) from public.monthly_series(:'compA'::uuid, 12)) = 12);

-- Audit: faturat e seed-it kanë audit insert (seed-i ekzekutohet si postgres, user_id null, por rreshtat ekzistojnë)
reset role;
select pg_temp.check('audit_logs ka rreshta për invoices', (select count(*) from public.audit_logs where table_name = 'invoices') >= 24);

-- =============================================================================
-- 3. Mbyllja dhe rihapja e periudhës
-- =============================================================================
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
select close_period((select id from public.fiscal_periods where company_id = :'compA'::uuid order by year, month limit 1));
select pg_temp.check('periudha u mbyll', (select status from public.fiscal_periods where company_id = :'compA'::uuid order by year, month limit 1) = 'closed');

do $$
declare v_period uuid; v_date date;
begin
  select id, make_date(year, month, 5) into v_period, v_date from public.fiscal_periods
   where company_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' order by year, month limit 1;
  insert into public.invoices (company_id, period_id, direction, issue_date, subtotal, vat_amount, total)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', v_period, 'sale', v_date, 100, 20, 120);
  perform pg_temp.check('insert në periudhë të mbyllur bllokohet', false, 'insert u lejua!');
exception when others then
  perform pg_temp.check('insert në periudhë të mbyllur bllokohet', sqlerrm like '%mbyllur%', sqlerrm);
end $$;

-- update i një fature ekzistuese në periudhë të mbyllur bllokohet
do $$ begin
  update public.invoices set notes = 'x'
   where company_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     and period_id = (select id from public.fiscal_periods where company_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' order by year, month limit 1);
  perform pg_temp.check('update në periudhë të mbyllur bllokohet', false, 'update u lejua!');
exception when others then
  perform pg_temp.check('update në periudhë të mbyllur bllokohet', sqlerrm like '%mbyllur%', sqlerrm);
end $$;

-- UPDATE direkt i statusit nga klienti (jo përmes funksionit) bllokohet nga policy
do $$ begin
  update public.fiscal_periods set status = 'open'
   where company_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and status = 'closed';
  perform pg_temp.check('rihapje me UPDATE direkt bllokohet', not exists (
    select 1 from public.fiscal_periods where company_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and status = 'open'
      and id = (select id from public.fiscal_periods where company_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' order by year, month limit 1)));
end $$;

-- rihapje pa arsye bllokohet
do $$ begin
  perform reopen_period((select id from public.fiscal_periods where company_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' order by year, month limit 1), '');
  perform pg_temp.check('reopen pa arsye bllokohet', false);
exception when others then
  perform pg_temp.check('reopen pa arsye bllokohet', sqlerrm like '%reason%', sqlerrm);
end $$;

select reopen_period((select id from public.fiscal_periods where company_id = :'compA'::uuid order by year, month limit 1), 'Korrigjim fature nga klienti');
select pg_temp.check('periudha u rihap', (select status from public.fiscal_periods where company_id = :'compA'::uuid order by year, month limit 1) = 'open');
reset role;
select pg_temp.check('audit ka reopen_period me arsye',
  exists (select 1 from public.audit_logs where action = 'reopen_period' and reason = 'Korrigjim fature nga klienti' and user_id = :'acc'::uuid));

-- =============================================================================
-- 4. Klienti (company_admin i B)
-- =============================================================================
select set_config('request.jwt.claim.sub', :'cli', false);
set role authenticated;
select pg_temp.check('klienti sheh vetëm B', (select count(*) from public.companies) = 1 and (select id from public.companies) = :'compB'::uuid);
select pg_temp.check('klienti sheh 0 fatura të A', (select count(*) from public.invoices where company_id = :'compA'::uuid) = 0);
select pg_temp.check('klienti NUK ka invoices.close', not app.has_permission(:'compB'::uuid, 'invoices', 'close'));
select pg_temp.check('klienti NUK ka declarations.write', not app.has_permission(:'compB'::uuid, 'declarations', 'write'));

-- klienti fut faturë në B (lejohet) dhe period_id vendoset automatikisht
insert into public.invoices (company_id, direction, issue_date, counterparty_name, subtotal, vat_amount, total)
values (:'compB'::uuid, 'purchase', current_date, 'Furnitor test', 1000, 0, 1000);
select pg_temp.check('klienti fut faturë në B', (select count(*) from public.invoices where company_id = :'compB'::uuid) = 1);
select pg_temp.check('period_id u vendos automatikisht',
  (select period_id is not null from public.invoices where company_id = :'compB'::uuid limit 1));

-- klienti nuk mund të mbyllë periudhë
do $$ begin
  perform close_period((select period_id from public.invoices where company_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' limit 1));
  perform pg_temp.check('klienti nuk mbyll periudhë', false);
exception when insufficient_privilege then
  perform pg_temp.check('klienti nuk mbyll periudhë', true);
end $$;

-- klienti nuk mund të bëhet super admin
do $$ begin
  update public.users set is_super_admin = true where id = auth.uid();
  perform pg_temp.check('klienti nuk vetë-promovohet super admin', false, 'update u lejua!');
exception when others then
  perform pg_temp.check('klienti nuk vetë-promovohet super admin', true);
end $$;
select pg_temp.check('is_super_admin mbetet false', not app.is_super_admin());

-- klienti nuk sheh audit logs të A, as rregulla të kompanisë A
select pg_temp.check('klienti nuk sheh audit të A', (select count(*) from public.audit_logs where company_id = :'compA'::uuid) = 0);
select pg_temp.check('klienti sheh rregullat globale', (select count(*) from public.tax_rules where scope = 'global') > 0);

-- documents: path jashtë kompanisë bllokohet
do $$ begin
  insert into public.documents (company_id, category, storage_path, file_name, mime, size_bytes, uploaded_by)
  values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'contract', 'companies/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/contract/x.pdf', 'x.pdf', 'application/pdf', 10, auth.uid());
  perform pg_temp.check('document path jashtë kompanisë bllokohet', false);
exception when others then
  perform pg_temp.check('document path jashtë kompanisë bllokohet', sqlerrm like '%storage_path%', sqlerrm);
end $$;
insert into public.documents (company_id, category, storage_path, file_name, mime, size_bytes, uploaded_by)
values (:'compB'::uuid, 'contract', 'companies/' || :'compB' || '/contract/x.pdf', 'x.pdf', 'application/pdf', 10, auth.uid());
select pg_temp.check('document i saktë futet', (select count(*) from public.documents where company_id = :'compB'::uuid) = 1);

-- integrimet default u krijuan për B me manual_import = functional, selfcare = pending
select pg_temp.check('integrimet default', (select count(*) from public.integrations where company_id = :'compB'::uuid) = 4
  and (select status from public.integrations where company_id = :'compB'::uuid and provider = 'manual_import') = 'functional'
  and (select status from public.integrations where company_id = :'compB'::uuid and provider = 'selfcare') = 'pending_integration');

reset role;

-- =============================================================================
-- 5. Owner i organizatës: sheh A dhe B
-- =============================================================================
select set_config('request.jwt.claim.sub', :'owner', false);
set role authenticated;
select pg_temp.check('owner sheh 2 kompani', (select count(*) from public.companies) = 2);
select pg_temp.check('owner sheh faturat e A dhe B', (select count(*) from public.invoices) = 25);
select pg_temp.check('owner roli = org_owner', app.company_role(:'compB'::uuid) = 'org_owner');
reset role;

-- =============================================================================
-- 6. Rregullat tatimore sipas datës
-- =============================================================================
select pg_temp.check('TVSH standarde 20% në 2026', (public.effective_tax_rule('vat_rate', '2026-06-01', 'standard') ->> 'rate')::numeric = 20);
select pg_temp.check('asnjë normë para 2015', public.effective_tax_rule('vat_rate', '2010-01-01', 'standard') is null);
select pg_temp.check('vat_rates_at kthen >= 4 norma', (select count(*) from public.vat_rates_at(current_date)) >= 4);

-- =============================================================================
-- Përmbledhje
-- =============================================================================
select name, ok, detail from t_results where not ok;
do $$
declare v_fail int; v_total int;
begin
  select count(*) filter (where not ok), count(*) into v_fail, v_total from t_results;
  raise notice '==== % / % teste kaluan ====', v_total - v_fail, v_total;
  if v_fail > 0 then raise exception '% teste dështuan', v_fail; end if;
end $$;
