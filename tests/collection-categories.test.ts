import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { categoryForDiscovery, collectionCategoryCounts, canonicalCollectionCategory, collectionDisplayCategory, buildCollectionCategoryIndex, indexedCategory, FALLBACK_CATEGORY } from '../src/lib/collectionCategories';
import { mergeFoundryIntoCraft } from '../src/lib/unifiedCollection';
import { mergeSharedDiscoveries } from '../src/lib/sharedDiscoveries';
import { conceptMaterial } from '../src/lib/conceptMaterial';
import { collectKitchenStep } from '../src/lib/kitchen/engine';
import { validateCraft } from '../src/lib/saveData';
import type { InfiniteElement } from '../src/lib/infiniteCraftData';

const craft = (name:string, category?:string):InfiniteElement => ({id:'id_'+name.toLowerCase().replaceAll(' ','_'),name,emoji:'✨', ...(category?{category}:{})});

test('collection display corrects stale standard categories using the subject without changing save identity', () => {
  for (const [name, category, expected] of [
    ['Biochar', 'Animals', 'Materials & Minerals'],
    ['Charcoal', 'Animals', 'Materials & Minerals'],
    ['Cat Food', 'Animals', 'Food & Drink'],
    ['Fire Truck', 'Elements & Energy', 'Vehicles'],
    ['Cloud Server', 'Weather & Climate', 'Technology'],
    ['Moon Cake', 'Space & Cosmos', 'Food & Drink'],
    ['Robot', 'Animals', 'Technology'],
    ['Golden Fox', 'Materials & Minerals', 'Animals'],
    ['Wind', 'Elements & Energy', 'Elements & Energy'],
    ['Golden Fox', 'Custom Creatures', 'Animals'],
  ]) {
    const item = { name, category };
    assert.equal(collectionDisplayCategory(item), expected, name);
    assert.equal(item.category, category);
  }
});

test('biology metadata does not imply an animal', () => {
  assert.equal(collectionDisplayCategory({ name: 'Biochar', connection: 'biology' }), 'Materials & Minerals');
  assert.equal(categoryForDiscovery({ name: 'Biochar', category: 'Biological' }), 'Materials & Minerals');
  assert.equal(collectionDisplayCategory({ name: 'Biochar', category: 'Biological' }), 'Materials & Minerals');
  assert.equal(categoryForDiscovery({ name: 'Unidentified specimen', connection: 'biology' }), 'Science & Medicine');
  assert.equal(categoryForDiscovery({ name: 'Fox', connection: 'biology' }), 'Animals');
});

test('collection categories put discoveries in meaningful reusable shelves',()=>{
  assert.equal(categoryForDiscovery({name:'Pikachu'}),'Characters');
  assert.equal(categoryForDiscovery({name:'Toaster Strudel',connection:'wordplay'}),'Food & Drink');
  assert.equal(categoryForDiscovery({name:'Robot',connection:'biology'}),'Technology');
  assert.equal(categoryForDiscovery({name:'Fox'}),'Animals');
  assert.equal(categoryForDiscovery({name:'Water'}),'Elements & Energy');
  assert.equal(categoryForDiscovery({name:'Glass'}),'Materials & Minerals');
  assert.equal(categoryForDiscovery({name:'Dragon',connection:'mythology'}),'Fantasy & Mythology');
  assert.equal(categoryForDiscovery({name:'Ferrum Hopper',connection:'function'}),FALLBACK_CATEGORY);
  assert.equal(categoryForDiscovery({name:'Luminous Hopper',connection:'appearance'}),FALLBACK_CATEGORY);
  assert.equal(categoryForDiscovery({name:'Zorblax'}),FALLBACK_CATEGORY);
});

test('unrecognized Foundry categories remain grouped until there is a real family',()=>{
  assert.equal(categoryForDiscovery({name:'Ferrum Hopper',category:'Invented Machinery'}),FALLBACK_CATEGORY);
  assert.equal(categoryForDiscovery({name:'Pebble',category:'Mineral'}),'Materials & Minerals');
  assert.equal(categoryForDiscovery({name:'Spark',category:'Energy'}),'Elements & Energy');
  assert.equal(categoryForDiscovery({name:'Fancy Name',category:'Miscellaneous'}),FALLBACK_CATEGORY);
  assert.equal(canonicalCollectionCategory('too many words for an arbitrary paragraph'),undefined);
  assert.equal(canonicalCollectionCategory('  made-up   artifacts '),'Made-Up Artifacts');
  assert.equal(categoryForDiscovery({name:'Luminous Hopper',category:'Invented Machinery'}),FALLBACK_CATEGORY);
});

test('category list is derived automatically without a separate mutable registry',()=>{
  const owned=[craft('Fox'),craft('Pizza'),craft('Ferrum Hopper'),craft('Luminous Hopper'),craft('Zorblax')];
  const original=JSON.stringify(owned);
  const cats=collectionCategoryCounts(owned);
  assert.deepEqual(cats.map(x=>[x.name,x.count]),[
    ['Animals',1],['Food & Drink',1],[FALLBACK_CATEGORY,3],
  ]);
  assert.equal(JSON.stringify(owned),original);
});

test('collection view repairs automatic and incorrect old shelves without touching saves',()=>{
  const old = {name:'Golden Fox',category:'Foxes'};
  const before = JSON.stringify(old);
  assert.equal(collectionDisplayCategory(old),'Animals');
  assert.equal(collectionDisplayCategory({name:'Golden Fox',category:'Custom Creatures'}),'Animals');
  assert.equal(collectionDisplayCategory({name:'Ferrum Hopper',category:'Hoppers'}),FALLBACK_CATEGORY);
  assert.equal(collectionDisplayCategory({name:'Moon Cake',category:'Cakes'}),'Food & Drink');
  assert.equal(JSON.stringify(old),before);
});

