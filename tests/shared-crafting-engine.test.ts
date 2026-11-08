import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveSharedPair, applySharedPairDiscovery, SHARED_PAIR_ENGINE, type SharedPairRolls } from '../src/lib/sharedCraftingEngine';
import type { InfiniteElement, InfiniteCraftPairResponse } from '../src/lib/infiniteCraftData';
import { validateCraft } from '../src/lib/saveData';
import { rollOddsCaption } from '../src/lib/rarity';

const common:SharedPairRolls={shiny:false,celestial:false,holo:false,glitch:false,tier:'common'};
const rare:SharedPairRolls={shiny:true,celestial:true,holo:true,glitch:true,tier:'legendary'};
const item=(name:string,other:Partial<InfiniteElement>={}):InfiniteElement=>({
  id:name.toLowerCase().replaceAll(' ','_'),name,emoji:'✨',...other,
});
const response=(result:string,other:Partial<InfiniteCraftPairResponse>={}):InfiniteCraftPairResponse=>({
  result,emoji:'⚙️',isNew:false,explanation:'Both inputs produce a new functional concept.',connection:'technology',...other,
});

test('both modes use the exact same canonical pair resolver regardless of ingredient order',async()=>{
  assert.equal(SHARED_PAIR_ENGINE,'/api/infinite-craft/pair');
  assert.equal((await resolveSharedPair('Water','Fire')).result,'Steam');
  assert.equal((await resolveSharedPair('Fire','Water')).result,'Steam');
  assert.equal((await resolveSharedPair('Fire','Fire')).result,'Volcano');
});

test('global API isNew is never confused with a new discovery in this collection',()=>{
  const first=applySharedPairDiscovery([item('Water'),item('Fire')],response('Steam'),'Water','Fire',common,1000);
  assert.equal(first.isNew,true);
  assert.equal(first.main.name,'Steam');
  assert.equal(first.main.craftCount,1);
  assert.equal(first.main.rarityTier,'common');
  assert.equal(first.main.category,'Elements & Energy');
  assert.equal(first.main.recipeHistory?.[0].first,'Water');
  assert.equal(first.main.recipeHistory?.[0].second,'Fire');
  assert.ok(validateCraft(first.elements));
  assert.equal(first.elements.length,3);
});

test('Foundry duplicate, Craft duplicate, and reversed pairs share one recipe history and item identity',()=>{
  const first=applySharedPairDiscovery([item('Fire'),item('Water')],response('Steam'),'Fire','Water',common,1000);
  const replay=applySharedPairDiscovery(first.elements,response('Steam'),'Water','Fire',rare,2000);
  assert.equal(replay.elements.length,3);
  assert.equal(replay.isNew,false);
  assert.equal(replay.main.id,first.main.id);
  assert.equal(replay.main.discoveredAt,1000);
  assert.equal(replay.main.craftCount,2);
  assert.equal(replay.main.recipeHistory?.length,1);
  assert.equal(replay.main.recipeHistory?.[0].count,2);
  assert.equal(replay.main.rarityTier,'legendary');
  assert.equal(replay.main.unlockedShiny,true);
  assert.equal(replay.main.unlockedCelestial,true);
  assert.equal(replay.main.unlockedHolo,true);
  assert.equal(replay.main.unlockedGlitch,true);
  assert.equal(replay.main.shinyCraftCount,1);
  assert.match(rollOddsCaption(replay.main.rarityTier,rare.shiny,rare.celestial,rare.holo,rare.glitch),/Legendary/);
  assert.ok(validateCraft(replay.elements));
});

test('existing uploaded sprite, early rarity, and uncommon recipe lineage are preserved',()=>{
  const prior=item('Clockwork Fox',{
    id:'foundry_original',customSpriteUrl:'data:image/png;base64,iVBORw0KGgoAAA==',
    discoveredAt:123,rarityTier:'mythic',recipe:{first:'Gear',second:'Fox'},
    craftCount:3,recipeHistory:[{first:'Gear',second:'Fox',count:3,firstSeenAt:123,lastSeenAt:234}],
  });
  const next=applySharedPairDiscovery([prior],response('Clockwork Fox'),'Steam','Fox',common,500);
  assert.equal(next.main.id,'foundry_original');
  assert.equal(next.main.customSpriteUrl,prior.customSpriteUrl);
  assert.equal(next.main.rarityTier,'mythic');
  assert.equal(next.main.discoveredAt,123);
  assert.equal(next.main.craftCount,4);
  assert.equal(next.main.recipeHistory?.length,2);
  assert.equal(next.elements.length,1);
});

test('rare bonus is inserted once, with its own category and recipe, without extra AI generation',()=>{
  const outcome=response('Robot',{bonus:{result:'Silver Robot',emoji:'🤖',variantOf:'Robot',explanation:'An alternate discovery.'}});
  const first=applySharedPairDiscovery([],outcome,'Metal','Circuit',common,50);
  assert.equal(first.bonus?.name,'Silver Robot');
  assert.equal(first.main.name,'Robot');
  assert.equal(first.elements.length,2);
  const second=applySharedPairDiscovery(first.elements,outcome,'Circuit','Metal',common,60);
  assert.equal(second.bonus,undefined);
  assert.equal(second.elements.length,2);
  assert.equal(second.main.craftCount,2);
  assert.ok(validateCraft(second.elements));
});

test('Foundry specialized transformations retain their own categories but use shared collection quality and rarity',()=>{
  const built=applySharedPairDiscovery([],{...response('Silver Solvent'),category:'Alchemy'},'Stone','Distill',common,77);
  assert.equal(built.main.category,'Alchemy');
  assert.equal(built.main.recipe?.second,'Distill');
  const oddkin=applySharedPairDiscovery([],{...response('Flickerbeast'),category:'Oddkin & Creatures'},'Spark','Incubate',rare,88);
  assert.equal(oddkin.main.category,'Oddkin & Creatures');
  assert.equal(oddkin.main.unlockedShiny,true);
});

test('Craft and Foundry actually call the common resolver and common ledger',()=>{
  const craft=readFileSync(new URL('../src/components/InfiniteCraftView.tsx',import.meta.url),'utf8');
  const foundry=readFileSync(new URL('../src/lib/gameStore.tsx',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../src/components/WorkBench.tsx',import.meta.url),'utf8');
  const modal=readFileSync(new URL('../src/components/DiscoveryModal.tsx',import.meta.url),'utf8');
  const shared=readFileSync(new URL('../src/lib/sharedCraftingEngine.ts',import.meta.url),'utf8');
  for(const source of [craft,foundry]) {
    assert.match(source,/resolveSharedPair\(/);
    assert.match(source,/rollSharedPair\(/);
    assert.match(source,/applySharedPairDiscovery\(/);
  }
  assert.match(foundry,/isSharedMix\s*=\s*selectedProcess\.id\s*===\s*'MIX'/);
  assert.match(foundry,/saveCraftElements\(sharedRecord\.elements\)/);
  assert.match(foundry,/setSlotA\(null\); setSlotB\(null\)/);
  assert.match(shared,/SHARED_PAIR_ENGINE/);
  assert.match(ui,/process\?\.id === 'MIX' && !slotB/);
  assert.match(ui,/synthesisError/);
  assert.match(modal,/rollOddsCaption/);
  assert.match(modal,/RarityBadges/);
});
