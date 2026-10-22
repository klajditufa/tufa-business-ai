-- ===========================================================================
-- 0023 · Administrimi i rregullave tatimore globale (vetëm super admin)
--   * confirmed_by / confirmed_at + audit në tax_rules
--   * confirm_tax_rule(id)                     · konfirmon vlerën ekzistuese
--   * correct_tax_rule(id, params, source)     · korrigjon një vlerë të futur gabim (pa histori të re)
--   * supersede_tax_rule(id, params, from, source)
--       · ndryshim ligjor: mbyll rregullin e vjetër më (from − 1) dhe krijon të riun nga `from`,
--         kështu llogaritjet e periudhave të kaluara mbeten me vlerën e vjetër.
-- ===========================================================================
alter table public.tax_rules
  add column if not exists confirmed_by uuid references public.users(id),
  add column if not exists confirmed_at timestamptz;

drop trigger if exists audit_tax_rules on public.tax_rules;
create trigger audit_tax_rules after insert or update or delete on public.tax_rules
  for each row execute function app.audit_row();

create or replace function app.require_super_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not app.is_super_admin() then
    raise exception 'Vetëm administratori i platformës mund të ndryshojë rregullat tatimore globale' using errcode = '42501';
  end if;
end $$;

create or replace function app.validate_rule_params(p_params jsonb)
returns void language plpgsql immutable as $$
begin
  if p_params is null or jsonb_typeof(p_params) <> 'object' or p_params = '{}'::jsonb then
    raise exception 'Parametrat duhet të jenë një objekt jo bosh' using errcode = '22023';
  end if;
end $$;

create or replace function public.confirm_tax_rule(p_id uuid)
returns public.tax_rules language plpgsql security definer set search_path = public as $$
declare v public.tax_rules;
begin
  perform app.require_super_admin();
  update public.tax_rules set confirmed = true, confirmed_by = auth.uid(), confirmed_at = now()
   where id = p_id and company_id is null
  returning * into v;
  if v.id is null then raise exception 'Rregulli nuk u gjet' using errcode = 'P0002'; end if;
  return v;
end $$;

create or replace function public.correct_tax_rule(p_id uuid, p_params jsonb, p_source text default null)
returns public.tax_rules language plpgsql security definer set search_path = public as $$
declare v public.tax_rules;
begin
  perform app.require_super_admin();
  perform app.validate_rule_params(p_params);
  update public.tax_rules
     set params = p_params, source = coalesce(nullif(btrim(p_source), ''), source),
         confirmed = true, confirmed_by = auth.uid(), confirmed_at = now()
   where id = p_id and company_id is null
  returning * into v;
  if v.id is null then raise exception 'Rregulli nuk u gjet' using errcode = 'P0002'; end if;
  return v;
end $$;

create or replace function public.supersede_tax_rule(p_id uuid, p_params jsonb, p_valid_from date, p_source text)
returns public.tax_rules language plpgsql security definer set search_path = public as $$
declare v_old public.tax_rules; v_new public.tax_rules;
begin
  perform app.require_super_admin();
  perform app.validate_rule_params(p_params);
  select * into v_old from public.tax_rules where id = p_id and company_id is null for update;
  if v_old.id is null then raise exception 'Rregulli nuk u gjet' using errcode = 'P0002'; end if;
  if p_valid_from is null or p_valid_from <= v_old.valid_from then
    raise exception 'Data e hyrjes në fuqi duhet të jetë pas %; për gabime përdor korrigjimin', v_old.valid_from using errcode = '22023';
  end if;
  if v_old.valid_to is not null and p_valid_from > v_old.valid_to + 1 then
    raise exception 'Rregulli i vjetër ka mbaruar më %; vlera e re duhet të fillojë deri më %', v_old.valid_to, v_old.valid_to + 1 using errcode = '22023';
  end if;
  if coalesce(btrim(p_source), '') = '' then
    raise exception 'Shëno burimin ligjor (ligj, VKM, udhëzim)' using errcode = '22023';
  end if;

  update public.tax_rules set valid_to = p_valid_from - 1 where id = v_old.id;
  insert into public.tax_rules (scope, company_id, kind, code, params, valid_from, valid_to, source, confirmed, confirmed_by, confirmed_at, created_by)
  values ('global', null, v_old.kind, v_old.code, p_params, p_valid_from, v_old.valid_to, btrim(p_source), true, auth.uid(), now(), auth.uid())
  returning * into v_new;
  return v_new;
end $$;

revoke all on function public.confirm_tax_rule(uuid) from public, anon;
revoke all on function public.correct_tax_rule(uuid, jsonb, text) from public, anon;
revoke all on function public.supersede_tax_rule(uuid, jsonb, date, text) from public, anon;
grant execute on function public.confirm_tax_rule(uuid) to authenticated;
grant execute on function public.correct_tax_rule(uuid, jsonb, text) to authenticated;
grant execute on function public.supersede_tax_rule(uuid, jsonb, date, text) to authenticated;
