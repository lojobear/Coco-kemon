import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { removeEdgeConnectedBackground, tidyGeneratedSpritePixels, removeMagentaMask, assertTransparentSprite } from '../src/lib/spritePixelCleanup';

function image(w: number, h: number, color: [number, number, number, number]) {
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) pixels.set(color, i * 4);
  return {
    pixels,
    set(x: number, y: number, c: [number, number, number, number]) {
      pixels.set(c, (y * w + x) * 4);
    },
    alpha(x: number, y: number) {
      return pixels[(y * w + x) * 4 + 3];
    },
  };
}

test('chroma removal keeps the original subject and enclosed same-colour interior pixels', () => {
  const im = image(12, 12, [255, 0, 255, 255]);
  for (let y = 3; y <= 8; y++) for (let x = 3; x <= 8; x++)
    im.set(x, y, [18, 99, 175, 255]);
  im.set(5, 5, [255, 0, 255, 255]); // Surrounded, not the edge background.
  removeEdgeConnectedBackground(im.pixels, 12, 12);
  assert.equal(im.alpha(0, 0), 0);
  assert.equal(im.alpha(11, 5), 0);
  assert.equal(im.alpha(3, 3), 255);
  assert.equal(im.alpha(5, 5), 255);
});

test('nonuniform corners are not misinterpreted as a background', () => {
  const im = image(8, 8, [255, 0, 255, 255]);
  im.set(0, 0, [10, 30, 40, 255]);
  removeEdgeConnectedBackground(im.pixels, 8, 8);
  assert.equal(im.alpha(7, 7), 255);
});

test('small isolated artifacts and pinholes disappear while real furni silhouette remains', () => {
  const im = image(14, 14, [0, 0, 0, 0]);
  const furniture: [number, number, number, number] = [40, 145, 213, 255];
  for (let y = 4; y <= 9; y++) for (let x = 4; x <= 9; x++)
    im.set(x, y, furniture);
  im.set(7, 7, [0, 0, 0, 0]); // an accidental missing pixel
  im.set(1, 1, [40, 145, 213, 255]); // stray noise
  im.set(11, 12, [40, 145, 213, 255]);
  im.set(12, 12, [40, 145, 213, 255]); // 2-pixel speck
  im.set(10, 6, [255, 0, 255, 255]); // a magenta fringe touching transparent bg
  tidyGeneratedSpritePixels(im.pixels, 14, 14);
  assert.equal(im.alpha(1, 1), 0);
  assert.equal(im.alpha(11, 12), 0);
  assert.equal(im.alpha(12, 12), 0);
  assert.equal(im.alpha(10, 6), 0);
  assert.equal(im.alpha(7, 7), 255);
  assert.equal(im.alpha(4, 4), 255);
  assert.equal(im.alpha(9, 9), 255);
});

test('pink subject details are not erased when surrounded by the object', () => {
  const im = image(10, 10, [0, 0, 0, 0]);
  for (let y = 2; y <= 7; y++) for (let x = 2; x <= 7; x++)
    im.set(x, y, [42, 126, 201, 255]);
  im.set(5, 5, [255, 45, 239, 255]);
  tidyGeneratedSpritePixels(im.pixels, 10, 10);
  assert.equal(im.alpha(5, 5), 255);
});

test('client removes chroma at high resolution before shrinking onto the pixel grid', () => {
  const source = readFileSync(new URL('../src/lib/elementEmoji.ts', import.meta.url), 'utf8');
  const remove = source.indexOf('removeEdgeConnectedBackground(sourcePixels.data, sourceSize, sourceSize)');
  const resample = source.indexOf('pixelContext.drawImage(source, 0, 0, logicalSize, logicalSize)');
  const cleanup = source.indexOf('tidyGeneratedSpritePixels(sampled.data, logicalSize, logicalSize)');
  assert.ok(remove > 0 && resample > remove && cleanup > resample);
  assert.match(source, /const logicalSize = style === 'classic' \? MINI_CANVAS_SIZE : spriteStyleSize\(style\)/);
  assert.match(source, /composeMiniSpritePixels\(sampled.data, logicalSize, logicalSize\)/);
  assert.match(source, /pixelContext.imageSmoothingEnabled = false/);
});

test('magenta mask is removed despite inconsistent corners and shaded key colours',()=>{
  const im=image(16,16,[255,0,255,255]);
  im.set(0,0,[25,25,25,255]); im.set(15,0,[185,60,205,255]);
  for(let y=4;y<12;y++)for(let x=4;x<12;x++)im.set(x,y,[40,130,190,255]);
  for(let y=3;y<13;y++)im.set(3,y,[205,80,210,255]);
  im.set(7,7,[255,0,255,255]); // intentional enclosed pink
  assert.equal(removeMagentaMask(im.pixels,16,16),true);
  assert.equal(im.alpha(3,7),0);assert.equal(im.alpha(15,0),0);
  assert.equal(im.alpha(7,7),255);assert.equal(im.alpha(5,5),255);
  assertTransparentSprite(im.pixels,16,16);
});
test('already transparent artwork preserves enclosed pink and removes edge chroma',()=>{
  const im=image(12,12,[0,0,0,0]);
  for(let y=3;y<9;y++)for(let x=3;x<9;x++)im.set(x,y,[40,130,190,255]);
  im.set(2,5,[255,0,255,255]);im.set(5,5,[255,0,255,255]);
  removeMagentaMask(im.pixels,12,12);
  assert.equal(im.alpha(2,5),0);assert.equal(im.alpha(5,5),255);
  assertTransparentSprite(im.pixels,12,12);
});
test('reject completely opaque and completely erased output',()=>{
  assert.throws(()=>assertTransparentSprite(image(12,12,[255,0,255,255]).pixels,12,12));
  assert.throws(()=>assertTransparentSprite(image(12,12,[0,0,0,0]).pixels,12,12));
});
