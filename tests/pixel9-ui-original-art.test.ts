import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateFreshPixelArt, pixelArtFormFor } from '../src/lib/freshPixelArt';
const source=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('new 24px hand-authored icons identify real concepts instead of emoji placeholders',()=>{
  const samples:Record<string,string>={
    'Sushi':'sushi','Ramen Bowl':'ramen','Street Taco':'taco','Ice Cream':'icecream',
    'Cheddar Cheese':'cheese','Strawberry':'strawberry','Apple':'apple','Camera':'camera',
    'Electric Guitar':'guitar','Smartphone':'phone','Steam Train':'train',
    'Helicopter':'helicopter','Dinosaur':'dinosaur','Dragon':'dragon',
    'Red Fox':'fox','Cactus':'cactus','Castle':'castle','Lantern':'lantern',
    'Trophy':'trophy','Toaster':'toaster','Pancakes':'pancakes','Compass':'compass',
    'Umbrella':'umbrella','Bread':'bread'
  };
  for(const [name,expected] of Object.entries(samples)){
    assert.equal(pixelArtFormFor(name),expected,name);
    const art=generateFreshPixelArt(name);
    assert.match(art,/^data:image\/svg\+xml/);
    assert.ok(art.length>100);
    assert.equal(art,generateFreshPixelArt(name),'named sprites stay stable');
  }
});

test('made-up infinite crafting names get individual deterministic pixel art, not an emoji',()=>{
  const a=generateFreshPixelArt('Aether Wisp Nimbus');
  const b=generateFreshPixelArt('Aether Wisp Nebula');
  assert.ok(a.startsWith('data:image/svg+xml'));
  assert.notEqual(a,b);
  assert.doesNotMatch(decodeURIComponent(a),/<text|emoji/);
});

test('Pixel 9 Craft layout has one reachable dock with secondary tools hidden',()=>{
  const craft=source('src/components/InfiniteCraftView.tsx');
  const css=source('src/boop.css');
  assert.match(craft,/boop-craft-action-dock/);
  assert.match(craft,/boop-craft-dock-row/);
  assert.match(craft,/Find elements/);
  assert.match(craft,/boop-board-result/);
  assert.match(craft,/boop-board-more/);
  assert.match(css,/@media\(max-width:520px\)/);
  assert.match(css,/env\(safe-area-inset-bottom/);
  assert.match(css,/boop-craft-action-dock/);
});

test('Combine screen prioritizes two slots and one action, with advanced filters optional',()=>{
  const combine=source('src/components/WorkBench.tsx');
  assert.match(combine,/YOUR RECIPE/);
  assert.match(combine,/boop-foundry-filter-disclosure/);
  assert.match(combine,/filtered\.slice\(0,visible\)/);
  assert.match(combine,/boop-foundry-show-more/);
  assert.match(combine,/MaterialSprite/);
  assert.match(combine,/runSynthesis/);
  assert.doesNotMatch(combine,/>Turkish Delight emoji/);
});

test('pixel sprites render before provider art with no emoji fallback in Craft and Combine',()=>{
  const element=source('src/components/ElementSprite.tsx');
  assert.match(element,/generateFreshPixelArt\(name\)/);
  assert.match(element,/generateFreshPixelArt\(material.displayName\)/);
  assert.match(element,/url \|\|/);
  const craft=source('src/components/CraftSprite.tsx');
  assert.match(craft,/ElementSprite/);
});
