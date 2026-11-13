import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STARTER_ELEMENTS, type InfiniteElement, makePairKey } from '../src/lib/infiniteCraftData';
import { planAdvancedFusion, applyAdvancedFusion } from '../src/lib/advancedFusion';
import { validateCraft } from '../src/lib/saveData';
import { buildCollectionPassport, passportTotals } from '../src/lib/collectionPassport';
import { buildDiscoveryFamily } from '../src/lib/discoveryFamily';
import { smartSpawnPool, smartSpawnCategories, chooseUntriedPair } from '../src/lib/smartRandomizer';

const file=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const el=(name:string,extras:Partial<InfiniteElement>={}):InfiniteElement=>({
  id:name.toLowerCase().replace(/ /g,'_'),name,emoji:'✨',...extras,
});
const safeRoll={shiny:false,celestial:false,holo:false,glitch:false,tier:'common' as const};

test('Advanced Fusion plans a real three-element chain without an AI call',()=>{
  const plan=planAdvancedFusion(['Water','Fire','Wind'],STARTER_ELEMENTS);
  assert.ok(plan);
  assert.equal(plan.steps.length,2);
  assert.equal(plan.result,'Cloud');
  assert.deepEqual(plan.steps.map(step=>step.result),['Steam','Cloud']);
  const recorded=applyAdvancedFusion(STARTER_ELEMENTS,plan,[safeRoll,safeRoll],1000);
  assert.equal(recorded.newDiscoveries,2);
  assert.equal(recorded.final.name,'Cloud');
  assert.ok(recorded.elements.find(item=>item.name==='Steam'));
  assert.ok(recorded.elements.find(item=>item.name==='Cloud')?.recipeHistory?.some(
    recipe=>makePairKey(recipe.first,recipe.second)===makePairKey('Steam','Wind')));
  assert.equal(validateCraft(recorded.elements),true);
  assert.equal(STARTER_ELEMENTS.length,4);
});

test('Advanced Fusion handles four ingredients, repeated crafts, and old sprite preservation',()=>{
  const inputs=[...STARTER_ELEMENTS,el('Cloud',{customSpriteUrl:'data:image/png;base64,AAAA'})];
  const plan=planAdvancedFusion(['Water','Fire','Wind','Cloud'],inputs);
  assert.ok(plan);
  assert.equal(plan.steps.length,3);
  assert.equal(plan.result,'Thunderstorm');
  const saved=applyAdvancedFusion(inputs,plan,[safeRoll,safeRoll,safeRoll],2000);
  assert.equal(saved.elements.find(item=>item.name==='Cloud')?.customSpriteUrl,'data:image/png;base64,AAAA');
  const again=applyAdvancedFusion(saved.elements,plan,[safeRoll,safeRoll,safeRoll],3000);
  assert.equal(again.newDiscoveries,0);
  assert.equal(again.final.name,'Thunderstorm');
  assert.ok((again.final.craftCount||0)>(saved.final.craftCount||0));
  assert.equal(new Set(again.elements.map(item=>item.id)).size,again.elements.length);
});

