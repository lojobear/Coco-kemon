create schema if not exists bloop_private;
revoke all on schema bloop_private from public, anon, authenticated;
create table public.bloop_profiles (
 id text primary key check(id='bloop'), display_name text not null default 'Bloop',
 is_ai boolean not null default true check(is_ai), avatar text not null default '🤖',
 biography text not null default 'Curious autonomous Boop collector.',
 state jsonb not null default '{"id":"bloop","items":[],"crafts":0,"lastCraftAt":null,"artwork":{}}'::jsonb,
 last_slot bigint not null default -1, updated_at timestamptz not null default now(),
 check(octet_length(state::text)<=8388608)
);
create table public.bloop_controls (
 id text primary key references public.bloop_profiles(id) on delete cascade,
 owner_id uuid not null references auth.users(id), enabled boolean not null default true
);
create table public.bloop_activity (
 slot bigint primary key, bot_id text not null references public.bloop_profiles(id),
 created_at timestamptz not null default now(), detail jsonb not null
);
create table bloop_private.credentials (id text primary key check(id='bloop'), token_hash text not null);
alter table public.bloop_profiles enable row level security;
alter table public.bloop_controls enable row level security;
alter table public.bloop_activity enable row level security;
alter table bloop_private.credentials enable row level security;
revoke all on public.bloop_profiles, public.bloop_controls, public.bloop_activity from public,anon,authenticated;
grant select on public.bloop_profiles, public.bloop_activity to authenticated;
grant select on public.bloop_controls to authenticated;
grant update(enabled) on public.bloop_controls to authenticated;
create policy bloop_profile_read on public.bloop_profiles for select to authenticated using (true);
create policy bloop_activity_read on public.bloop_activity for select to authenticated using (true);
create policy bloop_controls_read on public.bloop_controls for select to authenticated using (owner_id=(select auth.uid()));
create policy bloop_controls_update on public.bloop_controls for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
insert into public.bloop_profiles(id) values ('bloop') on conflict do nothing;
create function bloop_private.authorized(p_token text) returns boolean language sql stable security invoker set search_path='' as $$
 select length(p_token)=73 and exists(select 1 from bloop_private.credentials where id='bloop' and token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex'))
$$;
revoke all on function bloop_private.authorized(text) from public,anon,authenticated;
create function bloop_private.claim(p_token text,p_slot bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb; active boolean;
begin
 if not coalesce(bloop_private.authorized(p_token),false) then raise exception 'Unauthorized bot' using errcode='42501'; end if;
 if abs(p_slot-floor(extract(epoch from clock_timestamp())/900)::bigint)>1 then return '{"claimed":false}'::jsonb; end if;
 select enabled into active from public.bloop_controls where id='bloop' for update;
 if active is distinct from true then return '{"claimed":false}'::jsonb; end if;
 update public.bloop_profiles set last_slot=p_slot where id='bloop' and last_slot<p_slot returning state into s;
 if not found then return '{"claimed":false}'::jsonb; end if;
 insert into public.bloop_activity(slot,bot_id,detail) values(p_slot,'bloop','{"status":"started"}'::jsonb);
 return jsonb_build_object('claimed',true,'state',s);
end $$;
create function bloop_private.finish(p_token text,p_slot bigint,p_state jsonb,p_detail jsonb) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(bloop_private.authorized(p_token),false) then raise exception 'Unauthorized bot' using errcode='42501'; end if;
 if p_state->>'id' is distinct from 'bloop' or jsonb_typeof(p_state->'items') is distinct from 'array' or jsonb_array_length(p_state->'items')>5000 or octet_length(p_state::text)>8388608 or octet_length(p_detail::text)>8192 then raise exception 'Invalid bot save'; end if;
 update public.bloop_activity set detail=p_detail where slot=p_slot and bot_id='bloop' and detail->>'status'='started';
 if not found then return false; end if;
 update public.bloop_profiles set state=p_state,updated_at=now() where id='bloop' and last_slot=p_slot;
 if not found then raise exception 'Stale bot save'; end if;
 return true;
end $$;
revoke all on function bloop_private.claim(text,bigint), bloop_private.finish(text,bigint,jsonb,jsonb) from public,anon,authenticated;
grant usage on schema bloop_private to anon;
grant execute on function bloop_private.claim(text,bigint), bloop_private.finish(text,bigint,jsonb,jsonb) to anon;
create function public.bloop_claim(p_token text,p_slot bigint) returns jsonb language sql security invoker set search_path='' as $$select bloop_private.claim(p_token,p_slot)$$;
create function public.bloop_finish(p_token text,p_slot bigint,p_state jsonb,p_detail jsonb) returns boolean language sql security invoker set search_path='' as $$select bloop_private.finish(p_token,p_slot,p_state,p_detail)$$;
revoke all on function public.bloop_claim(text,bigint),public.bloop_finish(text,bigint,jsonb,jsonb) from public,authenticated,anon;
grant execute on function public.bloop_claim(text,bigint),public.bloop_finish(text,bigint,jsonb,jsonb) to anon;
notify pgrst,'reload schema';