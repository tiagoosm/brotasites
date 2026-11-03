-- Checks the team panel (migration 20261103000000_cost_and_admin.sql) on a small set of known
-- facts whose numbers were worked out by hand: only team members with the second factor read or
-- act, every action and every account opened is logged, and the totals match.
-- Run in the SQL editor, or locally with supabase/tests/local/run.sh. It ends with the exception
-- "ALL CHECKS PASSED" on purpose, so everything rolls back.
do $$
declare
  t uuid := '71111111-1111-4111-8111-111111111111';  -- team
  a uuid := '72222222-2222-4222-8222-222222222222';
  b uuid := '73333333-3333-4333-8333-333333333333';
  c uuid := '74444444-4444-4444-8444-444444444444';
  s_a uuid;
  s_b1 uuid;
  s_b2 uuid;
  dir uuid;
  result jsonb;
  period jsonb;
  n int;
  fn text;
begin
  insert into auth.users (id, email, aud, role, email_confirmed_at) values
    (t, 'equipe-painel@brotasites.test', 'authenticated', 'authenticated', now()),
    (a, 'a-painel@brotasites.test', 'authenticated', 'authenticated', now()),
    (b, 'b-painel@brotasites.test', 'authenticated', 'authenticated', now()),
    (c, 'c-painel@brotasites.test', 'authenticated', 'authenticated', null);
  update public.profiles set full_name = 'Bia Painel' where id = b;
  insert into public.admins (user_id) values (t);

  -- The facts. A: a draft. B: a live, paid site and a site waiting for a choice, idle 10 days.
  -- C: one removed site that reached "direction chosen".
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  s_a := public.server_create_site(a, 1, '{"business":{"name":"Rascunho da A"}}');
  s_b1 := public.server_create_site(b, 1, '{"business":{"name":"Loja da Bia"}}');
  insert into public.site_directions (site_id, round, direction, identity, features, source)
    values (s_b1, 0, 'fiel-a-marca', '{}', '{}', 'ai') returning id into dir;
  update public.sites set status = 'live', approved_direction = dir, approved_at = now(),
    published_at = now(), subdomain = 'loja-da-bia' where id = s_b1;
  insert into public.payments (site_id, purpose, provider, status, amount_cents, paid_at)
    values (s_b1, 'publish', 'stub', 'paid', 29700, now());
  s_b2 := public.server_create_site(b, 1, '{"business":{"name":"Segunda da Bia"}}');
  insert into public.site_directions (site_id, round, direction, identity, features, source)
    values (s_b2, 0, 'evolucao', '{}', '{}', 'engine');
  update public.sites set status = 'awaiting_direction_choice', direction_rounds = 3,
    last_directions_at = now(), last_activity_at = now() - interval '10 days' where id = s_b2;
  insert into public.site_removals (site_id, owner_id, reason, last_status, stage, site_created_at)
    values (gen_random_uuid(), c, 'discarded', 'building', 2, now());
  insert into public.ai_calls (site_id, account_id, task, model, input_tokens, output_tokens, cost_usd) values
    (s_b1, b, 'directions', 'claude-opus-5-5', 10000, 5000, 0.30),
    (s_b1, b, 'copy', 'claude-opus-5-5', 20000, 10000, 0.70),
    (s_b2, b, 'directions', 'claude-opus-5-5', 15000, 8000, 0.50),
    (null, c, 'directions', 'claude-opus-5-5', 5000, 2000, 0.20);
  insert into public.jobs (site_id, kind, status, started_at, finished_at, created_at) values
    (s_b1, 'directions', 'done', now() - interval '90 seconds', now() - interval '30 seconds', now()),
    (s_b2, 'directions', 'done', now() - interval '60 seconds', now() - interval '20 seconds', now());

  -- Nobody but the team with the second factor gets in. --------------------------------------
  foreach fn in array array[
    'select public.admin_overview()', 'select public.admin_costs(30)',
    'select public.admin_accounts('''', '''', '''', 20, 0)',
    format('select public.admin_account(%L)', b), 'select public.admin_limits()',
    format('select public.admin_grant_round(%L, ''motivo'')', s_b2),
    format('select public.admin_grant_site_slot(%L, ''motivo'')', a),
    format('select public.admin_extend_cleanup(%L, 5, ''motivo'')', s_b2),
    format('select public.admin_site_costs(array[%L]::uuid[])', s_b1)
  ] loop
    -- A client.
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
    begin
      execute fn;
      raise exception 'FAIL: a client ran %', fn;
    exception when raise_exception then
      if sqlerrm <> 'forbidden' then raise; end if;
    end;
    -- A team member without the second factor.
    perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated', 'aal', 'aal1')::text, true);
    begin
      execute fn;
      raise exception 'FAIL: the team without aal2 ran %', fn;
    exception when raise_exception then
      if sqlerrm <> 'forbidden' then raise; end if;
    end;
    -- Anyone signed out.
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    begin
      execute fn;
      raise exception 'FAIL: anon ran %', fn;
    exception when insufficient_privilege then null;
    end;
  end loop;

  -- The team, with aal2. ----------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  -- Overview. Funnel (always): created 4 (3 sites + 1 removed); directions 3; chosen 2; built 1;
  -- approved 1; paid 1; live 1. Cost 1.70; per site 1.70 / 4 = 0.425; per paid site 1.70.
  result := public.admin_overview();
  period := result -> 'all';
  if (period ->> 'accounts')::int <> 4 or (period ->> 'confirmed')::int <> 3 then
    raise exception 'FAIL: accounts %', period;
  end if;
  if period -> 'funnel' <> '{"created":4,"directions":3,"chosen":2,"built":1,"approved":1,"paid":1,"live":1}'::jsonb then
    raise exception 'FAIL: funnel %', period -> 'funnel';
  end if;
  if (period ->> 'costUsd')::numeric <> 1.70 or (period ->> 'costPerSite')::numeric <> 0.425
     or (period ->> 'costPerPaidSite')::numeric <> 1.70 or (period ->> 'paidSites')::int <> 1 then
    raise exception 'FAIL: cost %', period;
  end if;
  if (result -> '7' -> 'funnel' ->> 'created')::int <> 4 then raise exception 'FAIL: 7-day funnel'; end if;
  -- Abandoned (unpaid, no action for over 7 days): S_B2, which reached stage 1.
  if result -> 'abandoned' <> '{"1":1}'::jsonb then raise exception 'FAIL: abandoned %', result -> 'abandoned'; end if;

  -- Costs: directions 1.00 and copy 0.70; S_B1 first (1.00); per site over the 2 sites with a
  -- link: average 0.75, median 0.75, paid 1.00, unpaid 0.50; removed 0.20; directions jobs
  -- 60s and 40s.
  result := public.admin_costs(30);
  if (result -> 'byTask' -> 0 ->> 'task') <> 'directions' or (result -> 'byTask' -> 0 ->> 'usd')::numeric <> 1.00
     or (result -> 'byTask' -> 1 ->> 'usd')::numeric <> 0.70 then
    raise exception 'FAIL: by task %', result -> 'byTask';
  end if;
  if (result -> 'topSites' -> 0 ->> 'siteId')::uuid <> s_b1 or (result -> 'topSites' -> 0 ->> 'name') <> 'Loja da Bia'
     or (result -> 'topSites' -> 0 ->> 'usd')::numeric <> 1.00 then
    raise exception 'FAIL: top sites %', result -> 'topSites';
  end if;
  if (result -> 'topAccounts' -> 0 ->> 'userId')::uuid <> b or (result -> 'topAccounts' -> 0 ->> 'usd')::numeric <> 1.50 then
    raise exception 'FAIL: top accounts %', result -> 'topAccounts';
  end if;
  if (result -> 'perSite' ->> 'average')::numeric <> 0.75 or (result -> 'perSite' ->> 'median')::numeric <> 0.75
     or (result -> 'perSite' ->> 'paidUsd')::numeric <> 1.00 or (result -> 'perSite' ->> 'unpaidUsd')::numeric <> 0.50 then
    raise exception 'FAIL: per site %', result -> 'perSite';
  end if;
  if (result ->> 'removedUsd')::numeric <> 0.20 then raise exception 'FAIL: removed cost'; end if;
  if (result -> 'jobs' -> 0 ->> 'averageSeconds')::numeric <> 50.0 or (result -> 'jobs' -> 0 ->> 'runs')::int <> 2 then
    raise exception 'FAIL: job times %', result -> 'jobs';
  end if;
  begin
    perform public.admin_costs(0);
    raise exception 'FAIL: 0 days accepted';
  exception when raise_exception then
    if sqlerrm <> 'bad_request' then raise; end if;
  end;

  -- Accounts: search by e-mail and name, literal; filters; pages.
  result := public.admin_accounts('', '', '', 50, 0);
  if (result ->> 'total')::int <> 4 then raise exception 'FAIL: total %', result ->> 'total'; end if;
  result := public.admin_accounts('b-painel', '', '', 50, 0);
  if (result ->> 'total')::int <> 1 or (result -> 'rows' -> 0 ->> 'userId')::uuid <> b then raise exception 'FAIL: search by e-mail'; end if;
  result := public.admin_accounts('Bia', '', '', 50, 0);
  if (result ->> 'total')::int <> 1 then raise exception 'FAIL: search by name'; end if;
  result := public.admin_accounts('%', '', '', 50, 0);
  if (result ->> 'total')::int <> 0 then raise exception 'FAIL: %% was a wildcard'; end if;
  result := public.admin_accounts('', 'paid', '', 50, 0);
  if (result ->> 'total')::int <> 1 then raise exception 'FAIL: paid filter'; end if;
  result := public.admin_accounts('', 'open', '', 50, 0);
  if (result ->> 'total')::int <> 2 then raise exception 'FAIL: open filter %', result; end if;
  result := public.admin_accounts('', 'limit', '', 50, 0);
  if (result ->> 'total')::int <> 1 then raise exception 'FAIL: limit filter'; end if;
  result := public.admin_accounts('', 'confirmed', 'cost', 2, 0);
  if (result ->> 'total')::int <> 3 or jsonb_array_length(result -> 'rows') <> 2
     or (result -> 'rows' -> 0 ->> 'userId')::uuid <> b then
    raise exception 'FAIL: confirmed, by cost, a page of 2: %', result;
  end if;
  begin
    perform public.admin_accounts('', 'tudo', '', 50, 0);
    raise exception 'FAIL: an unknown filter accepted';
  exception when raise_exception then
    if sqlerrm <> 'bad_request' then raise; end if;
  end;

  -- One account: only what support needs, and the opening is logged.
  result := public.admin_account(b);
  if result ->> 'email' <> 'b-painel@brotasites.test' or jsonb_array_length(result -> 'sites') <> 2 then
    raise exception 'FAIL: account %', result;
  end if;
  if result ? 'document_number' or result ? 'billing_address' then raise exception 'FAIL: too much personal data'; end if;
  perform set_config('role', 'service_role', true);
  select count(*) into n from public.admin_decisions where action = 'view_account' and target_user_id = b and admin_id = t;
  if n <> 1 then raise exception 'FAIL: opening the account was not logged'; end if;
  perform set_config('role', 'authenticated', true);

  -- Actions, each logged with before and after.
  result := public.admin_grant_round(s_b2, 'Cliente pediu ajuda com as cores');
  if (result ->> 'extraRounds')::int <> 1 then raise exception 'FAIL: grant round'; end if;
  result := public.admin_grant_site_slot(a, 'Agência com dois clientes');
  if (result ->> 'extra')::int <> 1 then raise exception 'FAIL: grant slot'; end if;
  result := public.admin_extend_cleanup(s_b2, 10, 'Cliente viajando');
  if (result ->> 'deletesAt')::timestamptz < now() + interval '29 days' then raise exception 'FAIL: extension %', result; end if;
  begin
    perform public.admin_grant_round(s_b2, '');
    raise exception 'FAIL: an action without a reason';
  exception when raise_exception then
    if sqlerrm <> 'bad_request' then raise; end if;
  end;
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select count(*) into n from public.admin_decisions
    where admin_id = t and action in ('grant_round', 'grant_site_slot', 'extend_cleanup') and details ? 'before' and details ? 'after';
  if n <> 3 then raise exception 'FAIL: % actions logged with before and after', n; end if;
  -- The slot grant works: A can start a second site now.
  perform public.server_create_site(a, 1, '{}');

  -- Limits in force and the cleanup preview.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  result := public.admin_limits();
  if (result ->> 'freeDirectionRounds')::int <> 3 or (result ->> 'openSitesPerAccount')::int <> 1
     or (result ->> 'idleDays')::int <> 30 or (result ->> 'slotGrants')::int <> 1 then
    raise exception 'FAIL: limits %', result;
  end if;
  result := public.admin_site_costs(array[s_b1, s_b2]);
  if (result -> s_b1::text ->> 'costUsd')::numeric <> 1.00 or (result -> s_b2::text ->> 'rounds')::int <> 3 then
    raise exception 'FAIL: queue costs %', result;
  end if;

  -- The log is not rewritten, not even by the server.
  perform set_config('role', 'service_role', true);
  begin
    delete from public.admin_decisions where admin_id = t;
    raise exception 'FAIL: the server deleted the log';
  exception when insufficient_privilege then null;
  end;

  raise exception 'ALL CHECKS PASSED';
end;
$$;
