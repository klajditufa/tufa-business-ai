-- 0003 · Audit logs (append-only) dhe trigger-i gjenerik app.audit_row()

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  company_id  uuid,
  user_id     uuid,
  action      text not null check (action in ('insert', 'update', 'delete', 'reopen_period', 'impersonate', 'login', 'custom')),
  table_name  text not null,
  row_id      text,
  old_data    jsonb,
  new_data    jsonb,
  reason      text,
  ip          inet,
  at          timestamptz not null default now()
);
create index audit_logs_company_at_idx on public.audit_logs (company_id, at desc);
create index audit_logs_table_row_idx on public.audit_logs (table_name, row_id);

alter table public.audit_logs enable row level security;

-- Lexim: kush ka 'companies.admin' në kompani (ose super admin). Asnjë UPDATE/DELETE policy → append-only.
create policy audit_select on public.audit_logs for select to authenticated
  using (
    app.is_super_admin()
    or (company_id is not null and app.has_permission(company_id, 'companies', 'admin'))
  );

-- Shkrimi bëhet vetëm nga trigger-i (SECURITY DEFINER); klienti nuk ka policy insert.
create or replace function app.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
  v_row_id text;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new);
  end if;

  v_company := coalesce((v_new ->> 'company_id')::uuid, (v_old ->> 'company_id')::uuid);
  v_row_id := coalesce(v_new ->> 'id', v_old ->> 'id');

  -- Mos ruaj kolona të ndjeshme në audit (shifrohen veçmas)
  v_old := v_old - 'personal_id_enc' - 'credentials_vault_id';
  v_new := v_new - 'personal_id_enc' - 'credentials_vault_id';

  insert into public.audit_logs (company_id, user_id, action, table_name, row_id, old_data, new_data)
  values (v_company, auth.uid(), lower(tg_op), tg_table_name, v_row_id, v_old, v_new);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- Audit edhe për tabelat e aksesit
create trigger audit_companies after insert or update or delete on public.companies
  for each row execute function app.audit_row();
create trigger audit_company_memberships after insert or update or delete on public.company_memberships
  for each row execute function app.audit_row();
create trigger audit_org_memberships after insert or update or delete on public.organization_memberships
  for each row execute function app.audit_row();

-- Funksion për regjistrime manuale (p.sh. login, impersonate) nga serveri
create or replace function public.log_audit_event(
  p_company_id uuid, p_action text, p_table text, p_row_id text, p_reason text default null
) returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (company_id, user_id, action, table_name, row_id, reason)
  values (p_company_id, auth.uid(), p_action, p_table, p_row_id, p_reason);
$$;
grant execute on function public.log_audit_event(uuid, text, text, text, text) to authenticated;
