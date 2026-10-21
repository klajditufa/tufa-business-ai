-- 0014 · GRANT execute për të gjitha funksionet e skemës app (policies e Storage dhe RLS i thërrasin si authenticated)
-- Shkaku: 0002 dha grant vetëm për funksionet që ekzistonin atëherë; storage_company_id (0009) etj. mbetën pa të drejta.

grant usage on schema app to authenticated, service_role;
grant execute on all functions in schema app to authenticated, service_role;
revoke all on schema app from public, anon;
revoke execute on all functions in schema app from public, anon;

-- Funksionet e ardhshme në app: automatikisht për authenticated/service_role, kurrë për anon
alter default privileges for role postgres in schema app grant execute on functions to authenticated, service_role;
alter default privileges for role postgres in schema app revoke execute on functions from public;
