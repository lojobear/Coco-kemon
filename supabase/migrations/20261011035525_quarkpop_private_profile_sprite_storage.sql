insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quarkpop-profile-sprites', 'quarkpop-profile-sprites', false, 4194304, array['image/png', 'application/json'])
on conflict (id) do nothing;

create policy "quarkpop_sprite_read_own"
on storage.objects for select to authenticated
using (bucket_id = 'quarkpop-profile-sprites'
  and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "quarkpop_sprite_insert_own"
on storage.objects for insert to authenticated
with check (bucket_id = 'quarkpop-profile-sprites'
  and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "quarkpop_sprite_update_own"
on storage.objects for update to authenticated
using (bucket_id = 'quarkpop-profile-sprites'
  and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'quarkpop-profile-sprites'
  and (storage.foldername(name))[1] = (select auth.uid())::text);
