import test from 'node:test';
import assert from 'node:assert/strict';
import { baseElementValue, elementValue, elementValueCriteria, buildCollectionValueBook, elementValueKey, RARITY_VALUE_MULTIPLIERS, FORM_VALUE_MULTIPLIERS, VALUE_VERSION } from '../src/lib/elementValue';
import { RARITY_TIERS } from '../src/lib/rarity';
import type { InfiniteElement } from '../src/lib/infiniteCraftData';
import { parseSave } from '../src/lib/saveData';
import { STARTER_MATERIALS, ALL_PROCESSES, INITIAL_HABITATS } from '../src/lib/starterData';
const foundry = { materials: STARTER_MATERIALS, oddkinCollection: [], processes: ALL_PROCESSES, habitats: INITIAL_HABITATS, experiments: [] };

const water: InfiniteElement = { id: 'water', name: 'Water', emoji: '💧' };

test('every existing and generated concept gets a deterministic positive whole-coin value', () => {
  const names = ['Water', 'Fire', 'Wind', 'Earth', 'Temporal Pancake', '月', '🪐', ''];
  for (let i = 0; i < 200; i++) names.push(`Future element ${i}`);
  for (const name of names) {
    const value = elementValue({ ...water, name });
    assert.ok(Number.isSafeInteger(value.coins) && value.coins >= 25 && value.coins <= 6000);
    assert.equal(elementValue({ ...water, name }).coins, value.coins);
  }
  assert.equal(baseElementValue('  WATER  '), baseElementValue('Water'));
  assert.equal(baseElementValue('Sea  Lion'), baseElementValue('sea lion'));
  assert.equal(baseElementValue('Ｗａｔｅｒ'), baseElementValue('Water'));
});

test('rarer tiers and forms increase a concept’s value without stacking unlocked finishes', () => {
  let previous = 0;
  for (const tier of RARITY_TIERS) {
    const item = { ...water, rarityTier: tier.id, unlockedShiny: true, unlockedHolo: true,
      unlockedCelestial: true, unlockedGlitch: true };
    const base = elementValue(item, 'normal');
    assert.ok(base.coins > previous);
    previous = base.coins;
    for (const variant of ['normal','shiny','holo','celestial','glitch'] as const) {
      assert.equal(elementValue(item, variant).coins,
        baseElementValue('Water') * RARITY_VALUE_MULTIPLIERS[tier.id] * FORM_VALUE_MULTIPLIERS[variant]);
    }
    assert.equal(elementValue(item).variant, 'glitch');
    assert.equal(elementValue(item).coins, base.coins * 15);
    assert.ok(elementValue(item).coins <= 25_000_000);
  }
});

test('locked forms and editable activity metadata cannot inflate the quote', () => {
  assert.equal(elementValue(water, 'glitch').variant, 'normal');
  assert.equal(elementValue(water, 'shiny').coins, elementValue(water).coins);
  const changed = { ...water, id: 'new-id', emoji: '🔥', craftCount: 999999, isNew: true,
    discoveredAt: Date.now(), customSpriteUrl: 'data:image/png;base64,AAAA', value: 99999999 };
  assert.equal(elementValue(changed).coins, elementValue(water).coins);
  assert.equal(elementValue({ ...water, shinyCraftCount: 1 }).variant, 'shiny');
});

test('old saves need no migration and backup imports preserve quoted values and selected forms', () => {
  const element: InfiniteElement = { ...water, rarityTier: 'rare', unlockedShiny: true, unlockedGlitch: true };
  const serialized = JSON.stringify({ version: 2, crafting: [element], foundry });
  const restored = parseSave(serialized).crafting![0];
  assert.deepEqual(elementValue(restored), elementValue(element));
  assert.equal(elementValue(restored, 'shiny').coins, elementValue(element, 'shiny').coins);
  assert.equal(Object.hasOwn(restored, 'value'), false);
  assert.ok(elementValue(parseSave(JSON.stringify({ version: 2, crafting: [water], foundry })).crafting![0]).coins > 0);
});


test('v2 value criteria reward real concept characteristics without depending on IDs or device timestamps',()=>{
  assert.equal(VALUE_VERSION,2);
  const simple=elementValueCriteria('Water');
  const compound=elementValueCriteria('Ancient Crystal Dragon');
  assert.equal(simple.words,1);
  assert.equal(compound.words,3);
  assert.ok(compound.complexityBonus > simple.complexityBonus);
  assert.equal(simple.canonicalSteps,0);
  assert.equal(elementValueCriteria('Steam').canonicalSteps,1);
  assert.equal(elementValueCriteria('Cloud').canonicalSteps,2);
  assert.ok(elementValueCriteria('Water').category.length>0);
  assert.ok(elementValueCriteria('Dragon').category.length>0);
  assert.equal(baseElementValue('  WATER '),baseElementValue('Water'));
  assert.notEqual(baseElementValue('Water'),baseElementValue('Cloud'));
  const item={...water,category:'Mysterious',recipe:{first:'Poison',second:'Banana'},id:'different',craftCount:300};
  assert.equal(elementValue(item).coins,elementValue(water).coins);
});

test('collection price book guarantees distinct prices across names and all five forms, even after collisions',()=>{
  // Thousands of identically structured generated concepts intentionally force
  // several raw-price collisions while covering the real future-discovery case.
  const items=Array.from({length:2200},(_,index):InfiniteElement=>({
    id:'item-'+index,name:'Token '+String(index).padStart(5,'0'),emoji:'🧩',
    rarityTier:index%9===0?'rare':'common',
    unlockedShiny:true,unlockedHolo:true,unlockedCelestial:true,unlockedGlitch:true,
  }));
  const book=buildCollectionValueBook(items);
  assert.equal(book.size,items.length*5);
  assert.equal(new Set(book.values()).size,book.size);
  assert.ok([...book.values()].every(x=>Number.isSafeInteger(x)&&x>0));
  assert.deepEqual([...book.entries()], [...buildCollectionValueBook([...items].reverse()).entries()]);
  for(const item of [items[0],items[247],items[1700]]){
    for(const form of ['normal','shiny','holo','celestial','glitch'] as const){
      const quote=elementValue(item,form,book);
      assert.equal(quote.coins,book.get(elementValueKey(item.name,form)));
      assert.equal(quote.coins,quote.baseCoins*quote.rarityMultiplier*quote.formMultiplier+quote.uniquenessAdjustment);
    }
  }
});

test('normalized duplicates represent one concept but separate names get their own quotes',()=>{
  const items=[{...water,name:'Water'},
    {...water,id:'water-other',name:' ＷＡＴＥＲ '},
    {...water,id:'steam',name:'Steam'},
  ];
  const book=buildCollectionValueBook(items);
  assert.equal(book.size,10);
  assert.equal(elementValue(items[0],'normal',book).coins,elementValue(items[1],'normal',book).coins);
  assert.notEqual(elementValue(items[0],'normal',book).coins,elementValue(items[2],'normal',book).coins);
  const fromFields={...items[2],id:'changed',emoji:'🎲',discoveredAt:Date.now(),
    craftCount:9999,customSpriteUrl:'data:image/png;base64,AAAA'};
  assert.equal(elementValue(fromFields,'normal',book).coins,elementValue(items[2],'normal',book).coins);
});
