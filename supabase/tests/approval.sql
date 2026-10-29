-- Checks approval and the one-time payment (migration 20261028010000_approval.sql): only the
-- server approves and confirms, a payment counts once, and a paid site publishes on approval.
-- Run in the SQL editor, or locally with supabase/tests/local/run.sh. It ends with the exception
-- "ALL CHECKS PASSED" on purpose, so everything rolls back.
do $$
declare
  a uuid := '55555555-5555-4555-8555-555555555555';
  site_a uuid;
  dir_a uuid;
  result jsonb;
  payment uuid;
  job uuid;
  n int;
begin
  insert into auth.users (id, email, aud, role, email_confirmed_at)
    values (a, 'a-approval@brotasites.test', 'authenticated', 'authenticated', now());

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.sites default values returning id into site_a;

  -- The site is built and waiting for the client's approval.
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into public.site_directions (site_id, round, direction, identity, features, source)
    values (site_a, 0, 'fiel-a-marca', '{}', '{}', 'ai') returning id into dir_a;
  update public.sites set status = 'awaiting_approval', approved_direction = dir_a where id = site_a;

  -- Clients cannot approve or pay by themselves.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    perform public.server_approve(site_a, 100, 'stub');
    raise exception 'FAIL: client called server_approve';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.server_confirm_payment(gen_random_uuid(), 'x');
    raise exception 'FAIL: client confirmed a payment';
  exception when insufficient_privilege then null;
  end;

  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  begin
    perform public.server_approve(site_a, 29700, 'stub');
    raise exception 'FAIL: approved without an address';
  exception when raise_exception then
    if sqlerrm <> 'no_subdomain' then raise; end if;
  end;
  update public.sites set subdomain = 'padaria-aprovacao' where id = site_a;

  -- Approving creates one pending payment; approving again reuses it.
  result := public.server_approve(site_a, 29700, 'stub');
  payment := (result ->> 'paymentId')::uuid;
  if payment is null then raise exception 'FAIL: no payment to make'; end if;
  if (public.server_approve(site_a, 29700, 'stub') ->> 'paymentId')::uuid <> payment then
    raise exception 'FAIL: a second payment was created';
  end if;
  select count(*) into n from public.sites where id = site_a and status = 'awaiting_approval' and approved_at is not null;
  if n <> 1 then raise exception 'FAIL: approval not recorded'; end if;

  -- Confirming the payment publishes once.
  job := public.server_confirm_payment(payment, 'stub_1');
  select count(*) into n from public.jobs where id = job and kind = 'publish' and status = 'queued';
  if n <> 1 then raise exception 'FAIL: publish not queued'; end if;
  select count(*) into n from public.sites where id = site_a and status = 'publishing';
  if n <> 1 then raise exception 'FAIL: site not publishing'; end if;
  if public.server_confirm_payment(payment, 'stub_1') is not null then
    raise exception 'FAIL: a repeated confirmation queued another publish';
  end if;
  select count(*) into n from public.payments where site_id = site_a and status = 'paid';
  if n <> 1 then raise exception 'FAIL: payment not paid once'; end if;
  begin
    perform public.server_approve(site_a, 29700, 'stub');
    raise exception 'FAIL: approved while publishing';
  exception when raise_exception then
    if sqlerrm <> 'wrong_status' then raise; end if;
  end;

  -- A paid site that is rebuilt publishes right on the next approval.
  update public.sites set status = 'awaiting_approval' where id = site_a;
  result := public.server_approve(site_a, 29700, 'stub');
  if result ->> 'jobId' is null then raise exception 'FAIL: paid site asked for another payment'; end if;

  raise exception 'ALL CHECKS PASSED';
end;
$$;
