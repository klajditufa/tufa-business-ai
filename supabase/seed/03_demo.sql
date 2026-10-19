-- Seed · Të dhëna DEMO (organizata type='demo'; fshihen me scripts/db-demo-reset.sh)
-- KURRË mos e ekzekuto në një projekt me të dhëna reale pa e lexuar: krijon 3 përdorues demo me fjalëkalim "Demo1234!".
-- Përdoruesit demo (vetëm për zhvillim/pilot):
--   demo.studio@tufa.al     org_owner i "Studio Demo" (sheh A dhe B)
--   demo.kontabilist@tufa.al accountant në Kompaninë A
--   demo.klient@tufa.al     company_admin i Kompanisë B

do $$
declare
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_acc   uuid := '22222222-2222-4222-8222-222222222222';
  v_cli   uuid := '33333333-3333-4333-8333-333333333333';
  v_org   uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_a     uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_b     uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_pw    text := crypt('Demo1234!', gen_salt('bf'));
  v_period uuid;
  v_cust uuid;
  v_sup uuid;
  m int;
begin
  -- auth users (idempotent)
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.studio@tufa.al', v_pw, now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Studio"}', now(), now(), '', '', '', ''),
    (v_acc,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.kontabilist@tufa.al', v_pw, now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Kontabilist"}', now(), now(), '', '', '', ''),
    (v_cli,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.klient@tufa.al', v_pw, now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Klient"}', now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
  from auth.users u where u.id in (v_owner, v_acc, v_cli)
  on conflict do nothing;

  -- profilet (trigger-i i krijon; sigurohemi edhe këtu)
  insert into public.users (id, email, full_name) values
    (v_owner, 'demo.studio@tufa.al', 'Demo Studio'),
    (v_acc,   'demo.kontabilist@tufa.al', 'Demo Kontabilist'),
    (v_cli,   'demo.klient@tufa.al', 'Demo Klient')
  on conflict (id) do nothing;

  -- organizata demo + 2 kompani
  insert into public.organizations (id, name, type, created_by) values (v_org, 'Studio Demo', 'demo', v_owner)
  on conflict (id) do nothing;
  insert into public.organization_memberships (organization_id, user_id, role) values (v_org, v_owner, 'org_owner')
  on conflict do nothing;

  insert into public.companies (id, organization_id, nipt, legal_name, trade_name, legal_form, administrator_name, city, tax_regime, vat_registered, base_currency, created_by) values
    (v_a, v_org, 'K00000001A', 'DEMO ALFA SHPK', 'Alfa Demo', 'shpk', 'Arben Demo', 'Tiranë', 'standard', true, 'ALL', v_owner),
    (v_b, v_org, 'K00000002B', 'DEMO BETA PERSON FIZIK', 'Beta Demo', 'pf', 'Besa Demo', 'Durrës', 'simplified', false, 'ALL', v_owner)
  on conflict (id) do nothing;

  insert into public.company_memberships (company_id, user_id, role) values
    (v_a, v_acc, 'accountant'),
    (v_b, v_cli, 'company_admin')
  on conflict do nothing;

  -- palë dhe fatura për Kompaninë A (12 muaj, numra të thjeshtë dhe të verifikueshëm)
  insert into public.customers (company_id, nipt, name) values (v_a, 'L11111111A', 'Klienti Demo 1') returning id into v_cust;
  insert into public.suppliers (company_id, nipt, name) values (v_a, 'M22222222B', 'Furnitori Demo 1') returning id into v_sup;

  for m in 0..11 loop
    v_period := app.period_for_date(v_a, (date_trunc('month', current_date) - (m || ' months')::interval)::date);
    insert into public.invoices (company_id, period_id, direction, number, nivf, issue_date, customer_id, counterparty_name,
                                 subtotal, vat_amount, total, vat_breakdown, payment_status, paid_amount, source)
    values (v_a, v_period, 'sale', 'S-' || (12 - m), 'DEMO-S-' || (12 - m),
            (date_trunc('month', current_date) - (m || ' months')::interval + interval '9 days')::date,
            v_cust, 'Klienti Demo 1',
            100000 + m * 5000, (100000 + m * 5000) * 0.20, (100000 + m * 5000) * 1.20,
            jsonb_build_array(jsonb_build_object('rate', 20, 'base', 100000 + m * 5000, 'vat', (100000 + m * 5000) * 0.20)),
            (case when m < 2 then 'unpaid' else 'paid' end)::public.payment_status, case when m < 2 then 0 else (100000 + m * 5000) * 1.20 end, 'manual');
    insert into public.invoices (company_id, period_id, direction, number, nivf, issue_date, supplier_id, counterparty_name,
                                 subtotal, vat_amount, total, vat_breakdown, payment_status, paid_amount, source)
    values (v_a, v_period, 'purchase', 'P-' || (12 - m), 'DEMO-P-' || (12 - m),
            (date_trunc('month', current_date) - (m || ' months')::interval + interval '14 days')::date,
            v_sup, 'Furnitori Demo 1',
            60000 + m * 2000, (60000 + m * 2000) * 0.20, (60000 + m * 2000) * 1.20,
            jsonb_build_array(jsonb_build_object('rate', 20, 'base', 60000 + m * 2000, 'vat', (60000 + m * 2000) * 0.20)),
            'paid', (60000 + m * 2000) * 1.20, 'manual');
  end loop;

  -- deklarime për muajin e kaluar (Kompania A)
  v_period := app.period_for_date(v_a, (date_trunc('month', current_date) - interval '1 month')::date);
  insert into public.tax_declarations (company_id, period_id, kind, status, due_date, assigned_to) values
    (v_a, v_period, 'vat', 'in_process', (date_trunc('month', current_date) + interval '13 days')::date, v_acc),
    (v_a, v_period, 'payroll_esig25', 'pending', (date_trunc('month', current_date) + interval '19 days')::date, v_acc)
  on conflict do nothing;

  insert into public.tax_obligations (company_id, kind, description, amount, due_date, confirmed_official) values
    (v_a, 'vat', 'TVSH për pagesë (llogaritje orientuese)', 8000, (date_trunc('month', current_date) + interval '13 days')::date, false);
end $$;
