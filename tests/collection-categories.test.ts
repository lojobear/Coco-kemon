import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { categoryForDiscovery, collectionCategoryCounts, canonicalCollectionCategory } from '../src/lib/collectionCategories';
import { mergeFoundryIntoCraft } from '../src/lib/unifiedCollection';
import { mergeSharedDiscoveries } from '../src/lib/sharedDiscoveries';
import { conceptMaterial } from '../src/lib/conceptMaterial';
import { collectKitchenStep } from '../src/lib/kitchen/engine';
import { validateCraft } from '../src/lib/saveData';
import type { InfiniteElement } from '../src/lib/infiniteCraftData';

const craft = (name:string, category?:string):InfiniteElement => ({id:'id_'+name.toLowerCase().replaceAll(' ','_'),name,emoji:'✨', ...(category?{category}:{})});

test('collection categories put discoveries in meaningful reusable shelves',()=>{
  assert.equal(categoryForDiscovery({name:'Pikachu'}),'Characters');
  assert.equal(categoryForDiscovery({name:'Toaster Strudel',connection:'wordplay'}),'Food & Drink');
  assert.equal(categoryForDiscovery({name:'Robot',connection:'biology'}),'Technology');
  assert.equal(categoryForDiscovery({name:'Fox'}),'Animals');
  assert.equal(categoryForDiscovery({name:'Water'}),'Elements & Energy');
  assert.equal(categoryForDiscovery({name:'Glass'}),'Materials & Minerals');
  assert.equal(categoryForDiscovery({name:'Dragon',connection:'mythology'}),'Fantasy & Mythology');
  assert.equal(categoryForDiscovery({name:'Ferrum Hopper',connection:'function'}),'Hoppers');
  assert.equal(categoryForDiscovery({name:'Luminous Hopper',connection:'appearance'}),'Hoppers');
  assert.equal(categoryForDiscovery({name:'Zorblax'}),'Zorblax Family');
});

test('unrecognized meaningful Foundry categories become new named categories, not misc',()=>{
  assert.equal(categoryForDiscovery({name:'Ferrum Hopper',category:'Invented Machinery'}),'Invented Machinery');
  assert.equal(categoryForDiscovery({name:'Pebble',category:'Mineral'}),'Materials & Minerals');
  assert.equal(categoryForDiscovery({name:'Spark',category:'Energy'}),'Elements & Energy');
  assert.equal(categoryForDiscovery({name:'Fancy Name',category:'Miscellaneous'}),'Names');
  assert.equal(canonicalCollectionCategory('too many words for an arbitrary paragraph'),undefined);
  assert.equal(canonicalCollectionCategory('  made-up   artifacts '),'Made-Up Artifacts');
  assert.equal(categoryForDiscovery({name:'Luminous Hopper',category:'Invented Machinery'}),'Invented Machinery');
});

test('category list is derived automatically without a separate mutable registry',()=>{
  const owned=[craft('Fox'),craft('Pizza'),craft('Ferrum Hopper'),craft('Luminous Hopper'),craft('Zorblax')];
  const original=JSON.stringify(owned);
  const cats=collectionCategoryCounts(owned);
  assert.deepEqual(cats.map(x=>[x.name,x.count]),[
    ['Animals',1],['Food & Drink',1],['Hoppers',2],['Zorblax Family',1],
  ]);
  assert.equal(JSON.stringify(owned),original);
});

test('save validation accepts a category without changing legacy saves or artwork',()=>{
  assert.ok(validateCraft([craft('Ferrum Hopper','Hoppers')]));
  assert.ok(validateCraft([craft('Old Item')]));
  assert.equal(validateCraft([craft('Bad', 'x'.repeat(37))]),false);
});

test('Foundry and Kitchen discoveries are automatically classified and safely projected into Craft',()=>{
  const material=conceptMaterial({result:'Luminous Hopper',emoji:'✨',connection:'function'});
  assert.equal(material.category,'Hoppers');
  const projected=mergeFoundryIntoCraft([craft('Water')],{materials:[material]});
  assert.equal(projected.length,2);
  assert.equal(projected[1].category,'Hoppers');
  assert.equal(projected[0].name,'Water');
  assert.equal(mergeSharedDiscoveries([craft('Water')],[material])[1].category,'Hoppers');
  const kitchen=collectKitchenStep([craft('Water')],{
    outputName:'Toaster Strudel',outputEmoji:'🥐',category:'Food',inputs:['Water'],
    toolName:'mix',explanation:'A pastry', 
  } as any);
  assert.equal(kitchen[1].category,'Food & Drink');
  assert.equal(kitchen[0].name,'Water');
});

test('all three discovery flows and the collection UI preserve category metadata',()=>{
  const album=readFileSync(new URL('../src/components/CollectionAlbum.tsx',import.meta.url),'utf8');
  const craftSource=readFileSync(new URL('../src/components/InfiniteCraftView.tsx',import.meta.url),'utf8');
  const kitchenSource=readFileSync(new URL('../src/lib/kitchen/engine.ts',import.meta.url),'utf8');
  const foundrySource=readFileSync(new URL('../src/components/WorkBench.tsx',import.meta.url),'utf8');
  assert.match(craftSource,/category: categoryForDiscovery\(\{ name: cleanName/);
  assert.match(craftSource,/category: categoryForDiscovery\(\{ name: bonus.result/);
  assert.match(kitchenSource,/category: categoryForDiscovery\(\{ name: step.outputName/);
  assert.match(foundrySource,/const categories = useMemo\(/);
  assert.match(album,/aria-label="Collection category"/);
  assert.match(album,/boop-album-category-section/);
  assert.match(album,/visibleGroups\.map/);
  assert.match(album,/\{categoryCounts.length\} discovered categories/);
});
