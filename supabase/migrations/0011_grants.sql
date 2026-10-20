-- 0011 · GRANT-et e tabelave për rolet e Supabase
-- Tabelat e krijuara përmes SQL (jo Dashboard) nuk marrin automatikisht privilegje për authenticated.
-- RLS vazhdon të kufizojë rreshtat; GRANT-i vetëm lejon që policy-t të vlerësohen.

grant usage on schema public to anon, authenticated, service_role;

-- authenticated: lexim/shkrim mbi tabelat (RLS filtron). Pa DELETE në tabelat append-only.
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke delete on public.audit_logs from authenticated;
revoke insert, update, delete on public.permissions from authenticated;
revoke insert, update, delete on public.plans from authenticated;
revoke delete on public.documents from authenticated;

grant usage, select on all sequences in schema public to authenticated;
grant select on public.tax_declarations_view to authenticated;

-- anon: asgjë mbi tabelat e aplikacionit
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- service_role: gjithçka (workers, Edge Functions)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Tabelat e ardhshme të krijuara nga postgres marrin të njëjtat privilegje
alter default privileges for role postgres in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema public grant usage, select on sequences to authenticated;
alter default privileges for role postgres in schema public grant all on tables to service_role;
alter default privileges for role postgres in schema public grant all on sequences to service_role;