test('Advanced Fusion rejects unowned, incomplete or disconnected chains',()=>{
  assert.equal(planAdvancedFusion(['Water','Fire'],STARTER_ELEMENTS),null);
  assert.equal(planAdvancedFusion(['Water','Fire','Not owned'],STARTER_ELEMENTS),null);
  assert.equal(planAdvancedFusion(['Water','Water','Water','Water','Fire'],STARTER_ELEMENTS),null);
  const source=file('src/lib/advancedFusion.ts');
  assert.doesNotMatch(source,/requestJson\(|fetch\(|resolveSharedPair\(|enqueueArtwork\(/);
  assert.match(source,/applySharedPairDiscovery\(/);
});

test('Collection Passport awards earned medals from existing items with no save changes',()=>{
  const blank=buildCollectionPassport([]);
  assert.equal(blank.length,6);
  assert.equal(blank[0].medal,'Unstarted');
  const ocean=['Water','Ocean','Sea','Coral','Fish','Shark','Whale','Pearl'];
  const bronze=buildCollectionPassport(ocean.slice(0,2).map(name=>el(name)));
  assert.equal(bronze[0].medal,'Bronze');
  const silver=buildCollectionPassport(ocean.slice(0,4).map(name=>el(name)));
  assert.equal(silver[0].medal,'Silver');
  const gold=buildCollectionPassport(ocean.map(name=>el(name)));
  assert.equal(gold[0].medal,'Gold');
  assert.equal(gold[0].complete,true);
  const platinum=buildCollectionPassport(ocean.map(name=>el(name,{unlockedShiny:true})));
  assert.equal(platinum[0].medal,'Platinum');
  assert.equal(platinum[0].shinyCount,8);
  assert.deepEqual(passportTotals(platinum),{stamps:1,completed:1,platinum:1,total:6});
  assert.equal(ocean.length,8);
});

test('Discovery Family Trees follow saved parents and descendants up to two generations',()=>{
  const owned=[
    ...STARTER_ELEMENTS,
    el('Steam',{recipe:{first:'Water',second:'Fire'}}),
    el('Cloud',{recipeHistory:[{first:'Steam',second:'Wind',count:2,firstSeenAt:1,lastSeenAt:2}]}),
    el('Rain',{recipe:{first:'Cloud',second:'Earth'}}),
    el('Rainbow',{recipe:{first:'Rain',second:'Sun'}}),
  ];
  const family=buildDiscoveryFamily('Cloud',owned);
  assert.ok(family.ancestors.some(node=>node.name==='Steam'&&node.depth===1));
  assert.ok(family.ancestors.some(node=>node.name==='Fire'&&node.depth===2));
  assert.ok(family.descendants.some(node=>node.name==='Rain'&&node.depth===1));
  assert.ok(family.descendants.some(node=>node.name==='Rainbow'&&node.depth===2));
  assert.equal(family.recipes[0].count,2);
  const cycle=buildDiscoveryFamily('A',[el('A',{recipe:{first:'B',second:'Water'}}),el('B',{recipe:{first:'A',second:'Fire'}})]);
  assert.ok(cycle.ancestors.length<=28);
});

test('Smart Randomizer filters owned items by source/category/minimum rarity',()=>{
  const items=[
    el('Water',{rarityTier:'common'}),
    el('Fire',{rarityTier:'rare'}),
    el('Dragon',{rarityTier:'legendary',unlockedShiny:true,discoveredAt:100}),
    el('Unicorn',{rarityTier:'epic',discoveredAt:101}),
  ];
  const rare=smartSpawnPool(items,{source:'all',category:'all',rarity:'rare'});
  assert.deepEqual(new Set(rare.map(x=>x.name)),new Set(['Fire','Dragon','Unicorn']));
  const shiny=smartSpawnPool(items,{source:'shiny',category:'all',rarity:'all'});
  assert.deepEqual(shiny.map(x=>x.name),['Dragon']);
  const epic=smartSpawnPool(items,{source:'all',category:'all',rarity:'legendary'});
  assert.deepEqual(epic.map(x=>x.name),['Dragon']);
  const empty=smartSpawnPool(items,{source:'starters',category:'all',rarity:'legendary'});
  assert.deepEqual(empty,[]);
});

test('Smart Randomizer untried pair tool excludes recorded recipes without calling AI',()=>{
  const items=[el('Water'),el('Fire')];
  const known=[el('Steam',{recipe:{first:'Water',second:'Fire'}})];
  const candidate=chooseUntriedPair(items,known,()=>0);
  assert.ok(candidate);
  assert.notEqual(makePairKey(candidate[0].name,candidate[1].name),makePairKey('Water','Fire'));
  const all=[
    el('Lake',{recipe:{first:'Water',second:'Water'}}),
    el('Volcano',{recipe:{first:'Fire',second:'Fire'}}),
    ...known,
  ];
  assert.equal(chooseUntriedPair(items,all),null);
  assert.match(file('src/lib/smartRandomizer.ts'),/uniformRandomIndex/);
  assert.doesNotMatch(file('src/lib/smartRandomizer.ts'),/requestJson\(|fetch\(/);
});

test('New feature UI is reachable from Craft, Foundry, and Collection',()=>{
  const craft=file('src/components/InfiniteCraftView.tsx');
  const foundry=file('src/components/WorkBench.tsx');
  const album=file('src/components/CollectionAlbum.tsx');
  assert.match(craft,/AdvancedFusionModal/);
  assert.match(craft,/chooseUntriedPair\(spawnPool,sharedElements\)/);
  assert.match(craft,/aria-label="Random spawn category"/);
  assert.match(craft,/aria-label="Random spawn rarity"/);
  assert.match(foundry,/boop-open-advanced-fusion/);
  assert.match(album,/buildCollectionPassport\(catalog\)/);
  assert.match(album,/buildDiscoveryFamily\(selected\.name,catalog\)/);
  assert.match(album,/boop-family-tree/);
  assert.match(album,/boop-passport-medal/);
  assert.match(file('src/boop.css'),/\.boop-feature-modal/);
});

test('Randomizer uses the same promoted shelves and counts even with rarity and source filters',()=>{
 const items=[el('Ferrum Hopper',{rarityTier:'rare'}),el('Luminous Hopper',{rarityTier:'common'}),el('Blue Hopper',{rarityTier:'common'}),el('Cat Food',{category:'Animals',rarityTier:'rare'}),el('Fox',{rarityTier:'common'})];
 const categories=smartSpawnCategories(items,{source:'all',rarity:'rare'});
 assert.deepEqual(categories,[{name:'Food & Drink',count:1},{name:'Hoppers',count:1}]);
 assert.deepEqual(smartSpawnPool(items,{source:'all',rarity:'rare',category:'Hoppers'}).map(x=>x.name),['Ferrum Hopper']);
 assert.deepEqual(smartSpawnPool(items,{source:'all',rarity:'all',category:'Food & Drink'}).map(x=>x.name),['Cat Food']);
});
