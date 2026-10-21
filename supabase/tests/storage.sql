-- Checks the photo storage rules (migration 20261021120000_site_images_storage.sql).
-- Run in the SQL editor: it ends with an exception on purpose, so everything rolls back.
-- Deleting is not covered here: Storage blocks direct deletes in SQL (use the Storage API).
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  site_a uuid;
  n int;
begin
  insert into auth.users (id, email, aud, role) values
    (a, 'a-teste@exemplo.com', 'authenticated', 'authenticated'),
    (b, 'b-teste@exemplo.com', 'authenticated', 'authenticated');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.sites default values returning id into site_a;

  -- Asset rows may only point into the person's own folder.
  insert into public.assets (site_id, storage_path, kind)
    values (site_a, a::text || '/' || site_a::text || '/x.webp', 'image');
  begin
    insert into public.assets (site_id, storage_path, kind) values (site_a, b::text || '/x.webp', 'image');
    raise exception 'FAIL: asset outside own folder';
  exception when insufficient_privilege then null;
  end;

  -- Uploads go only into the person's own folder.
  insert into storage.objects (bucket_id, name, owner_id) values ('site-images', a::text || '/s/ok.webp', a::text);
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('site-images', b::text || '/s/no.webp', a::text);
    raise exception 'FAIL: upload into another folder';
  exception when insufficient_privilege then null;
  end;

  -- B does not list A's photos.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from storage.objects where bucket_id = 'site-images';
  if n <> 0 then raise exception 'FAIL: B lists A''s photos'; end if;

  raise exception 'ALL CHECKS PASSED';
end $$;