test('save validation accepts a category without changing legacy saves or artwork',()=>{
  assert.ok(validateCraft([craft('Ferrum Hopper','Hoppers')]));
  assert.ok(validateCraft([craft('Old Item')]));
  assert.equal(validateCraft([craft('Bad', 'x'.repeat(37))]),false);
});

test('Foundry and Kitchen discoveries are automatically classified and safely projected into Craft',()=>{
  const material=conceptMaterial({result:'Luminous Hopper',emoji:'✨',connection:'function'});
  assert.equal(material.category,FALLBACK_CATEGORY);
  const projected=mergeFoundryIntoCraft([craft('Water')],{materials:[material]});
  assert.equal(projected.length,2);
  assert.equal(projected[1].category,FALLBACK_CATEGORY);
  assert.equal(projected[0].name,'Water');
  assert.equal(mergeSharedDiscoveries([craft('Water')],[material])[1].category,FALLBACK_CATEGORY);
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
  const sharedSource=readFileSync(new URL('../src/lib/sharedCraftingEngine.ts',import.meta.url),'utf8');
  const kitchenSource=readFileSync(new URL('../src/lib/kitchen/engine.ts',import.meta.url),'utf8');
  const foundrySource=readFileSync(new URL('../src/components/WorkBench.tsx',import.meta.url),'utf8');
  assert.match(craftSource,/applySharedPairDiscovery\(/);
  assert.match(sharedSource,/category: categoryForDiscovery\(\{ name, category: outcome.category/);
  assert.match(sharedSource,/category: categoryForDiscovery\(\{ name: rare.result/);
  assert.match(kitchenSource,/category: categoryForDiscovery\(\{ name: step.outputName/);
  assert.match(foundrySource,/const categories = useMemo\(/);
  assert.match(album,/aria-label="Collection category"/);
  assert.match(album,/boop-album-category-section/);
  assert.match(album,/visibleGroups\.map/);
  assert.match(album,/\{categoryCounts.length\} discovered categories/);
});

test('new families appear only with three distinct unknown concepts; duplicates and filtering cannot manufacture categories',()=>{
 const items=[craft('Ferrum Hopper','Hoppers'),craft('Luminous Hopper','Hopper Family'),craft('Zorblax'),craft('Blue Hopper','Hoppers'),craft('Golden Fox','Foxes'),craft('Cat Food','Animals')];
 const before=JSON.stringify(items);
 const index=buildCollectionCategoryIndex(items);
 assert.equal(indexedCategory(items[0],index),'Hoppers');
 assert.equal(indexedCategory(items[1],index),'Hoppers');
 assert.equal(indexedCategory(items[2],index),FALLBACK_CATEGORY);
 assert.deepEqual(collectionCategoryCounts(items,index).map(x=>[x.name,x.count]),[['Animals',1],['Food & Drink',1],['Hoppers',3],[FALLBACK_CATEGORY,1]]);
 assert.deepEqual(collectionCategoryCounts([items[0]],index),[{name:'Hoppers',count:1}]);
 assert.equal(indexedCategory(items[0],buildCollectionCategoryIndex([items[0],items[0],items[1]])),FALLBACK_CATEGORY);
 assert.deepEqual([...buildCollectionCategoryIndex([...items].reverse()).entries()].sort(),[...index.entries()].sort());
 assert.equal(JSON.stringify(items),before);
 const singletons=Array.from({length:100},(_,i)=>craft('Unknown '+i,'Category '+i));
 assert.deepEqual(collectionCategoryCounts(singletons),[{name:FALLBACK_CATEGORY,count:100}]);
});
test('recognized names and subject nouns beat stale or misleading labels',()=>{
 const examples=[
  ['Fire Truck','Elements & Energy','Vehicles'],['Cat Food','Animals','Food & Drink'],
  ['Hot Dog','Animals','Food & Drink'],['Moon Cake','Space & Cosmos','Food & Drink'],
  ['Cloud Server','Weather & Climate','Technology'],['Gold Dragon','Materials & Minerals','Fantasy & Mythology'],['Golden Fox','Characters','Animals'],
  ['Tim Hortons','Food & Drink','Brands'],['Minecraft','Materials & Minerals','Games & Toys'],
  ['Winnie the Pooh','Animals','Characters'],['WALL-E','Technology','Characters'],
  ['Ghost Ship','Vehicles','Fantasy & Mythology'],['Snow Globe','Weather & Climate','Tools & Objects'],
  ['Doctor','Science & Medicine','People & Professions'],['Hockey Puck','Materials & Minerals','Sports & Recreation'],
  ['Running Shoes','Vehicles','Clothing & Accessories'],['Plastic Figurine','Materials & Minerals','Games & Toys'],
  ['Prism','Materials & Minerals','Science & Medicine'],['Clock','Technology','Tools & Objects'],
  ['Black Hole','Science & Medicine','Space & Cosmos'],['Water','Weather & Climate','Elements & Energy'],
  ['Mouse (computer)','Animals','Technology'],['Python (snake)','Technology','Animals'],
 ];
 for(const [name,category,expected] of examples)assert.equal(categoryForDiscovery({name,category}),expected,name);
});
test('legacy meaningful custom shelves also need three unrelated-to-standard subjects',()=>{
 const items=['Zorblax','Quivox','Marnix'].map(name=>craft(name,'Invented Wonders'));
 assert.deepEqual(collectionCategoryCounts(items),[{name:'Invented Wonders',count:3}]);
 assert.deepEqual(collectionCategoryCounts(items.slice(0,2)),[{name:FALLBACK_CATEGORY,count:2}]);
});
