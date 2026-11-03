-- Cost control and the team panel (PLAN.md E24).
--
-- 1. The limits the platform sends (apps/platform/src/config/limits.ts), kept in one row so the
--    client paths (the form's own calls) and the server paths enforce the same numbers.
-- 2. Rounds of directions per site: free rounds, then one per wait. Decided under a row lock.
-- 3. One unpaid site in progress per account (plus a team grant), under an advisory lock.
-- 4. Every model call, with tokens and cost in USD (no prompt, no answer).
-- 5. Discarding an unpaid site and removing sites left idle, with a record that survives them.
-- 6. The team panel: read-only aggregates and logged actions, for team members with the
--    second factor only (private.is_admin checks aal2).
-- Errors are stable codes the platform translates: site_in_progress, not_removable, bad_limits,
-- directions_wait, forbidden, bad_request.

-- 1. Limits --------------------------------------------------------------------------------

create table private.platform_limits (
  id boolean primary key default true check (id),
  free_direction_rounds integer not null default 3 check (free_direction_rounds between 1 and 20),
  extra_round_wait_seconds integer not null default 3600
    check (extra_round_wait_seconds between 0 and 604800),
  open_sites_per_account integer not null default 1 check (open_sites_per_account between 1 and 20),
  idle_days integer not null default 30 check (idle_days between 7 and 365),
  updated_at timestamptz not null default now()
);
insert into private.platform_limits default values;
alter table private.platform_limits enable row level security;
revoke all on private.platform_limits from public, anon, authenticated;

-- Writes the values the platform sent (validated: out of range raises bad_limits).
create function private.set_limits(
  p_free_rounds integer default null,
  p_wait_seconds integer default null,
  p_open_sites integer default null,
  p_idle_days integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (p_free_rounds is not null and p_free_rounds not between 1 and 20)
     or (p_wait_seconds is not null and p_wait_seconds not between 0 and 604800)
     or (p_open_sites is not null and p_open_sites not between 1 and 20)
     or (p_idle_days is not null and p_idle_days not between 7 and 365) then
    raise exception 'bad_limits';
  end if;
  update private.platform_limits set
    free_direction_rounds = coalesce(p_free_rounds, free_direction_rounds),
    extra_round_wait_seconds = coalesce(p_wait_seconds, extra_round_wait_seconds),
    open_sites_per_account = coalesce(p_open_sites, open_sites_per_account),
    idle_days = coalesce(p_idle_days, idle_days),
    updated_at = now()
  where id
    and (free_direction_rounds, extra_round_wait_seconds, open_sites_per_account, idle_days)
      is distinct from (
        coalesce(p_free_rounds, free_direction_rounds),
        coalesce(p_wait_seconds, extra_round_wait_seconds),
        coalesce(p_open_sites, open_sites_per_account),
        coalesce(p_idle_days, idle_days)
      );
end;
$$;
revoke execute on function private.set_limits(integer, integer, integer, integer) from public, anon, authenticated;

-- 2. Per-site counters and activity ------------------------------------------------------

alter table public.sites
  -- Rounds of directions generated for the site (the first one included). Never reset.
  add column direction_rounds integer not null default 0 check (direction_rounds >= 0),
  -- Extra free rounds the team granted.
  add column extra_direction_rounds integer not null default 0
    check (extra_direction_rounds between 0 and 50),
  add column last_directions_at timestamptz,
  -- The person's last action on the site: editing the draft, asking for directions, choosing,
  -- approving, paying. Jobs and the team do not count. The idle cleanup starts from it.
  add column last_activity_at timestamptz not null default now(),
  -- A later date the team set for the cleanup.
  add column keep_until timestamptz;

update public.sites set last_activity_at = updated_at;
update public.sites s
  set direction_rounds = d.rounds, last_directions_at = d.last_at
  from (
    select site_id, count(distinct round)::integer as rounds, max(created_at) as last_at
    from public.site_directions group by site_id
  ) d
  where d.site_id = s.id;
-- A round asked for and still being drawn counts too.
update public.sites s
  set direction_rounds = direction_rounds + 1, last_directions_at = coalesce(last_directions_at, updated_at)
  where status = 'generating_directions'
    and not exists (select 1 from public.site_directions d where d.site_id = s.id and d.round = s.round);

create index sites_owner_status_idx on public.sites (owner_id, status);
create index sites_created_at_idx on public.sites (created_at);

-- Editing the draft is an action.
create function private.touch_site_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sites set last_activity_at = now() where id = new.site_id;
  return new;
end;
$$;
revoke execute on function private.touch_site_activity() from public, anon, authenticated;
create trigger site_configs_touch_activity after update of draft, completed on public.site_configs
  for each row execute function private.touch_site_activity();

-- 3. Sites in progress ---------------------------------------------------------------------

-- The statuses of a site still being made (docs/product.md). Paid sites never count.
create function private.open_statuses()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['draft', 'generating_directions', 'awaiting_direction_choice', 'building',
               'in_review', 'awaiting_approval', 'needs_attention'];
$$;

create function private.site_paid(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.payments
    where site_id = p_site_id and purpose = 'publish' and status = 'paid'
  );
$$;
revoke execute on function private.site_paid(uuid) from public, anon, authenticated;

create function private.open_sites(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.sites s
  where s.owner_id = p_user_id
    and s.status = any(private.open_statuses())
    and not private.site_paid(s.id);
$$;
revoke execute on function private.open_sites(uuid) from public, anon, authenticated;

-- A team exception: more sites in progress for one account, with the reason.
create table public.account_site_slots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  extra integer not null check (extra between 1 and 10),
  reason text not null check (char_length(reason) between 3 and 500),
  granted_by uuid not null references auth.users (id),
  granted_at timestamptz not null default now()
);
alter table public.account_site_slots enable row level security;
revoke all on public.account_site_slots from anon, authenticated;

-- How many sites in progress the account may have.
create function private.allowed_open_sites(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (select open_sites_per_account from private.platform_limits)
       + coalesce((select extra from public.account_site_slots where user_id = p_user_id), 0);
$$;
revoke execute on function private.allowed_open_sites(uuid) from public, anon, authenticated;

-- Every new site, whatever path creates it: one at a time per owner (an advisory lock, so two
-- clicks at once cannot both pass), and only within the allowance. Accounts with more sites in
-- progress from before this rule keep them, but cannot add another.
create function private.check_new_site()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('open-sites:' || new.owner_id::text, 0));
  if private.open_sites(new.owner_id) >= private.allowed_open_sites(new.owner_id) then
    raise exception 'site_in_progress';
  end if;
  return new;
end;
$$;
revoke execute on function private.check_new_site() from public, anon, authenticated;
create trigger sites_check_new before insert on public.sites
  for each row execute function private.check_new_site();

-- The platform creates sites with the allowance from limits.ts.
create function public.server_create_site(p_user_id uuid, p_open_sites integer, p_draft jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  site_id uuid;
begin
  if p_user_id is null or jsonb_typeof(coalesce(p_draft, '{}'::jsonb)) <> 'object' then
    raise exception 'bad_request';
  end if;
  perform private.set_limits(p_open_sites => p_open_sites);
  insert into public.sites (owner_id) values (p_user_id) returning id into site_id;
  insert into public.site_configs (site_id, draft, completed)
    values (site_id, coalesce(p_draft, '{}'::jsonb), '{}');
  return site_id;
end;
$$;
revoke execute on function public.server_create_site(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.server_create_site(uuid, integer, jsonb) to service_role;

-- 4. Rounds of directions ------------------------------------------------------------------

-- Starts a round of directions for the owner, within the free rounds or after the wait.
-- Refusing is an answer, not an error: {"ok": false, "reason": "wait", "availableAt": ...}.
create function private.start_directions(p_site_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  lim private.platform_limits%rowtype;
  job_id uuid;
  next_round integer;
  free_rounds integer;
  available timestamptz;
begin
  if p_user_id is null or not private.email_confirmed(p_user_id) then
    raise exception 'email_not_confirmed';
  end if;
  select * into site from public.sites
    where id = p_site_id and owner_id = p_user_id
    for update;
  if not found then raise exception 'site_not_found'; end if;
  if site.schema_version <> '1.2' then raise exception 'needs_v12'; end if;
  if site.status not in ('draft', 'awaiting_direction_choice', 'needs_attention') then
    raise exception 'wrong_status';
  end if;

  select * into lim from private.platform_limits;
  free_rounds := lim.free_direction_rounds + site.extra_direction_rounds;
  if site.direction_rounds >= free_rounds and site.last_directions_at is not null then
    available := site.last_directions_at + make_interval(secs => lim.extra_round_wait_seconds);
    if available > now() then
      return jsonb_build_object('ok', false, 'reason', 'wait', 'availableAt', available,
        'used', site.direction_rounds, 'free', free_rounds);
    end if;
  end if;
  -- The AI's own daily limits per site and per account (packages/ai) stay as they were.
  perform private.hit_rate_limit('directions:site:' || p_site_id, 20, interval '1 day');
  perform private.hit_rate_limit('directions:user:' || p_user_id, 40, interval '1 day');

  next_round := case
    when exists (select 1 from public.site_directions d where d.site_id = p_site_id) then site.round + 1
    else site.round
  end;
  update public.sites
    set status = 'generating_directions', round = next_round, status_message = null,
        direction_rounds = direction_rounds + 1, last_directions_at = now(), last_activity_at = now()
    where id = p_site_id;
  insert into public.jobs (site_id, kind, payload)
    values (p_site_id, 'directions', jsonb_build_object('round', next_round))
    returning id into job_id;
  perform private.add_event(p_site_id, 'directions_requested',
    case when next_round = 0 then 'Recebemos suas respostas. Estamos criando as 3 direções.'
         else 'Pedido de novas direções recebido.' end);
  return jsonb_build_object('ok', true, 'jobId', job_id, 'used', site.direction_rounds + 1,
    'free', free_rounds);
end;
$$;
revoke execute on function private.start_directions(uuid, uuid) from public, anon, authenticated;

-- The client's own call keeps its shape (a job id) and the same rules, with the last values the
-- platform sent.
create or replace function private.request_directions(p_site_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  result := private.start_directions(p_site_id, (select auth.uid()));
  if (result ->> 'ok')::boolean is not true then raise exception 'directions_wait'; end if;
  return (result ->> 'jobId')::uuid;
end;
$$;

-- The platform's call, with the limits from limits.ts.
create function public.server_request_directions(
  p_site_id uuid,
  p_user_id uuid,
  p_free_rounds integer,
  p_wait_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.set_limits(p_free_rounds => p_free_rounds, p_wait_seconds => p_wait_seconds);
  return private.start_directions(p_site_id, p_user_id);
end;
$$;
revoke execute on function public.server_request_directions(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.server_request_directions(uuid, uuid, integer, integer) to service_role;

-- What the owner sees: rounds used, free rounds and when the next one opens.
create function private.directions_quota(p_site_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  lim private.platform_limits%rowtype;
  free_rounds integer;
  available timestamptz;
begin
  select * into site from public.sites where id = p_site_id and owner_id = (select auth.uid());
  if not found then raise exception 'site_not_found'; end if;
  select * into lim from private.platform_limits;
  free_rounds := lim.free_direction_rounds + site.extra_direction_rounds;
  if site.direction_rounds >= free_rounds and site.last_directions_at is not null then
    available := site.last_directions_at + make_interval(secs => lim.extra_round_wait_seconds);
    if available <= now() then available := null; end if;
  end if;
  return jsonb_build_object('used', site.direction_rounds, 'free', free_rounds,
    'availableAt', available);
end;
$$;
create function public.directions_quota(p_site_id uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.directions_quota(p_site_id); $$;
revoke execute on function private.directions_quota(uuid) from public, anon;
revoke execute on function public.directions_quota(uuid) from public, anon;
grant execute on function private.directions_quota(uuid) to authenticated;
grant execute on function public.directions_quota(uuid) to authenticated;

-- Choosing and approving are actions too (the functions themselves stay as they were).
create function private.touch_on_choice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.approved_direction is distinct from old.approved_direction
     or new.approved_at is distinct from old.approved_at then
    new.last_activity_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function private.touch_on_choice() from public, anon, authenticated;
create trigger sites_touch_on_choice before update of approved_direction, approved_at on public.sites
  for each row execute function private.touch_on_choice();

-- Opening a payment counts as an action as well.
create function private.touch_on_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.site_id is not null then
    update public.sites set last_activity_at = now() where id = new.site_id;
  end if;
  return new;
end;
$$;
revoke execute on function private.touch_on_payment() from public, anon, authenticated;
create trigger payments_touch_activity after insert or update of status on public.payments
  for each row execute function private.touch_on_payment();

-- 5. Model calls ---------------------------------------------------------------------------

-- One row per call to the model, written by the jobs (packages/ai SpendingGuard). No prompt and
-- no answer. When a site or an account is removed the row loses the link and keeps its cost.
create table public.ai_calls (
  id bigint generated always as identity primary key,
  site_id uuid references public.sites (id) on delete set null,
  account_id uuid references auth.users (id) on delete set null,
  task text not null check (task in ('directions', 'copy', 'review', 'rewrite')),
  model text not null check (char_length(model) between 1 and 80),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cache_write_tokens integer not null default 0 check (cache_write_tokens >= 0),
  cache_read_tokens integer not null default 0 check (cache_read_tokens >= 0),
  cost_usd numeric(12, 6) not null check (cost_usd >= 0),
  created_at timestamptz not null default now()
);
create index ai_calls_created_at_idx on public.ai_calls (created_at);
create index ai_calls_site_id_idx on public.ai_calls (site_id);
create index ai_calls_account_id_idx on public.ai_calls (account_id);
alter table public.ai_calls enable row level security;
revoke all on public.ai_calls from anon, authenticated;

-- 6. Discarding and the idle cleanup -------------------------------------------------------

-- What is left of a removed site: enough for the funnel and the costs, nothing personal.
create table public.site_removals (
  id bigint generated always as identity primary key,
  site_id uuid not null,
  owner_id uuid references auth.users (id) on delete set null,
  reason text not null check (reason in ('discarded', 'idle')),
  last_status text not null,
  -- The furthest stage the site reached (private.site_stage).
  stage integer not null check (stage between 0 and 6),
  direction_rounds integer not null default 0,
  site_created_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index site_removals_created_at_idx on public.site_removals (created_at);
alter table public.site_removals enable row level security;
revoke all on public.site_removals from anon, authenticated;

-- The furthest stage of the funnel a site reached: 0 created, 1 directions ready, 2 direction
-- chosen, 3 built, 4 approved, 5 paid, 6 live.
create function private.site_stage(s public.sites)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.published_at is not null then 6
    when private.site_paid(s.id) then 5
    when s.approved_at is not null then 4
    when s.status in ('in_review', 'awaiting_approval', 'publishing', 'live', 'grace', 'suspended')
      or exists (select 1 from public.review_reports r where r.site_id = s.id) then 3
    when s.approved_direction is not null then 2
    when exists (select 1 from public.site_directions d where d.site_id = s.id) then 1
    else 0
  end;
$$;
revoke execute on function private.site_stage(public.sites) from public, anon, authenticated;

-- Removes an unpaid site in progress, as account deletion does: pending payments go, the
-- hosting cleanup is queued, a removal record stays. Returns what the platform still has to
-- clean (Storage, KV). Paid sites and sites past "in progress" are refused.
create function private.remove_unpaid_site(p_site_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  queued boolean := false;
begin
  select * into site from public.sites where id = p_site_id for update;
  if not found then raise exception 'site_not_found'; end if;
  if private.site_paid(site.id) or not (site.status = any(private.open_statuses())) then
    raise exception 'not_removable';
  end if;
  insert into public.site_removals
    (site_id, owner_id, reason, last_status, stage, direction_rounds, site_created_at)
    values (site.id, site.owner_id, p_reason, site.status, private.site_stage(site),
            site.direction_rounds, site.created_at);
  delete from public.payments where site_id = site.id and status in ('pending', 'failed');
  if site.subdomain is not null or site.status <> 'draft' then
    insert into public.site_purges (site_id, subdomain) values (site.id, site.subdomain);
    queued := true;
  end if;
  delete from public.sites where id = site.id;
  return jsonb_build_object('siteId', site.id, 'ownerId', site.owner_id,
    'subdomain', site.subdomain, 'queued', queued, 'removed', true);
end;
$$;
revoke execute on function private.remove_unpaid_site(uuid, text) from public, anon, authenticated;

-- The owner discards an unpaid site (with a confirmation in the interface). The AI's daily
-- limits per account are keyed by the account, so discarding does not reset them.
create function public.server_discard_site(p_site_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.sites where id = p_site_id and owner_id = p_user_id) then
    raise exception 'site_not_found';
  end if;
  return private.remove_unpaid_site(p_site_id, 'discarded');
end;
$$;
revoke execute on function public.server_discard_site(uuid, uuid) from public, anon, authenticated;
grant execute on function public.server_discard_site(uuid, uuid) to service_role;

-- The idle rule: unpaid, waiting on the person (not on a job or the team), with no action for
-- idle_days, and past any later date the team set. When the site is deleted.
create function private.idle_deadline(s public.sites, p_idle_days integer)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select greatest(s.last_activity_at + make_interval(days => p_idle_days),
                  coalesce(s.keep_until, '-infinity'::timestamptz));
$$;

create function private.idle_candidate(s public.sites)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Generating, building and in review wait on us, not on the person: never removed.
  select s.status in ('draft', 'awaiting_direction_choice', 'awaiting_approval', 'needs_attention')
    and s.schema_version = '1.2'
    and not private.site_paid(s.id)
    and not exists (select 1 from public.jobs j where j.site_id = s.id and j.status in ('queued', 'running'));
$$;
revoke execute on function private.idle_candidate(public.sites) from public, anon, authenticated;

-- Sites the cleanup would remove within p_within_days (0 = due now). The dry run.
create function public.server_idle_sites(p_idle_days integer, p_within_days integer, p_limit integer)
returns table (site_id uuid, owner_id uuid, subdomain text, status text, deadline timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_within_days not between 0 and 60 or p_limit not between 1 and 500 then
    raise exception 'bad_request';
  end if;
  perform private.set_limits(p_idle_days => p_idle_days);
  return query
    select s.id, s.owner_id, s.subdomain, s.status, private.idle_deadline(s, p_idle_days)
    from public.sites s
    where private.idle_candidate(s)
      and private.idle_deadline(s, p_idle_days) <= now() + make_interval(days => p_within_days)
    order by private.idle_deadline(s, p_idle_days)
    limit p_limit;
end;
$$;
revoke execute on function public.server_idle_sites(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.server_idle_sites(integer, integer, integer) to service_role;

-- Removes one idle site after checking the rule again under the lock: in doubt, nothing goes.
create function public.server_remove_idle_site(p_site_id uuid, p_idle_days integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
begin
  perform private.set_limits(p_idle_days => p_idle_days);
  select * into site from public.sites where id = p_site_id for update;
  if not found then return jsonb_build_object('removed', false, 'why', 'gone'); end if;
  if not private.idle_candidate(site) or private.idle_deadline(site, p_idle_days) > now() then
    return jsonb_build_object('removed', false, 'why', 'not_due');
  end if;
  return private.remove_unpaid_site(p_site_id, 'idle');
end;
$$;
revoke execute on function public.server_remove_idle_site(uuid, integer) from public, anon, authenticated;
grant execute on function public.server_remove_idle_site(uuid, integer) to service_role;

-- The in-site warnings before the cleanup: no emails this round, so the dashboard says it.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'directions_ready', 'site_ready_for_approval', 'changes_requested', 'site_published',
  'site_suspended', 'site_suspension_lifted', 'email_confirmed', 'site_deletion_warning'
));
alter table public.notifications
  add column days_left integer check (days_left between 0 and 60),
  add column deadline date;
-- One warning per threshold and deadline: a new deadline (after an action) warns again.
create unique index notifications_deletion_once on public.notifications (site_id, days_left, deadline)
  where kind = 'site_deletion_warning';

create function public.server_warn_idle_sites(p_idle_days integer, p_thresholds integer[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  warned integer := 0;
  threshold integer;
  added integer;
begin
  if p_thresholds is null or cardinality(p_thresholds) not between 1 and 5 then
    raise exception 'bad_request';
  end if;
  perform private.set_limits(p_idle_days => p_idle_days);
  foreach threshold in array p_thresholds loop
    if threshold not between 1 and 30 then raise exception 'bad_request'; end if;
    insert into public.notifications (user_id, site_id, kind, days_left, deadline)
      select s.owner_id, s.id, 'site_deletion_warning', threshold,
             (private.idle_deadline(s, p_idle_days) at time zone 'America/Sao_Paulo')::date
      from public.sites s
      where private.idle_candidate(s)
        and private.idle_deadline(s, p_idle_days) > now()
        and private.idle_deadline(s, p_idle_days) <= now() + make_interval(days => threshold)
      on conflict do nothing;
    get diagnostics added = row_count;
    warned := warned + added;
  end loop;
  return warned;
end;
$$;
revoke execute on function public.server_warn_idle_sites(integer, integer[]) from public, anon, authenticated;
grant execute on function public.server_warn_idle_sites(integer, integer[]) to service_role;

-- 7. The team log: more kinds of action, some without a site ----------------------------------

alter table public.admin_decisions alter column site_id drop not null;
alter table public.admin_decisions alter column from_status drop not null;
alter table public.admin_decisions alter column to_status drop not null;
alter table public.admin_decisions
  add column target_user_id uuid references auth.users (id) on delete set null,
  add column details jsonb check (details is null or jsonb_typeof(details) = 'object');
alter table public.admin_decisions drop constraint admin_decisions_action_check;
alter table public.admin_decisions add constraint admin_decisions_action_check check (action in (
  'approve', 'request_changes', 'suspend', 'unsuspend',
  'view_account', 'grant_round', 'grant_site_slot', 'extend_cleanup'
));
create index admin_decisions_target_user_idx on public.admin_decisions (target_user_id, created_at);

-- 8. The team panel ------------------------------------------------------------------------
-- Every function checks private.is_admin() (team and second factor) and returns only what the
-- panel shows. They run with the member's own session: no secret key.

create function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'forbidden'; end if;
end;
$$;
revoke execute on function private.require_admin() from public, anon, authenticated;

-- The day in Brazil, for daily totals.
create function private.br_day(p_at timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$ select (p_at at time zone 'America/Sao_Paulo')::date; $$;

-- Overview: accounts, the funnel, abandoned sites and AI cost, for 7 days, 30 days and always.
create function private.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb := '{}'::jsonb;
  period text;
  since timestamptz;
  funnel jsonb;
  cost numeric;
  created integer;
  paid integer;
begin
  perform private.require_admin();
  foreach period in array array['7', '30', 'all'] loop
    since := case when period = 'all' then '-infinity'::timestamptz
                  else now() - make_interval(days => period::integer) end;
    with all_sites as (
      select private.site_stage(s) as stage from public.sites s where s.created_at >= since
      union all
      select r.stage from public.site_removals r where r.site_created_at >= since
    )
    select jsonb_build_object(
      'created', count(*),
      'directions', count(*) filter (where stage >= 1),
      'chosen', count(*) filter (where stage >= 2),
      'built', count(*) filter (where stage >= 3),
      'approved', count(*) filter (where stage >= 4),
      'paid', count(*) filter (where stage >= 5),
      'live', count(*) filter (where stage >= 6)
    ) into funnel from all_sites;
    created := (funnel ->> 'created')::integer;
    select coalesce(sum(cost_usd), 0) into cost from public.ai_calls where created_at >= since;
    select count(*) into paid from public.payments
      where purpose = 'publish' and status = 'paid' and paid_at >= since;
    result := result || jsonb_build_object(period, jsonb_build_object(
      'accounts', (select count(*) from auth.users where created_at >= since),
      'confirmed', (select count(*) from auth.users where created_at >= since and email_confirmed_at is not null),
      'funnel', funnel,
      'costUsd', cost,
      'aiCalls', (select count(*) from public.ai_calls where created_at >= since),
      'paidSites', paid,
      'costPerSite', case when created > 0 then round(cost / created, 6) end,
      'costPerPaidSite', case when paid > 0 then round(cost / paid, 6) end
    ));
  end loop;
  return result || jsonb_build_object(
    'abandoned', (
      select coalesce(jsonb_object_agg(stage::text, n), '{}'::jsonb) from (
        select private.site_stage(s) as stage, count(*) as n from public.sites s
        where s.status = any(private.open_statuses()) and not private.site_paid(s.id)
          and s.last_activity_at < now() - interval '7 days'
        group by 1
      ) a
    ),
    'today', jsonb_build_object(
      'day', private.br_day(now()),
      'spentUsd', coalesce((select usd from public.ai_spend where day = private.br_day(now())), 0)
    )
  );
end;
$$;

-- Costs: per day, task and model; the sites and accounts that cost most; paid versus unpaid;
-- how long the jobs take (machine cost comes later, from these times).
create function private.admin_costs(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  since timestamptz;
begin
  perform private.require_admin();
  if p_days not between 1 and 365 then raise exception 'bad_request'; end if;
  since := now() - make_interval(days => p_days);
  return jsonb_build_object(
    'byDay', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'usd', usd, 'calls', calls) order by day), '[]'::jsonb)
      from (
        select private.br_day(created_at) as day, sum(cost_usd) as usd, count(*) as calls
        from public.ai_calls where created_at >= since group by 1
      ) d
    ),
    'byTask', (
      select coalesce(jsonb_agg(jsonb_build_object('task', task, 'usd', usd, 'calls', calls) order by usd desc), '[]'::jsonb)
      from (select task, sum(cost_usd) as usd, count(*) as calls from public.ai_calls
            where created_at >= since group by 1) t
    ),
    'byModel', (
      select coalesce(jsonb_agg(jsonb_build_object('model', model, 'usd', usd, 'calls', calls,
        'inputTokens', input_tokens, 'outputTokens', output_tokens) order by usd desc), '[]'::jsonb)
      from (select model, sum(cost_usd) as usd, count(*) as calls, sum(input_tokens) as input_tokens,
                   sum(output_tokens) as output_tokens
            from public.ai_calls where created_at >= since group by 1) m
    ),
    'topSites', (
      select coalesce(jsonb_agg(jsonb_build_object('siteId', c.site_id, 'name', c.name,
        'status', c.status, 'usd', c.usd) order by c.usd desc), '[]'::jsonb)
      from (
        select a.site_id, s.status, sc.draft #>> '{business,name}' as name, sum(a.cost_usd) as usd
        from public.ai_calls a
        join public.sites s on s.id = a.site_id
        left join public.site_configs sc on sc.site_id = a.site_id
        where a.created_at >= since
        group by a.site_id, s.status, sc.draft
        order by usd desc limit 20
      ) c
    ),
    'topAccounts', (
      select coalesce(jsonb_agg(jsonb_build_object('userId', c.account_id, 'email', c.email,
        'usd', c.usd) order by c.usd desc), '[]'::jsonb)
      from (
        select a.account_id, u.email, sum(a.cost_usd) as usd
        from public.ai_calls a join auth.users u on u.id = a.account_id
        where a.created_at >= since
        group by a.account_id, u.email
        order by usd desc limit 20
      ) c
    ),
    'perSite', (
      select jsonb_build_object(
        'sites', count(*),
        'average', round(avg(usd), 6),
        'median', round((percentile_cont(0.5) within group (order by usd))::numeric, 6),
        'paidUsd', coalesce(sum(usd) filter (where paid), 0),
        'unpaidUsd', coalesce(sum(usd) filter (where not paid), 0),
        'paidSites', count(*) filter (where paid),
        'unpaidSites', count(*) filter (where not paid)
      )
      from (
        select a.site_id, sum(a.cost_usd) as usd, private.site_paid(a.site_id) as paid
        from public.ai_calls a where a.created_at >= since and a.site_id is not null
        group by a.site_id
      ) p
    ),
    'removedUsd', (select coalesce(sum(cost_usd), 0) from public.ai_calls
                   where created_at >= since and site_id is null),
    'jobs', (
      select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'runs', runs,
        'averageSeconds', avg_s, 'maxSeconds', max_s) order by kind), '[]'::jsonb)
      from (
        select kind, count(*) as runs,
               round(avg(extract(epoch from finished_at - started_at))::numeric, 1) as avg_s,
               round(max(extract(epoch from finished_at - started_at))::numeric, 1) as max_s
        from public.jobs
        where created_at >= since and started_at is not null and finished_at is not null
          and kind in ('directions', 'build', 'publish')
        group by kind
      ) j
    )
  );
end;
$$;

-- Accounts: search, filters, order, pages. Only what the list shows.
create function private.admin_accounts(
  p_query text,
  p_filter text,
  p_sort text,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pattern text;
  page_rows jsonb;
  total integer;
begin
  perform private.require_admin();
  if p_limit not between 1 and 50 or p_offset not between 0 and 100000
     or coalesce(p_filter, '') not in ('', 'confirmed', 'open', 'paid', 'limit')
     or coalesce(p_sort, '') not in ('', 'recent', 'oldest', 'cost', 'email')
     or char_length(coalesce(p_query, '')) > 120 then
    raise exception 'bad_request';
  end if;
  -- The search is literal: % and _ typed by the team are not wildcards.
  pattern := '%' || replace(replace(replace(coalesce(p_query, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  with accounts as (
    select u.id, u.email, u.created_at, u.email_confirmed_at, p.full_name,
      (select count(*) from public.sites s where s.owner_id = u.id
         and s.status = any(private.open_statuses()) and not private.site_paid(s.id)) as open_sites,
      (select count(*) from public.sites s where s.owner_id = u.id and private.site_paid(s.id)) as paid_sites,
      exists (select 1 from public.sites s, private.platform_limits l
              where s.owner_id = u.id
                and s.direction_rounds >= l.free_direction_rounds + s.extra_direction_rounds) as at_limit,
      (select coalesce(sum(a.cost_usd), 0) from public.ai_calls a where a.account_id = u.id) as cost_usd
    from auth.users u
    left join public.profiles p on p.id = u.id
    where coalesce(p_query, '') = ''
       or u.email ilike pattern escape '\'
       or p.full_name ilike pattern escape '\'
  ),
  filtered as (
    select * from accounts
    where case coalesce(p_filter, '')
      when 'confirmed' then email_confirmed_at is not null
      when 'open' then open_sites > 0
      when 'paid' then paid_sites > 0
      when 'limit' then at_limit
      else true end
  )
  select (select count(*) from filtered),
    coalesce(jsonb_agg(jsonb_build_object(
      'userId', id, 'email', email, 'name', full_name, 'createdAt', created_at,
      'confirmed', email_confirmed_at is not null, 'openSites', open_sites,
      'paidSites', paid_sites, 'atLimit', at_limit, 'costUsd', cost_usd)), '[]'::jsonb)
    into total, page_rows
  from (
    select * from filtered
    order by
      case when coalesce(p_sort, '') in ('', 'recent') then created_at end desc,
      case when p_sort = 'oldest' then created_at end asc,
      case when p_sort = 'cost' then cost_usd end desc,
      case when p_sort = 'email' then email end asc,
      id
    limit p_limit offset p_offset
  ) page;
  return jsonb_build_object('total', total, 'rows', page_rows);
end;
$$;

-- One account, for support. Opening it is logged.
create function private.admin_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  account jsonb;
  lim private.platform_limits%rowtype;
begin
  perform private.require_admin();
  select jsonb_build_object('userId', u.id, 'email', u.email, 'name', p.full_name,
    'createdAt', u.created_at, 'lastSignInAt', u.last_sign_in_at,
    'confirmed', u.email_confirmed_at is not null)
    into account
    from auth.users u left join public.profiles p on p.id = u.id
    where u.id = p_user_id;
  if account is null then raise exception 'not_found'; end if;
  select * into lim from private.platform_limits;
  insert into public.admin_decisions (admin_id, action, target_user_id)
    values ((select auth.uid()), 'view_account', p_user_id);
  return account || jsonb_build_object(
    'slotGrant', (select jsonb_build_object('extra', extra, 'reason', reason, 'grantedAt', granted_at)
                  from public.account_site_slots where user_id = p_user_id),
    'openSites', private.open_sites(p_user_id),
    'allowedOpenSites', private.allowed_open_sites(p_user_id),
    'sites', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'siteId', s.id, 'name', sc.draft #>> '{business,name}', 'status', s.status,
        'subdomain', s.subdomain, 'paid', private.site_paid(s.id),
        'costUsd', (select coalesce(sum(cost_usd), 0) from public.ai_calls a where a.site_id = s.id),
        'rounds', s.direction_rounds,
        'freeRounds', lim.free_direction_rounds + s.extra_direction_rounds,
        'nextRoundAt', case
          when s.direction_rounds >= lim.free_direction_rounds + s.extra_direction_rounds
               and s.last_directions_at + make_interval(secs => lim.extra_round_wait_seconds) > now()
          then s.last_directions_at + make_interval(secs => lim.extra_round_wait_seconds) end,
        'lastActivityAt', s.last_activity_at,
        'deletesAt', case when private.idle_candidate(s) then private.idle_deadline(s, lim.idle_days) end,
        'createdAt', s.created_at) order by s.created_at desc), '[]'::jsonb)
      from public.sites s left join public.site_configs sc on sc.site_id = s.id
      where s.owner_id = p_user_id
    ),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object('siteId', e.site_id, 'kind', e.kind,
        'message', e.message, 'at', e.created_at) order by e.created_at desc), '[]'::jsonb)
      from (
        select e.* from public.site_events e join public.sites s on s.id = e.site_id
        where s.owner_id = p_user_id order by e.created_at desc limit 20
      ) e
    )
  );
end;
$$;

-- The limits in force and what the cleanup will remove soon.
create function private.admin_limits()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  lim private.platform_limits%rowtype;
begin
  perform private.require_admin();
  select * into lim from private.platform_limits;
  return jsonb_build_object(
    'freeDirectionRounds', lim.free_direction_rounds,
    'extraRoundWaitSeconds', lim.extra_round_wait_seconds,
    'openSitesPerAccount', lim.open_sites_per_account,
    'idleDays', lim.idle_days,
    'syncedAt', lim.updated_at,
    'deletingWithin7Days', (
      select count(*) from public.sites s
      where private.idle_candidate(s)
        and private.idle_deadline(s, lim.idle_days) <= now() + interval '7 days'
    ),
    'slotGrants', (select count(*) from public.account_site_slots)
  );
end;
$$;

-- Team actions, each one logged with who, when, what, before and after.
create function private.admin_grant_round(p_site_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
begin
  perform private.require_admin();
  if char_length(coalesce(p_note, '')) not between 3 and 500 then raise exception 'bad_request'; end if;
  select * into site from public.sites where id = p_site_id for update;
  if not found then raise exception 'not_found'; end if;
  update public.sites set extra_direction_rounds = extra_direction_rounds + 1 where id = p_site_id;
  insert into public.admin_decisions (site_id, admin_id, action, note, target_user_id, details)
    values (p_site_id, (select auth.uid()), 'grant_round', p_note, site.owner_id,
      jsonb_build_object('before', site.extra_direction_rounds, 'after', site.extra_direction_rounds + 1));
  return jsonb_build_object('extraRounds', site.extra_direction_rounds + 1);
end;
$$;

create function private.admin_grant_site_slot(p_user_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  before integer;
begin
  perform private.require_admin();
  if char_length(coalesce(p_reason, '')) not between 3 and 500 then raise exception 'bad_request'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'not_found'; end if;
  select extra into before from public.account_site_slots where user_id = p_user_id;
  if coalesce(before, 0) >= 10 then raise exception 'bad_request'; end if;
  insert into public.account_site_slots (user_id, extra, reason, granted_by)
    values (p_user_id, 1, p_reason, (select auth.uid()))
    on conflict (user_id) do update
      set extra = public.account_site_slots.extra + 1, reason = excluded.reason,
          granted_by = excluded.granted_by, granted_at = now();
  insert into public.admin_decisions (admin_id, action, note, target_user_id, details)
    values ((select auth.uid()), 'grant_site_slot', p_reason, p_user_id,
      jsonb_build_object('before', coalesce(before, 0), 'after', coalesce(before, 0) + 1));
  return jsonb_build_object('extra', coalesce(before, 0) + 1);
end;
$$;

create function private.admin_extend_cleanup(p_site_id uuid, p_days integer, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  lim private.platform_limits%rowtype;
  before timestamptz;
  after timestamptz;
begin
  perform private.require_admin();
  if p_days not between 1 and 90 or char_length(coalesce(p_note, '')) not between 3 and 500 then
    raise exception 'bad_request';
  end if;
  select * into site from public.sites where id = p_site_id for update;
  if not found then raise exception 'not_found'; end if;
  select * into lim from private.platform_limits;
  before := private.idle_deadline(site, lim.idle_days);
  after := greatest(before, now()) + make_interval(days => p_days);
  update public.sites set keep_until = after where id = p_site_id;
  insert into public.admin_decisions (site_id, admin_id, action, note, target_user_id, details)
    values (p_site_id, (select auth.uid()), 'extend_cleanup', p_note, site.owner_id,
      jsonb_build_object('before', before, 'after', after));
  return jsonb_build_object('deletesAt', after);
end;
$$;

-- The team's queue: cost and rounds of each site in it.
create function private.admin_site_costs(p_site_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if cardinality(p_site_ids) > 200 then raise exception 'bad_request'; end if;
  return (
    select coalesce(jsonb_object_agg(s.id, jsonb_build_object(
      'costUsd', (select coalesce(sum(cost_usd), 0) from public.ai_calls a where a.site_id = s.id),
      'rounds', s.direction_rounds)), '{}'::jsonb)
    from public.sites s where s.id = any(p_site_ids)
  );
end;
$$;

-- Wrappers the API exposes (security invoker), as elsewhere.
create function public.admin_overview()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.admin_overview(); $$;
create function public.admin_costs(p_days integer)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.admin_costs(p_days); $$;
create function public.admin_accounts(p_query text, p_filter text, p_sort text, p_limit integer, p_offset integer)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.admin_accounts(p_query, p_filter, p_sort, p_limit, p_offset); $$;
create function public.admin_account(p_user_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.admin_account(p_user_id); $$;
create function public.admin_limits()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.admin_limits(); $$;
create function public.admin_grant_round(p_site_id uuid, p_note text)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.admin_grant_round(p_site_id, p_note); $$;
create function public.admin_grant_site_slot(p_user_id uuid, p_reason text)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.admin_grant_site_slot(p_user_id, p_reason); $$;
create function public.admin_extend_cleanup(p_site_id uuid, p_days integer, p_note text)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.admin_extend_cleanup(p_site_id, p_days, p_note); $$;
create function public.admin_site_costs(p_site_ids uuid[])
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.admin_site_costs(p_site_ids); $$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'admin_overview()', 'admin_costs(integer)',
    'admin_accounts(text, text, text, integer, integer)', 'admin_account(uuid)', 'admin_limits()',
    'admin_grant_round(uuid, text)', 'admin_grant_site_slot(uuid, text)',
    'admin_extend_cleanup(uuid, integer, text)', 'admin_site_costs(uuid[])'
  ] loop
    execute format('revoke execute on function private.%s from public, anon', fn);
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function private.%s to authenticated', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;

-- 9. What the person's own dashboard needs: their place for a new site ---------------------

create function private.my_site_slots()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'open', private.open_sites((select auth.uid())),
    'allowed', private.allowed_open_sites((select auth.uid())),
    'openSiteId', (
      select s.id from public.sites s
      where s.owner_id = (select auth.uid())
        and s.status = any(private.open_statuses()) and not private.site_paid(s.id)
      order by s.updated_at desc limit 1
    )
  );
$$;
create function public.my_site_slots()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.my_site_slots(); $$;
revoke execute on function private.my_site_slots() from public, anon;
revoke execute on function public.my_site_slots() from public, anon;
grant execute on function private.my_site_slots() to authenticated;
grant execute on function public.my_site_slots() to authenticated;
