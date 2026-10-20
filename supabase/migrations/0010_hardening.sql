-- 0010 · Forcim sigurie sipas Supabase advisors
-- 1) Asnjë funksion SECURITY DEFINER nuk thirret nga anon/public (vetëm authenticated).
-- 2) search_path fiks për çdo funksion në skemën app.
-- 3) citext jashtë public.

-- Hiq të drejtën default të PUBLIC/anon për RPC-të e ekspozuara
revoke execute on function public.close_period(uuid) from public, anon;
revoke execute on function public.reopen_period(uuid, text) from public, anon;
revoke execute on function public.create_organization_with_company(text, public.organization_type, jsonb) from public, anon;
revoke execute on function public.effective_tax_rule(public.tax_rule_kind, date, text, uuid) from public, anon;
revoke execute on function public.vat_rates_at(date, uuid) from public, anon;
revoke execute on function public.log_audit_event(uuid, text, text, text, text) from public, anon;
revoke execute on function public.my_company_role(uuid) from public, anon;
revoke execute on function public.my_permissions(uuid) from public, anon;
revoke execute on function public.company_turnover(uuid, date, date) from public, anon;
revoke execute on function public.monthly_series(uuid, integer) from public, anon;
revoke execute on function public.vat_summary(uuid, uuid) from public, anon;
revoke execute on function public.outstanding_obligations(uuid) from public, anon;
revoke execute on function public.top_debtors(uuid, integer) from public, anon;
revoke execute on function public.top_creditors(uuid, integer) from public, anon;
revoke execute on function public.upcoming_deadlines(uuid, integer) from public, anon;

-- Funksionet e ardhshme në public: pa execute default për public/anon
alter default privileges in schema public revoke execute on functions from public, anon;

-- Skema app: vetëm authenticated/service_role, kurrë anon
revoke all on schema app from public, anon;
revoke execute on all functions in schema app from public, anon;

-- search_path fiks për funksionet trigger/immutable të app
alter function app.set_updated_at() set search_path = public;
alter function app.documents_check_path() set search_path = public;
alter function app.storage_company_id(text) set search_path = public;
alter function app.block_closed_period() set search_path = public;
alter function app.audit_row() set search_path = public;
alter function app.invoices_set_period() set search_path = public;
alter function app.companies_default_integrations() set search_path = public;
alter function app.period_for_date(uuid, date) set search_path = public;
alter function app.period_is_closed(uuid) set search_path = public;
alter function app.handle_new_auth_user() set search_path = public;

-- citext jashtë public (kolonat e tipit citext vazhdojnë të funksionojnë)
create schema if not exists extensions;
alter extension citext set schema extensions;
grant usage on schema extensions to public;
