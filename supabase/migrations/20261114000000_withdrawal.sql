-- Withdrawal (direito de arrependimento) and record keeping (E43).
--
-- CDC art. 49: a contract made outside a shop (online included) may be withdrawn within 7
-- days, and what was paid comes back at once, updated. Decreto 7.962/2013 art. 5: the seller
-- states clearly how to withdraw, accepts it through the same tool used to buy, confirms
-- receipt at once and tells the bank or card company so the charge is not billed or is
-- refunded. BrotaSites applies it as: within `withdrawal_days` (7) of the payment of a
-- publication, the owner withdraws from Meus sites; the site goes offline, its deletion is
-- scheduled, a refund request for the full amount is recorded and the team is told to refund
-- it through the payment provider. After that window, deleting a site gives no refund.
--
-- Record keeping: the takedown audit (site_takedowns) is kept 5 years (CDC art. 27, the period
-- to claim for damages) and then removed; expired address holds go too. Charges keep their own
-- rule (the tax period, E15).

-- 1. The window, in one place for the database -------------------------------------------------

create function private.withdrawal_days()
returns integer
language sql
immutable
set search_path = ''
as $$ select 7; $$;

-- The publication payment of a site that can still be withdrawn (null when there is none).
create function private.withdrawable_payment(p_site_id uuid)
returns public.payments
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.payments p
  where p.site_id = p_site_id and p.purpose = 'publish' and p.status = 'paid'
    and p.paid_at is not null
    and p.paid_at > now() - make_interval(days => private.withdrawal_days())
  order by p.paid_at desc
  limit 1;
$$;
revoke execute on function private.withdrawable_payment(uuid) from public, anon, authenticated;

-- 2. Refund requests: kept with the charges (no cascade from the site) --------------------------

create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  owner_id uuid references auth.users (id) on delete set null,
  -- Only the legal withdrawal for now; other refunds stay the team's manual decision.
  kind text not null default 'withdrawal' check (kind in ('withdrawal')),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'requested' check (status in ('requested', 'refunded')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  note text check (char_length(note) <= 1000),
  -- One request per charge.
  unique (payment_id)
);
create index refund_requests_open_idx on public.refund_requests (requested_at)
  where status = 'requested';
alter table public.refund_requests enable row level security;
revoke all on public.refund_requests from anon, authenticated;
grant select on public.refund_requests to authenticated;
create policy "Owners read their refund requests" on public.refund_requests
  for select to authenticated using (owner_id = (select auth.uid()));

-- The audit and the notices know the withdrawal.
alter table public.site_takedowns drop constraint site_takedowns_reason_check;
alter table public.site_takedowns add constraint site_takedowns_reason_check check (reason in (
  'owner_request', 'withdrawal', 'admin', 'abuse', 'legal', 'terms', 'payment', 'other'
));

alter table public.admin_decisions drop constraint admin_decisions_action_check;
alter table public.admin_decisions add constraint admin_decisions_action_check check (action in (
  'approve', 'request_changes', 'suspend', 'unsuspend',
  'view_account', 'grant_round', 'grant_site_slot', 'extend_cleanup',
  'take_offline', 'restore_online', 'schedule_deletion', 'cancel_deletion', 'delete_now',
  'refund_done'
));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'directions_ready', 'site_ready_for_approval', 'changes_requested', 'site_published',
  'site_suspended', 'site_suspension_lifted', 'email_confirmed', 'site_deletion_warning',
  'domain_active', 'domain_failed',
  'site_taken_offline', 'site_back_online', 'site_deletion_scheduled',
  'site_deletion_cancelled', 'site_deleted',
  'team_owner_took_offline', 'team_owner_requested_deletion',
  -- E43.
  'withdrawal_received', 'refund_done', 'team_withdrawal_requested'
));

-- 3. Withdrawing (the owner, from Meus sites) ----------------------------------------------------

