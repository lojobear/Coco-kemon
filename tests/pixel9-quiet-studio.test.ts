import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateFreshPixelArt, pixelArtFormFor } from '../src/lib/freshPixelArt';
const file = (path:string) => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('unavailable artwork uses genuine local original sprites with no emoji or online requirement',()=>{
  const names=['Water','Fire','Earth','Wind','Coffee','Ramen','Dragon','Toaster Strudel','Camera','Train','Crown','Music','Magic Puzzle','Dark Meadow'];
  for(const name of names){
    const data=generateFreshPixelArt(name);
    assert.match(data,/^data:image\/svg\+xml;charset=utf-8,/);
    const svg=decodeURIComponent(data.slice(data.indexOf(',')+1));
    assert.match(svg,/<svg /);assert.match(svg,/shape-rendering="crispEdges"/);
    assert.match(svg,/<rect /);assert.doesNotMatch(svg,/<text|<image|<foreignObject/);
    assert.equal(data,generateFreshPixelArt(name));
  }
  assert.equal(pixelArtFormFor('Ramen'),'noodles');
  assert.equal(pixelArtFormFor('Camera'),'camera');
  assert.equal(pixelArtFormFor('Dragon'),'dragon');
  assert.notEqual(generateFreshPixelArt('Cloud'),generateFreshPixelArt('Blue Moon Cloud'));
  assert.notEqual(generateFreshPixelArt('Mystery A'),generateFreshPixelArt('Mystery B'));
});
test('existing uploaded sprites and AI art always override new local fallbacks',()=>{
  const code=file('src/components/ElementSprite.tsx');
  assert.match(code,/generateFreshPixelArt\(name\)/);
  assert.match(code,/custom\s*\|\|/);
  assert.match(code,/isShiny && ownShiny/);
  assert.match(code,/SpriteImage src=/);
});
test('Pixel 9 Craft has one focus canvas plus mobile dock, no redundant floating Add button',()=>{
  const code=file('src/components/InfiniteCraftView.tsx');
  const css=file('src/boop.css');
  assert.match(code,/boop-mobile-craft-dock/);
  assert.match(code,/Open combination lab/);
  assert.match(code,/Browse ingredients/);
  assert.match(code,/Surprise me/);
  assert.doesNotMatch(code,/className="boop-board-mobile-library"/);
  assert.match(css,/@media\(max-width:520px\)/);
  assert.match(css,/boop-mobile-craft-dock/);
});
test('Combine keeps existing synthesis actions while simplifying ingredient browsing',()=>{
  const code=file('src/components/WorkBench.tsx');
  assert.match(code,/boop-discovery-filters/);
  assert.match(code,/Show more discoveries/);
  assert.match(code,/runSynthesis\(\)/);
  assert.match(code,/chooseRandomProcess/);
  assert.match(code,/Craft board/);
  assert.match(code,/\.slice\(0,visibleCount\)/);
});
