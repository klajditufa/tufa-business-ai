-- 0013 · Pranimi i ftesave dhe heqja e anëtarëve

-- Pranon ftesën: email-i i ftesës duhet të përputhet me email-in e përdoruesit të loguar
create or replace function public.accept_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inv public.invitations;
  v_email text;
  v_company uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select email::text into v_email from public.users where id = auth.uid();
  select * into v_inv from public.invitations where token = p_token;
  if v_inv.id is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if v_inv.accepted_at is not null then return jsonb_build_object('ok', false, 'error', 'used'); end if;
  if v_inv.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'expired'); end if;
  if lower(v_inv.email::text) <> lower(v_email) then return jsonb_build_object('ok', false, 'error', 'email_mismatch'); end if;

  if v_inv.organization_id is not null and v_inv.org_role is not null then
    insert into public.organization_memberships (organization_id, user_id, role)
    values (v_inv.organization_id, auth.uid(), v_inv.org_role)
    on conflict (organization_id, user_id) do update set role = excluded.role;
    select id into v_company from public.companies where organization_id = v_inv.organization_id and deleted_at is null order by created_at limit 1;
  end if;
  if v_inv.company_id is not null and v_inv.company_role is not null then
    insert into public.company_memberships (company_id, user_id, role)
    values (v_inv.company_id, auth.uid(), v_inv.company_role)
    on conflict (company_id, user_id) do update set role = excluded.role;
    v_company := v_inv.company_id;
  end if;

  update public.invitations set accepted_at = now() where id = v_inv.id;
  update public.users set last_company_id = coalesce(v_company, last_company_id) where id = auth.uid();
  return jsonb_build_object('ok', true, 'company_id', v_company);
end $$;

-- Informacion publik minimal mbi ftesën (për faqen /invite/[token] para login-it): vetëm emri i subjektit/organizatës dhe roli
create or replace function public.invitation_preview(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when i.id is null then null else jsonb_build_object(
    'email', i.email,
    'role', coalesce(i.company_role::text, i.org_role::text),
    'target', coalesce((select coalesce(c.trade_name, c.legal_name) from public.companies c where c.id = i.company_id),
                       (select o.name from public.organizations o where o.id = i.organization_id)),
    'expired', i.expires_at < now(),
    'used', i.accepted_at is not null
  ) end
  from (select 1) x left join public.invitations i on i.token = p_token;
$$;

revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;
-- preview: lejohet edhe anon (kthen vetëm emrin e subjektit dhe rolin, asnjë të dhënë financiare)
grant execute on function public.invitation_preview(text) to anon, authenticated;
