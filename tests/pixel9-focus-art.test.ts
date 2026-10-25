import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateFreshPixelArt, pixelArtFormFor } from '../src/lib/freshPixelArt';
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('fresh original sprites are crisp deterministic and visually distinct',()=>{
  const names=['Turkish Delight','Cereal','Chocolate Cookie','Donut','Ribeye Steak',
    'Apple Pie','Candle','Sandwich','Gyoza','Lemonade'];
  const urls=names.map(name=>generateFreshPixelArt(name));
  assert.equal(new Set(urls).size,names.length);
  for (const data of urls) {
    assert.ok(data.startsWith('data:image/svg+xml;charset=utf-8,'));
    const xml=decodeURIComponent(data.split(',').slice(1).join(','));
    assert.match(xml,/viewBox="0 0 24 24"/);
    assert.match(xml,/shape-rendering="crispEdges"/);
    assert.match(xml,/<rect /);
    assert.doesNotMatch(xml,/<text|<foreignObject|<image/);
  }
  assert.equal(generateFreshPixelArt('Turkish Delight'),urls[0]);
  assert.equal(pixelArtFormFor('Turkish Delight'),'delight');
});

test('unknown discoveries do not receive a single recycled fallback graphic',()=>{
  const subjects=['Celestial Walnut','Mysterious Pager','Impossible Breakfast','Paper Astronomy',
    'Vanishing Monday','Chromatic Notebook','Forgotten Umbrella Sword','Odd Little Vacuum',
    'Talking Lighthouse','Quantum Biscuit Orb'];
  const unique=new Set(subjects.map(name=>generateFreshPixelArt(name)));
  assert.equal(unique.size,subjects.length);
});

test('Pixel 9 Combine puts process choices into secondary settings',()=>{
  const workbench=source('src/components/WorkBench.tsx');
  assert.match(workbench,/boop-combine-settings/);
  assert.match(workbench,/CREATE SOMETHING NEW/);
  assert.match(workbench,/boop-combine-quick--in-picker/);
  assert.match(workbench,/boop-focus-surprise/);
  assert.doesNotMatch(workbench,/requestAnimationFrame\(\(\)=>searchRef\.current\?\.focus/);
  assert.match(workbench,/Find a sprite/);
  const beforeSettings=workbench.split('className="boop-combine-settings"')[0];
  assert.doesNotMatch(beforeSettings,/id="foundry-process"/);
  assert.match(workbench,/aria-label="Search your discoveries"/);
  assert.match(workbench,/runSynthesis\(\)/);
});

test('Craft has no artwork-progress bubble, only manual retry under More',()=>{
  const board=source('src/components/InfiniteCraftView.tsx');
  const css=source('src/boop.css');
  assert.doesNotMatch(board,/>Drawing artwork/);
  assert.doesNotMatch(board,/className="boop-artwork-queue"/);
  assert.match(board,/boop-more-artwork/);
  assert.match(board,/Retry missing sprites/);
  assert.match(css,/\.boop-app \.boop-artwork-queue \{display:none!important;\}/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('failed remote sprites render original offline pixel art, not an emoji/glyph',()=>{
  const sprite=source('src/components/ElementSprite.tsx');
  const image=source('src/components/SpriteImage.tsx');
  assert.match(sprite,/fallbackSrc=\{freshArt\}/);
  assert.match(image,/const url = candidate && candidate !== brokenSource \? candidate : fallbackSrc/);
  assert.doesNotMatch(image,/>◌<\/span>/);
  assert.match(sprite,/generateFreshPixelArt/);
});


test('novel unrecognized discoveries render newly assembled 24px silhouettes',()=>{
  for(const name of ['Astral Teapot Sparrow','Glacial Semaphore Vessel','Velvet Atlas Beacon']) {
    assert.equal(pixelArtFormFor(name),'chimera');
    const art=generateFreshPixelArt(name);
    assert.ok(art.startsWith('data:image/svg+xml'));
    assert.doesNotMatch(decodeURIComponent(art.slice(art.indexOf(',')+1)),/<text|<image/);
  }
  assert.notEqual(generateFreshPixelArt('Astral Teapot Sparrow'),generateFreshPixelArt('Glacial Semaphore Vessel'));
});

test('Pixel 9 always shows one bottom craft CTA; more tools have the spawn action',()=>{
  const board=source('src/components/InfiniteCraftView.tsx');
  assert.match(board,/boop-more-spawn-action/);
  assert.match(board,/boop-mobile-craft-library/);
  assert.doesNotMatch(board,/className="boop-mobile-craft-spawn"/);
});
