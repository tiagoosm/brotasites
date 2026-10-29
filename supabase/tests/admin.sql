-- Checks the admin panel's database (migration 20261029000000_admin.sql): only admins are
-- admins, only the server decides, every decision is logged and the log cannot be rewritten.
-- Run in the SQL editor, or locally with supabase/tests/local/run.sh. It ends with the exception
-- "ALL CHECKS PASSED" on purpose, so everything rolls back.
do $$
declare
  admin uuid := '66666666-6666-4666-8666-666666666666';
  client uuid := '77777777-7777-4777-8777-777777777777';
  site uuid;
  dir uuid;
  result jsonb;
  n int;
begin
  insert into auth.users (id, email, aud, role) values
    (admin, 'admin@brotasites.test', 'authenticated', 'authenticated'),
    (client, 'cliente@brotasites.test', 'authenticated', 'authenticated');

  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into public.admins (user_id) values (admin);

  -- The client's site, built and waiting for the review.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', client, 'role', 'authenticated')::text, true);
  insert into public.sites default values returning id into site;
  if public.is_admin() then raise exception 'FAIL: a client is an admin'; end if;
  begin
    perform 1 from public.admins;
    raise exception 'FAIL: client read the admins';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.admins (user_id) values (client);
    raise exception 'FAIL: client made themselves an admin';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.server_admin_decide(site, client, 'approve');
    raise exception 'FAIL: client called server_admin_decide';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.admin_decisions;
    raise exception 'FAIL: client read the decisions';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.catalog_weights;
    raise exception 'FAIL: client read the catalog weights';
  exception when insufficient_privilege then null;
  end;

  -- Without the second factor (aal1) the admin is only a member, not an admin (E15).
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  if public.is_admin() then raise exception 'FAIL: an admin without two factors is an admin'; end if;
  if not public.is_admin_member() then raise exception 'FAIL: the admin is not a member'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  if not public.is_admin() then raise exception 'FAIL: the admin is not an admin'; end if;
  -- Being an admin gives no access to clients' rows through the API: everything goes through the server.
  select count(*) into n from public.sites where id = site;
  if n <> 0 then raise exception 'FAIL: the admin reads a client site with their own session'; end if;

  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into public.site_directions (site_id, round, direction, identity, features, source, composition_key)
    values (site, 0, 'evolucao', '{}', '{}', 'ai', 'c0ffee00c0ffee00') returning id into dir;
  update public.sites
    set status = 'in_review', approved_direction = dir, preview_token = repeat('t', 32)
    where id = site;

  begin
    perform public.server_admin_decide(site, client, 'approve');
    raise exception 'FAIL: a non-admin decided';
  exception when raise_exception then
    if sqlerrm <> 'not_admin' then raise; end if;
  end;
  begin
    perform public.server_admin_decide(site, admin, 'request_changes', '  ');
    raise exception 'FAIL: changes requested without a note';
  exception when raise_exception then
    if sqlerrm <> 'note_required' then raise; end if;
  end;

  -- Changes requested: a build job carries the note to the copy step.
  result := public.server_admin_decide(site, admin, 'request_changes', 'O título repete o nome.');
  if result ->> 'status' <> 'building' then raise exception 'FAIL: not rebuilding'; end if;
  select count(*) into n from public.jobs
    where id = (result ->> 'jobId')::uuid and kind = 'build'
      and payload -> 'adminNotes' ->> 0 = 'O título repete o nome.';
  if n <> 1 then raise exception 'FAIL: the build job lacks the note'; end if;
  begin
    perform public.server_admin_decide(site, admin, 'approve');
    raise exception 'FAIL: approved while building';
  exception when raise_exception then
    if sqlerrm <> 'wrong_status' then raise; end if;
  end;

  -- Built again, approved: the client sees the finished site.
  update public.sites set status = 'in_review' where id = site;
  result := public.server_admin_decide(site, admin, 'approve', 'Tudo certo.');
  if result ->> 'status' <> 'awaiting_approval' then raise exception 'FAIL: not approved'; end if;

  -- Suspended with a reason the client sees, then restored to where it was.
  begin
    perform public.server_admin_decide(site, admin, 'suspend');
    raise exception 'FAIL: suspended without a reason';
  exception when raise_exception then
    if sqlerrm <> 'note_required' then raise; end if;
  end;
  perform public.server_admin_decide(site, admin, 'suspend', 'Imita a marca de um banco.');
  select count(*) into n from public.sites
    where id = site and status = 'suspended' and suspended_from = 'awaiting_approval'
      and status_message = 'Imita a marca de um banco.';
  if n <> 1 then raise exception 'FAIL: not suspended with the reason'; end if;
  perform public.server_admin_decide(site, admin, 'unsuspend');
  select count(*) into n from public.sites where id = site and status = 'awaiting_approval' and suspended_from is null;
  if n <> 1 then raise exception 'FAIL: suspension not lifted'; end if;

  -- Every decision is in the log, with who, from and to; nobody rewrites it.
  select count(*) into n from public.admin_decisions where site_id = site and admin_id = admin;
  if n <> 4 then raise exception 'FAIL: % decisions logged, expected 4', n; end if;
  begin
    update public.admin_decisions set note = 'apagado' where site_id = site;
    raise exception 'FAIL: the server rewrote the log';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.admin_decisions where site_id = site;
    raise exception 'FAIL: the server deleted the log';
  exception when insufficient_privilege then null;
  end;

  -- Catalog weights and factory requests are the server's.
  insert into public.catalog_weights (kind, ref, state, updated_by) values ('variant', 'hero-feast', 'retired', admin);
  insert into public.variant_requests (family, section, note, requested_by)
    values ('food', 'galeria', 'Uma galeria em mosaico para padarias.', admin);
  begin
    insert into public.catalog_weights (kind, ref, state, updated_by) values ('variant', 'x', 'loved', admin);
    raise exception 'FAIL: unknown catalog state accepted';
  exception when check_violation then null;
  end;

  raise exception 'ALL CHECKS PASSED';
end;
$$;
