-- Checks taking a site offline and deleting it (migration 20261113000000_takedown.sql): who may
-- do what, from which status, idempotence, the audit record, the notices, what a deletion keeps
-- and the 30-day rest of the address. Run in the SQL editor, or locally with
-- supabase/tests/local/run.sh. It ends with the exception "ALL CHECKS PASSED" on purpose, so
-- everything rolls back.
do $$
declare
  a uuid := '81111111-1111-4111-8111-111111111111';
  b uuid := '82222222-2222-4222-8222-222222222222';
  team uuid := '83333333-3333-4333-8333-333333333333';
  site_a uuid;
  site_b uuid;
  site_busy uuid;
  site_unpaid uuid;
  result jsonb;
  n int;
  st text;
  expect_error text;
begin
  insert into auth.users (id, email, aud, role, email_confirmed_at) values
    (a, 'a-takedown@brotasites.test', 'authenticated', 'authenticated', now()),
    (b, 'b-takedown@brotasites.test', 'authenticated', 'authenticated', now()),
    (team, 'team-takedown@brotasites.test', 'authenticated', 'authenticated', now());
  insert into public.admins (user_id) values (team);
  insert into public.sites (owner_id, subdomain, status, published_at)
    values (a, 'padaria-do-ze', 'live', now()) returning id into site_a;
  insert into public.sites (owner_id, subdomain, status, published_at)
    values (b, 'oficina-nova', 'grace', now()) returning id into site_b;
  insert into public.sites (owner_id, subdomain, status, published_at)
    values (a, 'bolos-da-ana', 'building', now()) returning id into site_busy;
  insert into public.sites (owner_id, status) values (b, 'awaiting_approval')
    returning id into site_unpaid;
  insert into public.payments (site_id, purpose, provider, status, amount_cents, paid_at) values
    (site_a, 'publish', 'stub', 'paid', 29700, now()),
    (site_b, 'publish', 'stub', 'paid', 29700, now());
  insert into public.payments (site_id, purpose, provider, status, amount_cents)
    values (site_a, 'renewal', 'stub', 'pending', 9900);

  -- 0. Server only -----------------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    perform public.server_take_offline(site_a, 'owner', a);
    raise exception 'FAIL: a signed-in person called a server function';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'anon', true);
  begin
    perform public.server_delete_site_now(site_a, 'system', null);
    raise exception 'FAIL: anon called a server function';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- 1. The owner takes their site offline, once ----------------------------------------------
  begin
    perform public.server_take_offline(site_a, 'owner', b);
    raise exception 'FAIL: another account took a site offline';
  exception when raise_exception then
    if sqlerrm <> 'site_not_found' then raise; end if;
  end;
  result := public.server_take_offline(site_a, 'owner', a);
  if (result ->> 'changed')::boolean is not true or result ->> 'status' <> 'offline' then
    raise exception 'FAIL: take offline: %', result;
  end if;
  select status into st from public.sites where id = site_a;
  if st <> 'offline' then raise exception 'FAIL: the site is %', st; end if;
  result := public.server_take_offline(site_a, 'owner', a);
  if (result ->> 'changed')::boolean then raise exception 'FAIL: taking offline twice changed it'; end if;
  select count(*) into n from public.site_takedowns where site_id = site_a and action = 'take_offline';
  if n <> 1 then raise exception 'FAIL: % audit rows for one take-offline', n; end if;
  select count(*) into n from public.notifications where user_id = a and kind = 'site_taken_offline';
  if n <> 1 then raise exception 'FAIL: the owner was not told (%)', n; end if;
  select count(*) into n from public.notifications where user_id = team and kind = 'team_owner_took_offline';
  if n <> 1 then raise exception 'FAIL: the team was not told (%)', n; end if;

  -- 2. Back online by the owner, with no "site published" notice --------------------------------
  result := public.server_restore_online(site_a, 'owner', a);
  select status into st from public.sites where id = site_a;
  if st <> 'live' then raise exception 'FAIL: restored to %', st; end if;
  select count(*) into n from public.notifications where user_id = a and kind = 'site_published';
  if n <> 0 then raise exception 'FAIL: coming back online said "published" again'; end if;
  result := public.server_restore_online(site_a, 'owner', a);
  if (result ->> 'changed')::boolean then raise exception 'FAIL: restoring twice changed it'; end if;

  -- 3. Statuses that cannot leave ----------------------------------------------------------------
  foreach expect_error in array array['busy', 'not_published'] loop
    begin
      if expect_error = 'busy' then
        perform public.server_take_offline(site_busy, 'owner', a);
      else
        perform public.server_take_offline(site_unpaid, 'owner', b);
      end if;
      raise exception 'FAIL: % site went offline', expect_error;
    exception when raise_exception then
      if sqlerrm <> expect_error then raise; end if;
    end;
  end loop;

  -- 4. The team: a reason, and the owner cannot undo it --------------------------------------
  begin
    perform public.server_take_offline(site_b, 'admin', a, 'abuse', 'Denúncia de golpe.');
    raise exception 'FAIL: a client acted as the team';
  exception when raise_exception then
    if sqlerrm <> 'not_admin' then raise; end if;
  end;
  begin
    perform public.server_take_offline(site_b, 'admin', team, 'abuse', '');
    raise exception 'FAIL: the team took a site offline without a note';
  exception when raise_exception then
    if sqlerrm <> 'reason_required' then raise; end if;
  end;
  result := public.server_take_offline(site_b, 'admin', team, 'legal', 'Pedido judicial nº 123.', true);
  if (select offline_public_reason from public.sites where id = site_b) <> 'Pedido judicial nº 123.' then
    raise exception 'FAIL: the reason shown to the client was not kept';
  end if;
  select count(*) into n from public.admin_decisions where site_id = site_b and action = 'take_offline';
  if n <> 1 then raise exception 'FAIL: the decision was not logged'; end if;
  begin
    perform public.server_restore_online(site_b, 'owner', b);
    raise exception 'FAIL: the owner undid the team''s take-offline';
  exception when raise_exception then
    if sqlerrm <> 'not_yours' then raise; end if;
  end;
  result := public.server_restore_online(site_b, 'admin', team, 'Resolvido.');
  select status into st from public.sites where id = site_b;
  if st <> 'grace' then raise exception 'FAIL: the renewal status was lost (%)', st; end if;

  -- 5. Suspended: only the team -----------------------------------------------------------------
  update public.sites set status = 'suspended', suspended_from = 'grace' where id = site_b;
  foreach expect_error in array array['take', 'restore', 'delete'] loop
    begin
      if expect_error = 'take' then perform public.server_take_offline(site_b, 'owner', b);
      elsif expect_error = 'restore' then perform public.server_restore_online(site_b, 'owner', b);
      else perform public.server_request_deletion(site_b, 'owner', b, 7);
      end if;
      raise exception 'FAIL: the owner could % a suspended site', expect_error;
    exception when raise_exception then
      if sqlerrm <> 'suspended' then raise; end if;
    end;
  end loop;
  update public.sites set status = 'grace', suspended_from = null where id = site_b;

  -- 6. Scheduled deletion and its cancellation ---------------------------------------------
  begin
    perform public.server_request_deletion(site_a, 'owner', a, 0);
    raise exception 'FAIL: the owner skipped the waiting period';
  exception when raise_exception then
    if sqlerrm <> 'bad_request' then raise; end if;
  end;
  result := public.server_request_deletion(site_a, 'owner', a, 7);
  select status into st from public.sites where id = site_a;
  if st <> 'offline' or (select delete_after from public.sites where id = site_a) < now() + interval '6 days' then
    raise exception 'FAIL: scheduling did not take the site offline for 7 days';
  end if;
  result := public.server_request_deletion(site_a, 'owner', a, 7);
  if (result ->> 'changed')::boolean then raise exception 'FAIL: scheduling twice changed it'; end if;
  begin
    perform public.server_restore_online(site_a, 'owner', a);
    raise exception 'FAIL: a site with a deletion on the way came back online';
  exception when raise_exception then
    if sqlerrm <> 'deletion_scheduled' then raise; end if;
  end;
  select count(*) into n from public.notifications where user_id = team and kind = 'team_owner_requested_deletion';
  if n <> 1 then raise exception 'FAIL: the team was not told of the deletion'; end if;
  result := public.server_cancel_deletion(site_a, 'owner', a);
  if (select delete_after from public.sites where id = site_a) is not null then
    raise exception 'FAIL: the deletion was not cancelled';
  end if;
  select status into st from public.sites where id = site_a;
  if st <> 'offline' then raise exception 'FAIL: cancelling should keep the site offline (%)', st; end if;
  result := public.server_restore_online(site_a, 'owner', a);

  -- The team's deletion: the owner cannot cancel it.
  result := public.server_request_deletion(site_b, 'admin', team, 7, 'terms', 'Conteúdo proibido.');
  begin
    perform public.server_cancel_deletion(site_b, 'owner', b);
    raise exception 'FAIL: the owner cancelled the team''s deletion';
  exception when raise_exception then
    if sqlerrm <> 'not_yours' then raise; end if;
  end;

  -- 7. The deletion: not before it is due, then once, keeping what must stay ---------------------
  result := public.server_request_deletion(site_a, 'owner', a, 7);
  begin
    perform public.server_delete_site_now(site_a, 'system', null);
    raise exception 'FAIL: a deletion ran before it was due';
  exception when raise_exception then
    if sqlerrm <> 'not_due' then raise; end if;
  end;
  update public.sites set delete_after = now() - interval '1 minute' where id = site_a;
  select count(*) into n from public.server_due_deletions(10) where site_id = site_a;
  if n <> 1 then raise exception 'FAIL: the due deletion was not listed'; end if;
  result := public.server_delete_site_now(site_a, 'system', null);
  if (result ->> 'removed')::boolean is not true then raise exception 'FAIL: delete: %', result; end if;
  if exists (select 1 from public.sites where id = site_a) then raise exception 'FAIL: the site is still there'; end if;
  select count(*) into n from public.payments where site_id is null and status = 'paid' and retained_customer ->> 'subdomain' = 'padaria-do-ze';
  if n <> 1 then raise exception 'FAIL: the paid charge was not kept with who paid (%)', n; end if;
  select count(*) into n from public.payments where status = 'pending' and amount_cents = 9900;
  if n <> 0 then raise exception 'FAIL: a pending charge outlived the site'; end if;
  select count(*) into n from public.site_removals where site_id = site_a and reason = 'deleted';
  if n <> 1 then raise exception 'FAIL: no removal record'; end if;
  select count(*) into n from public.site_purges where site_id = site_a;
  if n <> 1 then raise exception 'FAIL: the hosting cleanup was not queued'; end if;
  select count(*) into n from public.site_takedowns where site_id = site_a;
  if n < 6 then raise exception 'FAIL: the audit record lost rows (%)', n; end if;
  select count(*) into n from public.notifications where user_id = a and kind = 'site_deleted' and site_id is null;
  if n <> 1 then raise exception 'FAIL: the owner was not told of the deletion'; end if;
  result := public.server_delete_site_now(site_a, 'system', null);
  if (result ->> 'already')::boolean is not true then raise exception 'FAIL: deleting twice: %', result; end if;

  -- 8. The address rests for 30 days, except for its owner ----------------------------------
  begin
    update public.sites set subdomain = 'padaria-do-ze' where id = site_unpaid;
    raise exception 'FAIL: someone else took a deleted site''s address';
  exception when unique_violation then null;
  end;
  -- Its owner may take it back (here, on another site of theirs).
  update public.sites set subdomain = 'padaria-do-ze' where id = site_busy;

  -- 9. The team deletes now: never with a job on the way, always with a note ---------------------
  insert into public.jobs (site_id, kind, status) values (site_b, 'build', 'queued');
  begin
    perform public.server_delete_site_now(site_b, 'admin', team, 'Conteúdo proibido.');
    raise exception 'FAIL: a site with a job on the way was deleted';
  exception when raise_exception then
    if sqlerrm <> 'busy' then raise; end if;
  end;
  delete from public.jobs where site_id = site_b;
  begin
    perform public.server_delete_site_now(site_b, 'admin', team, '');
    raise exception 'FAIL: the team deleted without a note';
  exception when raise_exception then
    if sqlerrm <> 'reason_required' then raise; end if;
  end;
  begin
    perform public.server_delete_site_now(site_b, 'owner', b, 'agora');
    raise exception 'FAIL: the owner skipped the waiting period by deleting now';
  exception when raise_exception then
    if sqlerrm <> 'bad_request' then raise; end if;
  end;
  result := public.server_delete_site_now(site_b, 'admin', team, 'Conteúdo proibido.');
  select count(*) into n from public.site_takedowns where site_id = site_b and action = 'delete' and actor = 'admin';
  if n <> 1 then raise exception 'FAIL: the team''s deletion was not audited'; end if;

  raise exception 'ALL CHECKS PASSED';
end;
$$;
