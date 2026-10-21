-- Row level security checks for the platform tables.
-- Run in the SQL editor (or through the Supabase MCP). Everything happens inside one block
-- that ends with an exception, so nothing is kept. Success is the error "ALL CHECKS PASSED";
-- any "FAIL: ..." message names the broken rule.
do $$
declare
  a uuid := '11111111-1111-4111-8111-111111111111';
  b uuid := '22222222-2222-4222-8222-222222222222';
  site_a uuid;
  n int;
begin
  insert into auth.users (id, email, aud, role, instance_id)
  values (a, 'a@brotasites.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
         (b, 'b@brotasites.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  -- Person A works on their own site.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.sites default values returning id into site_a;
  insert into public.site_configs (site_id, draft, completed) values (site_a, '{"business":{"name":"A"}}', '{negocio}');
  update public.site_configs set draft = '{"business":{"name":"A2"}}' where site_id = site_a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: owner could not update draft'; end if;
  update public.sites set subdomain = 'padaria-do-ze' where id = site_a;

  -- Server-only columns stay closed to clients.
  begin
    update public.sites set status = 'live' where id = site_a;
    raise exception 'FAIL: client changed status';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.site_configs set config = '{}' where site_id = site_a;
    raise exception 'FAIL: client wrote the publishing config';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.jobs (site_id, kind) values (site_a, 'generate');
    raise exception 'FAIL: client created a job';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.sites (owner_id) values (b);
    raise exception 'FAIL: client chose another owner';
  exception when insufficient_privilege then null;
  end;

  -- Person B sees and changes nothing of A.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.sites;
  if n <> 0 then raise exception 'FAIL: B sees A''s sites'; end if;
  select count(*) into n from public.site_configs;
  if n <> 0 then raise exception 'FAIL: B sees A''s drafts'; end if;
  update public.site_configs set draft = '{}' where site_id = site_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B changed A''s draft'; end if;
  delete from public.sites where id = site_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B deleted A''s site'; end if;
  begin
    insert into public.assets (site_id, storage_path, kind) values (site_a, 'x/y.jpg', 'image');
    raise exception 'FAIL: B added an asset to A''s site';
  exception when insufficient_privilege then null;
  end;

  -- Anonymous visitors get nothing.
  perform set_config('role', 'anon', true);
  begin
    perform 1 from public.sites;
    raise exception 'FAIL: anon can read sites';
  exception when insufficient_privilege then null;
  end;

  raise exception 'ALL CHECKS PASSED';
end $$;
