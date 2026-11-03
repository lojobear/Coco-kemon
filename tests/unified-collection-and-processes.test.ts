import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeFoundryIntoCraft, discoveryIdentity } from '../src/lib/unifiedCollection';
import { STARTER_MATERIALS, ALL_PROCESSES, mergeProcesses } from '../src/lib/starterData';
import { EXPANDED_PROCESSES } from '../src/lib/expandedProcesses';
import { validateCraft } from '../src/lib/saveData';
import type { InfiniteElement } from '../src/lib/infiniteCraftData';
import type { Material, Oddkin } from '../src/types';

test('Craft preserves a previously discovered concept with art, Shiny status, and recipe/mastery history', () => {
  const original:InfiniteElement = {id:'water',name:'Water',emoji:'💧',isShiny:true,
    unlockedShiny:true,shinyCraftCount:17, craftCount:50, discoveredAt:12345,
    customSpriteUrl:'data:image/png;base64,'+'a'.repeat(100),
    recipeHistory:[{first:'Rain',second:'River',count:7,firstSeenAt:12345,lastSeenAt:19000}]};
  const materials=[{...STARTER_MATERIALS[0],displayName:' water ',discoveredAt:456},
    {...STARTER_MATERIALS[1],displayName:'Ancient Telescope',discoveredAt:21000,customSpriteUrl:undefined}];
  const merged=mergeFoundryIntoCraft([original],{materials});
  assert.equal(merged.filter(x=>discoveryIdentity(x.name)==='water').length,1);
  assert.equal(merged[0],original,'existing Craft entry must win unchanged');
  assert.equal(merged[0].recipeHistory?.[0].count,7);
  assert.equal(merged[0].customSpriteUrl,original.customSpriteUrl);
  assert.equal(merged[0].unlockedShiny,true);
  assert.equal(merged[0].craftCount,50);
  assert.equal(merged.find(x=>x.name==='Ancient Telescope')?.discoveredAt,21000);
  assert.ok(validateCraft(merged));
  assert.equal(mergeFoundryIntoCraft(merged,{materials}),merged,'migration must be idempotent');
});
test('Foundry-only Oddkin are discoverable in Craft without deleting their Foundry identity',()=>{
  const creature={speciesName:'Moon Glider',description:'A luminous mothlike specimen.'} as Oddkin;
  const craft=mergeFoundryIntoCraft([], {oddkinCollection:[creature]});
  assert.equal(craft.length,1);
  assert.equal(craft[0].name,'Moon Glider');
  assert.equal(craft[0].emoji,'🐾');
  assert.equal(craft[0].connection,'Oddkin');
  assert.ok(validateCraft(craft));
});
test('Unified collection refuses oversized artwork instead of corrupting saves',()=>{
  const huge='data:image/png;base64,'+'a'.repeat(150000);
  const materials=[{...STARTER_MATERIALS[0],displayName:'Massive Art',customSpriteUrl:huge}];
  const saved=mergeFoundryIntoCraft([],{materials});
  assert.equal(saved[0].customSpriteUrl,undefined);
  assert.ok(validateCraft(saved));
});
test('Expanded Foundry catalog contains 124 genuinely distinct named processes across seven categories',()=>{
  assert.equal(EXPANDED_PROCESSES.length,124);
  const ids=ALL_PROCESSES.map(p=>p.id);
  assert.equal(new Set(ids).size,ids.length,'No process ID may collide across existing sets');
  assert.equal(new Set(EXPANDED_PROCESSES.map(p=>p.name)).size,124);
  assert.deepEqual([...new Set(EXPANDED_PROCESSES.map(p=>p.category))].sort(),
    ['Alchemical','Biological','Electromagnetic','Mechanical','Pressure','Temporal','Thermal']);
  for(const p of EXPANDED_PROCESSES){
    assert.ok(p.verb.length>18);
    assert.ok(p.description.length>30);
    assert.equal(p.unlocked,true);
  }
  const original=mergeProcesses([{...ALL_PROCESSES.find(p=>p.id==='POLISH')!,unlocked:true}]);
  assert.equal(original.find(p=>p.id==='POLISH')?.unlocked,true);
  assert.ok(original.some(p=>p.id==='TELEPORT'));
  assert.equal(original.length,ALL_PROCESSES.length);
});
test('Foundry and Craft share the exact same pair resolver for MIX',()=>{
  const api=readFileSync(new URL('../server.ts', import.meta.url),'utf8');
  const store=readFileSync(new URL('../src/lib/gameStore.tsx', import.meta.url),'utf8');
  const foundry=readFileSync(new URL('../src/components/WorkBench.tsx', import.meta.url),'utf8');
  const craft=readFileSync(new URL('../src/components/InfiniteCraftView.tsx', import.meta.url),'utf8');
  assert.match(api,/normProc === 'MIX' && inputMaterialB[\s\S]*?resolveInfiniteCraftPair\(/);
  assert.match(api,/app\.get\('\/api\/infinite-craft\/pair'/);
  assert.match(store,/selectedProcess\.id === 'MIX' \? undefined/);
  assert.match(foundry,/SAVE_CHANGED_EVENT/);
  assert.match(craft,/window\.addEventListener\(SAVE_CHANGED_EVENT/);
  assert.match(foundry,/processGroups\.map\(/);
  assert.match(foundry,/Find a Foundry process/);
});
