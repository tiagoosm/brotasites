-- Accounts (PLAN.md E15): a profile per person, the history of accepted terms, the
-- confirmed-email rule for sending the form, rate limits for the sign-in routes, deleting an
-- account (with paid charges kept for the tax period) and admins only with two-factor sessions.
-- Errors are stable codes: email_not_confirmed, wrong_terms_version, is_admin.

-- 1. The terms in force. Bump it when the text changes; people accept again at /conta. -------

create function private.current_terms_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-10-draft'; $$;

grant execute on function private.current_terms_version() to authenticated, service_role;

-- 2. Profiles, one per auth user. ----------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default ''
    check (char_length(full_name) <= 80 and full_name !~ '[[:cntrl:]]'),
  -- WhatsApp or phone, optional, E.164 ("+5535999990000").
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  terms_version text check (char_length(terms_version) between 1 and 40),
  terms_accepted_at timestamptz,
  -- Billing data, asked for at payment (a later step); no screen writes them yet.
  document_type text check (document_type in ('cpf', 'cnpj')),
  document_number text check (document_number ~ '^([0-9]{11}|[0-9]{14})$'),
  billing_address jsonb check (billing_address is null or jsonb_typeof(billing_address) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
-- People read their profile and change only their name and phone; the terms change through
-- accept_terms (which keeps the history) and billing data through the server.
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create policy "People read their own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));
create policy "People update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- 3. Accepted terms, append-only. -----------------------------------------------------------

create table public.terms_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  terms_version text not null check (char_length(terms_version) between 1 and 40),
  accepted_at timestamptz not null default now()
);
create index terms_acceptances_user_idx on public.terms_acceptances (user_id, accepted_at);

alter table public.terms_acceptances enable row level security;
revoke all on public.terms_acceptances from anon, authenticated;
-- Not even the server rewrites the history (deleting the account removes it with the person).
revoke update, delete, truncate on public.terms_acceptances from service_role;
grant select on public.terms_acceptances to authenticated;

create policy "People read their own acceptances" on public.terms_acceptances
  for select to authenticated
  using (user_id = (select auth.uid()));

