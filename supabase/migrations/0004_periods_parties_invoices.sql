-- 0004 · Periudhat fiskale, palët (klientë/furnitorë), faturat, importet, banka

-- ---------------------------------------------------------------------------
-- fiscal_periods
-- ---------------------------------------------------------------------------
create table public.fiscal_periods (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  year        smallint not null check (year between 2000 and 2100),
  month       smallint not null check (month between 1 and 12),
  status      public.period_status not null default 'open',
  closed_by   uuid references public.users(id),
  closed_at   timestamptz,
  reopened_by uuid references public.users(id),
  reopened_at timestamptz,
  reopen_reason text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, year, month)
);
create trigger trg_fiscal_periods_updated before update on public.fiscal_periods
  for each row execute function app.set_updated_at();

-- Kthen (ose krijon) periudhën për një datë
create or replace function app.period_for_date(p_company_id uuid, p_date date)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.fiscal_periods
   where company_id = p_company_id and year = extract(year from p_date) and month = extract(month from p_date);
  if v_id is null then
    insert into public.fiscal_periods (company_id, year, month)
    values (p_company_id, extract(year from p_date), extract(month from p_date))
    on conflict (company_id, year, month) do update set updated_at = now()
    returning id into v_id;
  end if;
  return v_id;
end $$;

-- A është periudha e mbyllur?
create or replace function app.period_is_closed(p_period_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'closed' from public.fiscal_periods where id = p_period_id), false);
$$;

