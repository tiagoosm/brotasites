-- Taking a site offline and deleting it (E42). Two different things:
--   offline   reversible: the site stops answering (KV state "offline", page "Site fora do
--             ar", 410) and nothing is deleted. The owner may ask for it and undo it; the team
--             may do it with a reason. "suspended" stays the team's disciplinary measure.
--   deletion  final: scheduled (7 days by default, the site offline meanwhile, cancellable),
--             then the content, directions, reports, events and files go; the charges, the
--             terms acceptances and the audit record stay.
-- Every function is server-only (service_role), checks who acts and from which status, is
-- idempotent (asking twice changes nothing the second time) and writes the audit record
-- (site_takedowns, which survives the site). Error codes: site_not_found, not_admin,
-- not_published, busy, suspended, wrong_status, reason_required, deletion_scheduled,
-- not_yours, not_due, bad_request.

-- 1. The new status and what a site remembers while offline -------------------------------

alter table public.sites drop constraint sites_status_check;
alter table public.sites add constraint sites_status_check check (status in (
  'draft', 'generating_directions', 'awaiting_direction_choice', 'building', 'in_review',
  'awaiting_approval', 'publishing', 'live', 'needs_attention', 'suspended', 'grace',
  'offline',
  -- Schema 1.1 sites, until they move to 1.2.
  'generating', 'failed'
));

alter table public.sites
  -- The status to go back to ("live" or "grace") and who took the site offline.
  add column offline_from text check (offline_from in ('live', 'grace')),
  add column offline_by text check (offline_by in ('owner', 'admin', 'system')),
  -- The team's reason, shown to the client only when the team chose to.
  add column offline_public_reason text check (char_length(offline_public_reason) <= 300),
  -- A scheduled deletion: when, and who scheduled it (the owner may cancel only their own).
  add column delete_after timestamptz,
  add column deletion_by text check (deletion_by in ('owner', 'admin')),
  add column deletion_attempts integer not null default 0,
  add column deletion_error text check (char_length(deletion_error) <= 300);
create index sites_delete_after_idx on public.sites (delete_after) where delete_after is not null;

-- 2. The audit record: survives the site (no foreign key), nothing personal ----------------

create table public.site_takedowns (
  id bigint generated always as identity primary key,
  site_id uuid not null,
  subdomain text,
  action text not null check (action in (
    'take_offline', 'restore_online', 'schedule_deletion', 'cancel_deletion', 'delete'
  )),
  actor text not null check (actor in ('owner', 'admin', 'system')),
  actor_id uuid,
  reason text check (reason in (
    'owner_request', 'admin', 'abuse', 'legal', 'terms', 'payment', 'other'
  )),
  note text check (char_length(note) <= 1000),
  delete_after timestamptz,
  created_at timestamptz not null default now()
);
create index site_takedowns_site_idx on public.site_takedowns (site_id, created_at);
alter table public.site_takedowns enable row level security;
revoke all on public.site_takedowns from anon, authenticated;
revoke update, delete, truncate on public.site_takedowns from service_role;

-- What is left of a deleted site for the funnel (E24's record) gets its own reason.
alter table public.site_removals drop constraint site_removals_reason_check;
alter table public.site_removals add constraint site_removals_reason_check
  check (reason in ('discarded', 'idle', 'deleted'));

-- The team's decisions log knows the new actions.
alter table public.admin_decisions drop constraint admin_decisions_action_check;
alter table public.admin_decisions add constraint admin_decisions_action_check check (action in (
  'approve', 'request_changes', 'suspend', 'unsuspend',
  'view_account', 'grant_round', 'grant_site_slot', 'extend_cleanup',
  'take_offline', 'restore_online', 'schedule_deletion', 'cancel_deletion', 'delete_now'
));

-- 3. A deleted site's address rests for 30 days ---------------------------------------------
-- Nobody else may take it meanwhile (no one passes for the old business); its owner may.

create table public.subdomain_holds (
  subdomain text primary key,
  owner_id uuid references auth.users (id) on delete set null,
  until timestamptz not null
);
alter table public.subdomain_holds enable row level security;
revoke all on public.subdomain_holds from anon, authenticated;

create or replace function private.subdomain_taken(p_subdomain text)
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
  ) or exists (
    select 1 from public.subdomain_holds h
    where h.subdomain = p_subdomain
      and h.until > now()
      and h.owner_id is distinct from (select auth.uid())
  );
$$;

-- Whatever path writes the address (the client's own update, publication), a held address is
-- refused as taken (unique_violation, which the platform already reads as "endereço em uso").
create function private.check_subdomain_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.subdomain is not null and exists (
    select 1 from public.subdomain_holds h
    where h.subdomain = new.subdomain
      and h.until > now()
      and h.owner_id is distinct from new.owner_id
  ) then
    raise exception 'subdomain_taken' using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke execute on function private.check_subdomain_hold() from public, anon, authenticated;
create trigger sites_check_subdomain_hold before insert or update of subdomain on public.sites
  for each row execute function private.check_subdomain_hold();

-- 4. Notices ---------------------------------------------------------------------------------

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'directions_ready', 'site_ready_for_approval', 'changes_requested', 'site_published',
  'site_suspended', 'site_suspension_lifted', 'email_confirmed', 'site_deletion_warning',
  'domain_active', 'domain_failed',
  -- E42, to the client.
  'site_taken_offline', 'site_back_online', 'site_deletion_scheduled',
  'site_deletion_cancelled', 'site_deleted',
  -- E42, to the team: a client took their site offline or asked to delete it.
  'team_owner_took_offline', 'team_owner_requested_deletion'
));

