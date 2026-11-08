import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSpritePrompt, SPRITE_ENGINE_VERSION } from '../server/emoji';
import { compactSchnellImagePrompt } from '../server/gemini';
import { BOOP_MINI_REFERENCE_PNG_BASE64, BOOP_MINI_REFERENCE_VERSION, miniSpriteReferenceBlob } from '../server/spriteReference';
import { composeMiniSpritePixels, alphaBounds, MINI_CANVAS_SIZE, MINI_FOOTPRINT_WIDTH, MINI_FOOTPRINT_HEIGHT } from '../src/lib/miniSpriteStyle';

test('approved pixel-art reference remains intact but is never sent as model input', async()=>{
  const bytes=readFileSync(new URL('../public/sprite-reference/bold-collectible-softserve.png',import.meta.url));
  assert.equal(Buffer.from(BOOP_MINI_REFERENCE_PNG_BASE64,'base64').equals(bytes),true);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),112);
  assert.equal(bytes.readUInt32BE(20),154);
  assert.equal((await miniSpriteReferenceBlob().arrayBuffer()).byteLength,bytes.length);
  assert.equal(SPRITE_ENGINE_VERSION,BOOP_MINI_REFERENCE_VERSION);
});

test('new default, shiny and reroll prompts use compact isometric furni pixel art across image providers',()=>{
  const full=buildSpritePrompt('Grandfather Clock');
  assert.match(full,/112x112/);
  assert.match(full,/55–70%/);
  assert.match(full,/20–48 flat pixel colours/);
  assert.match(full,/Center in a 112x112 canvas/i);
  assert.match(full,/2:1 isometric/i);
  const compact=compactSchnellImagePrompt(full);
  assert.ok(compact.length<=2048);
  assert.match(compact,/112x112/);
  assert.match(compact,/55–70%/);
  assert.match(compact,/#FF00FF/);
  const shiny=buildSpritePrompt('Fox','',true);
  assert.match(shiny,/SHINY \/ ALTERNATE COLORWAY/);
  assert.match(compactSchnellImagePrompt(shiny),/Fox/);
  assert.match(compactSchnellImagePrompt(shiny),/SHINY:/);
  assert.match(compactSchnellImagePrompt(buildSpritePrompt('Clock','other-angle')),/other-angle/);
});

test('new generated sprites retain crisp 112px canvas and up to 48 colours',()=>{
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
  assert.equal(box!.bottom,90);
  assert.ok(box!.top>=15);
  const palette=new Set<string>();
  for(let p=0;p<output.length;p+=4){
    if(output[p+3]===0)continue;
    assert.equal(output[p+3],255);
    palette.add(`${output[p]},${output[p+1]},${output[p+2]}`);
  }
  assert.ok(palette.size<=48);
  assert.throws(()=>composeMiniSpritePixels(new Uint8ClampedArray(16),2,2),/no usable silhouette/);
});

test('bold near-black outlines and subject colours survive the new quantizer',()=>{
  const width=72,height=72;
  const data=new Uint8ClampedArray(width*height*4);
  for(let y=5;y<67;y++)for(let x=5;x<67;x++){
    const i=(y*width+x)*4;
    const border=x<10||x>61||y<10||y>61;
    const rgb=border?[12,10,15]:x<width/2?[250,205,120]:[62,172,229];
    for(let c=0;c<3;c++)data[i+c]=rgb[c];
    data[i+3]=255;
  }
  const before=new Uint8ClampedArray(data);
  const output=composeMiniSpritePixels(data,width,height);
  assert.deepEqual(data,before, 'postprocessor must not mutate the source');
  const colors=new Set();
  for(let i=0;i<output.length;i+=4)if(output[i+3])colors.add(
    [output[i],output[i+1],output[i+2]].join(','));
  assert.ok(colors.has('12,10,15'),'dark border remains');
  assert.ok(colors.has('250,205,120'),'warm tones remain');
  assert.ok(colors.has('62,172,229'),'cool subject tones remain');
});

test('offline preview uses compact 112px art; generated art only is processed',()=>{
  const fresh=readFileSync(new URL('../src/lib/freshPixelArt.ts',import.meta.url),'utf8');
  const art=readFileSync(new URL('../src/lib/elementEmoji.ts',import.meta.url),'utf8');
  const model=readFileSync(new URL('../server/gemini.ts',import.meta.url),'utf8');
  assert.match(fresh,/viewBox="0 0 112 112"/);
  assert.match(art,/composeMiniSpritePixels/);
  const lab=readFileSync(new URL('../src/components/SpriteLabModal.tsx',import.meta.url),'utf8');
  assert.match(lab,/ZoomedLabSprite target=\{selected\}/);
  assert.match(lab,/const b=alphaBounds\(pixels.data,width,height\)/);
  assert.match(lab,/targetSize=158/);
  assert.match(art,/Old saved art and uploaded sprites|saved\/uploads keep their exact bytes/i);
  assert.doesNotMatch(model, /input_image_0.*miniSpriteReferenceBlob\(\)/);
  assert.doesNotMatch(model, /form\.append\('input_image_0'/);
  assert.doesNotMatch(model, /import \{ miniSpriteReferenceBlob \}/);
  const full=buildSpritePrompt('Clock Tower', 'reroll-isolated');
  const other=buildSpritePrompt('Hedgehog', 'reroll-other');
  assert.match(full, /Clock Tower/);
  assert.match(other, /Hedgehog/);
  assert.doesNotMatch(full, /soft.serve|wooden tub|ice cream/i);
  assert.doesNotMatch(other, /soft.serve|wooden tub|ice cream/i);
});