-- Trigger: bllokon shkrime në periudhë të mbyllur (përveç kur app.reopen në progres)
create or replace function app.block_closed_period()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_period uuid;
begin
  if current_setting('app.bypass_period_lock', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  v_period := case when tg_op = 'DELETE' then old.period_id else new.period_id end;
  if app.period_is_closed(v_period) then
    raise exception 'Periudha është e mbyllur; rihapeni me reopen_period() para se të ndryshoni regjistrimet.'
      using errcode = 'P0001', hint = 'closed_period';
  end if;
  if tg_op = 'UPDATE' and old.period_id <> new.period_id and app.period_is_closed(old.period_id) then
    raise exception 'Regjistrimi i përket një periudhe të mbyllur.' using errcode = 'P0001', hint = 'closed_period';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- customers / suppliers
-- ---------------------------------------------------------------------------
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  nipt          text,
  name          text not null,
  email         citext,
  phone         text,
  address       text,
  country       char(2) not null default 'AL',
  is_vat_payer  boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index customers_company_idx on public.customers (company_id, name);
create unique index customers_company_nipt_uq on public.customers (company_id, nipt) where nipt is not null and deleted_at is null;
create trigger trg_customers_updated before update on public.customers for each row execute function app.set_updated_at();

create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  nipt          text,
  name          text not null,
  email         citext,
  phone         text,
  address       text,
  country       char(2) not null default 'AL',
  is_foreign    boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index suppliers_company_idx on public.suppliers (company_id, name);
create unique index suppliers_company_nipt_uq on public.suppliers (company_id, nipt) where nipt is not null and deleted_at is null;
create trigger trg_suppliers_updated before update on public.suppliers for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- import_batches · çdo import gjurmohet dhe mund të rikthehet
-- ---------------------------------------------------------------------------
create table public.import_batches (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  direction        public.invoice_direction,
  format           public.import_format not null,
  file_document_id uuid,                        -- FK te documents, shtohet në 0006
  file_name        text,
  rows_total       integer not null default 0,
  rows_imported    integer not null default 0,
  rows_duplicate   integer not null default 0,
  rows_error       integer not null default 0,
  status           public.import_status not null default 'queued',
  errors           jsonb not null default '[]'::jsonb,
  created_by       uuid references public.users(id),
  created_at       timestamptz not null default now(),
  finished_at      timestamptz,
  reverted_at      timestamptz
);
create index import_batches_company_idx on public.import_batches (company_id, created_at desc);

-- Rreshta staging para konfirmimit
create table public.import_rows (
  id          bigint generated always as identity primary key,
  batch_id    uuid not null references public.import_batches(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  row_no      integer not null,
  raw         jsonb not null,
  normalized  jsonb,
  status      public.import_row_status not null default 'new',
  error       text,
  invoice_id  uuid
);
create index import_rows_batch_idx on public.import_rows (batch_id, status);

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
create table public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  period_id           uuid not null references public.fiscal_periods(id) on delete restrict,
  direction           public.invoice_direction not null,
  type                public.invoice_type not null default 'normal',
  number              text,                 -- numri i faturës i lëshuesit
  nivf                text,                 -- numri identifikues i veçantë i faturës (fiskalizimi)
  nslf                text,                 -- numri i sigurisë i lëshuesit
  issue_date          date not null,
  due_date            date,
  customer_id         uuid references public.customers(id) on delete set null,
  supplier_id         uuid references public.suppliers(id) on delete set null,
  counterparty_name   text,                 -- siç vjen nga importi, edhe pa palë të lidhur
  counterparty_nipt   text,
  currency            public.currency_code not null default 'ALL',
  exchange_rate       numeric(12,6) not null default 1,
  subtotal            numeric(18,2) not null default 0,
  vat_amount          numeric(18,2) not null default 0,
  total               numeric(18,2) not null default 0,
  vat_breakdown       jsonb not null default '[]'::jsonb,  -- [{rate:20, base:..., vat:...}]
  corrects_invoice_id uuid references public.invoices(id) on delete set null,
  payment_status      public.payment_status not null default 'unpaid',
  payment_method      public.payment_method not null default 'unknown',
  paid_amount         numeric(18,2) not null default 0,
  paid_at             date,
  source              public.invoice_source not null default 'manual',
  import_batch_id     uuid references public.import_batches(id) on delete set null,
  raw                 jsonb,                 -- rreshti origjinal i importit
  notes               text,
  created_by          uuid references public.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  check (total = subtotal + vat_amount),
  check (paid_amount >= 0 and paid_amount <= abs(total) + 0.01),
  check ((direction = 'sale' and supplier_id is null) or (direction = 'purchase' and customer_id is null)),
  check (type <> 'corrective' or corrects_invoice_id is not null or raw is not null)
);
create index invoices_company_date_idx on public.invoices (company_id, issue_date desc) where deleted_at is null;
create index invoices_company_period_idx on public.invoices (company_id, period_id, direction) where deleted_at is null;
create index invoices_customer_idx on public.invoices (customer_id) where customer_id is not null;
create index invoices_supplier_idx on public.invoices (supplier_id) where supplier_id is not null;
create index invoices_batch_idx on public.invoices (import_batch_id) where import_batch_id is not null;
-- Dublikata e pamundur: i njëjti NIVF në të njëjtën kompani dhe drejtim
create unique index invoices_company_dir_nivf_uq on public.invoices (company_id, direction, nivf)
  where nivf is not null and deleted_at is null;

create trigger trg_invoices_updated before update on public.invoices for each row execute function app.set_updated_at();
create trigger trg_invoices_period_lock before insert or update or delete on public.invoices
  for each row execute function app.block_closed_period();
create trigger audit_invoices after insert or update or delete on public.invoices
  for each row execute function app.audit_row();

-- Vendos period_id automatikisht nga issue_date kur mungon
create or replace function app.invoices_set_period()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.period_id is null then
    new.period_id := app.period_for_date(new.company_id, new.issue_date);
  end if;
  return new;
end $$;
alter table public.invoices alter column period_id drop not null;
create trigger trg_invoices_set_period before insert or update of issue_date on public.invoices
  for each row execute function app.invoices_set_period();

-- ---------------------------------------------------------------------------
-- invoice_items
-- ---------------------------------------------------------------------------
create table public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  line_no     integer not null,
  description text not null default '',
  qty         numeric(14,3) not null default 1,
  unit        text,
  unit_price  numeric(18,4) not null default 0,
  vat_rate    numeric(5,2) not null default 20,
  vat_amount  numeric(18,2) not null default 0,
  line_total  numeric(18,2) not null default 0,
  unique (invoice_id, line_no)
);
create index invoice_items_company_idx on public.invoice_items (company_id);

-- ---------------------------------------------------------------------------
-- bank_transactions (import CSV i ekstraktit; rakordimi në Fazën 2)
-- ---------------------------------------------------------------------------
create table public.bank_transactions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  bank_account  text not null,
  date          date not null,
  amount        numeric(18,2) not null,
  currency      public.currency_code not null default 'ALL',
  counterparty  text,
  reference     text,
  description   text,
  matched_invoice_id uuid references public.invoices(id) on delete set null,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  hash          text,
  created_at    timestamptz not null default now()
);
create index bank_tx_company_date_idx on public.bank_transactions (company_id, date desc);
create unique index bank_tx_company_hash_uq on public.bank_transactions (company_id, hash) where hash is not null;

-- ---------------------------------------------------------------------------
-- RLS · shabllon: SELECT nëse ka 'read', shkrim nëse ka 'write'
-- ---------------------------------------------------------------------------
alter table public.fiscal_periods enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.bank_transactions enable row level security;

create policy fp_select on public.fiscal_periods for select to authenticated
  using (company_id in (select app.user_company_ids()));
create policy fp_insert on public.fiscal_periods for insert to authenticated
  with check (app.has_permission(company_id, 'invoices', 'write'));