-- Going offline and back is told by the functions below, with who did it: the status trigger
-- stays quiet (otherwise coming back to "live" would say "site published" again).
create or replace function private.notify_site_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'offline' or new.status = 'offline' then
    return new;
  elsif old.status = 'suspended' then
    perform private.notify(new.owner_id, new.id, 'site_suspension_lifted');
  elsif new.status = 'suspended' then
    perform private.notify(new.owner_id, new.id, 'site_suspended');
  elsif new.status = 'awaiting_direction_choice' then
    perform private.notify(new.owner_id, new.id, 'directions_ready', new.round);
  elsif new.status = 'awaiting_approval' then
    perform private.notify(new.owner_id, new.id, 'site_ready_for_approval');
  elsif new.status = 'live' then
    perform private.notify(new.owner_id, new.id, 'site_published');
  end if;
  return new;
end;
$$;

create function private.notify_team(p_site_id uuid, p_kind text)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.notify(a.user_id, p_site_id, p_kind) from public.admins a;
$$;
revoke execute on function private.notify_team(uuid, text) from public, anon, authenticated;

-- 5. Who may act ------------------------------------------------------------------------------

-- Locks the site and checks the actor: the owner (their own site), a team member, or the
-- system (the daily routine). Raises site_not_found for someone else's site.
create function private.takedown_site(p_site_id uuid, p_actor text, p_actor_id uuid)
returns public.sites
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
begin
  if p_actor not in ('owner', 'admin', 'system') then raise exception 'bad_request'; end if;
  select * into site from public.sites where id = p_site_id for update;
  if not found then raise exception 'site_not_found'; end if;
  if p_actor = 'owner' and site.owner_id is distinct from p_actor_id then
    raise exception 'site_not_found';
  end if;
  if p_actor = 'admin' and not exists (select 1 from public.admins where user_id = p_actor_id) then
    raise exception 'not_admin';
  end if;
  return site;
end;
$$;
revoke execute on function private.takedown_site(uuid, text, uuid) from public, anon, authenticated;

-- Why a published site cannot leave its current status (null when it can).
create function private.takedown_blocker(site public.sites)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when site.status in ('live', 'grace', 'offline') then null
    when site.status = 'suspended' then 'suspended'
    -- Never published: an unpaid site is discarded instead (server_discard_site).
    when site.published_at is null then 'not_published'
    -- Published, with a new version or the publication itself on the way.
    else 'busy'
  end;
$$;
revoke execute on function private.takedown_blocker(public.sites) from public, anon, authenticated;

