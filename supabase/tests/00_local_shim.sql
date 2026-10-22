-- Shim për Postgres lokal (jo Supabase): imiton auth.uid(), auth.users, rolet dhe storage.
-- NUK ekzekutohet në Supabase — aty këto ekzistojnë.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

-- Si në Supabase: pgcrypto jeton në skemën `extensions` dhe search_path i bazës e përfshin.
-- Kështu funksionet me `set search_path = public` që thërrasin pgcrypto dështojnë edhe lokalisht.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
do $$ begin
  execute format('alter database %I set search_path = "$user", public, extensions', current_database());
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  instance_id uuid, aud text, role text,
  email text, encrypted_password text, email_confirmed_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz, updated_at timestamptz,
  confirmation_token text, recovery_token text, email_change_token_new text, email_change text
);
create table if not exists auth.identities (
  id uuid primary key, user_id uuid, provider_id text, identity_data jsonb, provider text,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz,
  unique (provider_id, provider)
);

-- auth.uid() lexon request.jwt.claim.sub siç bën Supabase
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '');
$$;

-- storage minimal që 0009 të aplikohet
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, created_at timestamptz default now()
);
alter table storage.objects enable row level security;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to authenticated, service_role;
alter default privileges in schema public grant all on sequences to authenticated, service_role;
alter default privileges in schema public grant execute on functions to authenticated, service_role;
