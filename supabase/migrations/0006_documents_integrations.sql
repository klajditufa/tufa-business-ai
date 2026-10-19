-- 0006 · Dokumente (arkiva), lidhjet faturë↔dokument, integrimet, sync_jobs

-- ---------------------------------------------------------------------------
-- documents
-- storage_path: companies/{company_id}/{category}/{uuid}.{ext}  (bucket privat "documents")
-- ---------------------------------------------------------------------------
create table public.documents (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  category            public.document_category not null default 'other',
  storage_path        text not null unique,
  file_name           text not null,
  mime                text not null,
  size_bytes          bigint not null check (size_bytes >= 0 and size_bytes <= 26214400), -- 25 MB
  sha256              text,
  title               text,
  description         text,
  tags                text[] not null default '{}',
  document_date       date,
  ocr_text            text,
  ocr_status          public.ocr_status not null default 'none',
  version             integer not null default 1,
  previous_version_id uuid references public.documents(id) on delete set null,
  linked_type         text,       -- 'invoice' | 'declaration' | 'obligation' | 'employee' | ...
  linked_id           uuid,
  uploaded_by         uuid references public.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index documents_company_cat_idx on public.documents (company_id, category, created_at desc) where deleted_at is null;
create index documents_linked_idx on public.documents (linked_type, linked_id) where linked_id is not null;
create unique index documents_company_sha_uq on public.documents (company_id, sha256) where sha256 is not null and deleted_at is null;
create index documents_ocr_search_idx on public.documents using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(ocr_text, '')));
create trigger trg_documents_updated before update on public.documents for each row execute function app.set_updated_at();
create trigger audit_documents after insert or update or delete on public.documents
  for each row execute function app.audit_row();

-- Kontroll: storage_path duhet të fillojë me companies/{company_id}/
create or replace function app.documents_check_path()
returns trigger language plpgsql as $$
begin
  if new.storage_path !~ ('^companies/' || new.company_id::text || '/') then
    raise exception 'storage_path duhet të jetë brenda companies/%/', new.company_id;
  end if;
  return new;
end $$;
create trigger trg_documents_path before insert or update on public.documents
  for each row execute function app.documents_check_path();

create table public.invoice_documents (
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  primary key (invoice_id, document_id)
);

-- FK-të e shtyra nga migrations e mëparshme
alter table public.import_batches
  add constraint import_batches_file_fk foreign key (file_document_id) references public.documents(id) on delete set null;
alter table public.tax_declarations
  add constraint tax_decl_source_doc_fk foreign key (source_document_id) references public.documents(id) on delete set null;
alter table public.tax_obligations
  add constraint tax_oblig_payment_doc_fk foreign key (payment_order_document_id) references public.documents(id) on delete set null;

-- ---------------------------------------------------------------------------
-- integrations · statusi i deklaruar; kredencialet KURRË këtu (vetëm referencë Vault)
-- ---------------------------------------------------------------------------
create table public.integrations (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies(id) on delete cascade,
  provider             public.integration_provider not null,
  status               public.integration_status not null default 'pending_integration',
  credentials_vault_id uuid,          -- referencë në vault.secrets (Faza 2), asnjëherë vlerë
  config               jsonb not null default '{}'::jsonb,
  last_sync_at         timestamptz,
  last_error           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (company_id, provider)
);
create trigger trg_integrations_updated before update on public.integrations for each row execute function app.set_updated_at();
create trigger audit_integrations after insert or update or delete on public.integrations
  for each row execute function app.audit_row();

-- Çdo kompani e re merr automatikisht manual_import = functional dhe DPT = pending
create or replace function app.companies_default_integrations()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.integrations (company_id, provider, status) values
    (new.id, 'manual_import', 'functional'),
    (new.id, 'selfcare', 'pending_integration'),
    (new.id, 'cats', 'pending_integration'),
    (new.id, 'bank', 'unavailable')
  on conflict do nothing;
  return new;
end $$;
create trigger trg_companies_integrations after insert on public.companies
  for each row execute function app.companies_default_integrations();

-- ---------------------------------------------------------------------------
-- sync_jobs · radha e punëve (pg_cron / Edge Functions marrin 'queued')
-- ---------------------------------------------------------------------------
create table public.sync_jobs (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  integration_id uuid references public.integrations(id) on delete set null,
  kind           text not null,    -- 'import_parse' | 'import_commit' | 'notify_deadlines' | ...
  status         public.job_status not null default 'queued',
  payload        jsonb not null default '{}'::jsonb,
  result         jsonb,
  error          text,
  attempts       integer not null default 0,
  run_after      timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz,
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now()
);
create index sync_jobs_queue_idx on public.sync_jobs (status, run_after) where status = 'queued';
create index sync_jobs_company_idx on public.sync_jobs (company_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.documents enable row level security;
alter table public.invoice_documents enable row level security;
alter table public.integrations enable row level security;
alter table public.sync_jobs enable row level security;

create policy documents_select on public.documents for select to authenticated
  using (app.has_permission(company_id, 'documents', 'read') and deleted_at is null);
create policy documents_insert on public.documents for insert to authenticated
  with check (app.has_permission(company_id, 'documents', 'write') and uploaded_by = auth.uid());
create policy documents_update on public.documents for update to authenticated
  using (app.has_permission(company_id, 'documents', 'write'))
  with check (app.has_permission(company_id, 'documents', 'write'));
-- Pa DELETE policy: dokumentet fshihen vetëm me soft delete (deleted_at)

create policy invoice_documents_select on public.invoice_documents for select to authenticated
  using (app.has_permission(company_id, 'documents', 'read'));
create policy invoice_documents_write on public.invoice_documents for all to authenticated
  using (app.has_permission(company_id, 'documents', 'write'))
  with check (app.has_permission(company_id, 'documents', 'write'));

create policy integrations_select on public.integrations for select to authenticated
  using (app.has_permission(company_id, 'companies', 'read'));
create policy integrations_update on public.integrations for update to authenticated
  using (app.has_permission(company_id, 'companies', 'admin'))
  with check (app.has_permission(company_id, 'companies', 'admin') and credentials_vault_id is null);
-- Vendosja e credentials_vault_id bëhet vetëm nga service_role (Faza 2)

create policy sync_jobs_select on public.sync_jobs for select to authenticated
  using (app.has_permission(company_id, 'invoices', 'read'));
create policy sync_jobs_insert on public.sync_jobs for insert to authenticated
  with check (app.has_permission(company_id, 'invoices', 'write') and created_by = auth.uid() and status = 'queued');
-- Ndryshimi i statusit bëhet nga service_role (worker)