create function private.log_takedown(
  site public.sites, p_action text, p_actor text, p_actor_id uuid, p_reason text, p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status text;
  admin_action text;
begin
  insert into public.site_takedowns
    (site_id, subdomain, action, actor, actor_id, reason, note, delete_after)
    values (site.id, site.subdomain, p_action, p_actor, p_actor_id, p_reason, p_note,
            (select delete_after from public.sites where id = site.id));
  if p_actor = 'admin' then
    admin_action := case p_action when 'delete' then 'delete_now' else p_action end;
    select status into next_status from public.sites where id = site.id;
    insert into public.admin_decisions (site_id, admin_id, action, note, from_status, to_status)
      values (site.id, p_actor_id, admin_action, p_note, site.status,
              case when p_action = 'delete' then 'deleted' else next_status end);
  end if;
end;
$$;
revoke execute on function private.log_takedown(public.sites, text, text, uuid, text, text)
  from public, anon, authenticated;

-- The team's reason is required and from the list; the owner's is always owner_request.
create function private.takedown_reason(p_actor text, p_reason text, p_note text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_actor <> 'admin' then return 'owner_request'; end if;
  if p_reason is null or p_reason not in ('admin', 'abuse', 'legal', 'terms', 'payment', 'other')
     or char_length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'reason_required';
  end if;
  return p_reason;
end;
$$;
revoke execute on function private.takedown_reason(text, text, text) from public, anon, authenticated;

-- 6. Take offline, back online --------------------------------------------------------------

create function public.server_take_offline(
  p_site_id uuid,
  p_actor text,
  p_actor_id uuid,
  p_reason text default null,
  p_note text default null,
  p_public boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  reason text;
  blocker text;
begin
  site := private.takedown_site(p_site_id, p_actor, p_actor_id);
  if p_actor = 'system' then raise exception 'bad_request'; end if;
  if site.status = 'offline' then
    return jsonb_build_object('status', 'offline', 'changed', false, 'subdomain', site.subdomain,
      'ownerId', site.owner_id);
  end if;
  blocker := private.takedown_blocker(site);
  if blocker is not null then raise exception '%', blocker; end if;
  reason := private.takedown_reason(p_actor, p_reason, p_note);

  update public.sites
    set status = 'offline', offline_from = site.status, offline_by = p_actor,
        offline_public_reason = case when p_actor = 'admin' and p_public
                                     then left(trim(p_note), 300) end
    where id = site.id;
  perform private.log_takedown(site, 'take_offline', p_actor, p_actor_id, reason,
                               nullif(trim(coalesce(p_note, '')), ''));
  perform private.add_event(site.id, 'taken_offline',
    case when p_actor = 'owner' then 'Você tirou o site do ar. Ele pode voltar quando quiser.'
         else 'Nossa equipe tirou o site do ar.' end);
  perform private.notify(site.owner_id, site.id, 'site_taken_offline');
  if p_actor = 'owner' then perform private.notify_team(site.id, 'team_owner_took_offline'); end if;
  return jsonb_build_object('status', 'offline', 'changed', true, 'subdomain', site.subdomain,
    'ownerId', site.owner_id);
end;
$$;

create function public.server_restore_online(
  p_site_id uuid,
  p_actor text,
  p_actor_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  next_status text;
begin
  site := private.takedown_site(p_site_id, p_actor, p_actor_id);
  if p_actor = 'system' then raise exception 'bad_request'; end if;
  if site.status in ('live', 'grace') then
    return jsonb_build_object('status', site.status, 'changed', false, 'subdomain', site.subdomain,
      'ownerId', site.owner_id);
  end if;
  if site.status = 'suspended' then raise exception 'suspended'; end if;
  if site.status <> 'offline' then raise exception 'wrong_status'; end if;
  -- Only what the owner did, the owner undoes.
  if p_actor = 'owner' and site.offline_by is distinct from 'owner' then
    raise exception 'not_yours';
  end if;
  if site.delete_after is not null then raise exception 'deletion_scheduled'; end if;
  next_status := coalesce(site.offline_from, 'live');

  update public.sites
    set status = next_status, offline_from = null, offline_by = null, offline_public_reason = null
    where id = site.id;
  perform private.log_takedown(site, 'restore_online', p_actor, p_actor_id, null,
                               nullif(trim(coalesce(p_note, '')), ''));
  perform private.add_event(site.id, 'back_online', 'O site voltou ao ar.');
  perform private.notify(site.owner_id, site.id, 'site_back_online');
  return jsonb_build_object('status', next_status, 'changed', true, 'subdomain', site.subdomain,
    'ownerId', site.owner_id);
end;
$$;

-- 7. Scheduled deletion and its cancellation -------------------------------------------------

-- p_days: the owner's waiting period comes from the platform (limits.ts, 7); 0 to 30 for the
-- team, 0 meaning "due at the next daily run".
create function public.server_request_deletion(
  p_site_id uuid,
  p_actor text,
  p_actor_id uuid,
  p_days integer,
  p_reason text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  reason text;
  blocker text;
  due timestamptz;
  min_days integer;
begin
  site := private.takedown_site(p_site_id, p_actor, p_actor_id);
  if p_actor = 'system' then raise exception 'bad_request'; end if;
  min_days := case when p_actor = 'admin' then 0 else 1 end;
  if p_days is null or p_days > 30 or p_days < min_days then
    raise exception 'bad_request';
  end if;
  if site.delete_after is not null then
    return jsonb_build_object('status', site.status, 'changed', false, 'subdomain', site.subdomain,
      'ownerId', site.owner_id, 'deleteAfter', site.delete_after);
  end if;
  blocker := private.takedown_blocker(site);
  -- The team may also delete a suspended site; the owner may not.
  if blocker is not null and not (blocker = 'suspended' and p_actor = 'admin') then
    raise exception '%', blocker;
  end if;
  reason := private.takedown_reason(p_actor, p_reason, p_note);
  due := now() + make_interval(days => p_days);

  update public.sites
    set status = case when status in ('live', 'grace') then 'offline' else status end,
        offline_from = case when status in ('live', 'grace') then status else offline_from end,
        offline_by = case when status in ('live', 'grace') then p_actor else offline_by end,
        delete_after = due, deletion_by = p_actor, deletion_attempts = 0, deletion_error = null
    where id = site.id;
  perform private.log_takedown(site, 'schedule_deletion', p_actor, p_actor_id, reason,
                               nullif(trim(coalesce(p_note, '')), ''));
  perform private.add_event(site.id, 'deletion_scheduled',
    'O site saiu do ar e será excluído no prazo. Dá para cancelar até lá.');
  perform private.notify(site.owner_id, site.id, 'site_deletion_scheduled');
  if p_actor = 'owner' then
    perform private.notify_team(site.id, 'team_owner_requested_deletion');
  end if;
  return jsonb_build_object('status', 'offline', 'changed', true, 'subdomain', site.subdomain,
    'ownerId', site.owner_id, 'deleteAfter', due);
end;
$$;

create function public.server_cancel_deletion(p_site_id uuid, p_actor text, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
begin
  site := private.takedown_site(p_site_id, p_actor, p_actor_id);
  if p_actor = 'system' then raise exception 'bad_request'; end if;
  if site.delete_after is null then
    return jsonb_build_object('status', site.status, 'changed', false, 'subdomain', site.subdomain,
      'ownerId', site.owner_id);
  end if;
  if p_actor = 'owner' and site.deletion_by is distinct from 'owner' then
    raise exception 'not_yours';
  end if;
  update public.sites
    set delete_after = null, deletion_by = null, deletion_attempts = 0, deletion_error = null
    where id = site.id;
  perform private.log_takedown(site, 'cancel_deletion', p_actor, p_actor_id, null, null);
  perform private.add_event(site.id, 'deletion_cancelled',
    'A exclusão foi cancelada. O site continua fora do ar até você recolocar.');
  perform private.notify(site.owner_id, site.id, 'site_deletion_cancelled');
  return jsonb_build_object('status', site.status, 'changed', true, 'subdomain', site.subdomain,
    'ownerId', site.owner_id);
end;
$$;

-- 8. The deletion itself ----------------------------------------------------------------------

-- The team (now, with the address typed in the interface), or the daily routine for a deletion
-- that is due. Keeps the charges (with who paid, as account deletion does), the terms
-- acceptances (they belong to the account) and the audit record; removes the rest. Returns
-- what the platform still has to clean, like server_discard_site.
create function public.server_delete_site_now(
  p_site_id uuid,
  p_actor text,
  p_actor_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  retained integer;
begin
  if not exists (select 1 from public.sites where id = p_site_id) then
    -- Asked twice: the first one did it.
    if exists (select 1 from public.site_takedowns where site_id = p_site_id and action = 'delete') then
      return jsonb_build_object('siteId', p_site_id, 'removed', false, 'already', true);
    end if;
    raise exception 'site_not_found';
  end if;
  site := private.takedown_site(p_site_id, p_actor, p_actor_id);
  if p_actor = 'owner' then raise exception 'bad_request'; end if;
  if p_actor = 'system' and (site.delete_after is null or site.delete_after > now()) then
    raise exception 'not_due';
  end if;
  if p_actor = 'admin' then
    if char_length(trim(coalesce(p_note, ''))) < 3 then raise exception 'reason_required'; end if;
    if site.status in ('publishing', 'generating', 'generating_directions', 'building')
       or exists (select 1 from public.jobs j where j.site_id = site.id
                  and j.status in ('queued', 'running'))
       or exists (select 1 from public.payments p where p.site_id = site.id
                  and p.status = 'pending') then
      raise exception 'busy';
    end if;
  end if;

  update public.payments p
    set retained_customer = coalesce(p.retained_customer, jsonb_build_object(
      'user_id', site.owner_id,
      'email', u.email,
      'full_name', pr.full_name,
      'document_type', pr.document_type,
      'document_number', pr.document_number,
      'billing_address', pr.billing_address,
      'subdomain', site.subdomain,
      'retained_at', now()
    ))
    from auth.users u
    left join public.profiles pr on pr.id = u.id
    where p.site_id = site.id and u.id = site.owner_id and p.status in ('paid', 'refunded');
  get diagnostics retained = row_count;
  delete from public.payments where site_id = site.id and status in ('pending', 'failed');

  perform private.log_takedown(site, 'delete', p_actor, p_actor_id,
    case when p_actor = 'admin' then 'admin' else null end, nullif(trim(coalesce(p_note, '')), ''));
  insert into public.site_removals
    (site_id, owner_id, reason, last_status, stage, direction_rounds, site_created_at)
    values (site.id, site.owner_id, 'deleted', site.status, private.site_stage(site),
            site.direction_rounds, site.created_at);
  insert into public.site_purges (site_id, subdomain) values (site.id, site.subdomain);
  if site.subdomain is not null then
    insert into public.subdomain_holds (subdomain, owner_id, until)
      values (site.subdomain, site.owner_id, now() + interval '30 days')
      on conflict (subdomain) do update set owner_id = excluded.owner_id, until = excluded.until;
  end if;
  -- The notice outlives the site (no site_id: its row goes with it).
  perform private.notify(site.owner_id, null, 'site_deleted');
  -- Directions, reports, events, renders' rows, domains (queued by their own trigger) go with it.
  delete from public.sites where id = site.id;
  return jsonb_build_object('siteId', site.id, 'ownerId', site.owner_id,
    'subdomain', site.subdomain, 'queued', true, 'removed', true, 'retainedPayments', retained);
end;
$$;

-- The daily routine: deletions that are due, oldest first, and a place to say why one failed.
create function public.server_due_deletions(p_limit integer)
returns table (site_id uuid, subdomain text, delete_after timestamptz, attempts integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.subdomain, s.delete_after, s.deletion_attempts from public.sites s
  where s.delete_after is not null and s.delete_after <= now() and s.deletion_attempts < 10
  order by s.delete_after
  limit least(greatest(p_limit, 1), 100);
$$;

create function public.server_deletion_failed(p_site_id uuid, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.sites
    set deletion_attempts = deletion_attempts + 1, deletion_error = left(p_error, 300)
    where id = p_site_id;
$$;

-- 9. Server only ------------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.server_take_offline(uuid, text, uuid, text, text, boolean)',
    'public.server_restore_online(uuid, text, uuid, text)',
    'public.server_request_deletion(uuid, text, uuid, integer, text, text)',
    'public.server_cancel_deletion(uuid, text, uuid)',
    'public.server_delete_site_now(uuid, text, uuid, text)',
    'public.server_due_deletions(integer)',
    'public.server_deletion_failed(uuid, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
