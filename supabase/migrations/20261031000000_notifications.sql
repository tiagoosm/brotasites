-- In-site notices for the dashboard (PLAN.md E16). No emails: the panel shows them. A notice
-- holds only its kind; the platform writes the pt-BR sentence from it (one place for the copy,
-- no free text to inject). Notices are made here, by triggers on the status changes, so no
-- route or job has to remember to make them. Clients read theirs and mark them as read; nobody
-- inserts or deletes through the API.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  site_id uuid references public.sites (id) on delete cascade,
  kind text not null check (kind in (
    'directions_ready', 'site_ready_for_approval', 'changes_requested', 'site_published',
    'site_suspended', 'site_suspension_lifted', 'email_confirmed'
  )),
  -- The round of directions, for "directions_ready": one notice per round.
  round integer check (round >= 0),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create unique index notifications_once_per_round on public.notifications (site_id, kind, round)
  where round is not null;
create unique index notifications_email_once on public.notifications (user_id)
  where kind = 'email_confirmed';

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
-- Marking as read is the only change a client makes.
grant update (read_at) on public.notifications to authenticated;

create policy "People read their own notices" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "People mark their own notices" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- A notice is read once, at the time it was marked: read_at never goes back or moves.
create function private.notification_read_once()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.read_at := coalesce(old.read_at, now());
  return new;
end;
$$;
create trigger notifications_read_once before update on public.notifications
  for each row execute function private.notification_read_once();

-- Makes a notice (or nothing, if this round already has one) and drops the person's notices
-- read more than 90 days ago: retention without a scheduled job.
create function private.notify(p_user_id uuid, p_site_id uuid, p_kind text, p_round integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, site_id, kind, round)
    values (p_user_id, p_site_id, p_kind, p_round)
    on conflict do nothing;
  delete from public.notifications
    where user_id = p_user_id and read_at < now() - interval '90 days';
end;
$$;
revoke execute on function private.notify(uuid, uuid, text, integer) from public, anon, authenticated;

-- The site's status changed (jobs, approval, admin decisions): the notice that goes with it.
create function private.notify_site_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'suspended' then
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
revoke execute on function private.notify_site_status() from public, anon, authenticated;

create trigger sites_notify_status after update of status on public.sites
  for each row when (old.status is distinct from new.status)
  execute function private.notify_site_status();

-- The review asked for changes (admin decision): the site goes back to "building", so the
-- status alone does not say it; the decision does. Its note stays internal.
create function private.notify_admin_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if new.action = 'request_changes' then
    select owner_id into owner from public.sites where id = new.site_id;
    if owner is not null then
      perform private.notify(owner, new.site_id, 'changes_requested');
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.notify_admin_decision() from public, anon, authenticated;

create trigger admin_decisions_notify after insert on public.admin_decisions
  for each row execute function private.notify_admin_decision();

-- The email was confirmed: once per account.
create function private.notify_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(new.id, null, 'email_confirmed');
  return new;
end;
$$;
revoke execute on function private.notify_email_confirmed() from public, anon, authenticated;

create trigger on_auth_user_email_confirmed after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.notify_email_confirmed();
