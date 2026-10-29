-- Checks accounts (migration 20261030000000_accounts.sql): profiles made by the sign-up,
-- each person reaching only their own, the terms history nobody rewrites, the confirmed-email
-- rule, the sign-in rate limits and deleting an account. Run in the SQL editor, or locally with
-- supabase/tests/local/run.sh. It ends with the exception "ALL CHECKS PASSED" on purpose, so
-- everything rolls back.
do $$
declare
  a uuid := '88888888-8888-4888-8888-888888888888';
  b uuid := '99999999-9999-4999-8999-999999999999';
  admin uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  site_a uuid;
  paid uuid;
  pending uuid;
  result jsonb;
  n int;
  name text;
  ok boolean;
begin
  -- 1. The sign-up makes the profile from validated metadata. -----------------------------
  insert into auth.users (id, email, aud, role, raw_user_meta_data, encrypted_password) values
    (a, 'a-accounts@brotasites.test', 'authenticated', 'authenticated',
      jsonb_build_object('full_name', E'  Zé   da\tPadaria\u0007 ', 'terms_version', '2026-10-draft'), '$2a$10$hash'),
    (b, 'b-accounts@brotasites.test', 'authenticated', 'authenticated',
      jsonb_build_object('full_name', repeat('x', 200), 'terms_version', '1999-01-old'), ''),
    (admin, 'admin-accounts@brotasites.test', 'authenticated', 'authenticated', null, null);

  select full_name into name from public.profiles where id = a;
  if name is distinct from 'Zé da Padaria' then raise exception 'FAIL: name not cleaned: %', name; end if;
  select char_length(full_name) into n from public.profiles where id = b;
  if n <> 80 then raise exception 'FAIL: long name kept % characters', n; end if;
  if not exists (select 1 from public.profiles where id = admin and full_name = '') then
    raise exception 'FAIL: no profile without metadata';
  end if;
  select count(*) into n from public.terms_acceptances where user_id = a and terms_version = '2026-10-draft';
  if n <> 1 then raise exception 'FAIL: the accepted terms were not recorded'; end if;
  if not exists (select 1 from public.profiles where id = a and terms_version = '2026-10-draft' and terms_accepted_at is not null) then
    raise exception 'FAIL: the profile does not show the accepted terms';
  end if;
  select count(*) into n from public.terms_acceptances where user_id = b;
  if n <> 0 then raise exception 'FAIL: an unknown terms version was recorded'; end if;
  -- Who has a password: from the sign-up, then when one is created.
  if not exists (select 1 from public.profiles where id = a and has_password)
    or exists (select 1 from public.profiles where id = b and has_password) then
    raise exception 'FAIL: has_password is wrong after the sign-up';
  end if;
  update auth.users set encrypted_password = '$2a$10$new' where id = b;
  if not exists (select 1 from public.profiles where id = b and has_password) then
    raise exception 'FAIL: creating a password was not noticed';
  end if;

  -- 2. Each person reaches only their own profile. ----------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'FAIL: A sees % profiles', n; end if;
  update public.profiles set full_name = 'Outro nome' where id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: A changed B''s profile'; end if;
  update public.profiles set full_name = 'José', phone = '+5535999990000' where id = a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: A could not change their own name'; end if;
  begin
    update public.profiles set phone = '35 99999-0000' where id = a;
    raise exception 'FAIL: a phone outside E.164 was saved';
  exception when check_violation then null;
  end;
  begin
    update public.profiles set id = b where id = a;
    raise exception 'FAIL: A changed their profile id';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set terms_version = '2030-01-x', terms_accepted_at = now() where id = a;
    raise exception 'FAIL: A rewrote the accepted terms';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set document_number = '12345678901' where id = a;
    raise exception 'FAIL: A wrote billing data';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.profiles (id, full_name) values (gen_random_uuid(), 'Intruso');
    raise exception 'FAIL: A inserted a profile';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.profiles where id = a;
    raise exception 'FAIL: A deleted their profile directly';
  exception when insufficient_privilege then null;
  end;

  -- 3. The terms history is append-only. ---------------------------------------------------
  begin
    perform public.accept_terms('1999-01-old');
    raise exception 'FAIL: accepted an old terms version';
  exception when raise_exception then
    if sqlerrm <> 'wrong_terms_version' then raise; end if;
  end;
  perform public.accept_terms('2026-10-draft');
  select count(*) into n from public.terms_acceptances;
  if n <> 2 then raise exception 'FAIL: A sees % acceptances, expected 2', n; end if;
  begin
    update public.terms_acceptances set terms_version = 'x' where user_id = a;
    raise exception 'FAIL: A rewrote an acceptance';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.terms_acceptances where user_id = a;
    raise exception 'FAIL: A deleted an acceptance';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.terms_acceptances (user_id, terms_version) values (b, '2026-10-draft');
    raise exception 'FAIL: A recorded an acceptance for B';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.terms_acceptances;
  if n <> 0 then raise exception 'FAIL: B sees A''s acceptances'; end if;
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  begin
    update public.terms_acceptances set terms_version = 'x';
    raise exception 'FAIL: the server rewrote an acceptance';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.terms_acceptances;
    raise exception 'FAIL: the server deleted acceptances';
  exception when insufficient_privilege then null;
  end;

  -- 4. Only a confirmed email sends the form. ----------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.sites default values returning id into site_a;
  begin
    perform public.request_directions(site_a);
    raise exception 'FAIL: an unconfirmed email sent the form';
  exception when raise_exception then
    if sqlerrm <> 'email_not_confirmed' then raise; end if;
  end;
  perform set_config('role', 'postgres', true);
  update auth.users set email_confirmed_at = now() where id = a;
  perform set_config('role', 'authenticated', true);
  perform public.request_directions(site_a);
  select count(*) into n from public.jobs where site_id = site_a and kind = 'directions';
  if n <> 1 then raise exception 'FAIL: the confirmed email did not send the form'; end if;

  -- 5. Rate limits: server only, and they stop at the maximum. ------------------------------
  begin
    perform public.server_rate_limit('signin:test', 2, 60);
    raise exception 'FAIL: a client called server_rate_limit';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  ok := public.server_rate_limit('signin:test', 2, 60);
  if not ok then raise exception 'FAIL: first try limited'; end if;
  ok := public.server_rate_limit('signin:test', 2, 60);
  if not ok then raise exception 'FAIL: second try limited'; end if;
  ok := public.server_rate_limit('signin:test', 2, 60);
  if ok then raise exception 'FAIL: third try allowed'; end if;
  ok := public.server_rate_limit('signin:other', 2, 60);
  if not ok then raise exception 'FAIL: one key limited another'; end if;

  -- 6. Admins need two factors (aal2). -----------------------------------------------------
  insert into public.admins (user_id) values (admin);
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  if public.is_admin() then raise exception 'FAIL: an aal1 session is an admin'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  if not public.is_admin() then raise exception 'FAIL: an aal2 admin is not an admin'; end if;

  -- 7. Deleting an account. ------------------------------------------------------------------
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.sites set subdomain = 'padaria-contas', status = 'live' where id = site_a;
  insert into public.payments (site_id, purpose, provider, status, amount_cents, paid_at)
    values (site_a, 'publish', 'stub', 'paid', 29700, now()) returning id into paid;
  insert into public.payments (site_id, purpose, provider, amount_cents)
    values (site_a, 'custom_domain', 'stub', 9700) returning id into pending;
  insert into public.admin_decisions (site_id, admin_id, action, from_status, to_status)
    values (site_a, admin, 'approve', 'in_review', 'awaiting_approval');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    perform public.server_delete_account(a);
    raise exception 'FAIL: a client called server_delete_account';
  exception when insufficient_privilege then null;
  end;

  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  begin
    perform public.server_delete_account(admin);
    raise exception 'FAIL: deleted a team account';
  exception when raise_exception then
    if sqlerrm <> 'is_admin' then raise; end if;
  end;
  result := public.server_delete_account(a);
  if (result ->> 'sites')::int <> 1 or (result ->> 'retainedPayments')::int <> 1 then
    raise exception 'FAIL: unexpected deletion result %', result;
  end if;
  if result -> 'purges' -> 0 ->> 'subdomain' <> 'padaria-contas' then
    raise exception 'FAIL: the hosting cleanup was not queued: %', result;
  end if;
  if exists (select 1 from public.sites where owner_id = a) then raise exception 'FAIL: the site survived'; end if;
  if exists (select 1 from public.site_configs where site_id = site_a) then raise exception 'FAIL: the draft survived'; end if;
  if exists (select 1 from public.jobs where site_id = site_a) then raise exception 'FAIL: the jobs survived'; end if;
  if exists (select 1 from public.payments where id = pending) then raise exception 'FAIL: a pending charge was kept'; end if;
  if not exists (
    select 1 from public.payments
    where id = paid and site_id is null and retained_customer ->> 'email' = 'a-accounts@brotasites.test'
  ) then
    raise exception 'FAIL: the paid charge was not kept for the tax period';
  end if;
  select count(*) into n from public.claim_site_purge() where subdomain = 'padaria-contas';
  if n <> 1 then raise exception 'FAIL: the jobs could not claim the cleanup'; end if;

  -- The auth user goes last: the profile and the terms history go with it.
  perform set_config('role', 'postgres', true);
  delete from auth.users where id = a;
  if exists (select 1 from public.profiles where id = a) then raise exception 'FAIL: the profile survived'; end if;
  if exists (select 1 from public.terms_acceptances where user_id = a) then raise exception 'FAIL: the history survived'; end if;
  if not exists (select 1 from public.profiles where id = b) then raise exception 'FAIL: B''s profile went too'; end if;

  raise exception 'ALL CHECKS PASSED';
end;
$$;
