-- The client's own domain (PLAN.md E25): included in the price and optional (owner's decision
-- of 2026-11-04). One domain per site, only for a paid site. The domain serves the site only
-- after the hosting (Cloudflare for SaaS) has validated the DNS record and issued the
-- certificate: typing a domain never activates it (no domain takeover). The platform's server
-- talks to the hosting; this file decides and records every change of state, atomically.
--
-- States, in the client's words (apps/platform/src/lib/domains/copy.ts):
--   pending    aguardando configuração (the DNS records are shown, nothing checked yet)
--   verifying  verificando (checked at least once, not valid yet, within 7 days)
--   active     ativo (validated, certificate issued, served by the Worker)
--   failed     com problema (7 days without validation, or the hosting refused it)
--   removed    removido (by the client, or with the site); kept for the history
-- Errors are stable codes the platform translates: site_not_found, not_paid, domain_taken,
-- domain_exists, domain_not_found, bad_transition, bad_request.

create table public.site_domains (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  -- The hostname connected (lowercase; "www.<domain>" when the client typed the domain itself).
  host text not null check (host ~ '^[a-z0-9.-]{4,253}$' and host = lower(host)),
  -- The domain without "www", which the client redirects at the registrar (see docs/hosting.md).
  alias_host text check (alias_host is null or (alias_host ~ '^[a-z0-9.-]{4,253}$' and alias_host = lower(alias_host))),
  status text not null default 'pending'
    check (status in ('pending', 'verifying', 'active', 'failed', 'removed')),
  -- True when the client chose the own domain as the main address (the other one redirects).
  is_primary boolean not null default true,
  -- The hosting's id for the custom hostname and the DNS records to show the client.
  provider_id text check (provider_id is null or char_length(provider_id) <= 100),
  dns_records jsonb not null default '[]'::jsonb check (jsonb_typeof(dns_records) = 'array'),
  -- A stable code (never the hosting's raw text): dns_missing, timeout, refused, conflict.
  failure_reason text check (failure_reason is null or failure_reason in ('dns_missing', 'timeout', 'refused', 'conflict')),
  verify_until timestamptz not null default now() + interval '7 days',
  last_checked_at timestamptz,
  verified_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Never two sites with the same domain, and one domain in use per site.
create unique index site_domains_host_once on public.site_domains (host) where status <> 'removed';
create unique index site_domains_alias_once on public.site_domains (alias_host)
  where status <> 'removed' and alias_host is not null;
create unique index site_domains_one_per_site on public.site_domains (site_id) where status <> 'removed';
create index site_domains_to_check on public.site_domains (status, verify_until)
  where status in ('pending', 'verifying');

alter table public.site_domains enable row level security;
revoke all on public.site_domains from anon, authenticated;
grant select on public.site_domains to authenticated;
-- The owner reads the domain of their sites; only the server's functions write.
create policy "Owners read the domains of their sites" on public.site_domains
  for select to authenticated
  using (exists (
    select 1 from public.sites s where s.id = site_id and s.owner_id = (select auth.uid())
  ));

-- What the hosting still has to drop when a site with a domain goes (deleted account, a site
-- removed by any path): the platform's daily routine takes it (lib/server/domains.ts).
create table public.domain_purges (
  id bigint generated always as identity primary key,
  site_id uuid not null,
  subdomain text,
  host text not null,
  alias_host text,
  provider_id text,
  requested_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  done_at timestamptz
);
alter table public.domain_purges enable row level security;
revoke all on public.domain_purges from anon, authenticated;

create function private.queue_domain_purge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.domain_purges (site_id, subdomain, host, alias_host, provider_id)
    select d.site_id, old.subdomain, d.host, d.alias_host, d.provider_id
    from public.site_domains d
    where d.site_id = old.id and d.status <> 'removed';
  return old;
end;
$$;
revoke execute on function private.queue_domain_purge() from public, anon, authenticated;
create trigger sites_queue_domain_purge before delete on public.sites
  for each row execute function private.queue_domain_purge();

-- New notices (E16): texts are written by the interface from the kind.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'directions_ready', 'site_ready_for_approval', 'changes_requested', 'site_published',
  'site_suspended', 'site_suspension_lifted', 'email_confirmed', 'site_deletion_warning',
  'domain_active', 'domain_failed'
));

-- The domain as the platform returns it (the client's and the team's view).
create function private.domain_json(d public.site_domains)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.id, 'siteId', d.site_id, 'host', d.host, 'aliasHost', d.alias_host,
    'status', d.status, 'primary', d.is_primary, 'records', d.dns_records,
    'failure', d.failure_reason, 'verifyUntil', d.verify_until,
    'lastCheckedAt', d.last_checked_at, 'verifiedAt', d.verified_at, 'createdAt', d.created_at
  );
$$;

