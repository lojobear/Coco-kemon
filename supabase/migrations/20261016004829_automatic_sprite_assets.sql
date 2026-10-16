-- Private immutable PNG files plus one current reference per account/discovery.
create table public.sprite_assets (
  user_id uuid not null references auth.users(id) on delete cascade,
  sprite_key text not null check (length(sprite_key) between 1 and 1000),
  name text not null check (length(name) between 1 and 1000),
  path text not null,
  primary key (user_id, sprite_key),
  constraint own_sprite_path check (
    path ~ ('^' || user_id::text || '/auto/[0-9a-f]{64}\.png$')
  )
);
create index sprite_assets_account_name on public.sprite_assets (user_id, name);
alter table public.sprite_assets enable row level security;
revoke all on public.sprite_assets from anon, authenticated;
grant select, insert, update, delete on public.sprite_assets to authenticated;
create policy sprite_assets_select_own on public.sprite_assets for select to authenticated
  using ((select auth.uid()) = user_id);
create policy sprite_assets_insert_own on public.sprite_assets for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy sprite_assets_update_own on public.sprite_assets for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy sprite_assets_delete_own on public.sprite_assets for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Match the existing production bucket/policies, also supporting new installations.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quarkpop-profile-sprites', 'quarkpop-profile-sprites', false, 4194304, array['image/png','application/json'])
on conflict (id) do nothing;
drop policy if exists quarkpop_sprite_read_own on storage.objects;
create policy quarkpop_sprite_read_own on storage.objects for select to authenticated
  using (bucket_id = 'quarkpop-profile-sprites' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists quarkpop_sprite_insert_own on storage.objects;
create policy quarkpop_sprite_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'quarkpop-profile-sprites' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists quarkpop_sprite_update_own on storage.objects;
create policy quarkpop_sprite_update_own on storage.objects for update to authenticated
  using (bucket_id = 'quarkpop-profile-sprites' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'quarkpop-profile-sprites' and (storage.foldername(name))[1] = (select auth.uid())::text);
