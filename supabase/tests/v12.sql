-- Checks the schema 1.2 platform tables and functions (migration 20261028000000_platform_v12.sql):
-- person A works on a site, person B can never see or change it, server-only tables stay closed.
-- Run in the SQL editor, or locally with supabase/tests/local/run.sh. It ends with the exception
-- "ALL CHECKS PASSED" on purpose, so everything rolls back.
do $$
declare
  a uuid := '33333333-3333-4333-8333-333333333333';
  b uuid := '44444444-4444-4444-8444-444444444444';
  site_a uuid;
  site_b uuid;
  dir_a uuid;
  dir_b uuid;
  job uuid;
  n int;
begin
  insert into auth.users (id, email, aud, role) values
    (a, 'a-v12@brotasites.test', 'authenticated', 'authenticated'),
    (b, 'b-v12@brotasites.test', 'authenticated', 'authenticated');

  -- A creates a 1.2 site and saves the form draft.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.sites default values returning id into site_a;
  select count(*) into n from public.sites where id = site_a and schema_version = '1.2' and status = 'draft';
  if n <> 1 then raise exception 'FAIL: new sites are 1.2 drafts'; end if;
  insert into public.site_configs (site_id, draft, completed) values (site_a, '{"business":{"name":"A"}}', '{negocio}');

  -- Server-controlled columns and tables are closed to the client.
  begin
    update public.sites set round = 5 where id = site_a;
    raise exception 'FAIL: client changed the round';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.sites set preview_token = repeat('x', 40) where id = site_a;
    raise exception 'FAIL: client set the preview token';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.site_events (site_id, kind, message) values (site_a, 'fake', 'x');
    raise exception 'FAIL: client wrote the timeline';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.payments (site_id, purpose, provider, status, amount_cents) values (site_a, 'publish', 'stub', 'paid', 100);
    raise exception 'FAIL: client created a paid payment';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.design_registry;
    raise exception 'FAIL: client read the registry';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.review_reports;
    raise exception 'FAIL: client read review reports';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.ai_cache;
    raise exception 'FAIL: client read the AI cache';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.rate_limits;
    raise exception 'FAIL: client read rate limits';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.sites set subdomain = 'painel' where id = site_a;
    raise exception 'FAIL: reserved address written directly';
  exception when check_violation then null;
  end;

  -- A sends the answers: directions are queued once.
  job := public.request_directions(site_a);
  select count(*) into n from public.jobs where id = job and kind = 'directions' and status = 'queued';
  if n <> 1 then raise exception 'FAIL: directions job not queued'; end if;
  select count(*) into n from public.sites where id = site_a and status = 'generating_directions' and round = 0;
  if n <> 1 then raise exception 'FAIL: site not generating directions'; end if;
  select count(*) into n from public.site_events where site_id = site_a and kind = 'directions_requested';
  if n <> 1 then raise exception 'FAIL: no timeline event'; end if;
  begin
    perform public.request_directions(site_a);
    raise exception 'FAIL: second request while generating';
  exception when raise_exception then
    if sqlerrm <> 'wrong_status' then raise; end if;
  end;

  -- The server (secret key) stores the 3 directions.
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into public.site_directions (site_id, round, direction, identity, features, source)
    values (site_a, 0, 'fiel-a-marca', '{}', '{}', 'ai') returning id into dir_a;
  insert into public.site_directions (site_id, round, direction, identity, features, source)
    values (site_a, 0, 'evolucao', '{}', '{}', 'ai'), (site_a, 0, 'contraste', '{}', '{}', 'engine');
  update public.sites set status = 'awaiting_direction_choice' where id = site_a;
  insert into public.payments (site_id, purpose, provider, amount_cents) values (site_a, 'publish', 'stub', 29700);
  insert into public.design_registry (site_id, family, city_key, fingerprint, features)
    values (site_a, 'food', 'santa rita do sapucai', 'abcdef0123456789', '{}');

  -- B sees nothing of A and cannot act on A's site.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.sites default values returning id into site_b;
  select count(*) into n from public.sites where id = site_a;
  if n <> 0 then raise exception 'FAIL: B sees A''s site'; end if;
  select count(*) into n from public.site_directions where site_id = site_a;
  if n <> 0 then raise exception 'FAIL: B sees A''s directions'; end if;
  select count(*) into n from public.site_events where site_id = site_a;
  if n <> 0 then raise exception 'FAIL: B sees A''s timeline'; end if;
  select count(*) into n from public.payments where site_id = site_a;
  if n <> 0 then raise exception 'FAIL: B sees A''s payments'; end if;
  select count(*) into n from public.site_configs where site_id = site_a;
  if n <> 0 then raise exception 'FAIL: B sees A''s draft'; end if;
  begin
    perform public.request_directions(site_a);
    raise exception 'FAIL: B requested A''s directions';
  exception when raise_exception then
    if sqlerrm <> 'site_not_found' then raise; end if;
  end;
  begin
    perform public.choose_direction(site_a, dir_a);
    raise exception 'FAIL: B chose A''s direction';
  exception when raise_exception then
    if sqlerrm <> 'site_not_found' then raise; end if;
  end;
  begin
    perform public.request_rebuild(site_a);
    raise exception 'FAIL: B rebuilt A''s site';
  exception when raise_exception then
    if sqlerrm <> 'site_not_found' then raise; end if;
  end;
  update public.site_configs set draft = '{}' where site_id = site_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B changed A''s draft'; end if;
  delete from public.sites where id = site_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B deleted A''s site'; end if;

  -- B's own direction cannot be used on A's site, even by A.
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into public.site_directions (site_id, round, direction, identity, features, source)
    values (site_b, 0, 'fiel-a-marca', '{}', '{}', 'engine') returning id into dir_b;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    perform public.choose_direction(site_a, dir_b);
    raise exception 'FAIL: A chose a direction of another site';
  exception when raise_exception then
    if sqlerrm <> 'direction_not_found' then raise; end if;
  end;
  select count(*) into n from public.payments where site_id = site_a and status = 'pending';
  if n <> 1 then raise exception 'FAIL: owner cannot see their payment'; end if;

  -- A chooses: the site is built; a rebuild waits for the build to finish.
  job := public.choose_direction(site_a, dir_a);
  select count(*) into n from public.sites where id = site_a and status = 'building' and approved_direction = dir_a;
  if n <> 1 then raise exception 'FAIL: direction not chosen'; end if;
  select count(*) into n from public.jobs where id = job and kind = 'build';
  if n <> 1 then raise exception 'FAIL: build not queued'; end if;
  begin
    perform public.request_rebuild(site_a);
    raise exception 'FAIL: rebuild while building';
  exception when raise_exception then
    if sqlerrm <> 'wrong_status' then raise; end if;
  end;

  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.sites set status = 'awaiting_approval' where id = site_a;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  job := public.request_rebuild(site_a);
  select count(*) into n from public.sites where id = site_a and status = 'building';
  if n <> 1 then raise exception 'FAIL: rebuild not started'; end if;

  -- Rate limits: past the maximum in a window, rate_limited.
  perform set_config('role', 'service_role', true);
  perform private.hit_rate_limit('test:key', 2, interval '1 hour');
  perform private.hit_rate_limit('test:key', 2, interval '1 hour');
  begin
    perform private.hit_rate_limit('test:key', 2, interval '1 hour');
    raise exception 'FAIL: third hit allowed';
  exception when raise_exception then
    if sqlerrm <> 'rate_limited' then raise; end if;
  end;

  -- Server functions: jobs by kind, AI counters, one alert per day.
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select count(*) into n from public.claim_job(array['publish']);
  if n <> 0 then raise exception 'FAIL: claimed a job of another kind'; end if;
  select count(*) into n from public.claim_job(array['directions', 'build']) where kind in ('directions', 'build') and attempts = 1;
  if n <> 1 then raise exception 'FAIL: did not claim the oldest 1.2 job'; end if;
  if public.ai_count_round('k') <> 1 or public.ai_count_round('k') <> 2 then raise exception 'FAIL: AI round counter'; end if;
  if public.ai_add_spend('2026-10-28', 0.5) <> 0.5 or public.ai_add_spend('2026-10-28', 0.25) <> 0.75 then
    raise exception 'FAIL: AI spend';
  end if;
  if not public.ai_claim_alert('2026-10-28') or public.ai_claim_alert('2026-10-28') then
    raise exception 'FAIL: one alert per day';
  end if;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    perform public.claim_job(array['build']);
    raise exception 'FAIL: client claimed a job';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ai_add_spend('2026-10-28', -100);
    raise exception 'FAIL: client changed the AI spend';
  exception when insufficient_privilege then null;
  end;

  -- Clients cannot call the rate limiter or log events themselves.
  perform set_config('role', 'authenticated', true);
  begin
    perform private.hit_rate_limit('x', 1000, interval '1 hour');
    raise exception 'FAIL: client called the rate limiter';
  exception when insufficient_privilege then null;
  end;
  begin
    perform private.add_event(site_a, 'fake', 'x');
    raise exception 'FAIL: client logged an event';
  exception when insufficient_privilege then null;
  end;

  -- Private uploads: only into the person's own folder, and only their own are listed.
  insert into storage.objects (bucket_id, name, owner_id) values ('site-uploads', a::text || '/s/foto.jpg', a::text);
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('site-uploads', b::text || '/s/foto.jpg', a::text);
    raise exception 'FAIL: upload into another person''s folder';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from storage.objects where bucket_id = 'site-uploads';
  if n <> 0 then raise exception 'FAIL: B lists A''s originals'; end if;
  select count(*) into n from storage.objects where bucket_id = 'site-renders';
  if n <> 0 then raise exception 'FAIL: renders readable by clients'; end if;

  -- Anonymous visitors: nothing.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform public.request_directions(site_a);
    raise exception 'FAIL: anon requested directions';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.site_events;
    raise exception 'FAIL: anon read the timeline';
  exception when insufficient_privilege then null;
  end;

  raise exception 'ALL CHECKS PASSED';
end $$;
