-- The admin panel (PLAN.md E11): the administrator role, the review queue's decisions with a log
-- nobody can rewrite, and the catalog promotion cycle (docs/catalog-promotion.md). Admins never
-- act as a client: the platform checks the role with the person's own session (is_admin), then
-- the server calls the functions below with the secret key. Errors are stable codes:
-- not_admin, site_not_found, wrong_status, note_required.

-- 1. Who is an admin. The owner adds rows in the SQL editor (docs/owner-steps.md). -------------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create function public.is_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.is_admin(); $$;

revoke execute on function private.is_admin() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- 2. Decisions on sites, append-only. ----------------------------------------------------------

alter table public.sites add column suspended_from text;

create table public.admin_decisions (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites (id) on delete cascade,
  admin_id uuid not null references auth.users (id),
  action text not null check (action in ('approve', 'request_changes', 'suspend', 'unsuspend')),
  note text check (char_length(note) <= 1000),
  from_status text not null,
  to_status text not null,
  created_at timestamptz not null default now()
);
create index admin_decisions_site_id_idx on public.admin_decisions (site_id, created_at);
alter table public.admin_decisions enable row level security;
revoke all on public.admin_decisions from anon, authenticated;
-- Not even the server rewrites the log.
revoke update, delete, truncate on public.admin_decisions from service_role;

-- Approve, ask for changes, suspend or lift a suspension. Returns {"status": <new status>} and,
-- for a change request, {"jobId": <build job>}.
create function public.server_admin_decide(
  p_site_id uuid,
  p_admin_id uuid,
  p_action text,
  p_note text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  note text := nullif(trim(coalesce(p_note, '')), '');
  next_status text;
  job_id uuid;
begin
  if not exists (select 1 from public.admins where user_id = p_admin_id) then
    raise exception 'not_admin';
  end if;
  select * into site from public.sites where id = p_site_id for update;
  if not found then raise exception 'site_not_found'; end if;

  if p_action = 'approve' then
    if site.status not in ('in_review', 'needs_attention')
      or site.preview_token is null or site.approved_direction is null then
      raise exception 'wrong_status';
    end if;
    next_status := 'awaiting_approval';
    update public.sites set status = next_status, status_message = null where id = p_site_id;
    perform private.add_event(p_site_id, 'review_approved', 'Seu site está pronto para você conferir.');
  elsif p_action = 'request_changes' then
    if site.status not in ('in_review', 'needs_attention') or site.approved_direction is null then
      raise exception 'wrong_status';
    end if;
    if note is null then raise exception 'note_required'; end if;
    next_status := 'building';
    update public.sites set status = next_status, status_message = null where id = p_site_id;
    insert into public.jobs (site_id, kind, payload)
      values (p_site_id, 'build', jsonb_build_object('rebuild', true, 'adminNotes', jsonb_build_array(note)))
      returning id into job_id;
    perform private.add_event(p_site_id, 'review_changes', 'Nossa equipe pediu alguns ajustes. Estamos montando o site de novo.');
  elsif p_action = 'suspend' then
    if site.status = 'suspended' then raise exception 'wrong_status'; end if;
    if note is null then raise exception 'note_required'; end if;
    next_status := 'suspended';
    update public.sites
      set status = next_status, suspended_from = site.status, status_message = left(note, 300)
      where id = p_site_id;
    perform private.add_event(p_site_id, 'suspended', 'O site foi suspenso pela nossa equipe.');
  elsif p_action = 'unsuspend' then
    if site.status <> 'suspended' then raise exception 'wrong_status'; end if;
    next_status := coalesce(site.suspended_from, 'draft');
    update public.sites
      set status = next_status, suspended_from = null, status_message = null
      where id = p_site_id;
    perform private.add_event(p_site_id, 'unsuspended', 'A suspensão foi retirada.');
  else
    raise exception 'wrong_status';
  end if;

  insert into public.admin_decisions (site_id, admin_id, action, note, from_status, to_status)
    values (p_site_id, p_admin_id, p_action, note, site.status, next_status);
  return jsonb_build_object('status', next_status) ||
    case when job_id is null then '{}'::jsonb else jsonb_build_object('jobId', job_id) end;
end;
$$;

revoke execute on function public.server_admin_decide(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.server_admin_decide(uuid, uuid, text, text) to service_role;

-- 3. Catalog promotion (docs/catalog-promotion.md). ---------------------------------------------

-- Each direction keeps the key of its composition, for the metrics per composition.
alter table public.site_directions add column composition_key text
  check (composition_key ~ '^[0-9a-f]{16}$');
create index site_directions_composition_idx on public.site_directions (composition_key);

-- Recommended or retired compositions and variants; the jobs read them before each draw.
create table public.catalog_weights (
  kind text not null check (kind in ('composition', 'variant')),
  ref text not null check (char_length(ref) between 1 and 80),
  state text not null check (state in ('recommended', 'retired')),
  -- For a recommended composition: its choices, so the engine can draw it.
  choices jsonb,
  updated_by uuid not null references auth.users (id),
  updated_at timestamptz not null default now(),
  primary key (kind, ref)
);
alter table public.catalog_weights enable row level security;
revoke all on public.catalog_weights from anon, authenticated;

-- Requests to the variant factory (E6): a person designs, tests and approves every variant.
create table public.variant_requests (
  id bigint generated always as identity primary key,
  family text not null check (char_length(family) between 1 and 40),
  section text not null check (char_length(section) between 1 and 40),
  note text not null check (char_length(note) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'done')),
  requested_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.variant_requests enable row level security;
revoke all on public.variant_requests from anon, authenticated;
