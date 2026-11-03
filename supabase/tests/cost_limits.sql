-- Checks the cost limits (migration 20261103000000_cost_and_admin.sql): rounds of directions
-- per site, one unpaid site in progress per account, discarding, the idle cleanup and the model
-- call log. Run in the SQL editor, or locally with supabase/tests/local/run.sh. It ends with the
-- exception "ALL CHECKS PASSED" on purpose, so everything rolls back.
do $$
declare
  a uuid := '61111111-1111-4111-8111-111111111111';
  b uuid := '62222222-2222-4222-8222-222222222222';
  u uuid := '63333333-3333-4333-8333-333333333333';
  site_a uuid;
  site_a2 uuid;
  site_b uuid;
  site_u uuid;
  result jsonb;
  available timestamptz;
  n int;
  before timestamptz;
begin
  insert into auth.users (id, email, aud, role, email_confirmed_at) values
    (a, 'a-limits@brotasites.test', 'authenticated', 'authenticated', now()),
    (b, 'b-limits@brotasites.test', 'authenticated', 'authenticated', now()),
    (u, 'u-limits@brotasites.test', 'authenticated', 'authenticated', null);

  -- 1. One unpaid site in progress per account --------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.sites default values returning id into site_a;
  begin
    insert into public.sites default values;
    raise exception 'FAIL: a second site in progress was created by the client';
  exception when raise_exception then
    if sqlerrm <> 'site_in_progress' then raise; end if;
  end;

  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  begin
    perform public.server_create_site(a, 1, '{}');
    raise exception 'FAIL: a second site in progress was created by the server';
  exception when raise_exception then
    if sqlerrm <> 'site_in_progress' then raise; end if;
  end;
  -- The allowance comes from the platform, validated.
  begin
    perform public.server_create_site(a, 0, '{}');
    raise exception 'FAIL: an allowance of 0 was accepted';
  exception when raise_exception then
    if sqlerrm <> 'bad_limits' then raise; end if;
  end;
  -- Clients cannot call the server's functions.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    perform public.server_create_site(a, 5, '{}');
    raise exception 'FAIL: a client called server_create_site';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.server_request_directions(site_a, a, 20, 0);
    raise exception 'FAIL: a client called server_request_directions';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.server_discard_site(site_a, a);
    raise exception 'FAIL: a client called server_discard_site';
  exception when insufficient_privilege then null;
  end;
  -- Clients cannot move their own counters.
  begin
    update public.sites set direction_rounds = 0, last_activity_at = now() where id = site_a;
    raise exception 'FAIL: a client changed its counters';
  exception when insufficient_privilege then null;
  end;

  -- The person sees their own place, and which site holds it.
  result := public.my_site_slots();
  if (result ->> 'open')::int <> 1 or (result ->> 'allowed')::int <> 1 or (result ->> 'openSiteId')::uuid <> site_a then
    raise exception 'FAIL: own slots %', result;
  end if;

  -- Paying frees the place: the paid site is no longer "in progress".
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into public.payments (site_id, purpose, provider, status, amount_cents, paid_at)
    values (site_a, 'publish', 'stub', 'paid', 29700, now());
  update public.sites set status = 'publishing' where id = site_a;
  site_a2 := public.server_create_site(a, 1, '{"business":{"name":"Segundo"}}');
  select count(*) into n from public.site_configs where site_id = site_a2 and draft #>> '{business,name}' = 'Segundo';
  if n <> 1 then raise exception 'FAIL: the new site has no draft'; end if;
  begin
    perform public.server_create_site(a, 1, '{}');
    raise exception 'FAIL: a third site was created';
  exception when raise_exception then
    if sqlerrm <> 'site_in_progress' then raise; end if;
  end;

  -- Discarding: the owner only, unpaid only; a record stays; the place is free again.
  begin
    perform public.server_discard_site(site_a2, b);
    raise exception 'FAIL: another account discarded the site';
  exception when raise_exception then
    if sqlerrm <> 'site_not_found' then raise; end if;
  end;
  begin
    perform public.server_discard_site(site_a, a);
    raise exception 'FAIL: a paid site was discarded';
  exception when raise_exception then
    if sqlerrm <> 'not_removable' then raise; end if;
  end;
  update public.sites set status = 'awaiting_direction_choice', subdomain = 'segundo-descarte' where id = site_a2;
  result := public.server_discard_site(site_a2, a);
  if (result ->> 'queued')::boolean is not true then raise exception 'FAIL: the hosting cleanup was not queued'; end if;
  select count(*) into n from public.sites where id = site_a2;
  if n <> 0 then raise exception 'FAIL: the discarded site is still there'; end if;
  select count(*) into n from public.site_removals where site_id = site_a2 and reason = 'discarded' and owner_id = a;
  if n <> 1 then raise exception 'FAIL: no record of the discard'; end if;
  select count(*) into n from public.site_purges where site_id = site_a2;
  if n <> 1 then raise exception 'FAIL: no purge queued for the discarded site'; end if;
  site_a2 := public.server_create_site(a, 1, '{}');

  -- Accounts with two sites in progress from before the rule keep them, and add no third.
  perform set_config('role', 'postgres', true);
  alter table public.sites disable trigger sites_check_new;
  insert into public.sites (owner_id) values (b) returning id into site_b;
  insert into public.sites (owner_id) values (b);
  alter table public.sites enable trigger sites_check_new;
  perform set_config('role', 'service_role', true);
  begin
    perform public.server_create_site(b, 1, '{}');
    raise exception 'FAIL: a third site was created for an old account';
  exception when raise_exception then
    if sqlerrm <> 'site_in_progress' then raise; end if;
  end;

  -- 2. Rounds of directions --------------------------------------------------------------
  perform public.server_request_directions(site_b, b, 3, 3600);
  -- Two clicks at once: the row lock makes the second one wait and find the site generating.
  begin
    perform public.server_request_directions(site_b, b, 3, 3600);
    raise exception 'FAIL: a second round started while generating';
  exception when raise_exception then
    if sqlerrm <> 'wrong_status' then raise; end if;
  end;
  select direction_rounds into n from public.sites where id = site_b;
  if n <> 1 then raise exception 'FAIL: rounds counted % times', n; end if;

  for i in 2..3 loop
    update public.sites set status = 'awaiting_direction_choice' where id = site_b;
    result := public.server_request_directions(site_b, b, 3, 3600);
    if (result ->> 'ok')::boolean is not true or (result ->> 'used')::int <> i then
      raise exception 'FAIL: free round % refused: %', i, result;
    end if;
  end loop;
  -- The fourth waits an hour from the last one.
  update public.sites set status = 'awaiting_direction_choice' where id = site_b;
  result := public.server_request_directions(site_b, b, 3, 3600);
  if (result ->> 'ok')::boolean or result ->> 'reason' <> 'wait' then
    raise exception 'FAIL: the fourth round was not refused: %', result;
  end if;
  available := (result ->> 'availableAt')::timestamptz;
  if available < now() + interval '59 minutes' or available > now() + interval '61 minutes' then
    raise exception 'FAIL: the next round is not in one hour: %', available;
  end if;
  select status into result from (select to_jsonb(status) as status from public.sites where id = site_b) s;
  if result <> '"awaiting_direction_choice"' then raise exception 'FAIL: a refused round changed the site'; end if;

  -- A change in limits.ts reaches the database with the next call.
  result := public.server_request_directions(site_b, b, 4, 3600);
  if (result ->> 'ok')::boolean is not true or (result ->> 'free')::int <> 4 then
    raise exception 'FAIL: the new limit did not apply: %', result;
  end if;
  begin
    perform public.server_request_directions(site_b, b, 0, 3600);
    raise exception 'FAIL: 0 free rounds accepted';
  exception when raise_exception then
    if sqlerrm <> 'bad_limits' then raise; end if;
  end;
  begin
    perform public.server_request_directions(site_b, b, 3, -1);
    raise exception 'FAIL: a negative wait accepted';
  exception when raise_exception then
    if sqlerrm <> 'bad_limits' then raise; end if;
  end;
  perform set_config('role', 'postgres', true);
  perform private.set_limits(p_free_rounds => 3);
  perform set_config('role', 'service_role', true);

  -- After the wait, one more round.
  update public.sites set status = 'awaiting_direction_choice',
    last_directions_at = now() - interval '61 minutes' where id = site_b;
  result := public.server_request_directions(site_b, b, 3, 3600);
  if (result ->> 'ok')::boolean is not true then raise exception 'FAIL: no round after the wait: %', result; end if;

  -- The client's own call follows the same rule, with the values last sent.
  update public.sites set status = 'awaiting_direction_choice' where id = site_b;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  result := public.directions_quota(site_b);
  if (result ->> 'used')::int <> 5 or (result ->> 'free')::int <> 3 or result ->> 'availableAt' is null then
    raise exception 'FAIL: wrong quota: %', result;
  end if;
  begin
    perform public.request_directions(site_b);
    raise exception 'FAIL: the client went past the wait';
  exception when raise_exception then
    if sqlerrm <> 'directions_wait' then raise; end if;
  end;
  -- Another account's site, and an account without a confirmed email.
  begin
    perform public.directions_quota(site_a2);
    raise exception 'FAIL: B read A''s quota';
  exception when raise_exception then
    if sqlerrm <> 'site_not_found' then raise; end if;
  end;
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  begin
    perform public.server_request_directions(site_a2, b, 3, 3600);
    raise exception 'FAIL: B asked for directions on A''s site';
  exception when raise_exception then
    if sqlerrm <> 'site_not_found' then raise; end if;
  end;
  site_u := public.server_create_site(u, 1, '{}');
  begin
    perform public.server_request_directions(site_u, u, 3, 3600);
    raise exception 'FAIL: an unconfirmed email asked for directions';
  exception when raise_exception then
    if sqlerrm <> 'email_not_confirmed' then raise; end if;
  end;

  -- 3. Activity ----------------------------------------------------------------------------
  update public.sites set last_activity_at = now() - interval '40 days' where id = site_a2;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.site_configs set draft = '{"business":{"name":"Editado"}}' where site_id = site_a2;
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select count(*) into n from public.sites where id = site_a2 and last_activity_at > now() - interval '1 minute';
  if n <> 1 then raise exception 'FAIL: editing the draft did not count as an action'; end if;

  -- 4. The idle cleanup ---------------------------------------------------------------------
  update public.sites set last_activity_at = now() - interval '31 days' where id = site_a2;
  update public.sites set status = 'live', published_at = now(),
    last_activity_at = now() - interval '90 days' where id = site_a;
  select count(*) into n from public.server_idle_sites(30, 0, 50) where site_id = site_a2;
  if n <> 1 then raise exception 'FAIL: the idle site is not listed'; end if;
  select count(*) into n from public.server_idle_sites(30, 0, 50) where site_id = site_a;
  if n <> 0 then raise exception 'FAIL: a paid site is listed for removal'; end if;
  -- A site waiting on us (generating) never goes, whatever its dates.
  update public.sites set last_activity_at = now() - interval '90 days' where id = site_b;
  update public.sites set status = 'generating_directions' where id = site_b;
  select count(*) into n from public.server_idle_sites(30, 0, 50) where site_id = site_b;
  if n <> 0 then raise exception 'FAIL: a generating site is listed for removal'; end if;
  -- The team's extension postpones it.
  update public.sites set keep_until = now() + interval '5 days' where id = site_a2;
  select count(*) into n from public.server_idle_sites(30, 0, 50) where site_id = site_a2;
  if n <> 0 then raise exception 'FAIL: an extended site is due'; end if;
  select count(*) into n from public.server_idle_sites(30, 7, 50) where site_id = site_a2;
  if n <> 1 then raise exception 'FAIL: the extended site is not in the next 7 days'; end if;
  result := public.server_remove_idle_site(site_a2, 30);
  if (result ->> 'removed')::boolean then raise exception 'FAIL: an extended site was removed'; end if;

  -- Warnings: one per threshold and deadline, again only after a new deadline.
  n := public.server_warn_idle_sites(30, array[7, 1]);
  if n <> 1 then raise exception 'FAIL: % warnings instead of 1', n; end if;
  n := public.server_warn_idle_sites(30, array[7, 1]);
  if n <> 0 then raise exception 'FAIL: the warning repeated'; end if;
  select count(*) into n from public.notifications
    where site_id = site_a2 and kind = 'site_deletion_warning' and days_left = 7 and user_id = a;
  if n <> 1 then raise exception 'FAIL: the warning is not the 7-day one for A'; end if;

  -- Due now: removed with a record; the cost log keeps its rows without the site.
  update public.sites set keep_until = null where id = site_a2;
  insert into public.ai_calls (site_id, account_id, task, model, input_tokens, output_tokens, cost_usd)
    values (site_a2, a, 'directions', 'claude-opus-5-5', 1000, 500, 0.014);
  result := public.server_remove_idle_site(site_a2, 30);
  if (result ->> 'removed')::boolean is not true then raise exception 'FAIL: the idle site stayed: %', result; end if;
  select count(*) into n from public.site_removals where site_id = site_a2 and reason = 'idle';
  if n <> 1 then raise exception 'FAIL: no record of the idle removal'; end if;
  select count(*) into n from public.ai_calls where site_id is null and account_id = a and cost_usd = 0.014;
  if n <> 1 then raise exception 'FAIL: the cost of the removed site was lost'; end if;
  -- Running it again does nothing.
  result := public.server_remove_idle_site(site_a2, 30);
  if (result ->> 'removed')::boolean then raise exception 'FAIL: removed twice'; end if;

  -- 5. Only the server writes or reads the cost log and the records -----------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    select count(*) into n from public.ai_calls;
    raise exception 'FAIL: a client read the cost log';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.ai_calls (task, model, cost_usd) values ('copy', 'x', 0);
    raise exception 'FAIL: a client wrote the cost log';
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from public.site_removals;
    raise exception 'FAIL: a client read the removals';
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from public.account_site_slots;
    raise exception 'FAIL: a client read the slot grants';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.server_idle_sites(30, 0, 50);
    raise exception 'FAIL: a client listed idle sites';
  exception when insufficient_privilege then null;
  end;

  raise exception 'ALL CHECKS PASSED';
end;
$$;
