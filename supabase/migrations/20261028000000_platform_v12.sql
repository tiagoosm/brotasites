-- Platform data for schema 1.2 (PLAN.md E10): the site lifecycle of docs/product.md, the
-- timeline the dashboard shows, the 3 directions of each round, the uniqueness registry, the
-- reviewer's reports, the AI layer's usage, budget and cache, payments (stub for now), rate
-- limits and a private bucket for the photos clients send.
--
-- Same access model as before: clients read their own rows (RLS) and change state only through
-- the functions below, which check ownership; everything else is written by the server with
-- the secret key. Tables that only the server uses have RLS on and no policy at all.

-- 1. Site lifecycle ----------------------------------------------------------------------

alter table public.sites alter column status drop default;
alter table public.sites alter column status type text using status::text;
alter table public.sites alter column status set default 'draft';
alter table public.sites add constraint sites_status_check check (status in (
  'draft', 'generating_directions', 'awaiting_direction_choice', 'building', 'in_review',
  'awaiting_approval', 'publishing', 'live', 'needs_attention', 'suspended', 'grace',
  -- Schema 1.1 sites, until they move to 1.2.
  'generating', 'failed'
));

alter table public.sites
  add column schema_version text not null default '1.1' check (schema_version in ('1.1', '1.2')),
  add column round integer not null default 0 check (round >= 0),
  add column status_message text check (char_length(status_message) <= 300),
  add column preview_token text check (preview_token ~ '^[A-Za-z0-9_-]{32,64}$'),
  add column approved_at timestamptz,
  add column published_at timestamptz;
alter table public.sites alter column schema_version set default '1.2';

-- Reserved addresses can no longer be written directly either.
alter table public.sites
  add constraint sites_subdomain_not_reserved check (not public.is_reserved_subdomain(subdomain));

-- 2. Timeline, directions, reports ------------------------------------------------------

create table public.site_events (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]{2,40}$'),
  -- Shown to the client (pt-BR).
  message text not null check (char_length(message) between 1 and 300),
  created_at timestamptz not null default now()
);
create index site_events_site_id_idx on public.site_events (site_id, created_at);

create table public.site_directions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  round integer not null check (round >= 0),
  direction text not null check (direction in ('fiel-a-marca', 'evolucao', 'contraste')),
  identity jsonb not null,
  features jsonb not null,
  source text not null check (source in ('ai', 'engine')),
  -- Paths in the private "site-renders" bucket; the dashboard shows them by signed URL.
  screenshots text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (site_id, round, direction)
);
create index site_directions_site_id_idx on public.site_directions (site_id, round);

alter table public.sites
  add column approved_direction uuid references public.site_directions (id) on delete set null;

create table public.review_reports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  status text not null check (status in ('passed', 'changesNeeded', 'needsAttention')),
  report jsonb not null,
  created_at timestamptz not null default now()
);
create index review_reports_site_id_idx on public.review_reports (site_id, created_at);

-- 3. Uniqueness registry (docs/art-direction.md): one design per site, drafts included.

create table public.design_registry (
  site_id uuid primary key references public.sites (id) on delete cascade,
  family text not null,
  -- The city as the engine normalizes it (lowercase, no accents).
  city_key text not null,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{16,64}$'),
  features jsonb not null,
  approved boolean not null default false,
  updated_at timestamptz not null default now()
);
create index design_registry_family_city_idx on public.design_registry (family, city_key);

-- 4. AI layer: rounds per day, spend per day, cache ----------------------------------------

create table public.ai_usage (
  key text primary key,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now()
);

create table public.ai_spend (
  day date primary key,
  usd numeric(12, 6) not null default 0 check (usd >= 0),
  alerted boolean not null default false
);

create table public.ai_cache (
  key text primary key check (key ~ '^[0-9a-f]{64}$'),
  value jsonb not null,
  created_at timestamptz not null default now()
);