create function public.server_withdraw(p_site_id uuid, p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  payment public.payments%rowtype;
  request public.refund_requests%rowtype;
  due timestamptz;
begin
  site := private.takedown_site(p_site_id, 'owner', p_owner_id);
  -- Asked twice: the first request stands.
  select r.* into request from public.refund_requests r
    join public.payments p on p.id = r.payment_id
    where p.site_id = site.id and r.kind = 'withdrawal'
    order by r.requested_at desc limit 1;
  if found then
    return jsonb_build_object('requestId', request.id, 'requestedAt', request.requested_at,
      'amountCents', request.amount_cents, 'status', request.status, 'changed', false,
      'subdomain', site.subdomain, 'ownerId', site.owner_id, 'siteStatus', site.status,
      'deleteAfter', site.delete_after);
  end if;
  payment := private.withdrawable_payment(site.id);
  if payment.id is null then raise exception 'withdrawal_expired'; end if;
  -- A suspended site is still withdrawn: the right does not depend on the team's measures.
  if site.status not in ('live', 'grace', 'offline', 'suspended') then
    raise exception 'busy';
  end if;

  insert into public.refund_requests (site_id, payment_id, owner_id, amount_cents)
    values (site.id, payment.id, site.owner_id, payment.amount_cents)
    returning * into request;

  -- The contract ends: offline at once, deletion scheduled (the client can download meanwhile).
  due := coalesce(site.delete_after, now() + make_interval(days => private.withdrawal_days()));
  update public.sites
    set status = case when status in ('live', 'grace') then 'offline' else status end,
        offline_from = case when status in ('live', 'grace') then status else offline_from end,
        offline_by = case when status in ('live', 'grace') then 'owner' else offline_by end,
        delete_after = due,
        deletion_by = coalesce(deletion_by, 'owner'),
        deletion_attempts = 0, deletion_error = null
    where id = site.id;
  perform private.log_takedown(site, 'schedule_deletion', 'owner', p_owner_id, 'withdrawal',
                               'Direito de arrependimento');
  perform private.add_event(site.id, 'withdrawal_received',
    'Recebemos sua desistência. O site saiu do ar e o valor pago será devolvido.');
  perform private.notify(site.owner_id, site.id, 'withdrawal_received');
  perform private.notify_team(site.id, 'team_withdrawal_requested');
  return jsonb_build_object('requestId', request.id, 'requestedAt', request.requested_at,
    'amountCents', request.amount_cents, 'status', request.status, 'changed', true,
    'subdomain', site.subdomain, 'ownerId', site.owner_id,
    'siteStatus', (select status from public.sites where id = site.id), 'deleteAfter', due);
end;
$$;

-- A withdrawn contract is over: the owner cannot cancel its deletion and keep the site with the
-- refund (the team still can, to fix a mistake).
create or replace function public.server_cancel_deletion(p_site_id uuid, p_actor text, p_actor_id uuid)
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
  if p_actor = 'owner' and exists (select 1 from public.refund_requests r
                                   where r.site_id = site.id and r.kind = 'withdrawal') then
    raise exception 'withdrawn';
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

-- 4. The team records the refund it made at the payment provider -------------------------------

create function public.server_refund_done(p_request_id uuid, p_admin_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.refund_requests%rowtype;
  site_status text;
begin
  if not exists (select 1 from public.admins where user_id = p_admin_id) then
    raise exception 'not_admin';
  end if;
  select * into request from public.refund_requests where id = p_request_id for update;
  if not found then raise exception 'not_found'; end if;
  if request.status = 'refunded' then
    return jsonb_build_object('requestId', request.id, 'status', 'refunded', 'changed', false);
  end if;
  update public.refund_requests
    set status = 'refunded', resolved_at = now(), resolved_by = p_admin_id,
        note = nullif(trim(coalesce(p_note, '')), '')
    where id = request.id;
  update public.payments set status = 'refunded' where id = request.payment_id;
  if request.site_id is not null then
    select status into site_status from public.sites where id = request.site_id;
    insert into public.admin_decisions (site_id, admin_id, action, note, from_status, to_status)
      values (request.site_id, p_admin_id, 'refund_done', nullif(trim(coalesce(p_note, '')), ''),
              coalesce(site_status, 'deleted'), coalesce(site_status, 'deleted'));
  end if;
  if request.owner_id is not null then
    -- The site may be gone already: the notice then has no site.
    perform private.notify(request.owner_id,
      (select id from public.sites where id = request.site_id), 'refund_done');
  end if;
  return jsonb_build_object('requestId', request.id, 'status', 'refunded', 'changed', true);
end;
$$;

-- Requests still to refund, oldest first, for the team panel.
create function public.server_open_refunds(p_limit integer)
returns table (id uuid, site_id uuid, subdomain text, amount_cents integer, requested_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.site_id, coalesce(s.subdomain, p.retained_customer ->> 'subdomain'),
         r.amount_cents, r.requested_at
  from public.refund_requests r
  left join public.sites s on s.id = r.site_id
  left join public.payments p on p.id = r.payment_id
  where r.status = 'requested'
  order by r.requested_at
  limit least(greatest(p_limit, 1), 100);
$$;

-- 5. Record keeping, run by the daily routine ---------------------------------------------------

create function public.server_purge_expired_records()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  audits integer;
  holds integer;
begin
  -- The audit's own owner may delete; nobody else can (E42 revoked it from service_role).
  delete from public.site_takedowns where created_at < now() - interval '5 years';
  get diagnostics audits = row_count;
  delete from public.subdomain_holds where until < now();
  get diagnostics holds = row_count;
  return jsonb_build_object('audits', audits, 'holds', holds);
end;
$$;

-- 6. The terms in force change: the refund rule is new ------------------------------------------

create or replace function private.current_terms_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-11-draft'; $$;

-- 7. Server only ---------------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.server_withdraw(uuid, uuid)',
    'public.server_refund_done(uuid, uuid, text)',
    'public.server_open_refunds(integer)',
    'public.server_purge_expired_records()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
