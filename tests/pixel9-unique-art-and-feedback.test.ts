import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateFreshPixelArt, pixelArtFormFor } from '../src/lib/freshPixelArt';
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('fifteen new themed original pixel sprites have their own silhouettes',()=>{
  const art:Record<string,string>={
    'Sushi':'sushi','Street Taco':'taco','Ice Cream':'icecream','Cheddar Cheese':'cheese',
    'Strawberry':'berry','Apple':'apple','Smartphone':'phone','Helicopter':'helicopter',
    'Dinosaur':'dinosaur','Cactus':'cactus','Castle':'castle','Pancakes':'pancakes',
    'Umbrella':'umbrella','Fox':'fox','Bread':'bread'
  };
  const pictures=new Set<string>();
  for(const [name,form]of Object.entries(art)){
    assert.equal(pixelArtFormFor(name),form,name);
    const result=generateFreshPixelArt(name);
    assert.match(result,/^data:image\/svg\+xml/);
    const xml=decodeURIComponent(result);
    assert.match(xml,/<svg/);
    assert.doesNotMatch(xml,/<text|<image|<foreignObject/);
    pictures.add(result);
  }
  assert.equal(pictures.size,Object.keys(art).length);
});

test('we keep current Pixel 9 Craft dock and show only one status instead of three overlapping ones',()=>{
  const craft=source('src/components/InfiniteCraftView.tsx');
  assert.match(craft,/boop-mobile-craft-dock/);
  assert.match(craft,/Open combination lab/);
  assert.match(craft,/boop-more-artwork/);
  assert.match(craft,/combineError\s*\?/);
  assert.match(craft,/: activeCombination\s*\?/);
  assert.match(craft,/: lastResult\s*\?/);
  const css=source('src/boop.css');
  assert.match(css,/max-width:520px/);
});

test('Combine does not treat temporary offline fallback pixels as uploaded custom art',()=>{
  const combine=source('src/components/WorkBench.tsx');
  const sprite=source('src/components/ElementSprite.tsx');
  assert.match(combine,/customSpriteUrl: item.customSpriteUrl/);
  assert.match(sprite,/generateFreshPixelArt\(name\)/);
  assert.match(sprite,/custom\s*\|\|/);
});