create function private.record_terms(p_user_id uuid, p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_version is distinct from private.current_terms_version() then
    raise exception 'wrong_terms_version';
  end if;
  insert into public.terms_acceptances (user_id, terms_version) values (p_user_id, p_version);
  update public.profiles
    set terms_version = p_version, terms_accepted_at = now()
    where id = p_user_id;
end;
$$;
revoke execute on function private.record_terms(uuid, text) from public, anon, authenticated;

-- Accounts made before the terms (or before a new version) accept them at /conta.
create function private.accept_terms(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in'; end if;
  perform private.record_terms((select auth.uid()), p_version);
end;
$$;
create function public.accept_terms(p_version text)
returns void language sql security invoker set search_path = ''
as $$ select private.accept_terms(p_version); $$;
revoke execute on function private.accept_terms(text) from public, anon;
revoke execute on function public.accept_terms(text) from public, anon;
grant execute on function private.accept_terms(text) to authenticated;
grant execute on function public.accept_terms(text) to authenticated;

-- 4. A profile for every new account, from what the sign-up sent (validated here: anyone can
-- call the Auth API with any metadata). ----------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text;
begin
  name := left(
    btrim(regexp_replace(regexp_replace(coalesce(meta ->> 'full_name', ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g')),
    80
  );
  insert into public.profiles (id, full_name) values (new.id, name) on conflict (id) do nothing;
  if meta ->> 'terms_version' = private.current_terms_version() then
    perform private.record_terms(new.id, meta ->> 'terms_version');
  end if;
  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Accounts made with the sign-in link before profiles existed: an empty name, asked for at
-- /conta the first time.
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

-- 5. Only a confirmed email sends the form (the draft can be saved before). -----------------

create function private.email_confirmed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users where id = p_user_id and email_confirmed_at is not null
  );
$$;
revoke execute on function private.email_confirmed(uuid) from public, anon, authenticated;

create or replace function private.request_directions(p_site_id uuid)
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
  if not private.email_confirmed((select auth.uid())) then
    raise exception 'email_not_confirmed';
  end if;
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

-- Approval creates the payment: the platform checks the confirmed email with the person's
-- session; the database checks it again.
create or replace function public.server_approve(p_site_id uuid, p_amount_cents integer, p_provider text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  payment_id uuid;
  job_id uuid;
begin
  select * into site from public.sites where id = p_site_id for update;
  if not found then raise exception 'site_not_found'; end if;
  if not private.email_confirmed(site.owner_id) then raise exception 'email_not_confirmed'; end if;
  if site.status <> 'awaiting_approval' or site.approved_direction is null then
    raise exception 'wrong_status';
  end if;
  if site.subdomain is null then raise exception 'no_subdomain'; end if;

  update public.sites set approved_at = coalesce(approved_at, now()) where id = p_site_id;

  if exists (
    select 1 from public.payments
    where site_id = p_site_id and purpose = 'publish' and status = 'paid'
  ) then
    update public.sites set status = 'publishing', status_message = null where id = p_site_id;
    insert into public.jobs (site_id, kind) values (p_site_id, 'publish') returning id into job_id;
    perform private.add_event(p_site_id, 'approved', 'Site aprovado. Estamos colocando no ar.');
    return jsonb_build_object('jobId', job_id);
  end if;

  select id into payment_id from public.payments
    where site_id = p_site_id and purpose = 'publish' and status = 'pending'
      and provider = p_provider and amount_cents = p_amount_cents
    order by created_at desc
    limit 1;
  if payment_id is null then
    insert into public.payments (site_id, purpose, provider, amount_cents)
      values (p_site_id, 'publish', p_provider, p_amount_cents)
      returning id into payment_id;
    perform private.add_event(p_site_id, 'approved', 'Site aprovado. Falta o pagamento para colocar no ar.');
  end if;
  return jsonb_build_object('paymentId', payment_id);
end;
$$;
grant execute on function private.email_confirmed(uuid) to service_role;

-- 6. Admins only with a two-factor session (aal2). ------------------------------------------

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
    and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

-- Whether the person is on the team at all, so /admin can ask for the second factor.
create function private.is_admin_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
create function public.is_admin_member()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.is_admin_member(); $$;
revoke execute on function private.is_admin_member() from public, anon;
revoke execute on function public.is_admin_member() from public, anon;
grant execute on function private.is_admin_member() to authenticated;
grant execute on function public.is_admin_member() to authenticated;

-- 7. Rate limits for the sign-in routes (keys are hashes, never an email or an IP). ---------

create function public.server_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(p_key) not between 1 and 120 or p_max < 1 or p_window_seconds < 1 then
    raise exception 'bad_rate_limit';
  end if;
  delete from public.rate_limits
    where key = p_key and window_start < now() - make_interval(secs => p_window_seconds * 2);
  perform private.hit_rate_limit(p_key, p_max, make_interval(secs => p_window_seconds));
  return true;
exception when raise_exception then
  if sqlerrm = 'rate_limited' then return false; end if;
  raise;
end;
$$;
revoke execute on function public.server_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.server_rate_limit(text, integer, integer) to service_role;

-- 8. Deleting an account. --------------------------------------------------------------------

-- Paid (or refunded) charges stay for the tax period with who paid, without the site; pending
-- ones go with the site.
alter table public.payments alter column site_id drop not null;
alter table public.payments drop constraint payments_site_id_fkey;
alter table public.payments
  add constraint payments_site_id_fkey foreign key (site_id) references public.sites (id) on delete set null;
alter table public.payments add column retained_customer jsonb
  check (retained_customer is null or jsonb_typeof(retained_customer) = 'object');

-- What the sites Worker and R2 still hold for a deleted site: the jobs remove it.
create table public.site_purges (
  id bigint generated always as identity primary key,
  site_id uuid not null,
  subdomain text,
  requested_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text,
  done_at timestamptz
);
alter table public.site_purges enable row level security;
revoke all on public.site_purges from anon, authenticated;

-- Removes the person's sites and everything under them, keeps paid charges and queues the
-- hosting cleanup. The platform removes the files in Storage before and the auth user after.
-- Team members are removed by the owner instead (their decisions keep their id).
create function public.server_delete_account(p_user_id uuid)
returns jsonb
language plpgsql
-- Definer: it reads the email in auth.users, which the API roles cannot.
security definer
set search_path = ''
as $$
declare
  retained integer;
  purges jsonb;
  removed integer;
begin
  if exists (select 1 from public.admins where user_id = p_user_id) then
    raise exception 'is_admin';
  end if;

  update public.payments p
    set retained_customer = jsonb_build_object(
      'user_id', p_user_id,
      'email', u.email,
      'full_name', pr.full_name,
      'document_type', pr.document_type,
      'document_number', pr.document_number,
      'billing_address', pr.billing_address,
      'subdomain', s.subdomain,
      'retained_at', now()
    )
    from public.sites s
    join auth.users u on u.id = s.owner_id
    left join public.profiles pr on pr.id = s.owner_id
    where p.site_id = s.id and s.owner_id = p_user_id and p.status in ('paid', 'refunded');
  get diagnostics retained = row_count;

  delete from public.payments p
    using public.sites s
    where p.site_id = s.id and s.owner_id = p_user_id and p.status in ('pending', 'failed');

  with queued as (
    insert into public.site_purges (site_id, subdomain)
      select id, subdomain from public.sites
      where owner_id = p_user_id and (subdomain is not null or status <> 'draft')
      returning site_id, subdomain
  )
  select coalesce(jsonb_agg(jsonb_build_object('siteId', site_id, 'subdomain', subdomain)), '[]'::jsonb)
    into purges from queued;

  delete from public.sites where owner_id = p_user_id;
  get diagnostics removed = row_count;

  return jsonb_build_object('sites', removed, 'retainedPayments', retained, 'purges', purges);
end;
$$;
revoke execute on function public.server_delete_account(uuid) from public, anon, authenticated;
grant execute on function public.server_delete_account(uuid) to service_role;

-- The jobs take one cleanup at a time.
create function public.claim_site_purge()
returns setof public.site_purges
language sql
set search_path = ''
as $$
  update public.site_purges
    set attempts = attempts + 1
    where id = (
      select id from public.site_purges
      where done_at is null and attempts < 5
      order by id
      limit 1
      for update skip locked
    )
    returning *;
$$;
revoke execute on function public.claim_site_purge() from public, anon, authenticated;
grant execute on function public.claim_site_purge() to service_role;
