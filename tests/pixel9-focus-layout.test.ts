import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateFreshPixelArt, pixelArtFormFor } from '../src/lib/freshPixelArt';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Pixel 9 combination screen keeps the recipe visible while putting inventory in a bottom sheet',()=>{
  const page=source('src/components/WorkBench.tsx');
  const style=source('src/boop.css');
  assert.match(page,/boop-focus-recipe/);
  assert.match(page,/boop-combine-browse-toggle/);
  assert.match(page,/boop-combine-inventory/);
  assert.match(page,/boop-combine-backdrop/);
  assert.match(page,/boop-combine-quick-row/);
  assert.match(page,/onClick=\{\(\)=>selectItem\(item\)\}/);
  assert.match(page,/window.addEventListener\('boop-native-back'/);
  assert.match(style,/\.boop-combine-inventory\.is-open \{display:flex;/);
  assert.match(style,/height:min\(82dvh,760px\)/);
  assert.match(style,/\.boop-focus-recipe \.ingredient-pick/);
  assert.match(style,/@media\(max-width:600px\)/);
});
test('Board and combination page retain navigation and their working actions',()=>{
  const board=source('src/components/InfiniteCraftView.tsx');
  const combine=source('src/components/WorkBench.tsx');
  assert.match(board,/setActiveTab\('foundry'\)/);
  assert.match(board,/boop-mobile-craft-dock/);
  assert.match(board,/onPointerDown=\{e=>handlePointerDown\(item,e\)\}/);
  assert.match(board,/boop-board-viewport/);
  assert.match(combine,/setActiveTab\('infinite-craft'\)/);
  assert.match(combine,/void runSynthesis\(\)/);
  assert.match(combine,/setSlotA\(item\)/);
  assert.match(combine,/setSlotB\(item\)/);
});
test('Original semantic sprites replace emoji defaults without AI calls',()=>{
  const pairs: Array<[string,string]>=[
    ['Owl','owl'],['Deep Sea Jellyfish','jellyfish'],['Sailboat','sailboat'],
    ['Hot Air Balloon','balloon'],['Campfire','campfire'],['Healing Potion','potion'],
    ['Breakfast Food','breakfast'],['Hourglass','hourglass'],
    ['Magic Ring','ring'],['Lightning','lightning']
  ];
  const outputs=new Set<string>();
  for(const [name,form] of pairs){
    assert.equal(pixelArtFormFor(name),form);
    const url=generateFreshPixelArt(name);
    assert.ok(url.startsWith('data:image/svg+xml'),name);
    const decoded=decodeURIComponent(url.split(',')[1]);
    assert.match(decoded,/<svg/);
    assert.match(decoded,/<rect/);
    assert.doesNotMatch(decoded,/<text|<image|<foreignObject/);
    outputs.add(url);
  }
  assert.equal(outputs.size,pairs.length);
  const elementSprite=source('src/components/ElementSprite.tsx');
  assert.match(elementSprite,/generateFreshPixelArt\(name\)/);
  assert.match(elementSprite,/fallbackSrc=\{freshArt\}/);
});
