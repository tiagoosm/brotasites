-- Follow-up to 20261021180000_publication.sql.
-- 1. Supabase grants EXECUTE to anon and authenticated directly, so revoking from PUBLIC
--    was not enough: anon could call request_publication (it found no site, but still).
-- 2. Privileged (SECURITY DEFINER) code moves to the unexposed "private" schema; the API
--    only exposes SECURITY INVOKER wrappers, as the Supabase security advisor recommends.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create function private.subdomain_taken(p_subdomain text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sites s
    where s.subdomain = p_subdomain
      and s.owner_id is distinct from (select auth.uid())
  );
$$;

create or replace function public.subdomain_available(p_subdomain text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_subdomain ~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$'
    and not public.is_reserved_subdomain(p_subdomain)
    and not private.subdomain_taken(p_subdomain);
$$;

alter function public.request_publication(uuid, text) set schema private;

create function public.request_publication(p_site_id uuid, p_subdomain text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.request_publication(p_site_id, p_subdomain);
$$;

revoke execute on function private.subdomain_taken(text) from public, authenticated, anon;
revoke execute on function private.request_publication(uuid, text) from public, authenticated, anon;
revoke execute on function public.request_publication(uuid, text) from public, anon;
revoke execute on function public.claim_next_job() from anon, authenticated;

grant execute on function private.subdomain_taken(text) to anon, authenticated;
grant execute on function private.request_publication(uuid, text) to authenticated;
grant execute on function public.request_publication(uuid, text) to authenticated;
