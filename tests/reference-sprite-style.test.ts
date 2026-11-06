import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSpritePrompt, SPRITE_ENGINE_VERSION } from '../server/emoji';
import { compactSchnellImagePrompt } from '../server/gemini';
import { BOOP_MINI_REFERENCE_PNG_BASE64, BOOP_MINI_REFERENCE_VERSION, miniSpriteReferenceBlob } from '../server/spriteReference';
import { composeMiniSpritePixels, alphaBounds, MINI_CANVAS_SIZE, MINI_FOOTPRINT_WIDTH, MINI_FOOTPRINT_HEIGHT } from '../src/lib/miniSpriteStyle';

test('artist-uploaded reference is preserved verbatim for production FLUX.2 image conditioning', async()=>{
  const bytes=readFileSync(new URL('../public/sprite-reference/mini-handheld-master.png',import.meta.url));
  assert.equal(Buffer.from(BOOP_MINI_REFERENCE_PNG_BASE64,'base64').equals(bytes),true);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),112);
  assert.equal(bytes.readUInt32BE(20),112);
  assert.equal((await miniSpriteReferenceBlob().arrayBuffer()).byteLength,bytes.length);
  assert.equal(SPRITE_ENGINE_VERSION,BOOP_MINI_REFERENCE_VERSION);
});

test('new default, shiny and reroll prompts use tiny retro handheld art across image providers',()=>{
  const full=buildSpritePrompt('Grandfather Clock');
  assert.match(full,/112x112/);
  assert.match(full,/70 to 80-pixel-tall/);
  assert.match(full,/12 to 20 solid/);
  assert.match(full,/centered/i);
  assert.doesNotMatch(full,/2:1 isometric|virtual-hotel FURNI/);
  const compact=compactSchnellImagePrompt(full);
  assert.ok(compact.length<=2048);
  assert.match(compact,/112x112/);
  assert.match(compact,/70-80 pixels/);
  assert.match(compact,/#FF00FF/);
  const shiny=buildSpritePrompt('Fox','',true);
  assert.match(shiny,/SHINY \/ ALTERNATE COLORWAY/);
  assert.match(compactSchnellImagePrompt(shiny),/Fox/);
  assert.match(compactSchnellImagePrompt(shiny),/SHINY:/);
  assert.match(compactSchnellImagePrompt(buildSpritePrompt('Clock','other-angle')),/other-angle/);
});

test('generated output is 112px, centered, readable and limited to 20 opaque colors',()=>{
  const width=64,height=64;
  const src=new Uint8ClampedArray(width*height*4);
  for(let y=5;y<55;y++)for(let x=7;x<59;x++){
    const p=(y*width+x)*4;
    src[p]=Math.round(x*4.1);src[p+1]=Math.round(y*4.3);src[p+2]=88;src[p+3]=255;
  }
  const output=composeMiniSpritePixels(src,width,height);
  assert.equal(output.length,MINI_CANVAS_SIZE*MINI_CANVAS_SIZE*4);
  const box=alphaBounds(output,MINI_CANVAS_SIZE,MINI_CANVAS_SIZE);
  assert.ok(box);
  assert.ok(box!.width<=MINI_FOOTPRINT_WIDTH);
  assert.ok(box!.height<=MINI_FOOTPRINT_HEIGHT);
  assert.equal(box!.bottom,95);
  assert.ok(box!.top>=16);
  const palette=new Set<string>();
  for(let p=0;p<output.length;p+=4){
    if(output[p+3]===0)continue;
    assert.equal(output[p+3],255);
    palette.add(`${output[p]},${output[p+1]},${output[p+2]}`);
  }
  assert.ok(palette.size<=20);
  assert.throws(()=>composeMiniSpritePixels(new Uint8ClampedArray(16),2,2),/no usable silhouette/);
});

test('offline preview is the same 112px mini scale; generated art only is processed',()=>{
  const fresh=readFileSync(new URL('../src/lib/freshPixelArt.ts',import.meta.url),'utf8');
  const art=readFileSync(new URL('../src/lib/elementEmoji.ts',import.meta.url),'utf8');
  const model=readFileSync(new URL('../server/gemini.ts',import.meta.url),'utf8');
  assert.match(fresh,/viewBox="0 0 112 112"/);
  assert.match(art,/composeMiniSpritePixels/);
  const lab=readFileSync(new URL('../src/components/SpriteLabModal.tsx',import.meta.url),'utf8');
  assert.match(lab,/ZoomedLabSprite key=\{selected.catalogKey\}/);
  assert.match(lab,/const b=alphaBounds\(pixels.data,width,height\)/);
  assert.match(lab,/targetSize=158/);
  assert.match(art,/Old saved art and uploaded sprites|saved\/uploads keep their exact bytes/i);
  assert.match(model,/input_image_0.*miniSpriteReferenceBlob/);
});
