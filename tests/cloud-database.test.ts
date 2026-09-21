import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('cloud database isolates accounts and atomically rejects stale saves', async () => {
  const db = new PGlite();
  const alice = '11111111-1111-4111-8111-111111111111';
  const bob = '22222222-2222-4222-8222-222222222222';
  const payload = JSON.stringify({ version: 2, crafting: [], foundry: {} });
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('${alice}'), ('${bob}');
    `);
    await db.exec(await readFile('supabase/migrations/20260914030000_cloud_saves.sql', 'utf8'));
    // Replaying an SQL Editor bootstrap must not fail on existing objects.
    await db.exec(await readFile('supabase/migrations/20260914030000_cloud_saves.sql', 'utf8'));
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.game_saves'), /permission denied/);
    await assert.rejects(db.query('select * from public.write_game_save($1, 0)', [payload]), /permission denied/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from public.write_game_save($1, 0)', [payload]), /Sign in required/);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [alice]);
    const first = await db.query<{ revision: number; user_id: string }>('select * from public.write_game_save($1, 0)', [payload]);
    assert.equal(first.rows[0].user_id, alice);
    assert.equal(first.rows[0].revision, 1);
    await assert.rejects(db.query('insert into public.game_saves (user_id,payload) values ($1,$2)', [bob, payload]), /permission denied/);
    await assert.rejects(db.query('update public.game_saves set revision=10'), /permission denied/);
    await assert.rejects(db.query('select * from public.write_game_save($1, 0)', [payload]), /Cloud save changed/);
    const second = await db.query<{ revision: number }>('select * from public.write_game_save($1, 1)', [payload]);
    assert.equal(second.rows[0].revision, 2);
    await assert.rejects(db.query('select * from public.write_game_save($1, 1)', [payload]), /Cloud save changed/);
    await assert.rejects(db.query('select * from public.write_game_save($1, 2)', ['{"version":null,"crafting":[],"foundry":{}}']), /save_format/);
    await assert.rejects(db.query('select * from public.write_game_save($1, 2)', ['{}']), /save_format/);
    // Also replay with existing user data, then check revisions, RLS, and writes below.
    await db.exec('reset role');
    await db.exec(await readFile('supabase/migrations/20260914030000_cloud_saves.sql', 'utf8'));
    assert.equal((await db.query<{ revision: number }>('select revision from public.game_saves')).rows[0].revision, 2);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [bob]);
    assert.equal((await db.query('select * from public.game_saves')).rows.length, 0);
    await assert.rejects(db.query('select * from public.write_game_save($1, 2)', [payload]), /Cloud save changed/);
    const other = await db.query<{ user_id: string }>('select * from public.write_game_save($1, 0)', [payload]);
    assert.equal(other.rows[0].user_id, bob);
    const visible = await db.query<{ user_id: string }>('select * from public.game_saves');
    assert.deepEqual(visible.rows.map(x => x.user_id), [bob]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [alice]);
    assert.equal((await db.query<{ revision: number }>('select revision from public.game_saves')).rows[0].revision, 2);
  } finally { await db.close(); }
});
