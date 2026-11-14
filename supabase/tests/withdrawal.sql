-- Checks the withdrawal (direito de arrependimento) and record keeping (migration
-- 20261114000000_withdrawal.sql): only within 7 days of the payment, once per charge, the site
-- offline with its deletion scheduled, the refund request for the full amount, the notices,
-- the team marking it refunded, and the purge of old audit rows. Run in the SQL editor, or
-- locally with supabase/tests/local/run.sh. It ends with "ALL CHECKS PASSED" on purpose, so
-- everything rolls back.
do $$
declare
  a uuid := '91111111-1111-4111-8111-111111111111';
  b uuid := '92222222-2222-4222-8222-222222222222';
  team uuid := '93333333-3333-4333-8333-333333333333';
  site_a uuid;
  site_old uuid;
  result jsonb;
  request uuid;
  n int;
  st text;
begin
  insert into auth.users (id, email, aud, role, email_confirmed_at) values
    (a, 'a-withdraw@brotasites.test', 'authenticated', 'authenticated', now()),
    (b, 'b-withdraw@brotasites.test', 'authenticated', 'authenticated', now()),
    (team, 'team-withdraw@brotasites.test', 'authenticated', 'authenticated', now());
  insert into public.admins (user_id) values (team);
  insert into public.sites (owner_id, subdomain, status, published_at)
    values (a, 'padaria-do-ze', 'live', now()) returning id into site_a;
  insert into public.sites (owner_id, subdomain, status, published_at)
    values (b, 'oficina-antiga', 'live', now() - interval '20 days') returning id into site_old;
  insert into public.payments (site_id, purpose, provider, status, amount_cents, paid_at) values
    (site_a, 'publish', 'stub', 'paid', 29700, now() - interval '2 days'),
    (site_old, 'publish', 'stub', 'paid', 29700, now() - interval '8 days');

  -- 0. Server only; owners read only their own requests -----------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    perform public.server_withdraw(site_a, a);
    raise exception 'FAIL: a signed-in person called server_withdraw';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- 1. Someone else's site, and a payment older than 7 days, are refused ------------------
  begin
    perform public.server_withdraw(site_a, b);
    raise exception 'FAIL: another account withdrew a site';
  exception when raise_exception then
    if sqlerrm <> 'site_not_found' then raise; end if;
  end;
  begin
    perform public.server_withdraw(site_old, b);
    raise exception 'FAIL: withdrew after the 7 days';
  exception when raise_exception then
    if sqlerrm <> 'withdrawal_expired' then raise; end if;
  end;

  -- 2. Within the window: request, offline, deletion scheduled, notices ---------------------
  result := public.server_withdraw(site_a, a);
  if (result ->> 'changed')::boolean is not true or (result ->> 'amountCents')::int <> 29700 then
    raise exception 'FAIL: withdraw: %', result;
  end if;
  request := (result ->> 'requestId')::uuid;
  select status into st from public.sites where id = site_a;
  if st <> 'offline' then raise exception 'FAIL: the site is % after withdrawing', st; end if;
  if not exists (select 1 from public.sites where id = site_a and delete_after > now() + interval '6 days'
                 and deletion_by = 'owner') then
    raise exception 'FAIL: the deletion was not scheduled';
  end if;
  if not exists (select 1 from public.site_takedowns where site_id = site_a and reason = 'withdrawal') then
    raise exception 'FAIL: no audit row for the withdrawal';
  end if;
  select count(*) into n from public.notifications where user_id = a and kind = 'withdrawal_received';
  if n <> 1 then raise exception 'FAIL: the owner was not told (%)', n; end if;
  select count(*) into n from public.notifications where user_id = team and kind = 'team_withdrawal_requested';
  if n <> 1 then raise exception 'FAIL: the team was not told (%)', n; end if;

  -- The owner cannot cancel the deletion of a withdrawn site.
  begin
    perform public.server_cancel_deletion(site_a, 'owner', a);
    raise exception 'FAIL: cancelled the deletion of a withdrawn site';
  exception when raise_exception then
    if sqlerrm <> 'withdrawn' then raise; end if;
  end;

  -- Asked twice: the same request, nothing new.
  result := public.server_withdraw(site_a, a);
  if (result ->> 'changed')::boolean or (result ->> 'requestId')::uuid <> request then
    raise exception 'FAIL: withdrawing twice: %', result;
  end if;
  select count(*) into n from public.refund_requests where site_id = site_a;
  if n <> 1 then raise exception 'FAIL: % requests for one charge', n; end if;

  -- The owner reads their request; another account does not.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.refund_requests;
  if n <> 1 then raise exception 'FAIL: the owner sees % requests', n; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.refund_requests;
  if n <> 0 then raise exception 'FAIL: another account sees % requests', n; end if;
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- 3. The team lists it and records the refund ----------------------------------------------
  select count(*) into n from public.server_open_refunds(10);
  if n <> 1 then raise exception 'FAIL: % open refunds', n; end if;
  begin
    perform public.server_refund_done(request, a, 'tentativa');
    raise exception 'FAIL: a client marked a refund';
  exception when raise_exception then
    if sqlerrm <> 'not_admin' then raise; end if;
  end;
  result := public.server_refund_done(request, team, 'Estorno feito no Asaas');
  if (result ->> 'changed')::boolean is not true then raise exception 'FAIL: refund: %', result; end if;
  if not exists (select 1 from public.payments where site_id = site_a and status = 'refunded') then
    raise exception 'FAIL: the charge is not refunded';
  end if;
  select count(*) into n from public.notifications where user_id = a and kind = 'refund_done';
  if n <> 1 then raise exception 'FAIL: the owner was not told of the refund (%)', n; end if;
  result := public.server_refund_done(request, team, null);
  if (result ->> 'changed')::boolean then raise exception 'FAIL: refunding twice changed it'; end if;
  select count(*) into n from public.server_open_refunds(10);
  if n <> 0 then raise exception 'FAIL: % open refunds after refunding', n; end if;

  -- 4. The request survives the deletion of the site --------------------------------------
  update public.sites set delete_after = now() - interval '1 minute' where id = site_a;
  perform public.server_delete_site_now(site_a, 'system', null);
  if not exists (select 1 from public.refund_requests where id = request and site_id is null) then
    raise exception 'FAIL: the request did not survive the deletion';
  end if;

  -- 5. Record keeping: audit rows older than 5 years and expired holds go ----------------------
  set local role postgres;
  insert into public.site_takedowns (site_id, subdomain, action, actor, created_at)
    values (gen_random_uuid(), 'antigo', 'delete', 'system', now() - interval '6 years');
  insert into public.subdomain_holds (subdomain, owner_id, until)
    values ('vencido', a, now() - interval '1 day');
  set local role service_role;
  result := public.server_purge_expired_records();
  if (result ->> 'audits')::int <> 1 or (result ->> 'holds')::int < 1 then
    raise exception 'FAIL: purge: %', result;
  end if;
  if not exists (select 1 from public.site_takedowns where site_id = site_a) then
    raise exception 'FAIL: the purge removed a recent audit row';
  end if;
  if not exists (select 1 from public.subdomain_holds where subdomain = 'padaria-do-ze') then
    raise exception 'FAIL: the purge removed a hold still in force';
  end if;

  -- 6. The terms in force moved on ------------------------------------------------------------
  if private.current_terms_version() <> '2026-11-draft' then
    raise exception 'FAIL: terms version %', private.current_terms_version();
  end if;

  raise exception 'ALL CHECKS PASSED';
end;
$$;
