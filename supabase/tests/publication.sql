-- Checks the publication functions (migration 20261021180000_publication.sql).
-- Run in the SQL editor: it ends with an exception on purpose, so everything rolls back.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  site_a uuid;
  site_b uuid;
  job uuid;
  n int;
begin
  insert into auth.users (id, email, aud, role) values
    (a, 'a-teste@exemplo.com', 'authenticated', 'authenticated'),
    (b, 'b-teste@exemplo.com', 'authenticated', 'authenticated');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.sites default values returning id into site_a;

  if not public.subdomain_available('padaria-do-ze') then raise exception 'FAIL: free address'; end if;
  if public.subdomain_available('painel') then raise exception 'FAIL: reserved address'; end if;
  if public.subdomain_available('-x') then raise exception 'FAIL: malformed address'; end if;

  job := public.request_publication(site_a, 'padaria-do-ze');
  select count(*) into n from public.jobs where id = job and status = 'queued';
  if n <> 1 then raise exception 'FAIL: job not queued'; end if;
  select count(*) into n from public.sites where id = site_a and status = 'generating' and subdomain = 'padaria-do-ze';
  if n <> 1 then raise exception 'FAIL: site not reserved'; end if;
  -- Still available to its owner (re-publishing), but no second job while one runs.
  if not public.subdomain_available('padaria-do-ze') then raise exception 'FAIL: owner sees own address taken'; end if;
  begin
    perform public.request_publication(site_a, 'padaria-do-ze');
    raise exception 'FAIL: second job while running';
  exception when raise_exception then
    if sqlerrm <> 'already_running' then raise; end if;
  end;

  -- B: the address is taken, A's site is not B's, and B cannot claim jobs.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.sites default values returning id into site_b;
  if public.subdomain_available('padaria-do-ze') then raise exception 'FAIL: taken address free for B'; end if;
  begin
    perform public.request_publication(site_b, 'padaria-do-ze');
    raise exception 'FAIL: B took A''s address';
  exception when raise_exception then
    if sqlerrm <> 'subdomain_taken' then raise; end if;
  end;
  begin
    perform public.request_publication(site_a, 'outro-endereco');
    raise exception 'FAIL: B published A''s site';
  exception when raise_exception then
    if sqlerrm <> 'site_not_found' then raise; end if;
  end;
  begin
    perform public.claim_next_job();
    raise exception 'FAIL: client claimed a job';
  exception when insufficient_privilege then null;
  end;

  -- Anonymous visitors may check addresses only.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  if public.subdomain_available('padaria-do-ze') then raise exception 'FAIL: anon sees taken address free'; end if;
  begin
    perform public.request_publication(site_a, 'x-y-z');
    raise exception 'FAIL: anon requested publication';
  exception when insufficient_privilege then null;
  end;

  raise exception 'ALL CHECKS PASSED';
end $$;
