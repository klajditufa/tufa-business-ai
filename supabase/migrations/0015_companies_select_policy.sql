-- 0015 · companies_select: kontroll direkt mbi organization_id të rreshtit
-- Shkaku: INSERT ... RETURNING kërkon edhe policy SELECT; user_company_ids() është STABLE dhe përdor snapshot-in
-- para insert-it, kështu që rreshti i ri nuk shihej → "new row violates row-level security policy".

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (
    app.is_super_admin()
    or app.is_org_owner(organization_id)
    or id in (select company_id from public.company_memberships where user_id = auth.uid())
  );
