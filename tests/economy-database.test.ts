import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('cloud save migration preserves v2 rows, accepts v3 wallets, and rejects invalid versions/wallets',async()=>{
  const db=new PGlite();
  try{
    await db.exec('create table public.game_saves(payload jsonb not null);');
    const v2={version:2,crafting:[],foundry:{}};
    await db.query('insert into game_saves values ($1)',[JSON.stringify(v2)]);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261109121858_boop_economy_save_format.sql',import.meta.url),'utf8'));
    const v3={...v2,version:3,economy:{version:1,coins:30,sold:{steam:{normal:1}}}};
    await db.query('insert into game_saves values ($1)',[JSON.stringify(v3)]);
    for(const invalid of [{...v3,version:4},{...v3,economy:undefined},{...v3,economy:{version:1,coins:-1,sold:{}}},{...v3,economy:{version:1,coins:1.5,sold:{}}}]){
      await assert.rejects(db.query('insert into game_saves values ($1)',[JSON.stringify(invalid)]));
    }
    const rows=await db.query<{count:number}>('select count(*)::int as count from game_saves');
    assert.equal(rows.rows[0].count,2);
  }finally{await db.close();}
});
