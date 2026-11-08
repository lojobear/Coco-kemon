import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSpritePrompt } from '../server/emoji';
import { compactSchnellImagePrompt } from '../server/gemini';
import { BOOP_MINI_REFERENCE_VERSION } from '../server/spriteReference';
import { composeMiniSpritePixels, alphaBounds, MINI_CANVAS_SIZE, MINI_FOOTPRINT_WIDTH, MINI_FOOTPRINT_HEIGHT, MINI_MAX_OPAQUE_COLORS } from '../src/lib/miniSpriteStyle';

const css = readFileSync(new URL('../src/boop.css', import.meta.url), 'utf8');
test('sprite artwork is ~8.9% bigger without changing layout and touch-target geometry', () => {
  const sizeBlock = css.slice(css.indexOf('/* Sprite polish v19:'), css.indexOf('/* Foundry pagination:'));
  assert.ok(sizeBlock.startsWith('/* Sprite polish v19:'));
  assert.match(sizeBlock, /\.boop-app \.element-emoji > img \{[^}]*width: 98% !important;[^}]*height: 98% !important;/);
  assert.match(sizeBlock, /image-rendering: pixelated/);
  assert.match(sizeBlock, /\.boop-app img\.boop-editor-sprite/);
  assert.match(sizeBlock, /padding: 1%;/);
  assert.ok(98/90>1.08 && 98/90<1.10);
});
test('future AI art stays 112px with slightly larger silhouette and more crisp details', () => {
  assert.equal(MINI_CANVAS_SIZE,112);
  assert.equal(MINI_FOOTPRINT_WIDTH,76);
  assert.equal(MINI_FOOTPRINT_HEIGHT,76);
  assert.equal(MINI_MAX_OPAQUE_COLORS,48);
  assert.match(BOOP_MINI_REFERENCE_VERSION,/^v19-/);
  const premium=buildSpritePrompt('Fire Truck');
  const compact=compactSchnellImagePrompt(premium);
  assert.match(premium,/112x112/);
  assert.match(premium,/55–70%/);
  assert.match(premium,/one or two tiny subject-specific details/i);
  assert.match(compact,/112x112/);
  assert.match(compact,/55–70%/);
  assert.match(compact,/1–2 tiny subject-specific details/);
  assert.ok(compact.length<=2048);
  const client=readFileSync(new URL('../src/lib/elementEmoji.ts',import.meta.url),'utf8');
  assert.match(client,/saved\/uploads keep their exact bytes/i);
});
test('nearest-neighbor postprocessing gives a larger bounded and crisp silhouette', () => {
  const w=32,h=32,rgba=new Uint8ClampedArray(w*h*4);
  for(let y=5;y<26;y++)for(let x=5;x<26;x++){
    const i=(y*w+x)*4;rgba[i]=15;rgba[i+1]=y*8;rgba[i+2]=x*8;rgba[i+3]=255;
  }
  const out=composeMiniSpritePixels(rgba,w,h);
  const bounds=alphaBounds(out,MINI_CANVAS_SIZE,MINI_CANVAS_SIZE);
  assert.ok(bounds);
  assert.equal(bounds!.width,76);
  assert.equal(bounds!.height,76);
  assert.equal(bounds!.bottom,90);
  assert.equal(bounds!.top,15);
  const colors=new Set<string>();
  for(let i=0;i<out.length;i+=4){
    assert.ok(out[i+3]===0||out[i+3]===255);
    if(out[i+3])colors.add([out[i],out[i+1],out[i+2]].join(','));
  }
  assert.ok(colors.size<=48);
});