-- The owner asks for a domain. The platform has already checked its format and the reserved
-- names (lib/domains/validate.ts); here: the site is theirs and paid, it has no other domain,
-- and nobody else uses this one.
create function public.server_domain_request(
  p_site_id uuid,
  p_user_id uuid,
  p_host text,
  p_alias text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  d_row public.site_domains%rowtype;
begin
  if p_host is null or p_host !~ '^[a-z0-9.-]{4,253}$' or (p_alias is not null and p_alias !~ '^[a-z0-9.-]{4,253}$') then
    raise exception 'bad_request';
  end if;
  select * into site from public.sites where id = p_site_id and owner_id = p_user_id for update;
  if not found then raise exception 'site_not_found'; end if;
  if not private.site_paid(site.id) or site.status not in ('publishing', 'live', 'grace', 'suspended') then
    raise exception 'not_paid';
  end if;
  if exists (select 1 from public.site_domains where site_id = site.id and status <> 'removed') then
    raise exception 'domain_exists';
  end if;
  if exists (
    select 1 from public.site_domains
    where status <> 'removed'
      and (host in (p_host, coalesce(p_alias, p_host)) or alias_host in (p_host, coalesce(p_alias, p_host)))
  ) then
    raise exception 'domain_taken';
  end if;
  insert into public.site_domains (site_id, host, alias_host)
    values (site.id, p_host, p_alias)
    returning * into d_row;
  perform private.add_event(site.id, 'domain_requested', 'Pedido de domínio próprio: ' || p_host || '.');
  return private.domain_json(d_row);
end;
$$;

-- The hosting registered the hostname: its id and the DNS records to show.
create function public.server_domain_attach(p_domain_id uuid, p_provider_id text, p_records jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d_row public.site_domains%rowtype;
begin
  if jsonb_typeof(coalesce(p_records, 'null'::jsonb)) <> 'array' or char_length(coalesce(p_provider_id, '')) not between 1 and 100 then
    raise exception 'bad_request';
  end if;
  update public.site_domains
    set provider_id = p_provider_id, dns_records = p_records, updated_at = now()
    where id = p_domain_id and status in ('pending', 'verifying')
    returning * into d_row;
  if not found then raise exception 'domain_not_found'; end if;
  return private.domain_json(d_row);
end;
$$;

-- The result of a check with the hosting. Only these moves exist:
--   pending|verifying -> verifying (not valid yet), active, failed
--   failed -> verifying (the client tries again: 7 more days)
--   active -> failed (the hosting dropped it: the DNS changed)
-- A check never brings back a removed domain. Every change leaves an event, and the two that
-- matter to the client leave a notice.
create function public.server_domain_set_status(
  p_domain_id uuid,
  p_status text,
  p_reason text default null,
  p_records jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d_row public.site_domains%rowtype;
  owner uuid;
  was text;
begin
  select * into d_row from public.site_domains where id = p_domain_id for update;
  if not found then raise exception 'domain_not_found'; end if;
  was := d_row.status;
  if not (
    (d_row.status in ('pending', 'verifying') and p_status in ('verifying', 'active', 'failed'))
    or (d_row.status = 'failed' and p_status = 'verifying')
    or (d_row.status = 'active' and p_status in ('active', 'failed'))
  ) then
    raise exception 'bad_transition';
  end if;
  if p_status = 'failed' and (p_reason is null or p_reason not in ('dns_missing', 'timeout', 'refused', 'conflict')) then
    raise exception 'bad_request';
  end if;
  if p_records is not null and jsonb_typeof(p_records) <> 'array' then raise exception 'bad_request'; end if;

  update public.site_domains set
    status = p_status,
    failure_reason = case when p_status = 'failed' then p_reason else null end,
    dns_records = coalesce(p_records, dns_records),
    last_checked_at = now(),
    verified_at = case when p_status = 'active' then coalesce(verified_at, now()) else verified_at end,
    -- Trying again after a failure gives 7 more days of automatic checks.
    verify_until = case when d_row.status = 'failed' and p_status = 'verifying' then now() + interval '7 days' else verify_until end,
    updated_at = now()
  where id = d_row.id
  returning * into d_row;

  select owner_id into owner from public.sites where id = d_row.site_id;
  if p_status = 'active' and was <> 'active' then
    perform private.add_event(d_row.site_id, 'domain_active', 'Domínio próprio ativo: ' || d_row.host || '.');
    perform private.notify(owner, d_row.site_id, 'domain_active');
  elsif p_status = 'failed' and was <> 'failed' then
    perform private.add_event(d_row.site_id, 'domain_failed', 'Não conseguimos verificar o domínio ' || d_row.host || '.');
    perform private.notify(owner, d_row.site_id, 'domain_failed');
  end if;
  return private.domain_json(d_row);
end;
$$;

-- The client chooses the main address: the own domain, or the BrotaSites address.
create function public.server_domain_set_primary(p_site_id uuid, p_user_id uuid, p_primary boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d_row public.site_domains%rowtype;
begin
  if p_primary is null then raise exception 'bad_request'; end if;
  update public.site_domains d set is_primary = p_primary, updated_at = now()
    from public.sites s
    where d.site_id = p_site_id and s.id = d.site_id and s.owner_id = p_user_id
      and d.status <> 'removed'
    returning d.* into d_row;
  if not found then raise exception 'domain_not_found'; end if;
  return private.domain_json(d_row);
end;
$$;

-- The client (p_user_id) or the platform (null: a site removed, a domain expired) removes it.
-- Returns what the hosting still has to drop.
create function public.server_domain_remove(p_site_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d_row public.site_domains%rowtype;
begin
  update public.site_domains d set status = 'removed', removed_at = now(), updated_at = now()
    from public.sites s
    where d.site_id = p_site_id and s.id = d.site_id
      and (p_user_id is null or s.owner_id = p_user_id)
      and d.status <> 'removed'
    returning d.* into d_row;
  if not found then raise exception 'domain_not_found'; end if;
  perform private.add_event(d_row.site_id, 'domain_removed', 'Domínio próprio removido: ' || d_row.host || '.');
  return private.domain_json(d_row) || jsonb_build_object('providerId', d_row.provider_id);
end;
$$;

-- The daily routine: domains still waiting (for the automatic checks), and the ones past their
-- 7 days, which become "com problema".
create function public.server_domains_to_check(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired integer;
begin
  if p_limit not between 1 and 500 then raise exception 'bad_request'; end if;
  with gone as (
    update public.site_domains
      set status = 'failed', failure_reason = 'timeout', updated_at = now()
      where status in ('pending', 'verifying') and verify_until <= now()
      returning id, site_id, host
  ), noted as (
    select private.add_event(g.site_id, 'domain_failed', 'Não conseguimos verificar o domínio ' || g.host || '.'),
           private.notify(s.owner_id, g.site_id, 'domain_failed')
    from gone g join public.sites s on s.id = g.site_id
  )
  select count(*) into expired from noted;
  return jsonb_build_object(
    'expired', expired,
    'due', (
      select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'siteId', d.site_id, 'host', d.host,
        'aliasHost', d.alias_host, 'providerId', d.provider_id, 'subdomain', s.subdomain,
        'primary', d.is_primary)), '[]'::jsonb)
      from (
        select * from public.site_domains
        where status in ('pending', 'verifying') and provider_id is not null
        order by last_checked_at nulls first
        limit p_limit
      ) d join public.sites s on s.id = d.site_id
    )
  );
end;
$$;

-- Purges taken by the routine: claim a batch, then mark each done or failed.
create function public.server_claim_domain_purges(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed jsonb;
begin
  if p_limit not between 1 and 100 then raise exception 'bad_request'; end if;
  with batch as (
      update public.domain_purges set attempts = attempts + 1
        where id in (
          select id from public.domain_purges
          where done_at is null and attempts < 10
          order by requested_at
          limit p_limit
          for update skip locked
        )
        returning *
    )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'siteId', site_id, 'subdomain', subdomain,
    'host', host, 'aliasHost', alias_host, 'providerId', provider_id)), '[]'::jsonb)
    into claimed
    from batch;
  return claimed;
end;
$$;

create function public.server_finish_domain_purge(p_id bigint, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.domain_purges
    set done_at = case when p_error is null then now() else done_at end,
        last_error = left(p_error, 300)
    where id = p_id;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'server_domain_request(uuid, uuid, text, text)', 'server_domain_attach(uuid, text, jsonb)',
    'server_domain_set_status(uuid, text, text, jsonb)', 'server_domain_set_primary(uuid, uuid, boolean)',
    'server_domain_remove(uuid, uuid)', 'server_domains_to_check(integer)',
    'server_claim_domain_purges(integer)', 'server_finish_domain_purge(bigint, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
revoke execute on function private.domain_json(public.site_domains) from public, anon, authenticated;

-- The team panel: client domains against the 100 the hosting includes (alert from 80).
create function private.admin_domains()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'active', (select count(*) from public.site_domains where status = 'active'),
    'waiting', (select count(*) from public.site_domains where status in ('pending', 'verifying')),
    'failed', (select count(*) from public.site_domains where status = 'failed'),
    -- Hostnames count at the hosting from the moment they are created, not only once active.
    'inUse', (select count(*) from public.site_domains where status <> 'removed' and provider_id is not null)
  );
end;
$$;
create function public.admin_domains()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.admin_domains(); $$;
revoke execute on function private.admin_domains() from public, anon;
revoke execute on function public.admin_domains() from public, anon;
grant execute on function private.admin_domains() to authenticated;
grant execute on function public.admin_domains() to authenticated;
