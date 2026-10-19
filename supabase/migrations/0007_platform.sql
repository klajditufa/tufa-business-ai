-- 0007 · Platforma: detyra, njoftime, plane/abonime, biseda AI (strukturë e fiksuar tani, përdoret në Fazat 2–4)

-- ---------------------------------------------------------------------------
-- tasks · detyrat e studios për çdo klient
-- ---------------------------------------------------------------------------
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  declaration_id  uuid references public.tax_declarations(id) on delete set null,
  title           text not null,
  kind            text not null default 'general',   -- 'missing_documents' | 'declaration' | 'review' | 'general'
  description     text,
  assigned_to     uuid references public.users(id),
  due_date        date,
  status          public.task_status not null default 'open',
  created_by      uuid references public.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz
);
create index tasks_company_status_idx on public.tasks (company_id, status, due_date);
create index tasks_assignee_idx on public.tasks (assigned_to, status) where assigned_to is not null;
create trigger trg_tasks_updated before update on public.tasks for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications · in-app; email dërgohet nga worker dhe shënohet sent_email_at
-- ---------------------------------------------------------------------------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete cascade,
  kind          text not null,          -- 'deadline' | 'declaration_status' | 'import_done' | 'invite' | 'system'
  title         text not null,
  body          text,
  link          text,
  read_at       timestamptz,
  sent_email_at timestamptz,
  created_at    timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

-- ---------------------------------------------------------------------------
-- plans / subscriptions · pagesa reale e ndarë; asnjë abonim 'active' pa payment_provider_ref në Fazën 4
-- ---------------------------------------------------------------------------
create table public.plans (
  id          text primary key,            -- 'starter' | 'business' | 'professional' | 'enterprise'
  name        text not null,
  price_month numeric(18,2) not null default 0,
  currency    public.currency_code not null default 'ALL',
  limits      jsonb not null default '{}'::jsonb,   -- {companies:1, users:2, storage_mb:500, ai_requests:0, modules:[...]}
  is_active   boolean not null default true,
  sort_order  integer not null default 0
);

create table public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  plan_id              text not null references public.plans(id),
  status               public.subscription_status not null default 'trialing',
  period_start         date not null default current_date,
  period_end           date,
  payment_provider     text,              -- 'stripe' | 'paysera' | 'manual' (Faza 4)
  payment_provider_ref text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (status <> 'active' or payment_provider is not null)
);
create index subscriptions_org_idx on public.subscriptions (organization_id, status);
create trigger trg_subscriptions_updated before update on public.subscriptions for each row execute function app.set_updated_at();

alter table public.organizations
  add column subscription_id uuid references public.subscriptions(id) on delete set null;

insert into public.plans (id, name, price_month, limits, sort_order) values
  ('starter',      'Starter',      0, '{"companies":1,"users":2,"storage_mb":500,"ai_requests":0,"modules":["invoices","documents","vat","reports"]}', 1),
  ('business',     'Business',     0, '{"companies":3,"users":5,"storage_mb":5000,"ai_requests":200,"modules":["invoices","documents","vat","reports","declarations","obligations","payroll"]}', 2),
  ('professional', 'Professional', 0, '{"companies":50,"users":20,"storage_mb":50000,"ai_requests":2000,"modules":["*"]}', 3),
  ('enterprise',   'Enterprise',   0, '{"companies":-1,"users":-1,"storage_mb":-1,"ai_requests":-1,"modules":["*"]}', 4);
-- Çmimet 0 = TBD; vendosen në Fazën 4, jo në kod.

-- ---------------------------------------------------------------------------
-- ai_conversations / ai_messages (Faza 3)
-- ---------------------------------------------------------------------------
create table public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table public.ai_messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'tool')),
  content         text not null,
  tool_calls      jsonb,
  tokens_in       integer,
  tokens_out      integer,
  created_at      timestamptz not null default now()
);
create index ai_messages_conv_idx on public.ai_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy tasks_select on public.tasks for select to authenticated
  using (app.has_permission(company_id, 'declarations', 'read'));
create policy tasks_write on public.tasks for all to authenticated
  using (app.has_permission(company_id, 'studio', 'write') or app.has_permission(company_id, 'declarations', 'write'))
  with check (app.has_permission(company_id, 'studio', 'write') or app.has_permission(company_id, 'declarations', 'write'));

create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy plans_read on public.plans for select to authenticated using (true);

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (organization_id in (select app.user_org_ids()) or app.is_super_admin());
-- Shkrimi i abonimeve: vetëm service_role / super admin (Faza 4)
create policy subscriptions_admin on public.subscriptions for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy ai_conv_own on public.ai_conversations for all to authenticated
  using (user_id = auth.uid() and company_id in (select app.user_company_ids()))
  with check (user_id = auth.uid() and company_id in (select app.user_company_ids()));
create policy ai_msg_own on public.ai_messages for all to authenticated
  using (conversation_id in (select id from public.ai_conversations where user_id = auth.uid()))
  with check (conversation_id in (select id from public.ai_conversations where user_id = auth.uid()));
