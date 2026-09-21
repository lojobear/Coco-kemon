-- One private, versioned backup per account.
-- Replay-safe for projects bootstrapped through the SQL Editor before migration tracking.
-- Preserve existing rows; this does not reconcile an incompatible pre-existing schema.
create table if not exists public.game_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint save_size check (octet_length(payload::text) <= 8388608),
  constraint save_format check (coalesce((
    jsonb_typeof(payload) = 'object' and
    payload->>'version' = '2' and
    jsonb_typeof(payload->'crafting') = 'array' and
    jsonb_typeof(payload->'foundry') = 'object' and
    payload ?& array['version', 'crafting', 'foundry']
  ), false))
);
alter table public.game_saves enable row level security;
revoke all on public.game_saves from anon, authenticated;
grant select on public.game_saves to authenticated;
drop policy if exists "Read own save" on public.game_saves;
create policy "Read own save" on public.game_saves for select to authenticated
  using ((select auth.uid()) = user_id);

-- Writes go through one atomic compare-and-swap operation. Never accept a user ID
-- from the client. A stale device must reload before it can replace a newer save.
create or replace function public.write_game_save(save_payload jsonb, expected_revision integer)
returns setof public.game_saves
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  saved public.game_saves;
begin
  if owner_id is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if save_payload is null or expected_revision is null or expected_revision < 0 then
    raise exception 'Invalid save request' using errcode = '22023';
  end if;
  if expected_revision = 0 then
    insert into public.game_saves (user_id, payload)
      values (owner_id, save_payload)
      on conflict (user_id) do nothing returning * into saved;
  else
    update public.game_saves set payload = save_payload,
      revision = revision + 1, updated_at = now()
      where user_id = owner_id and revision = expected_revision
      returning * into saved;
  end if;
  if saved.user_id is null then
    raise exception 'Cloud save changed on another device. Reload before saving.' using errcode = '40001';
  end if;
  return next saved;
end;
$$;
revoke all on function public.write_game_save(jsonb, integer) from public, anon;
grant execute on function public.write_game_save(jsonb, integer) to authenticated;
