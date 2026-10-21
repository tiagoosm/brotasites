-- Publishing: choosing the site address and asking for the site to be generated.
--
-- Clients cannot write site status or jobs (see the first migration), so they go through
-- these functions, which check ownership and the address. The worker (server, secret key)
-- claims queued jobs, validates the draft with the Zod schema and builds the site.

-- Keep in sync with reservedSubdomains in packages/schema/src/publish.ts (a test checks it).
create function public.is_reserved_subdomain(p_subdomain text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_subdomain = any (array[
    'www', 'app', 'api', 'admin', 'painel', 'conta', 'entrar', 'login', 'mail', 'email',
    'smtp', 'ftp', 'blog', 'status', 'ajuda', 'suporte', 'docs', 'cdn', 'static', 'assets',
    'dev', 'staging', 'teste', 'test', 'preview', 'previa', 'brotasites'
  ]);
$$;

-- Whether an address can be used: well formed, not reserved and not taken by someone else.
-- Anyone may ask (the form checks before sign-in); addresses of live sites are public anyway.
create function public.subdomain_available(p_subdomain text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_subdomain ~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$'
    and not public.is_reserved_subdomain(p_subdomain)
    and not exists (
      select 1 from public.sites s
      where s.subdomain = p_subdomain
        and s.owner_id is distinct from (select auth.uid())
    );
$$;

alter table public.jobs add column started_at timestamptz;

-- Reserves the address and queues the generation. Errors use stable messages that the form
-- translates: site_not_found, subdomain_invalid, subdomain_taken, already_running.
create function public.request_publication(p_site_id uuid, p_subdomain text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.site_status;
  job_id uuid;
begin
  select status into current_status from public.sites
    where id = p_site_id and owner_id = (select auth.uid())
    for update;
  if not found then
    raise exception 'site_not_found';
  end if;
  if current_status in ('generating', 'publishing') then
    raise exception 'already_running';
  end if;
  if p_subdomain !~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$' or public.is_reserved_subdomain(p_subdomain) then
    raise exception 'subdomain_invalid';
  end if;

  begin
    update public.sites set subdomain = p_subdomain, status = 'generating' where id = p_site_id;
  exception when unique_violation then
    raise exception 'subdomain_taken';
  end;

  insert into public.jobs (site_id, kind) values (p_site_id, 'generate') returning id into job_id;
  return job_id;
end;
$$;

-- The worker takes the oldest queued job; concurrent workers never take the same one.
create function public.claim_next_job()
returns setof public.jobs
language sql
set search_path = ''
as $$
  update public.jobs set status = 'running', started_at = now()
  where id = (
    select id from public.jobs where status = 'queued'
    order by created_at
    for update skip locked
    limit 1
  )
  returning *;
$$;

revoke execute on function public.is_reserved_subdomain(text) from public;
revoke execute on function public.subdomain_available(text) from public;
revoke execute on function public.request_publication(uuid, text) from public;
revoke execute on function public.claim_next_job() from public, anon, authenticated;

grant execute on function public.is_reserved_subdomain(text) to anon, authenticated;
grant execute on function public.subdomain_available(text) to anon, authenticated;
grant execute on function public.request_publication(uuid, text) to authenticated;
grant execute on function public.claim_next_job() to service_role;
