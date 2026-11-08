import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RARITY_DENOMINATOR, RARITY_TIERS, SHINY_ODDS, CELESTIAL_ODDS,
  HOLO_ODDS, GLITCH_ODDS, rollRarityTier, rollHolo, rollGlitch,
  bestRarity, rarityChanceLabel, rollOddsCaption, uniformRandomIndex,
} from '../src/lib/rarity';
import { rollCelestial, availableVariants, sanitizeTrophyRoom } from '../src/lib/collectorData';
import { chooseSpawnElements, spawnSourcePool } from '../src/lib/randomSpawn';
import { validateCraft } from '../src/lib/saveData';

test('rarity probabilities sum to exactly 10000 and each boundary is correct',()=>{
  assert.equal(RARITY_TIERS.reduce((sum,tier)=>sum+tier.weight,0),RARITY_DENOMINATOR);
  let boundary=0;
  for(const tier of RARITY_TIERS) {
    assert.equal(rollRarityTier(()=>boundary),tier.id);
    assert.equal(rollRarityTier(()=>boundary+tier.weight-1),tier.id);
    boundary+=tier.weight;
  }
  assert.equal(boundary,10000);
  assert.equal(rarityChanceLabel('common'),'60%');
  assert.equal(rarityChanceLabel('secret'),'0.01%');
  assert.throws(()=>rollRarityTier(()=>10000),/Invalid rarity/);
  assert.throws(()=>rollRarityTier(()=>-1),/Invalid rarity/);
  assert.equal(bestRarity('mythic','common'),'mythic');
  assert.equal(bestRarity(undefined,'secret'),'secret');
});

test('published independent finish odds are exact and cosmetic',()=>{
  assert.deepEqual([SHINY_ODDS,CELESTIAL_ODDS,HOLO_ODDS,GLITCH_ODDS],[512,4096,2048,8192]);
  assert.equal(rollHolo(()=>0),true);
  assert.equal(rollHolo(()=>1),false);
  assert.equal(rollGlitch(()=>0),true);
  assert.equal(rollGlitch(()=>8191),false);
  assert.equal(rollCelestial(()=>0),true);
  assert.equal(rollCelestial(()=>1/4096),false);
  const caption=rollOddsCaption('legendary',true,false,true,false);
  assert.match(caption,/Legendary 1\.2%/);
  assert.match(caption,/Shiny hit 1\/512/);
  assert.match(caption,/Holo hit 1\/2,048/);
  assert.match(caption,/Celestial 1\/4,096/);
});

test('first random spawn draw gives every owned concept exactly equal probability',()=>{
  const names=['Water','Fire','Earth','Wind','Cloud'];
  const owned=names.map((name,i)=>({id:String(i),name,emoji:'☁️'}));
  const source=[...owned, {id:'dupe',name:' water  ',emoji:'💧'}];
  const pool=spawnSourcePool(source,'all');
  assert.equal(pool.length,5);
  const outcomes=names.map((_,i)=>chooseSpawnElements(pool,1,()=>i/pool.length)[0].name);
  assert.deepEqual(outcomes,names);
  const picked=chooseSpawnElements(pool,5,()=>0);
  assert.equal(new Set(picked.map(item=>item.name)).size,5);
  assert.deepEqual(pool.map(x=>x.name),names);
  assert.equal(uniformRandomIndex(1),0);
  assert.throws(()=>uniformRandomIndex(0),/Invalid random/);
});

test('roll badges survive save and rare finishes unlock trophy appearances',()=>{
  const e={id:'nova',name:'Nova',emoji:'✨',rarityTier:'mythic' as const,
    unlockedShiny:true,unlockedCelestial:true,unlockedHolo:true,unlockedGlitch:true};
  assert.equal(validateCraft([e]),true);
  assert.equal(validateCraft([{...e,rarityTier:'not-a-tier'}]),false);
  assert.equal(validateCraft([{id:'old',name:'Old',emoji:'✨'}]),true);
  assert.deepEqual(availableVariants(e),['normal','shiny','celestial','holo','glitch']);
  const room=sanitizeTrophyRoom({theme:'gallery',slots:[{name:'Nova',variant:'glitch',frame:'holo'}]},[e]);
  assert.equal(room.slots[0]?.variant,'glitch');
});

test('every generated result displays odds above the bubble and collection renders new badges',()=>{
  const src=readFileSync(new URL('../src/components/InfiniteCraftView.tsx',import.meta.url),'utf8');
  const shared=readFileSync(new URL('../src/lib/sharedCraftingEngine.ts',import.meta.url),'utf8');
  const album=readFileSync(new URL('../src/components/CollectionAlbum.tsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/boop.css',import.meta.url),'utf8');
  assert.match(src,/rollSharedPair\(/);
  assert.match(shared,/rollRarityTier\(\)/);
  assert.match(shared,/bestRarity\(old\.rarityTier, rolls\.tier\)/);
  assert.match(src,/rollOddsCaption\(lastResult\.rarityTier/);
  assert.match(shared,/rarityDiscoveredAt: timestamp/);
  assert.match(shared,/rollHolo\(\)/);
  assert.match(shared,/rollGlitch\(\)/);
  assert.match(album,/RarityBadges item=\{item\}/);
  assert.match(album,/id:'legendary'/);
  assert.match(css,/\.boop-board-result > \.boop-board-roll-odds[\s\S]*?bottom:calc\(100% \+ 5px\)/);
});
