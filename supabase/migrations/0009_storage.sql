-- 0009 · Storage: bucket privat "documents" + policies mbi storage.objects
-- Path: companies/{company_id}/{category}/{uuid}.{ext}
-- Vlen vetëm në Supabase (skema storage); lokalisht kapërcehet nga scripts/db-local.sh.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 26214400,
  array['application/pdf','image/jpeg','image/png','image/webp','image/heic',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel',
        'text/csv','text/xml','application/xml','application/json',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- company_id nga path-i: companies/<uuid>/...
create or replace function app.storage_company_id(p_name text)
returns uuid language sql immutable as $$
  select case when p_name ~ '^companies/[0-9a-f-]{36}/' then substring(p_name from 11 for 36)::uuid end;
$$;

drop policy if exists documents_read on storage.objects;
drop policy if exists documents_insert on storage.objects;
drop policy if exists documents_update on storage.objects;
drop policy if exists documents_delete on storage.objects;

create policy documents_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and app.has_permission(app.storage_company_id(name), 'documents', 'read'));

create policy documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and app.has_permission(app.storage_company_id(name), 'documents', 'write'));

create policy documents_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and app.has_permission(app.storage_company_id(name), 'documents', 'write'));

-- Fshirje fizike vetëm nga kush mund të mbyllë periudha (accountant / org_owner)
create policy documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and app.has_permission(app.storage_company_id(name), 'invoices', 'close'));
