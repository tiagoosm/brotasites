-- Checks the dashboard notices (migration 20261031000000_notifications.sql): each person
-- reads and marks only their own, clients cannot make, change or delete them, the triggers make
-- the right notice once for each status change, and deleting the account takes them along. Run
-- in the SQL editor, or locally with supabase/tests/local/run.sh. It ends with the exception
-- "ALL CHECKS PASSED" on purpose, so everything rolls back.
do $$
declare
  a uuid := '12121212-1212-4121-8121-121212121212';
  b uuid := '34343434-3434-4343-8343-343434343434';
  admin uuid := '56565656-5656-4565-8565-565656565656';
  site_a uuid;
  site_b uuid;
  notice uuid;
  n int;
  first_read timestamptz;
begin
  insert into auth.users (id, email, aud, role) values
    (a, 'a-notices@brotasites.test', 'authenticated', 'authenticated'),
    (b, 'b-notices@brotasites.test', 'authenticated', 'authenticated'),
    (admin, 'admin-notices@brotasites.test', 'authenticated', 'authenticated');
  insert into public.admins (user_id) values (admin);
  insert into public.sites (owner_id) values (a) returning id into site_a;
  insert into public.sites (owner_id) values (b) returning id into site_b;

  -- 1. The status changes make the right notice. --------------------------------------------
  update public.sites set status = 'generating_directions' where id = site_a;
  if exists (select 1 from public.notifications where site_id = site_a) then
    raise exception 'FAIL: a working status made a notice';
  end if;
  update public.sites set status = 'awaiting_direction_choice' where id = site_a;
  select count(*) into n from public.notifications
    where user_id = a and site_id = site_a and kind = 'directions_ready' and round = 0;
  if n <> 1 then raise exception 'FAIL: no directions_ready notice'; end if;
  -- The same round again (a status set twice, a retried job): no second notice.
  update public.sites set status = 'generating_directions' where id = site_a;
  update public.sites set status = 'awaiting_direction_choice' where id = site_a;
  select count(*) into n from public.notifications where site_id = site_a and kind = 'directions_ready';
  if n <> 1 then raise exception 'FAIL: directions_ready repeated for the same round (%)', n; end if;
  -- Writing the same status does not count as a change.
  update public.sites set status = 'awaiting_direction_choice', status_message = null where id = site_a;
  select count(*) into n from public.notifications where site_id = site_a;
  if n <> 1 then raise exception 'FAIL: an unchanged status made a notice'; end if;
  -- A new round: a new notice.
  update public.sites set status = 'generating_directions', round = 1 where id = site_a;
  update public.sites set status = 'awaiting_direction_choice' where id = site_a;
  select count(*) into n from public.notifications where site_id = site_a and kind = 'directions_ready';
  if n <> 2 then raise exception 'FAIL: the second round made no notice'; end if;

  update public.sites set status = 'in_review' where id = site_a;
  update public.sites set status = 'awaiting_approval' where id = site_a;
  if not exists (select 1 from public.notifications where site_id = site_a and kind = 'site_ready_for_approval') then
    raise exception 'FAIL: no site_ready_for_approval notice';
  end if;
  update public.sites set status = 'publishing' where id = site_a;
  update public.sites set status = 'live', published_at = now() where id = site_a;
  if not exists (select 1 from public.notifications where site_id = site_a and kind = 'site_published') then
    raise exception 'FAIL: no site_published notice';
  end if;
  update public.sites set status = 'suspended', suspended_from = 'live' where id = site_a;
  if not exists (select 1 from public.notifications where site_id = site_a and kind = 'site_suspended') then
    raise exception 'FAIL: no site_suspended notice';
  end if;
  update public.sites set status = 'live', suspended_from = null where id = site_a;
  if not exists (select 1 from public.notifications where site_id = site_a and kind = 'site_suspension_lifted') then
    raise exception 'FAIL: no site_suspension_lifted notice';
  end if;
  select count(*) into n from public.notifications where site_id = site_a and kind = 'site_published';
  if n <> 1 then raise exception 'FAIL: lifting a suspension counted as publishing'; end if;

  -- The review asks for changes: a notice, and the admin's note is not in it.
  insert into public.admin_decisions (site_id, admin_id, action, note, from_status, to_status)
    values (site_b, admin, 'request_changes', 'Nota interna da equipe', 'in_review', 'building');
  if not exists (select 1 from public.notifications where user_id = b and site_id = site_b and kind = 'changes_requested') then
    raise exception 'FAIL: no changes_requested notice';
  end if;
  insert into public.admin_decisions (site_id, admin_id, action, from_status, to_status)
    values (site_b, admin, 'approve', 'in_review', 'awaiting_approval');
  select count(*) into n from public.notifications where site_id = site_b and kind = 'changes_requested';
  if n <> 1 then raise exception 'FAIL: an approval made a changes_requested notice'; end if;

  -- Confirming the email: once.
  update auth.users set email_confirmed_at = now() where id = b;
  update auth.users set email_confirmed_at = now() where id = b;
  select count(*) into n from public.notifications where user_id = b and kind = 'email_confirmed';
  if n <> 1 then raise exception 'FAIL: % email_confirmed notices', n; end if;

  -- 2. Each person reads and marks only their own. -------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.notifications where user_id <> a) then
    raise exception 'FAIL: A sees someone else''s notices';
  end if;
  select count(*) into n from public.notifications;
  if n <> 6 then raise exception 'FAIL: A sees % notices, expected 6', n; end if;
  update public.notifications set read_at = now() where user_id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: A marked B''s notices'; end if;

  select id into notice from public.notifications where kind = 'site_published';
  update public.notifications set read_at = now() where id = notice;
  select read_at into first_read from public.notifications where id = notice;
  if first_read is null then raise exception 'FAIL: A could not mark a notice as read'; end if;
  -- Read stays read, at the first time.
  update public.notifications set read_at = null where id = notice;
  update public.notifications set read_at = now() + interval '1 day' where id = notice;
  if (select read_at from public.notifications where id = notice) is distinct from first_read then
    raise exception 'FAIL: read_at moved after the first read';
  end if;

  begin
    insert into public.notifications (user_id, kind) values (a, 'site_published');
    raise exception 'FAIL: a client inserted a notice';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.notifications set kind = 'site_suspended' where id = notice;
    raise exception 'FAIL: a client changed the kind';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.notifications set user_id = b where id = notice;
    raise exception 'FAIL: a client changed the owner';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.notifications where id = notice;
    raise exception 'FAIL: a client deleted a notice';
  exception when insufficient_privilege then null;
  end;
  begin
    perform private.notify(a, site_a, 'site_published');
    raise exception 'FAIL: a client called notify';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.notifications;
  if n <> 2 then raise exception 'FAIL: B sees % notices, expected 2', n; end if;

  -- 3. Retention: notices read more than 90 days ago go with the next notice. --------------
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  alter table public.notifications disable trigger notifications_read_once;
  update public.notifications set read_at = now() - interval '91 days' where id = notice;
  alter table public.notifications enable trigger notifications_read_once;
  update public.sites set status = 'grace' where id = site_a;
  update public.sites set status = 'suspended' where id = site_a;
  if exists (select 1 from public.notifications where id = notice) then
    raise exception 'FAIL: an old read notice was kept';
  end if;
  if not exists (select 1 from public.notifications where user_id = a and read_at is null) then
    raise exception 'FAIL: retention removed unread notices';
  end if;

  -- 4. Deleting the account takes the notices along. -----------------------------------------
  perform set_config('role', 'service_role', true);
  perform public.server_delete_account(a);
  perform set_config('role', 'postgres', true);
  if exists (select 1 from public.notifications where site_id = site_a) then
    raise exception 'FAIL: the site''s notices survived';
  end if;
  delete from auth.users where id = a;
  if exists (select 1 from public.notifications where user_id = a) then
    raise exception 'FAIL: the account''s notices survived';
  end if;
  if not exists (select 1 from public.notifications where user_id = b) then
    raise exception 'FAIL: B''s notices went too';
  end if;

  raise exception 'ALL CHECKS PASSED';
end;
$$;