-- Mbyllja/rihapja bëhet vetëm nga funksionet e dedikuara (më poshtë), jo me UPDATE direkt
create policy fp_update_meta on public.fiscal_periods for update to authenticated
  using (app.has_permission(company_id, 'invoices', 'close') and status <> 'closed')
  with check (app.has_permission(company_id, 'invoices', 'close') and status <> 'closed');

create policy customers_select on public.customers for select to authenticated
  using (app.has_permission(company_id, 'invoices', 'read'));
create policy customers_write on public.customers for all to authenticated
  using (app.has_permission(company_id, 'invoices', 'write'))
  with check (app.has_permission(company_id, 'invoices', 'write'));

create policy suppliers_select on public.suppliers for select to authenticated
  using (app.has_permission(company_id, 'invoices', 'read'));
create policy suppliers_write on public.suppliers for all to authenticated
  using (app.has_permission(company_id, 'invoices', 'write'))
  with check (app.has_permission(company_id, 'invoices', 'write'));

create policy import_batches_select on public.import_batches for select to authenticated
  using (app.has_permission(company_id, 'invoices', 'read'));
create policy import_batches_write on public.import_batches for all to authenticated
  using (app.has_permission(company_id, 'invoices', 'write'))
  with check (app.has_permission(company_id, 'invoices', 'write'));

create policy import_rows_select on public.import_rows for select to authenticated
  using (app.has_permission(company_id, 'invoices', 'read'));
create policy import_rows_write on public.import_rows for all to authenticated
  using (app.has_permission(company_id, 'invoices', 'write'))
  with check (app.has_permission(company_id, 'invoices', 'write'));

create policy invoices_select on public.invoices for select to authenticated
  using (app.has_permission(company_id, 'invoices', 'read') and deleted_at is null);
create policy invoices_insert on public.invoices for insert to authenticated
  with check (app.has_permission(company_id, 'invoices', 'write'));
create policy invoices_update on public.invoices for update to authenticated
  using (app.has_permission(company_id, 'invoices', 'write'))
  with check (app.has_permission(company_id, 'invoices', 'write'));
-- Fshirje fizike: vetëm kush mund të mbyllë periudha (accountant/org_owner); përndryshe soft delete
create policy invoices_delete on public.invoices for delete to authenticated
  using (app.has_permission(company_id, 'invoices', 'close'));

create policy invoice_items_select on public.invoice_items for select to authenticated
  using (app.has_permission(company_id, 'invoices', 'read'));
create policy invoice_items_write on public.invoice_items for all to authenticated
  using (app.has_permission(company_id, 'invoices', 'write'))
  with check (app.has_permission(company_id, 'invoices', 'write'));

create policy bank_tx_select on public.bank_transactions for select to authenticated
  using (app.has_permission(company_id, 'invoices', 'read'));
create policy bank_tx_write on public.bank_transactions for all to authenticated
  using (app.has_permission(company_id, 'invoices', 'write'))
  with check (app.has_permission(company_id, 'invoices', 'write'));

-- ---------------------------------------------------------------------------
-- Mbyllja dhe rihapja e periudhës (vetëm përmes këtyre funksioneve, me audit)
-- ---------------------------------------------------------------------------
create or replace function public.close_period(p_period_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  select company_id into v_company from public.fiscal_periods where id = p_period_id;
  if v_company is null then raise exception 'period not found'; end if;
  if not app.has_permission(v_company, 'invoices', 'close') then
    raise exception 'insufficient privileges' using errcode = '42501';
  end if;
  update public.fiscal_periods
     set status = 'closed', closed_by = auth.uid(), closed_at = now()
   where id = p_period_id;
  perform public.log_audit_event(v_company, 'custom', 'fiscal_periods', p_period_id::text, 'close_period');
end $$;

create or replace function public.reopen_period(p_period_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  if coalesce(length(p_reason), 0) < 5 then raise exception 'reason required'; end if;
  select company_id into v_company from public.fiscal_periods where id = p_period_id;
  if v_company is null then raise exception 'period not found'; end if;
  if not app.has_permission(v_company, 'invoices', 'close') then
    raise exception 'insufficient privileges' using errcode = '42501';
  end if;
  update public.fiscal_periods
     set status = 'open', reopened_by = auth.uid(), reopened_at = now(), reopen_reason = p_reason
   where id = p_period_id;
  insert into public.audit_logs (company_id, user_id, action, table_name, row_id, reason)
  values (v_company, auth.uid(), 'reopen_period', 'fiscal_periods', p_period_id::text, p_reason);
end $$;

grant execute on function public.close_period(uuid) to authenticated;
grant execute on function public.reopen_period(uuid, text) to authenticated;
