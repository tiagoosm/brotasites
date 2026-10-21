-- BrotaSites platform data: sites, their form drafts, generation jobs and uploaded assets.
-- Client sites themselves are static and keep no data here.
--
-- Access model: a signed-in person reads and edits only their own rows (RLS). Columns the
-- server controls (site status, the validated config used for publishing, jobs) are not
-- writable by clients at all (column privileges); the server uses the secret key.

create type public.site_status as enum ('draft', 'generating', 'publishing', 'live', 'in_review', 'failed');

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subdomain text unique check (subdomain ~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$'),
  status public.site_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sites_owner_id_idx on public.sites (owner_id);

create table public.site_configs (
  site_id uuid primary key references public.sites (id) on delete cascade,
  -- What the form collected so far (SiteDraft) and the questions already answered.
  draft jsonb not null default '{}'::jsonb,
  completed text[] not null default '{}',
  -- The validated SiteConfig used for the last generation. Written by the server only.
  config jsonb,
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  kind text not null check (kind in ('generate', 'publish')),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index jobs_site_id_idx on public.jobs (site_id);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  storage_path text not null unique,
  kind text not null check (kind in ('logo', 'image')),
  width integer check (width > 0),
  height integer check (height > 0),
  created_at timestamptz not null default now()
);
create index assets_site_id_idx on public.assets (site_id);

-- Keep updated_at current.
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sites_touch_updated_at before update on public.sites
  for each row execute function public.touch_updated_at();
create trigger site_configs_touch_updated_at before update on public.site_configs
  for each row execute function public.touch_updated_at();

-- Privileges: nothing for anonymous visitors; signed-in people get only what the form needs.
revoke all on public.sites, public.site_configs, public.jobs, public.assets from anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

grant select, delete on public.sites to authenticated;
grant insert (subdomain), update (subdomain) on public.sites to authenticated;

grant select on public.site_configs to authenticated;
grant insert (site_id, draft, completed), update (draft, completed) on public.site_configs to authenticated;

grant select on public.jobs to authenticated;

grant select, delete on public.assets to authenticated;
grant insert (site_id, storage_path, kind, width, height) on public.assets to authenticated;

-- Row level security: every row belongs to the owner of its site.
alter table public.sites enable row level security;
alter table public.site_configs enable row level security;
alter table public.jobs enable row level security;
alter table public.assets enable row level security;

create policy "Owners read their sites" on public.sites
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "People create their own sites" on public.sites
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Owners update their sites" on public.sites
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners delete their sites" on public.sites
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "Owners read their drafts" on public.site_configs
  for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "Owners create their drafts" on public.site_configs
  for insert to authenticated
  with check (exists (select 1 from public.sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "Owners update their drafts" on public.site_configs
  for update to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.sites s where s.id = site_id and s.owner_id = (select auth.uid())));

create policy "Owners read their jobs" on public.jobs
  for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.owner_id = (select auth.uid())));

create policy "Owners read their assets" on public.assets
  for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "Owners add assets to their sites" on public.assets
  for insert to authenticated
  with check (exists (select 1 from public.sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "Owners delete their assets" on public.assets
  for delete to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.owner_id = (select auth.uid())));
