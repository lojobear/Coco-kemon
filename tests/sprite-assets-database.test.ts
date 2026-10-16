import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('sprite metadata and private storage enforce account ownership for reads and writes', async () => {
  const db = new PGlite();
  const alice = '11111111-1111-4111-8111-111111111111';
  const bob = '22222222-2222-4222-8222-222222222222';
  const path = `${alice}/auto/${'a'.repeat(64)}.png`;
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema storage;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id int generated always as identity primary key, bucket_id text, name text);
      create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
      alter table storage.objects enable row level security;
      grant usage on schema auth, public, storage to anon, authenticated;
      grant all on storage.objects to anon, authenticated;
      grant usage on all sequences in schema storage to anon, authenticated;
      insert into auth.users values ('${alice}'), ('${bob}');
    `);
    await db.exec(await readFile('supabase/migrations/20261016004024_automatic_sprite_assets.sql', 'utf8'));
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.sprite_assets'), /permission denied/);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [alice]);
    await db.query('insert into public.sprite_assets values ($1,$2,$3,$4)', [alice, 'craft:water', 'water', path]);
    await db.query('insert into storage.objects (bucket_id,name) values ($1,$2)', ['quarkpop-profile-sprites', path]);
    await assert.rejects(db.query('insert into public.sprite_assets values ($1,$2,$3,$4)', [bob, 'craft:water', 'water', `${bob}/auto/${'b'.repeat(64)}.png`]), /row-level security/);
    await assert.rejects(db.query('update public.sprite_assets set user_id=$1', [bob]), /row-level security|own_sprite_path/);
    await assert.rejects(db.query('update public.sprite_assets set path=$1', [`${bob}/auto/${'b'.repeat(64)}.png`]), /own_sprite_path/);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [bob]);
    assert.equal((await db.query('select * from public.sprite_assets')).rows.length, 0);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    assert.equal((await db.query('update public.sprite_assets set name=$1 returning *', ['stolen'])).rows.length, 0);
    assert.equal((await db.query('delete from public.sprite_assets returning *')).rows.length, 0);
    await assert.rejects(db.query('insert into storage.objects (bucket_id,name) values ($1,$2)', ['quarkpop-profile-sprites', path]), /row-level security/);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [alice]);
    assert.equal((await db.query('select * from public.sprite_assets')).rows.length, 1);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    await db.query('update public.sprite_assets set name=$1', ['water-new']);
    assert.equal((await db.query<{ name: string }>('select name from public.sprite_assets')).rows[0].name, 'water-new');
  } finally { await db.close(); }
});
