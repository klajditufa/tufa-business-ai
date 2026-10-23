-- Teste RLS dhe integriteti · ekzekutohen me psql (lokalisht) ose në SQL editor të Supabase
-- Kërkon: migrations + seed/03_demo.sql të aplikuara. Çdo dështim ngre exception → CI dështon.
-- Shënim: në Supabase ekzekutoje si postgres (SQL editor); set role authenticated funksionon aty.

\set ON_ERROR_STOP on

create temp table t_results (name text, ok boolean, detail text);
grant all on t_results to authenticated, service_role, anon;

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
-- 7. Deklarimet (0012)
-- =============================================================================
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
select pg_temp.check('ensure_declarations krijon 3 rreshta për A (TVSH po)',
  (select count(*) from public.ensure_declarations(:'compA'::uuid, 2026, 9)) = 3);
select pg_temp.check('set_declaration_status → declared vendos declared_by',
  (select declared_by from public.set_declaration_status(
     (select id from public.tax_declarations where company_id = :'compA'::uuid and kind = 'vat' and period_id = (select id from public.fiscal_periods where company_id = :'compA'::uuid and year = 2026 and month = 9)),
     'declared', 'test')) = :'acc'::uuid);
do $$ begin
  perform public.set_declaration_status((select id from public.tax_declarations where company_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' limit 1), 'declared');
  perform pg_temp.check('accountant nuk ndryshon deklarime të B', (select id from public.tax_declarations where company_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' limit 1) is null);
exception when others then
  perform pg_temp.check('accountant nuk ndryshon deklarime të B', true);
end $$;
reset role;
select set_config('request.jwt.claim.sub', :'cli', false);
set role authenticated;
select pg_temp.check('klienti sheh deklarimet e B (2 lloje, pa TVSH)',
  (select count(*) from public.ensure_declarations(:'compB'::uuid, 2026, 9)) = 0);  -- klienti s'ka write → s'krijohen
reset role;
select set_config('request.jwt.claim.sub', :'owner', false);
set role authenticated;
select pg_temp.check('matrica e studios: A(3) + B(2) = 5 rreshta', (select count(*) from public.studio_declaration_matrix(2026, 9)) = 5);
reset role;

-- =============================================================================
-- 8. Storage helper thirret nga authenticated (0014)
-- =============================================================================
select set_config('request.jwt.claim.sub', :'cli', false);
set role authenticated;
select pg_temp.check('storage_company_id thirret nga authenticated',
  app.storage_company_id('companies/cccccccc-cccc-4ccc-8ccc-cccccccccccc/contract/x.pdf') = :'compB'::uuid);
select pg_temp.check('storage policy: klienti ka documents.write në B',
  app.has_permission(app.storage_company_id('companies/cccccccc-cccc-4ccc-8ccc-cccccccccccc/contract/x.pdf'), 'documents', 'write'));
reset role;

-- =============================================================================
-- 9. Owner-i fut kompani të re me RETURNING (0015)
-- =============================================================================
select set_config('request.jwt.claim.sub', :'owner', false);
set role authenticated;
do $$
declare v_id uuid;
begin
  insert into public.companies (organization_id, nipt, legal_name, created_by)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'T77777777T', 'TEST RETURNING SHPK', auth.uid()) returning id into v_id;
  perform pg_temp.check('owner fut kompani të re me returning', v_id is not null);
  perform pg_temp.check('kompania e re ka 4 integrime default', (select count(*) from public.integrations where company_id = v_id) = 4);
exception when others then
  perform pg_temp.check('owner fut kompani të re me returning', false, sqlerrm);
end $$;
reset role;

-- =============================================================================
-- 10. Importi CIS (0016): çelësa API + import_cis_invoices
-- =============================================================================
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
select pg_temp.check('accountant krijon çelës API për A (fillon me tba_)',
  (select key from public.create_api_key(:'compA'::uuid, 'Mac i zyrës')) like 'tba\_%');
select pg_temp.check('çelësi ruhet vetëm si hash (pa vlerë)',
  (select count(*) from public.company_api_keys where company_id = :'compA'::uuid and key_hash ~ '^[0-9a-f]{64}$' and length(key_prefix) = 12) = 1);
do $$ begin
  perform public.create_api_key('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'x');
  perform pg_temp.check('accountant NUK krijon çelës për B', false);
exception when others then
  perform pg_temp.check('accountant NUK krijon çelës për B', true);
end $$;
do $$ begin
  perform public.import_cis_invoices('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sale', '[]'::jsonb, null);
  perform pg_temp.check('authenticated NUK thërret import_cis_invoices', false);
exception when others then
  perform pg_temp.check('authenticated NUK thërret import_cis_invoices', true);
end $$;
reset role;

-- service_role: verifikon çelësin dhe importon (çelës i njohur, futur direkt si hash për testin)
insert into public.company_api_keys (company_id, name, key_prefix, key_hash)
values (:'compB'::uuid, 'test', left('tba_' || repeat('ab', 24), 12), encode(digest('tba_' || repeat('ab', 24), 'sha256'), 'hex'));
set role service_role;
do $$
declare v_key text := 'tba_' || repeat('ab', 24); v_company uuid; v_res jsonb; v_inv public.invoices;
begin
  select company_id into v_company from public.resolve_api_key(v_key, 'sync:invoices');
  perform pg_temp.check('resolve_api_key kthen kompaninë e çelësit', v_company = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  perform pg_temp.check('resolve_api_key refuzon scope të huaj', (select count(*) from public.resolve_api_key(v_key, 'admin')) = 0);
  perform pg_temp.check('resolve_api_key refuzon çelës të gabuar', (select count(*) from public.resolve_api_key('tba_wrong', 'sync:invoices')) = 0);

  v_res := public.import_cis_invoices(v_company, 'sale', $j$[
    {"TypeOfInv":"NONCASH","IssueDateTime":"2026-09-02T19:15:11+02:00","InvOrdNum":"280","TCRCode":"","BusinUnitCode":"xx123","OperatorCode":"op1",
     "TotVATAmt":"0.00","TotPrice":"64512.00","IIC":"ABCDEF0123456789ABCDEF0123456789","FIC":"f17b7558-c28e-42af-a1c3-bac9147b4de4","IsEinvoice":"true",
     "PayMethods":[{"Type":"ACCOUNT","Amt":"64512.00"}],"Seller":{"IDType":"NUIS","IDNum":"M14618202T","Name":"Klajdi Tufa"},
     "Buyer":{"IDType":"NUIS","IDNum":"L82224013T","Name":"XM"}},
    {"TypeOfInv":"CASH","IssueDateTime":"2026-09-30T11:32:00+02:00","InvNum":"7942/2026","TotVATAmt":"199.18","TotPrice":"1195.08","TotPriceWoVAT":"995.90",
     "FIC":"8a729363-771d-43e6-ab1f-253a582b8a8e","IIC":"00112233445566778899AABBCCDDEEFF",
     "PayMethods":[{"Type":"BANKNOTE","Amt":"1195.08"}],"Seller":{"IDType":"NUIS","IDNum":"M14618202T","Name":"Klajdi Tufa"},
     "Buyer":{"IDType":"NUIS","IDNum":"L82309007S","Name":"Host AL"},
     "SameTaxes":[{"VATRate":"20.00","NumOfItems":"1","PriceBefVAT":"995.90","VATAmt":"199.18"}]},
    {"TypeOfInv":"NONCASH","IssueDateTime":"2026-09-05T09:00:00+02:00","TotPrice":"10.00","TotVATAmt":"0.00"}
  ]$j$::jsonb, 'test shtator');
  perform pg_temp.check('import: 2 të reja, 1 pa FIC e anashkaluar',
    (v_res ->> 'imported')::int = 2 and (v_res ->> 'skipped')::int = 1 and jsonb_array_length(v_res -> 'errors') = 1);
  select * into v_inv from public.invoices where company_id = v_company and nivf = 'f17b7558-c28e-42af-a1c3-bac9147b4de4';
  perform pg_temp.check('mapimi FIC→nivf, IIC→nslf, blerësi, numri nga InvOrdNum',
    v_inv.nslf = 'ABCDEF0123456789ABCDEF0123456789' and v_inv.counterparty_nipt = 'L82224013T' and v_inv.number = '280'
    and v_inv.issue_date = date '2026-09-02' and v_inv.total = 64512 and v_inv.subtotal = 64512 and v_inv.payment_method = 'bank'
    and v_inv.payment_status = 'unpaid' and v_inv.source = 'connector' and v_inv.is_einvoice);
  select * into v_inv from public.invoices where company_id = v_company and nivf = '8a729363-771d-43e6-ab1f-253a582b8a8e';
  perform pg_temp.check('fatura CASH → e paguar, breakdown nga SameTaxes 20%',
    v_inv.payment_status = 'paid' and v_inv.paid_amount = 1195.08 and v_inv.payment_method = 'cash'
    and (v_inv.vat_breakdown -> 0 ->> 'rate')::numeric = 20 and v_inv.number = '7942/2026');
  perform pg_temp.check('periudha 2026-09 u krijua automatikisht',
    exists (select 1 from public.fiscal_periods p where p.company_id = v_company and p.year = 2026 and p.month = 9));

  -- Ri-import: përditësim, jo dublikatë
  v_res := public.import_cis_invoices(v_company, 'sale', $j$[
    {"TypeOfInv":"NONCASH","IssueDateTime":"2026-09-02T19:15:11+02:00","InvOrdNum":"280","TotVATAmt":"0.00","TotPrice":"64512.00",
     "IIC":"ABCDEF0123456789ABCDEF0123456789","FIC":"f17b7558-c28e-42af-a1c3-bac9147b4de4",
     "PayMethods":[{"Type":"ACCOUNT","Amt":"64512.00"}],"Buyer":{"IDType":"NUIS","IDNum":"L82224013T","Name":"XM SHPK"}}
  ]$j$::jsonb, null);
  perform pg_temp.check('ri-import: 0 të reja, 1 e përditësuar, pa dublikatë',
    (v_res ->> 'imported')::int = 0 and (v_res ->> 'updated')::int = 1
    and (select count(*) from public.invoices where company_id = v_company and nivf = 'f17b7558-c28e-42af-a1c3-bac9147b4de4') = 1
    and (select counterparty_name from public.invoices where company_id = v_company and nivf = 'f17b7558-c28e-42af-a1c3-bac9147b4de4') = 'XM SHPK');
  perform pg_temp.check('integrimi selfcare → functional me last_sync_at',
    (select status = 'functional' and last_sync_at is not null from public.integrations where company_id = v_company and provider = 'selfcare'));
  perform pg_temp.check('import_batches ka 2 batch-e done', (select count(*) from public.import_batches where company_id = v_company and status = 'done') = 2);
end $$;
reset role;

-- anon (si API-ja e serverit me çelësin publik): sync_check_key / sync_cis_invoices
set role anon;
select pg_temp.check('anon: sync_check_key me çelës të mirë kthen B',
  (select nipt from public.sync_check_key('tba_' || repeat('ab', 24))) is not null);
select pg_temp.check('anon: sync_check_key me çelës të keq → bosh',
  (select count(*) from public.sync_check_key('tba_' || repeat('cd', 24))) = 0);
select pg_temp.check('anon: sync_cis_invoices importon me çelësin e B',
  (public.sync_cis_invoices('tba_' || repeat('ab', 24), 'purchase',
     '[{"FIC":"11111111-2222-3333-4444-555555555555","IssueDateTime":"2026-09-03T10:46:00+02:00","InvNum":"18540","TotPrice":"9600.00","TotVATAmt":"1600.00","Seller":{"IDNum":"L52101183A","Name":"Embedded Systems"},"PayMethods":[{"Type":"ACCOUNT"}]}]'::jsonb) ->> 'imported')::int = 1);
do $$ begin
  perform public.sync_cis_invoices('tba_' || repeat('cd', 24), 'sale', '[]'::jsonb);
  perform pg_temp.check('anon: çelës i keq refuzohet', false);
exception when others then
  perform pg_temp.check('anon: çelës i keq refuzohet', sqlstate = '28000');
end $$;
do $$ begin
  perform public.import_cis_invoices('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'sale', '[]'::jsonb, null);
  perform pg_temp.check('anon NUK thërret import_cis_invoices direkt', false);
exception when others then
  perform pg_temp.check('anon NUK thërret import_cis_invoices direkt', true);
end $$;
reset role;

-- Izolimi: accountant-i (vetëm A) nuk sheh faturat e importuara të B; klienti i B i sheh
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
select pg_temp.check('accountant nuk sheh faturat CIS të B',
  (select count(*) from public.invoices where nivf = 'f17b7558-c28e-42af-a1c3-bac9147b4de4') = 0);
reset role;
select set_config('request.jwt.claim.sub', :'cli', false);
set role authenticated;
select pg_temp.check('klienti i B sheh faturat e veta CIS + sync status',
  (select count(*) from public.invoices where nivf = 'f17b7558-c28e-42af-a1c3-bac9147b4de4') = 1
  and (select sales_count from public.invoice_sync_status(:'compB'::uuid)) = 2);
reset role;

-- =============================================================================
-- 11. Pozicioni i TVSH-së (0017): zinxhiri i kreditit + vlerat zyrtare
-- =============================================================================
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
-- Rivendosim zinxhirin: kredi zyrtare 0 në dhjetor 2026
select pg_temp.check('set_vat_official dhjetor 2026 (credit_cf=0)',
  (select (official ->> 'credit_cf')::numeric from public.set_vat_official(:'compA'::uuid, 2026, 12, '{"credit_cf":"0"}')) = 0);
insert into public.invoices (company_id, direction, issue_date, subtotal, vat_amount, total) values
  (:'compA'::uuid, 'sale',     date '2027-01-10',  500, 100,  600),
  (:'compA'::uuid, 'purchase', date '2027-01-12', 1500, 300, 1800),
  (:'compA'::uuid, 'sale',     date '2027-02-05', 2500, 500, 3000),
  (:'compA'::uuid, 'purchase', date '2027-02-07',  500, 100,  600);
select pg_temp.check('janar 2027: TVSH 100 − 300 → kredi 200 për t''u mbartur',
  (select (p ->> 'payable')::numeric = 0 and (p ->> 'credit_cf')::numeric = 200 and p ->> 'credit_bf_source' = 'official'
     from public.vat_position(:'compA'::uuid, 2027, 1) p));
select pg_temp.check('shkurt 2027: 500 − 100 − 200 (mbartur) = 200 për pagesë',
  (select (p ->> 'payable')::numeric = 200 and (p ->> 'credit_bf')::numeric = 200 and p ->> 'credit_bf_source' = 'computed'
     from public.vat_position(:'compA'::uuid, 2027, 2) p));
-- C@TS deklaroi kredi 250 në janar → shkurti përdor vlerën zyrtare
select pg_temp.check('set_vat_official janar 2027 ruan official + computed',
  (select (official ->> 'credit_cf')::numeric = 250 and (computed ->> 'credit_cf')::numeric = 200 and official ? 'recorded_at'
     from public.set_vat_official(:'compA'::uuid, 2027, 1, '{"output_vat":100,"input_vat":300,"credit_cf":250,"note":"sipas C@TS"}')));
select pg_temp.check('shkurt 2027 me kredinë zyrtare: 500 − 100 − 250 = 150',
  (select (p ->> 'payable')::numeric = 150 and p ->> 'credit_bf_source' = 'official'
     from public.vat_position(:'compA'::uuid, 2027, 2) p));
do $$ begin
  perform public.set_vat_official('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 2027, 1, '{"credit_cf":-5}');
  perform pg_temp.check('vlera negative refuzohet', false);
exception when others then perform pg_temp.check('vlera negative refuzohet', sqlstate = '22023'); end $$;
do $$ begin
  perform public.set_vat_official('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 2027, 1, '{"credit_cf":1}');
  perform pg_temp.check('accountant NUK regjistron TVSH zyrtare për B', false);
exception when others then perform pg_temp.check('accountant NUK regjistron TVSH zyrtare për B', true); end $$;
select pg_temp.check('accountant: vat_position e B → zero (RLS)',
  (select (p ->> 'output_vat')::numeric = 0 and (p ->> 'sales_count')::int = 0 from public.vat_position(:'compB'::uuid, 2026, 9) p));
reset role;

-- =============================================================================
-- 12. Palët automatike + pagesat (0019)
-- =============================================================================
select set_config('request.jwt.claim.sub', :'cli', false);
set role authenticated;
select pg_temp.check('fatura CIS lidhet me klientin sipas NIPT-it',
  (select c.nipt = 'L82224013T' from public.invoices i join public.customers c on c.id = i.customer_id
    where i.nivf = 'f17b7558-c28e-42af-a1c3-bac9147b4de4'));
select pg_temp.check('blerja CIS lidhet me furnitorin sipas NIPT-it',
  (select s.nipt = 'L52101183A' from public.invoices i join public.suppliers s on s.id = i.supplier_id
    where i.nivf = '11111111-2222-3333-4444-555555555555'));
select pg_temp.check('ri-importi nuk dublikon klientin',
  (select count(*) from public.customers where company_id = :'compB'::uuid and nipt = 'L82224013T') = 1);
select pg_temp.check('set_invoices_payment → paid kthen ok',
  (select bool_and(ok) from public.set_invoices_payment(
     array[(select id from public.invoices where nivf = 'f17b7558-c28e-42af-a1c3-bac9147b4de4')], 'paid', date '2026-09-25', 'bank')));
select pg_temp.check('fatura e paguar: paid_amount = total, data e pagesës',
  (select paid_amount = 64512 and paid_at = date '2026-09-25' and payment_status = 'paid'
     from public.invoices where nivf = 'f17b7558-c28e-42af-a1c3-bac9147b4de4'));
select pg_temp.check('top_debtors nuk e përfshin më faturën e paguar',
  not exists (select 1 from public.top_debtors(:'compB'::uuid, 50) where customer_name in ('XM', 'XM SHPK')));
select pg_temp.check('set_invoices_payment → unpaid kthen ok',
  (select bool_and(ok) from public.set_invoices_payment(
     array[(select id from public.invoices where nivf = 'f17b7558-c28e-42af-a1c3-bac9147b4de4')], 'unpaid')));
select pg_temp.check('fatura e papaguar: paid_amount 0, pa datë',
  (select paid_amount = 0 and paid_at is null from public.invoices where nivf = 'f17b7558-c28e-42af-a1c3-bac9147b4de4'));
reset role;
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
select pg_temp.check('accountant i A NUK shënon pagesë për faturë të B',
  (select not ok from public.set_invoices_payment(array['00000000-0000-4000-8000-000000000000'::uuid], 'paid')));
reset role;
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
-- accountant-i i A nuk e sheh faturën e B (RLS), por funksioni është SECURITY DEFINER → duhet të refuzojë vetë
do $$
declare v_ok boolean; v_err text;
begin
  select ok, error into v_ok, v_err from public.set_invoices_payment(
    array[(select id from public.invoices where company_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' and nivf is not null limit 1)], 'paid');
  perform pg_temp.check('accountant i A: fatura e B → ok=false', v_ok = false, coalesce(v_err, 'null'));
end $$;
reset role;
-- me id-në reale (e marrë si superuser) — kontrolli i të drejtës brenda funksionit
select set_config('t.b_inv', (select id::text from public.invoices where nivf = 'f17b7558-c28e-42af-a1c3-bac9147b4de4'), false);
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
select pg_temp.check('accountant i A: id reale e B → "Pa të drejtë"',
  (select not ok and error = 'Pa të drejtë' from public.set_invoices_payment(array[current_setting('t.b_inv')::uuid], 'paid')));
reset role;

-- =============================================================================
-- 13. Gjendja e palëve (0020)
-- =============================================================================
select set_config('request.jwt.claim.sub', :'cli', false);
set role authenticated;
select pg_temp.check('party_balances: XM ka mbetje 64.512 (e papaguar)',
  (select outstanding = 64512 and invoices = 1 and nipt = 'L82224013T' and party_id is not null
     from public.party_balances(:'compB'::uuid, 'sale') where nipt = 'L82224013T'));
select pg_temp.check('party_balances: Host AL (CASH) mbetje 0',
  (select outstanding = 0 and paid = 1195.08 from public.party_balances(:'compB'::uuid, 'sale') where nipt = 'L82309007S'));
select pg_temp.check('party_balances: furnitori Embedded Systems 9.600 për t''u paguar',
  (select outstanding = 9600 from public.party_balances(:'compB'::uuid, 'purchase') where nipt = 'L52101183A'));
select pg_temp.check('party_balances: renditje sipas mbetjes (e para = më e madhja)',
  (select outstanding from public.party_balances(:'compB'::uuid, 'sale') limit 1)
   = (select max(outstanding) from public.party_balances(:'compB'::uuid, 'sale')));
reset role;
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
select pg_temp.check('accountant i A: party_balances e B → bosh (RLS)',
  (select count(*) from public.party_balances(:'compB'::uuid, 'sale')) = 0);
reset role;

-- =============================================================================
-- 14. Fatura CIS në valutë (0021): shumat mbeten në lekë
-- =============================================================================
set role service_role;
select pg_temp.check('import EUR: 1 e re',
  (public.import_cis_invoices(:'compB'::uuid, 'sale', $j$[
    {"TypeOfInv":"NONCASH","IssueDateTime":"2026-07-20T10:00:00+02:00","InvOrdNum":"250","TotPrice":"374120.00","TotVATAmt":"0.00",
     "FIC":"eeeeeeee-0000-4000-8000-000000000250","IIC":"EUR250","Currency":{"Code":"EUR","ExRate":"93.53"},
     "Buyer":{"IDType":"VAT","IDNum":"BE0788949696","Name":"ILIAD bv"}}]$j$::jsonb) ->> 'imported')::int = 1);
reset role;
select pg_temp.check('valuta: currency=ALL, kurs 1, origjinali EUR 93.53',
  (select currency = 'ALL' and exchange_rate = 1 and original_currency = 'EUR' and original_exchange_rate = 93.53 and total = 374120
     from public.invoices where nivf = 'eeeeeeee-0000-4000-8000-000000000250'));
select pg_temp.check('monthly_series nuk e fryn faturën në valutë',
  (select sum(sales_net) from public.monthly_series(:'compB'::uuid, 120) where month = date '2026-07-01') < 1000000);

-- =============================================================================
-- 15. Raporti vjetor (0022)
-- =============================================================================
select set_config('request.jwt.claim.sub', :'cli', false);
set role authenticated;
select pg_temp.check('annual_report: 12 muaj',
  jsonb_array_length(public.annual_report(:'compB'::uuid, 2026) -> 'months') = 12);
select pg_temp.check('annual_report: totali i shitjeve = company_turnover',
  (public.annual_report(:'compB'::uuid, 2026) -> 'totals' ->> 's_net')::numeric
   = (select sales_net from public.company_turnover(:'compB'::uuid, date '2026-01-01', date '2026-12-31')));
select pg_temp.check('annual_report: korriku përmban ILIAD (374.120)',
  (select (m ->> 's_net')::numeric >= 374120 from jsonb_array_elements(public.annual_report(:'compB'::uuid, 2026) -> 'months') m
    where m ->> 'm' = '2026-07-01'));
select pg_temp.check('annual_report: klienti kryesor = ILIAD bv',
  public.annual_report(:'compB'::uuid, 2026) -> 'top_customers' -> 0 ->> 'name' = 'ILIAD bv');
select pg_temp.check('annual_report: pragjet TVSH 10 mln + biznes i vogël 14 mln nga tax_rules',
  (select array_agg((t ->> 'amount')::numeric order by (t ->> 'amount')::numeric)
     from jsonb_array_elements(public.annual_report(:'compB'::uuid, 2026) -> 'thresholds') t) = array[10000000, 14000000]::numeric[]);
reset role;
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
select pg_temp.check('accountant i A: raporti i B pa shifra (RLS)',
  (public.annual_report(:'compB'::uuid, 2026) -> 'totals' ->> 's_count')::int = 0);
reset role;

-- =============================================================================
-- 16. Rregullat tatimore globale (0023): vetëm super admin
-- =============================================================================
select set_config('t.rule_vat', (select id::text from public.tax_rules where kind = 'vat_exempt' and code = 'threshold' and company_id is null order by valid_from desc limit 1), false);
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
do $$ begin
  perform public.confirm_tax_rule(current_setting('t.rule_vat')::uuid);
  perform pg_temp.check('jo-admin NUK konfirmon rregull global', false);
exception when others then perform pg_temp.check('jo-admin NUK konfirmon rregull global', sqlstate = '42501'); end $$;
do $$ begin
  perform public.supersede_tax_rule(current_setting('t.rule_vat')::uuid, '{"annual_turnover":1}', date '2027-01-01', 'x');
  perform pg_temp.check('jo-admin NUK ndryshon pragun', false);
exception when others then perform pg_temp.check('jo-admin NUK ndryshon pragun', sqlstate = '42501'); end $$;
reset role;

update public.users set is_super_admin = true where id = :'owner'::uuid;
select set_config('request.jwt.claim.sub', :'owner', false);
set role authenticated;
select pg_temp.check('super admin konfirmon rregullin',
  (select confirmed and confirmed_by = :'owner'::uuid from public.confirm_tax_rule(current_setting('t.rule_vat')::uuid)));
select pg_temp.check('supersede: rregull i ri nga 2027-01-01',
  (select valid_from = date '2027-01-01' and confirmed and (params ->> 'annual_turnover')::numeric = 12000000
     from public.supersede_tax_rule(current_setting('t.rule_vat')::uuid, '{"annual_turnover":12000000,"currency":"ALL","label":"Pragu TVSH (test)"}', date '2027-01-01', 'VKM test')));
select pg_temp.check('supersede: i vjetri mbyllet më 2026-12-31',
  (select valid_to = date '2026-12-31' from public.tax_rules where id = current_setting('t.rule_vat')::uuid));
select pg_temp.check('2026 përdor pragun e vjetër, 2027 të riun',
  (public.effective_tax_rule('vat_exempt', date '2026-06-30', 'threshold') ->> 'annual_turnover')::numeric = 10000000
  and (public.effective_tax_rule('vat_exempt', date '2027-06-30', 'threshold') ->> 'annual_turnover')::numeric = 12000000);
do $$ begin
  perform public.supersede_tax_rule(current_setting('t.rule_vat')::uuid, '{"annual_turnover":1}', date '2020-01-01', 'x');
  perform pg_temp.check('supersede me datë të hershme refuzohet', false);
exception when others then perform pg_temp.check('supersede me datë të hershme refuzohet', sqlstate = '22023'); end $$;
select pg_temp.check('ndryshimi i rregullit regjistrohet në audit',
  exists (select 1 from public.audit_logs where table_name = 'tax_rules' and row_id = current_setting('t.rule_vat')));
reset role;
update public.users set is_super_admin = false where id = :'owner'::uuid;

-- =============================================================================
-- 17. Pasqyra e studios (0024)
-- =============================================================================
select set_config('request.jwt.claim.sub', :'owner', false);
set role authenticated;
select pg_temp.check('studio_overview: owner sheh A dhe B',
  (select count(*) from public.studio_overview(2026, 9) where company_id in (:'compA'::uuid, :'compB'::uuid)) = 2);
select pg_temp.check('studio_overview: B shtator — shitjet e muajit dhe sinkronizimi',
  (select sales_count >= 2 and sync_status = 'functional' and last_sync_at is not null and vat_payable is null
     from public.studio_overview(2026, 9) where company_id = :'compB'::uuid));
select pg_temp.check('studio_overview: A (TVSH) shkurt 2027 → 150 për pagesë',
  (select vat_payable = 150 from public.studio_overview(2027, 2) where company_id = :'compA'::uuid));
select pg_temp.check('studio_overview: pragjet nga tax_rules',
  (select vat_threshold = 10000000 and small_threshold = 14000000 from public.studio_overview(2026, 9) where company_id = :'compB'::uuid));
select pg_temp.check('studio_overview: arkëtimet e B përfshijnë XM 64.512',
  (select receivables >= 64512 from public.studio_overview(2026, 9) where company_id = :'compB'::uuid));
reset role;
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
select pg_temp.check('studio_overview: accountant i A sheh vetëm A',
  (select array_agg(company_id) from public.studio_overview(2026, 9)) = array[:'compA'::uuid]);
reset role;

-- =============================================================================
-- 18. Listëpagesa nga C@TS (0026)
-- =============================================================================
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
select pg_temp.check('import_payroll_declarations: 2 muaj të rinj, 2 deklarime të shënuara',
  (select (j->>'imported')::int = 2 and (j->>'declarations_marked')::int = 2
     from public.import_payroll_declarations(:'compA'::uuid, $j$[
       {"year":2026,"month":9,"model":"Normal","submitted_on":"2026-10-01","due_date":"2026-10-20","employees":1,"gross":0,
        "social":11500,"health":3400,"income_tax":0,"cats_status":"Deklaratat e regjistruara.","issh_status":"E dërguar","issh_sent_on":"2026-10-07"},
       {"year":2026,"month":8,"model":"Normal","submitted_on":"2026-09-01","due_date":"2026-10-20","employees":1,"gross":0,
        "social":"11,500","health":"3,400","income_tax":0,"cats_status":"Aprovuar dhe paguar"}
     ]$j$::jsonb) j));
select pg_temp.check('deklarimi E-SIG 025 i shtatorit → declared me datën e C@TS',
  (select d.status = 'declared' and d.declared_at::date = date '2026-10-01' and (d.official->>'social')::numeric = 11500
     from public.tax_declarations d join public.fiscal_periods fp on fp.id = d.period_id
    where d.company_id = :'compA'::uuid and d.kind = 'payroll_esig25' and fp.year = 2026 and fp.month = 9));
select pg_temp.check('detyrimet zyrtare: shoqërore 11.500 + shëndetësore 3.400, afati 20.10',
  (select count(*) = 2 and sum(o.amount) = 14900 and bool_and(o.confirmed_official) and bool_and(o.due_date = date '2026-10-20')
     from public.tax_obligations o join public.payroll_declarations p on p.id = o.payroll_declaration_id
     join public.fiscal_periods fp on fp.id = p.period_id
    where o.company_id = :'compA'::uuid and fp.year = 2026 and fp.month = 9));
select pg_temp.check('"Aprovuar dhe paguar" → detyrimet e gushtit të paguara',
  (select bool_and(o.paid_amount = o.amount) from public.tax_obligations o join public.payroll_declarations p on p.id = o.payroll_declaration_id
     join public.fiscal_periods fp on fp.id = p.period_id where o.company_id = :'compA'::uuid and fp.year = 2026 and fp.month = 8));
select pg_temp.check('ri-importi përditëson, pa dublikata (detyrimet rishkruhen)',
  (select (j->>'updated')::int = 1 from public.import_payroll_declarations(:'compA'::uuid,
     '[{"year":2026,"month":9,"model":"Normal","submitted_on":"2026-10-01","due_date":"2026-10-20","employees":1,"social":11500,"health":3400,"income_tax":0}]'::jsonb) j));
select pg_temp.check('pas ri-importit: 1 përmbledhje dhe 2 detyrime për shtatorin',
  (select count(*) = 1 from public.payroll_declarations p join public.fiscal_periods fp on fp.id = p.period_id
    where p.company_id = :'compA'::uuid and fp.year = 2026 and fp.month = 9)
  and (select count(*) = 2 from public.tax_obligations o join public.payroll_declarations p on p.id = o.payroll_declaration_id
         join public.fiscal_periods fp on fp.id = p.period_id where o.company_id = :'compA'::uuid and fp.year = 2026 and fp.month = 9));
select pg_temp.check('import_payroll_lines: rreshti i punonjësit me fushat [9]–[29]',
  (select (j->>'lines')::int = 1 from public.import_payroll_lines(:'compA'::uuid, 2026, 9, $j$[
     {"nid":"j01020086i","full_name":"Test Tufa","profession":"2411.02, Kontabilist","category":"3/011(8)","days_worked":22,
      "gross":0,"social_base":50000,"social_employer":11500,"social_employee":0,"social_total":11500,"social_all":11500,
      "health_base":100000,"health_total":3400,"tax_base":0,"income_tax":0}]$j$::jsonb) j));
select pg_temp.check('rreshti ruhet me NID me shkronja të mëdha dhe bazën shëndetësore 100.000',
  (select nid = 'J01020086I' and health_base = 100000 and health_total = 3400 from public.payroll_declaration_lines where company_id = :'compA'::uuid));
reset role;

select set_config('request.jwt.claim.sub', :'cli', false);
set role authenticated;
do $$ begin
  perform public.import_payroll_declarations('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '[]'::jsonb);
  perform pg_temp.check('company_admin NUK importon listëpagesa', false);
exception when others then perform pg_temp.check('company_admin NUK importon listëpagesa', sqlstate = '42501'); end $$;
select pg_temp.check('klienti i B nuk sheh listëpagesat e A',
  (select count(*) from public.payroll_declarations where company_id = :'compA'::uuid) = 0
  and (select count(*) from public.payroll_declaration_lines where company_id = :'compA'::uuid) = 0);
reset role;

-- =============================================================================
-- 19. Dërgimi direkt i listëpagesave me çelës (0027)
-- =============================================================================
select set_config('t.nipt_b', (select nipt::text from public.companies where id = :'compB'::uuid), false);
set role anon;
do $$ begin
  perform public.sync_payroll('tba_' || repeat('ab', 24), 'X00000000X', 'summary', null, null, '[]'::jsonb);
  perform pg_temp.check('sync_payroll: NIPT i ndryshëm refuzohet', false);
exception when others then perform pg_temp.check('sync_payroll: NIPT i ndryshëm refuzohet', sqlstate = '22023'); end $$;
do $$ begin
  perform public.sync_payroll('tba_' || repeat('cd', 24), current_setting('t.nipt_b'), 'summary', null, null, '[]'::jsonb);
  perform pg_temp.check('sync_payroll: çelës i keq refuzohet', false);
exception when others then perform pg_temp.check('sync_payroll: çelës i keq refuzohet', sqlstate = '28000'); end $$;
select pg_temp.check('sync_payroll (anon + çelës): përmbledhja e B importohet',
  (select (j->>'imported')::int = 1 and (j->>'declarations_marked')::int = 1
     from public.sync_payroll('tba_' || repeat('ab', 24), lower(current_setting('t.nipt_b')), 'summary', null, null,
       '[{"year":2026,"month":7,"model":"Normal","submitted_on":"2026-08-05","due_date":"2026-08-20","employees":2,"gross":120000,"social":29400,"health":4080,"income_tax":5200,"cats_status":"Deklaratat e regjistruara."}]'::jsonb) j));
select pg_temp.check('sync_payroll: rreshtat e korrikut të B',
  (select (j->>'lines')::int = 1 from public.sync_payroll('tba_' || repeat('ab', 24), current_setting('t.nipt_b'), 'lines', 2026, 7,
     '[{"nid":"K12345678B","full_name":"Test","gross":"60,000","social_base":60000,"income_tax":3900}]'::jsonb) j));
do $$ begin
  perform app.payroll_import_declarations('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '[]'::jsonb);
  perform pg_temp.check('anon NUK thërret app.payroll_import_declarations', false);
exception when others then perform pg_temp.check('anon NUK thërret app.payroll_import_declarations', true); end $$;
reset role;
select pg_temp.check('deklarimi E-SIG 025 i korrikut të B → declared',
  (select d.status = 'declared' from public.tax_declarations d join public.fiscal_periods fp on fp.id = d.period_id
    where d.company_id = :'compB'::uuid and d.kind = 'payroll_esig25' and fp.year = 2026 and fp.month = 7));
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
do $$ begin
  perform app.payroll_import_declarations('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '[]'::jsonb);
  perform pg_temp.check('accountant i A NUK anashkalon kontrollin me app.payroll_import_declarations', false);
exception when others then perform pg_temp.check('accountant i A NUK anashkalon kontrollin me app.payroll_import_declarations', sqlstate = '42501'); end $$;
do $$ begin
  perform app.ensure_declarations_core('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 2026, 1);
  perform pg_temp.check('accountant i A NUK thërret app.ensure_declarations_core', false);
exception when others then perform pg_temp.check('accountant i A NUK thërret app.ensure_declarations_core', sqlstate = '42501'); end $$;
select pg_temp.check('import_payroll_declarations publik punon ende për A',
  (select (j->>'updated')::int = 1 from public.import_payroll_declarations(:'compA'::uuid,
     '[{"year":2026,"month":9,"model":"Normal","submitted_on":"2026-10-01","social":11500,"health":3400}]'::jsonb) j));
reset role;
select pg_temp.check('çelësat ekzistues kanë edhe sync:payroll',
  not exists (select 1 from public.company_api_keys where not ('sync:payroll' = any (scopes))));

-- =============================================================================
-- 20. Qiraja, doganat, regjistrat (0028)
-- =============================================================================
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
insert into public.rent_withholdings (company_id, doc_date, beneficiary_name, gross, reference_minimum)
values (:'compA'::uuid, '2026-09-05', 'Qiradhënës Test', 40000, 50000);
select pg_temp.check('qiraja: baza = max(bruto, minimumi), TAP 15%',
  (select tax_base = 50000 and tax = 7500 from public.rent_withholdings where company_id = :'compA'::uuid and beneficiary_name = 'Qiradhënës Test'));
do $$ begin
  update public.rent_withholdings set status = 'reviewed' where beneficiary_name = 'Qiradhënës Test';
  perform pg_temp.check('qiraja: pa rishikuar minimumin nuk kalon në reviewed', false);
exception when check_violation then perform pg_temp.check('qiraja: pa rishikuar minimumin nuk kalon në reviewed', true); end $$;
do $$ begin
  update public.rent_withholdings set status = 'submitted', reference_reviewed = true where beneficiary_name = 'Qiradhënës Test';
  perform pg_temp.check('qiraja: e dorëzuar pa protokoll refuzohet', false);
exception when check_violation then perform pg_temp.check('qiraja: e dorëzuar pa protokoll refuzohet', true); end $$;
do $$ begin
  insert into public.rent_withholdings (company_id, doc_date, beneficiary_name, gross)
  values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '2026-09-05', 'Ndërhyrës', 1000);
  perform pg_temp.check('qiraja: accountant i A nuk shkruan në B', false);
exception when others then perform pg_temp.check('qiraja: accountant i A nuk shkruan në B', sqlstate = '42501'); end $$;

insert into public.invoices (company_id, direction, number, nivf, issue_date, subtotal, vat_amount, total, counterparty_name)
values (:'compA'::uuid, 'purchase', 'DAV-T-1', 'FIC-DAV-T-1', '2026-09-10', 1000, 200, 1200, 'Dogana');
insert into public.customs_declarations (company_id, reference, decl_date, taxable_amount, import_vat)
values (:'compA'::uuid, 'dav-t-1', '2026-09-09', 1000, 190);
insert into public.customs_declarations (company_id, reference, decl_date, taxable_amount, import_vat, invoice_fic)
values (:'compA'::uuid, 'DAV-T-2', '2026-09-09', 1000, 200, 'FIC-DAV-T-1');
select pg_temp.check('doganat: përputhje me numrin e faturës, diferenca e TVSH = 10',
  (select match_by = 'reference' and vat_difference = 10 from public.customs_matches(:'compA'::uuid, '2026-09-01', '2026-09-30') where reference = 'dav-t-1'));
select pg_temp.check('doganat: përputhje me NIVF, pa diferencë',
  (select match_by = 'fic' and vat_difference = 0 from public.customs_matches(:'compA'::uuid, '2026-09-01', '2026-09-30') where reference = 'DAV-T-2'));
select pg_temp.check('doganat: accountant i A nuk sheh asgjë të B',
  (select count(*) from public.customs_matches(:'compB'::uuid, '2000-01-01', '2100-01-01')) = 0);
do $$ begin
  insert into public.customs_declarations (company_id, reference, decl_date, taxable_amount, import_vat, source_url)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'DAV-T-3', '2026-09-09', 1, 1, 'https://dogana.gov.al.evil.example/x');
  perform pg_temp.check('doganat: lidhje jo zyrtare refuzohet', false);
exception when check_violation then perform pg_temp.check('doganat: lidhje jo zyrtare refuzohet', true); end $$;
do $$ begin
  insert into public.company_registry (company_id, kind, rows) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'tcrs', '[]');
  perform pg_temp.check('regjistrat: përdoruesi nuk shkruan direkt', false);
exception when others then perform pg_temp.check('regjistrat: përdoruesi nuk shkruan direkt', sqlstate = '42501'); end $$;
reset role;

set role anon;
select pg_temp.check('regjistrat: agjenti me çelësin e B ruan operatorët, fushat e panjohura hidhen',
  (select (j->>'rows')::int = 2 from public.sync_cis_registry('tba_' || repeat('ab', 24), 'operators',
     '[{"name":"Arkëtar 1","opCode":"ab123cd456","idNumber":"X1","hack":"<script>"},{"name":"Arkëtar 2","opCode":"zz999zz999"}]'::jsonb) j));
do $$ begin
  perform public.sync_cis_registry('tba_' || repeat('cd', 24), 'tcrs', '[]'::jsonb);
  perform pg_temp.check('regjistrat: çelës i keq refuzohet', false);
exception when others then perform pg_temp.check('regjistrat: çelës i keq refuzohet', sqlstate = '28000'); end $$;
do $$ begin
  perform public.sync_cis_registry('tba_' || repeat('ab', 24), 'passwords', '[]'::jsonb);
  perform pg_temp.check('regjistrat: lloj i panjohur refuzohet', false);
exception when others then perform pg_temp.check('regjistrat: lloj i panjohur refuzohet', sqlstate = '22023'); end $$;
reset role;
select pg_temp.check('regjistrat: fusha "hack" nuk u ruajt',
  (select not (rows->0 ? 'hack') and rows->0->>'opCode' = 'ab123cd456' from public.company_registry where company_id = :'compB'::uuid and kind = 'operators'));
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
select pg_temp.check('regjistrat: accountant i A nuk sheh regjistrat e B',
  (select count(*) from public.company_registry where company_id = :'compB'::uuid) = 0);
reset role;

-- =============================================================================
-- 21. Importi nga shfletuesi (0029)
-- =============================================================================
select set_config('t.nipt_a', (select nipt::text from public.companies where id = :'compA'::uuid), false);
select set_config('request.jwt.claim.sub', :'acc', false);
set role authenticated;
select pg_temp.check('import_cis_invoices_user: fatura e A importohet, e huaja anashkalohet',
  (select (j->>'imported')::int = 1 and (j->>'foreign_skipped')::int = 1
     from public.import_cis_invoices_user(:'compA'::uuid, 'sale', jsonb_build_array(
       jsonb_build_object('FIC', 'fic-browser-1', 'IssueDateTime', '2026-10-05T10:00:00+02:00', 'TotPrice', '120', 'TotVATAmt', '20',
         'Seller', jsonb_build_object('IDNum', current_setting('t.nipt_a'), 'Name', 'A'),
         'Buyer', jsonb_build_object('IDNum', 'K11111111A', 'Name', 'Klient')),
       jsonb_build_object('FIC', 'fic-browser-2', 'IssueDateTime', '2026-10-05T10:00:00+02:00', 'TotPrice', '120', 'TotVATAmt', '20',
         'Seller', jsonb_build_object('IDNum', 'Z99999999Z', 'Name', 'Tjetër'),
         'Buyer', jsonb_build_object('IDNum', 'K11111111A', 'Name', 'Klient'))), 'test') j));
do $$ begin
  perform public.import_cis_invoices_user('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'sale', '[]'::jsonb, null);
  perform pg_temp.check('import_cis_invoices_user: accountant i A nuk importon në B', false);
exception when others then perform pg_temp.check('import_cis_invoices_user: accountant i A nuk importon në B', sqlstate = '42501'); end $$;
select pg_temp.check('set_company_registry: A ruan pajisjet',
  (select (j->>'rows')::int = 1 from public.set_company_registry(:'compA'::uuid, 'tcrs', '[{"TCRCode":"ab123cd456","x":"y"}]'::jsonb) j));
do $$ begin
  perform public.set_company_registry('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'tcrs', '[]'::jsonb);
  perform pg_temp.check('set_company_registry: accountant i A nuk shkruan në B', false);
exception when others then perform pg_temp.check('set_company_registry: accountant i A nuk shkruan në B', sqlstate = '42501'); end $$;
reset role;
set role anon;
do $$ begin
  perform public.import_cis_invoices_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sale', '[]'::jsonb, null);
  perform pg_temp.check('import_cis_invoices_user: anon refuzohet', false);
exception when others then perform pg_temp.check('import_cis_invoices_user: anon refuzohet', sqlstate = '42501'); end $$;
reset role;

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



