-- ===========================================================================
-- 0018 · Fix: në Supabase pgcrypto (gen_random_bytes, digest) jeton në skemën
-- `extensions`, jo në `public`. Funksionet e çelësave API e kërkonin vetëm te public
-- → "function gen_random_bytes(integer) does not exist".
-- ===========================================================================
alter function public.create_api_key(uuid, text)                set search_path = public, extensions;
alter function public.resolve_api_key(text, text)               set search_path = public, extensions;
alter function public.sync_check_key(text)                      set search_path = public, extensions;
alter function public.sync_cis_invoices(text, public.invoice_direction, jsonb, text) set search_path = public, extensions;
