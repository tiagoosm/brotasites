-- Checks the client's own domain (migration 20261105000000_site_domains.sql): who sees it,
-- one domain per site and per host, only paid sites, the moves between states, the notices,
-- and what happens when the site goes. Run in the SQL editor, or locally with
-- supabase/tests/local/run.sh. It ends with the exception "ALL CHECKS PASSED" on purpose, so
-- everything rolls back.
do $$
declare
  a uuid := '71111111-1111-4111-8111-111111111111';
  b uuid := '72222222-2222-4222-8222-222222222222';
  site_a uuid;
  site_b uuid;
  site_unpaid uuid;
  result jsonb;
  domain_id uuid;
  n int;
begin
  insert into auth.users (id, email, aud, role, email_confirmed_at) values
    (a, 'a-domains@brotasites.test', 'authenticated', 'authenticated', now()),
    (b, 'b-domains@brotasites.test', 'authenticated', 'authenticated', now());
  insert into public.sites (owner_id, subdomain, status) values (a, 'padaria-do-ze', 'live')
    returning id into site_a;
  insert into public.sites (owner_id, subdomain, status) values (b, 'oficina-nova', 'live')
    returning id into site_b;
  insert into public.payments (site_id, purpose, provider, status, amount_cents, paid_at) values
    (site_a, 'publish', 'stub', 'paid', 29700, now()),
    (site_b, 'publish', 'stub', 'paid', 29700, now());
  insert into public.sites (owner_id, status) values (a, 'awaiting_approval')
    returning id into site_unpaid;

  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- 1. Only a paid site, only its owner ------------------------------------------------------
  begin
    perform public.server_domain_request(site_unpaid, a, 'www.padariadoze.com.br', 'padariadoze.com.br');
    raise exception 'FAIL: a domain was asked for an unpaid site';
  exception when raise_exception then
    if sqlerrm <> 'not_paid' then raise; end if;
  end;
  begin
    perform public.server_domain_request(site_a, b, 'www.padariadoze.com.br', null);
    raise exception 'FAIL: another account asked for a domain on a site that is not theirs';
  exception when raise_exception then
    if sqlerrm <> 'site_not_found' then raise; end if;
  end;
  begin
    perform public.server_domain_request(site_a, a, 'WWW.Padaria.com.br', null);
    raise exception 'FAIL: a host out of format was accepted';
  exception when raise_exception then
    if sqlerrm <> 'bad_request' then raise; end if;
  end;

  result := public.server_domain_request(site_a, a, 'www.padariadoze.com.br', 'padariadoze.com.br');
  domain_id := (result ->> 'id')::uuid;
  if result ->> 'status' <> 'pending' or (result ->> 'primary')::boolean is not true then
    raise exception 'FAIL: a new domain should be pending and the main address: %', result;
  end if;

  -- 2. One domain per site, one site per domain ----------------------------------------------
  begin
    perform public.server_domain_request(site_a, a, 'www.outrodominio.com.br', null);
    raise exception 'FAIL: a second domain was connected to the same site';
  exception when raise_exception then
    if sqlerrm <> 'domain_exists' then raise; end if;
  end;
  begin
    perform public.server_domain_request(site_b, b, 'www.padariadoze.com.br', null);
    raise exception 'FAIL: two sites got the same domain';
  exception when raise_exception then
    if sqlerrm <> 'domain_taken' then raise; end if;
  end;
  begin
    -- The domain without "www" belongs to the pair already connected.
    perform public.server_domain_request(site_b, b, 'padariadoze.com.br', null);
    raise exception 'FAIL: the alias of a connected domain was given to another site';
  exception when raise_exception then
    if sqlerrm <> 'domain_taken' then raise; end if;
  end;
  begin
    -- Even straight into the table, the unique index holds.
    perform set_config('role', 'postgres', true);
    insert into public.site_domains (site_id, host) values (site_b, 'www.padariadoze.com.br');
    raise exception 'FAIL: the unique index let two sites hold one domain';
  exception when unique_violation then null;
  end;
  perform set_config('role', 'service_role', true);

  -- 3. The moves between states ---------------------------------------------------------------
  result := public.server_domain_attach(domain_id, 'cf-123', '[{"type":"CNAME","name":"www.padariadoze.com.br","value":"clientes.sites.test"}]');
  if result ->> 'records' not like '%CNAME%' then raise exception 'FAIL: records not saved'; end if;
  begin
    perform public.server_domain_set_status(domain_id, 'removed');
    raise exception 'FAIL: a check removed a domain';
  exception when raise_exception then
    if sqlerrm <> 'bad_transition' then raise; end if;
  end;
  begin
    perform public.server_domain_set_status(domain_id, 'failed', 'whatever');
    raise exception 'FAIL: a failure without a known reason was accepted';
  exception when raise_exception then
    if sqlerrm <> 'bad_request' then raise; end if;
  end;
  result := public.server_domain_set_status(domain_id, 'verifying');
  if result ->> 'status' <> 'verifying' then raise exception 'FAIL: not verifying'; end if;
  result := public.server_domain_set_status(domain_id, 'active');
  if result ->> 'status' <> 'active' or result ->> 'verifiedAt' is null then
    raise exception 'FAIL: not active: %', result;
  end if;
  -- A second "active" check leaves no second notice.
  perform public.server_domain_set_status(domain_id, 'active');
  select count(*) into n from public.notifications where site_id = site_a and kind = 'domain_active';
  if n <> 1 then raise exception 'FAIL: % notices for one activation', n; end if;
  select count(*) into n from public.site_events where site_id = site_a and kind in ('domain_requested', 'domain_active');
  if n <> 2 then raise exception 'FAIL: % domain events, expected 2', n; end if;

  -- The DNS changed: the hosting dropped it; trying again gives 7 more days.
  perform public.server_domain_set_status(domain_id, 'failed', 'dns_missing');
  select count(*) into n from public.notifications where site_id = site_a and kind = 'domain_failed';
  if n <> 1 then raise exception 'FAIL: no notice for the failure'; end if;
  update public.site_domains set verify_until = now() - interval '1 day' where id = domain_id;
  result := public.server_domain_set_status(domain_id, 'verifying');
  if (result ->> 'verifyUntil')::timestamptz < now() + interval '6 days' then
    raise exception 'FAIL: trying again did not give 7 more days';
  end if;

  -- The client chooses the BrotaSites address as the main one.
  result := public.server_domain_set_primary(site_a, a, false);
  if (result ->> 'primary')::boolean then raise exception 'FAIL: primary not changed'; end if;
  begin
    perform public.server_domain_set_primary(site_a, b, true);
    raise exception 'FAIL: another account changed the main address';
  exception when raise_exception then
    if sqlerrm <> 'domain_not_found' then raise; end if;
  end;

  -- 4. The routine: past the 7 days, "com problema" -------------------------------------------
  update public.site_domains set verify_until = now() - interval '1 minute' where id = domain_id;
  result := public.server_domains_to_check(50);
  if (result ->> 'expired')::int <> 1 then raise exception 'FAIL: expired domain not marked: %', result; end if;
  if (select failure_reason from public.site_domains where id = domain_id) <> 'timeout' then
    raise exception 'FAIL: expired domain without the timeout reason';
  end if;

  -- 5. A sees only A's domain ------------------------------------------------------------------
  perform public.server_domain_request(site_b, b, 'www.oficinanova.com.br', null);
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.site_domains;
  if n <> 1 then raise exception 'FAIL: A sees % domains', n; end if;
  select count(*) into n from public.site_domains where site_id = site_b;
  if n <> 0 then raise exception 'FAIL: A sees the domain of B'; end if;
  begin
    update public.site_domains set status = 'active' where site_id = site_a;
    raise exception 'FAIL: a client wrote a domain';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.server_domain_request(site_a, a, 'www.padariadoze.com.br', null);
    raise exception 'FAIL: a client called server_domain_request';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.domain_purges;
    raise exception 'FAIL: a client read the purge queue';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_domains();
    raise exception 'FAIL: a client read the team count';
  exception when raise_exception then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;

  -- 6. Removing: by the client, and with the site ---------------------------------------------
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  result := public.server_domain_remove(site_a, a);
  if result ->> 'status' <> 'removed' or result ->> 'providerId' <> 'cf-123' then
    raise exception 'FAIL: remove: %', result;
  end if;
  -- Removed, the domain can be connected again (here, by B).
  begin
    perform public.server_domain_remove(site_b, null);
    perform public.server_domain_request(site_b, b, 'www.padariadoze.com.br', null);
  exception when others then
    raise exception 'FAIL: a removed domain could not be connected again: %', sqlerrm;
  end;
  -- B's site goes (an account deletion): its domain is queued for the hosting, and its rows go.
  perform set_config('role', 'postgres', true);
  delete from public.sites where id = site_b;
  select count(*) into n from public.domain_purges where site_id = site_b and host = 'www.padariadoze.com.br';
  if n <> 1 then raise exception 'FAIL: the domain of a deleted site was not queued for the hosting'; end if;
  select count(*) into n from public.site_domains where site_id = site_b;
  if n <> 0 then raise exception 'FAIL: the domain rows outlived the site'; end if;
  perform set_config('role', 'service_role', true);
  result := public.server_claim_domain_purges(10);
  if jsonb_array_length(result) <> 1 then raise exception 'FAIL: purge not claimed: %', result; end if;
  perform public.server_finish_domain_purge((result -> 0 ->> 'id')::bigint, null);
  result := public.server_claim_domain_purges(10);
  if jsonb_array_length(result) <> 0 then raise exception 'FAIL: a finished purge came back'; end if;

  raise exception 'ALL CHECKS PASSED';
end;
$$;
