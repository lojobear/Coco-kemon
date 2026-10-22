import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateFreshPixelArt, pixelArtFormFor } from '../src/lib/freshPixelArt';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('common ingredients render freshly drawn, recognizably different pixel art',()=>{
  for(const [name,form] of [['Water','water'],['Fire','fire'],['Wind','wind'],['Earth','earth'],
    ['Coffee','coffee'],['Tree','tree'],['Robot','robot'],['Pizza','pizza'],['Mushroom','mushroom'],
    ['Rocket','rocket'],['Cloud','cloud'],['Fox','dog'],['Cat','cat'],['Book','book']]) {
    assert.equal(pixelArtFormFor(name),form,name);
    const image=generateFreshPixelArt(name);
    assert.ok(image.startsWith('data:image/svg+xml;charset=utf-8,'),name);
    const source=decodeURIComponent(image.split(',')[1]);
    assert.match(source,/<svg[^>]*shape-rendering="crispEdges"/);
    assert.match(source,/<rect/);
    assert.doesNotMatch(source,/<text|<image|emoji/);
  }
  assert.notEqual(generateFreshPixelArt('Water'),generateFreshPixelArt('Fire'));
  assert.notEqual(generateFreshPixelArt('Pizza'),generateFreshPixelArt('Book'));
});

test('unknown names remain offline pixel sprites, not a shared emoji glyph',()=>{
  const a=generateFreshPixelArt('Temporal Pancake Engine');
  const b=generateFreshPixelArt('Moonlit Paper Lantern');
  assert.notEqual(a,b);
  assert.equal(a,generateFreshPixelArt('Temporal Pancake Engine'));
  assert.equal(generateFreshPixelArt(''),'');
});

test('new art always appears before image-provider responses while preserving uploads',()=>{
  const src=read('src/components/ElementSprite.tsx');
  assert.match(src,/generateFreshPixelArt\(name\)/);
  assert.match(src,/fallback : freshArt/);
  assert.match(src,/material\.customSpriteUrl !== legacy/);
  assert.doesNotMatch(src,/>\{fallback \|\| '◌'\}<\/span>/);
});

test('Crafting board has one progressive-disclosure tools menu',()=>{
  const src=read('src/components/InfiniteCraftView.tsx');
  assert.match(src,/className="boop-board-more"/);
  assert.match(src,/boop-board-more-panel/);
  assert.match(src,/boop-quiet-spawn/);
  assert.match(src,/setSpawnCount\(count\)/);
  assert.match(src,/aria-label="Undo last board action"/);
  assert.match(src,/aria-label="Zoom in"/);
  assert.match(src,/boop-board-mobile-library/);
  assert.doesNotMatch(src,/className="boop-spawn-quick"/);
});

test('Combine screen puts the real ingredient panel first and hides advanced progression',()=>{
  const src=read('src/components/WorkBench.tsx');
  assert.ok(src.indexOf('className={`combine-dock') < src.indexOf('className="discovery-heading"'));
  assert.match(src,/<h1>Combine\.<\/h1>/);
  assert.match(src,/<details className="boop-foundry-progress-details">/);
  assert.match(src,/generateFreshPixelArt\(item\.name\)/);
  assert.match(src,/runSynthesis\(\)/);
  const styles=read('src/boop.css');
  assert.match(styles,/\.boop-app \.collection-workbench \.discovery-grid \{grid-template-columns:repeat\(3/);
  assert.match(styles,/\.boop-app \.boop-board-toolbar--quiet/);
  assert.match(styles,/max-width:760px/);
});
