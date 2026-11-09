-- Allow wallet-aware v3 backups while retaining v2 rows and the existing owner/RLS/CAS model.
begin;
alter table public.game_saves drop constraint if exists save_format;
alter table public.game_saves add constraint save_format check (coalesce((
  jsonb_typeof(payload) = 'object' and
  payload->>'version' in ('2', '3') and
  jsonb_typeof(payload->'crafting') = 'array' and
  jsonb_typeof(payload->'foundry') = 'object' and
  payload ?& array['version', 'crafting', 'foundry'] and
  (payload->>'version' = '2' or (
    jsonb_typeof(payload->'economy') = 'object' and
    payload->'economy'->>'version' = '1' and
    jsonb_typeof(payload->'economy'->'coins') = 'number' and
    (payload->'economy'->>'coins')::numeric between 0 and 9007199254740991 and
    trunc((payload->'economy'->>'coins')::numeric) = (payload->'economy'->>'coins')::numeric and
    jsonb_typeof(payload->'economy'->'sold') = 'object'
  ))
), false));
commit;