-- 5. Payments (docs/product.md): a stub for now; Asaas later, confirmed only by webhook. ----

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  purpose text not null check (purpose in ('publish', 'custom_domain', 'renewal')),
  provider text not null check (provider in ('stub', 'asaas')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  amount_cents integer not null check (amount_cents > 0),
  -- The provider's charge id; unique, so a repeated webhook cannot pay twice.
  external_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payments_site_id_idx on public.payments (site_id);

-- 6. Rate limits -------------------------------------------------------------------------

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

-- 7. Jobs for the 1.2 pipeline (Trigger.dev, docs/hosting.md) ---------------------------

alter table public.jobs drop constraint jobs_kind_check;
alter table public.jobs add constraint jobs_kind_check
  check (kind in ('generate', 'publish', 'directions', 'build'));
alter table public.jobs
  add column attempts integer not null default 0 check (attempts >= 0),
  add column payload jsonb not null default '{}'::jsonb,
  add column run_id text;

-- 8. Private uploads ---------------------------------------------------------------------

-- What clients send stays private: the pipeline cleans each photo (docs/security.md) and only
-- the cleaned copy is published. "<user id>/<site id>/<file>", as in site-images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-uploads', 'site-uploads', false, 10485760, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Renders (direction screenshots) are written and signed by the server only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-renders', 'site-renders', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "People upload originals to their own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "People list their own originals" on storage.objects
  for select to authenticated
  using (bucket_id = 'site-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "People delete their own originals" on storage.objects
  for delete to authenticated
  using (bucket_id = 'site-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter table public.assets
  add column bucket text not null default 'site-images' check (bucket in ('site-images', 'site-uploads'));
alter table public.assets alter column bucket set default 'site-uploads';

-- 9. Privileges and row level security ---------------------------------------------------

revoke all on public.site_events, public.site_directions, public.review_reports,
  public.design_registry, public.ai_usage, public.ai_spend, public.ai_cache, public.payments,
  public.rate_limits from anon, authenticated;

grant select on public.site_events, public.site_directions, public.payments to authenticated;
grant insert (bucket) on public.assets to authenticated;

alter table public.site_events enable row level security;
alter table public.site_directions enable row level security;
alter table public.review_reports enable row level security;
alter table public.design_registry enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_spend enable row level security;
alter table public.ai_cache enable row level security;
alter table public.payments enable row level security;
alter table public.rate_limits enable row level security;

create policy "Owners read their timeline" on public.site_events
  for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "Owners read their directions" on public.site_directions
  for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "Owners read their payments" on public.payments
  for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.owner_id = (select auth.uid())));
-- review_reports, design_registry, ai_*, rate_limits: no policy, server only.

-- 10. Functions clients call --------------------------------------------------------------
-- Privileged code lives in "private"; the API exposes SECURITY INVOKER wrappers (as in
-- 20261021190000_publication_private.sql). Errors are stable codes the platform translates:
-- site_not_found, wrong_status, rate_limited, direction_not_found, needs_v12.

-- Counts one use of a key in the current window; past the maximum, raises rate_limited.
create function private.hit_rate_limit(p_key text, p_max integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  start timestamptz := to_timestamp(floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window));
  used integer;
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, start, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into used;
  if used > p_max then
    raise exception 'rate_limited';
  end if;
end;
$$;

create function private.add_event(p_site_id uuid, p_kind text, p_message text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.site_events (site_id, kind, message) values (p_site_id, p_kind, p_message);
$$;

-- The client sends the answers: the engine and the AI draw the 3 directions (again, on a redo).
create function private.request_directions(p_site_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  job_id uuid;
  next_round integer;
begin
  select * into site from public.sites
    where id = p_site_id and owner_id = (select auth.uid())
    for update;
  if not found then raise exception 'site_not_found'; end if;
  if site.schema_version <> '1.2' then raise exception 'needs_v12'; end if;
  if site.status not in ('draft', 'awaiting_direction_choice', 'needs_attention') then
    raise exception 'wrong_status';
  end if;
  perform private.hit_rate_limit('directions:site:' || p_site_id, 20, interval '1 day');
  perform private.hit_rate_limit('directions:user:' || (select auth.uid()), 40, interval '1 day');

  next_round := case
    when exists (select 1 from public.site_directions d where d.site_id = p_site_id) then site.round + 1
    else site.round
  end;
  update public.sites
    set status = 'generating_directions', round = next_round, status_message = null
    where id = p_site_id;
  insert into public.jobs (site_id, kind, payload)
    values (p_site_id, 'directions', jsonb_build_object('round', next_round))
    returning id into job_id;
  perform private.add_event(p_site_id, 'directions_requested',
    case when next_round = 0 then 'Recebemos suas respostas. Estamos criando as 3 direções.'
         else 'Pedido de novas direções recebido.' end);
  return job_id;
end;
$$;

-- The client picks one of the 3 directions of the current round: the identity locks and the
-- site is built.
create function private.choose_direction(p_site_id uuid, p_direction_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  chosen public.site_directions%rowtype;
  job_id uuid;
begin
  select * into site from public.sites
    where id = p_site_id and owner_id = (select auth.uid())
    for update;
  if not found then raise exception 'site_not_found'; end if;
  if site.status <> 'awaiting_direction_choice' then raise exception 'wrong_status'; end if;
  select * into chosen from public.site_directions
    where id = p_direction_id and site_id = p_site_id and round = site.round;
  if not found then raise exception 'direction_not_found'; end if;

  update public.sites
    set approved_direction = p_direction_id, status = 'building', status_message = null
    where id = p_site_id;
  insert into public.jobs (site_id, kind, payload)
    values (p_site_id, 'build', jsonb_build_object('direction', p_direction_id))
    returning id into job_id;
  perform private.add_event(p_site_id, 'direction_chosen', 'Direção escolhida. Estamos montando o seu site.');
  return job_id;
end;
$$;

-- After edits in the dashboard: build the site again with the locked identity.
create function private.request_rebuild(p_site_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  job_id uuid;
begin
  select * into site from public.sites
    where id = p_site_id and owner_id = (select auth.uid())
    for update;
  if not found then raise exception 'site_not_found'; end if;
  if site.approved_direction is null or site.status not in ('awaiting_approval', 'needs_attention', 'live') then
    raise exception 'wrong_status';
  end if;
  perform private.hit_rate_limit('rebuild:site:' || p_site_id, 30, interval '1 day');

  update public.sites set status = 'building', status_message = null where id = p_site_id;
  insert into public.jobs (site_id, kind, payload)
    values (p_site_id, 'build', jsonb_build_object('rebuild', true, 'wasLive', site.status = 'live'))
    returning id into job_id;
  perform private.add_event(p_site_id, 'rebuild_requested', 'Alterações recebidas. Estamos montando o site de novo.');
  return job_id;
end;
$$;

create function public.request_directions(p_site_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.request_directions(p_site_id); $$;
create function public.choose_direction(p_site_id uuid, p_direction_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.choose_direction(p_site_id, p_direction_id); $$;
create function public.request_rebuild(p_site_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.request_rebuild(p_site_id); $$;

revoke execute on function private.hit_rate_limit(text, integer, interval) from public, anon, authenticated;
revoke execute on function private.add_event(uuid, text, text) from public, anon, authenticated;
revoke execute on function private.request_directions(uuid) from public, anon;
revoke execute on function private.choose_direction(uuid, uuid) from public, anon;
revoke execute on function private.request_rebuild(uuid) from public, anon;
revoke execute on function public.request_directions(uuid) from public, anon;
revoke execute on function public.choose_direction(uuid, uuid) from public, anon;
revoke execute on function public.request_rebuild(uuid) from public, anon;

grant execute on function private.request_directions(uuid) to authenticated;
grant execute on function private.choose_direction(uuid, uuid) to authenticated;
grant execute on function private.request_rebuild(uuid) to authenticated;
grant execute on function public.request_directions(uuid) to authenticated;
grant execute on function public.choose_direction(uuid, uuid) to authenticated;
grant execute on function public.request_rebuild(uuid) to authenticated;
grant execute on function private.hit_rate_limit(text, integer, interval) to service_role;
grant execute on function private.add_event(uuid, text, text) to service_role;
grant usage on schema private to service_role;
