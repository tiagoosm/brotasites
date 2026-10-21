-- Photos clients upload for their sites (hero, about, gallery).
--
-- The bucket is public for reading: the photos end up on public sites anyway, and the live
-- preview and the generator fetch them by URL. Writing is limited to the person's own
-- folder, "<user id>/<site id>/<file>". The form resizes photos to WebP before uploading.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "People upload photos to their own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'site-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "People list their own photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'site-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "People delete their own photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'site-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- An asset row may only point at a file in the person's own folder.
drop policy "Owners add assets to their sites" on public.assets;
create policy "Owners add assets to their sites" on public.assets
  for insert to authenticated
  with check (
    split_part(storage_path, '/', 1) = (select auth.uid())::text
    and exists (select 1 from public.sites s where s.id = site_id and s.owner_id = (select auth.uid()))
  );
