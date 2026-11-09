import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withUnifiedDiscoveryArtwork, buildSpriteCatalog } from '../src/lib/spriteCatalog';
import { validateCraft, MAX_SPRITE_CHARS } from '../src/lib/saveData';
import type { InfiniteElement } from '../src/lib/infiniteCraftData';
import type { Material } from '../src/types';

const file=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const png='data:image/png;base64,iVBORw0KGgo=';
const old='data:image/png;base64,AAAA';

test('Collection cards and details offer native one-tap replacement without going to another tab',()=>{
  const album=file('src/components/CollectionAlbum.tsx');
  assert.match(album,/function CollectorCard\([\s\S]*?onReplace:()=>void/);
  assert.match(album,/aria-label=\{`Replace sprite for \$\{item.name\}`\}/);
  assert.match(album,/className="boop-sticker-replace"/);
  assert.match(album,/className="boop-collection-replace"/);
  assert.match(album,/onClick=\{\(\)=>openSpritePicker\(selected\)\}/);
  assert.match(album,/onReplace=\{\(\)=>openSpritePicker\(item\)\}/);
  assert.match(album,/ref=\{spriteUploadRef\} type="file" accept="image\/png,image\/webp,image\/jpeg"/);
  assert.match(album,/await fileToSprite\(file\)/);
  assert.match(album,/await persistSpriteEdit\(\{type:'craft',id:target.id,name:target.name\}/);
  assert.match(album,/setElements\(updated\)/);
  assert.match(album,/spriteUploadStatus&&<p/);
});

test('Sprite screen cards each have separate replacement and preview buttons, never nested buttons',()=>{
  const studio=file('src/components/SpriteLabModal.tsx');
  assert.match(studio,/className="boop-sprite-grid-cell"/);
  assert.match(studio,/className="boop-sprite-card"/);
  assert.match(studio,/className="boop-sprite-quick-replace"/);
  assert.match(studio,/aria-label=\{`Replace sprite for \$\{item.name\}`\}/);
  assert.match(studio,/onClick=\{\(\) => chooseReplacement\(item\)\}/);
  assert.match(studio,/pendingUploadTarget.current = target/);
  assert.match(studio,/const target = pendingUploadTarget.current \?\? selected/);
  assert.match(studio,/await persistSprite\(target, sprite\)/);
  assert.match(studio,/pendingUploadTarget.current = null/);
  assert.match(studio,/\>Replace sprite<\/button>/);
});

test('Both pages use the same PNG resizing and save-safe upload pipeline',()=>{
  const service=file('src/lib/customSpriteUpload.ts');
  assert.match(service,/export async function fileToSprite\(file: File\)/);
  assert.match(service,/8 \* 1024 \* 1024/);
  assert.match(service,/canvas.width = 512/);
  assert.match(service,/imageSmoothingEnabled = false/);
  assert.match(service,/MAX_SPRITE_CHARS/);
  assert.ok(MAX_SPRITE_CHARS>=100_000);
  assert.match(service,/export async function persistSpriteEdit/);
  assert.match(service,/withUnifiedDiscoveryArtwork\(payload, target.name, sprite, MATERIAL_SPRITE_RENDERER_VERSION\)/);
  assert.match(service,/spriteAssets!\.put\(userId, key, target.name, uploadedData\)/);
  assert.match(service,/trackSpriteSync/);
  assert.match(service,/saveCraftElements\(changed\)/);
  assert.match(service,/importSaveData\(JSON.stringify\(updated\)\)/);
  assert.doesNotMatch(service,/upgradeElementEmoji|retryElementEmoji|enqueueArtwork|requestJson/);
});

test('Replacing one shared sprite updates Craft and Foundry but not recipes, variants, saves, or other art',()=>{
  const ingredient: InfiniteElement={id:'one',name:'Crystal Fox',emoji:'🦊',customSpriteUrl:old,discoveredAt:123,
    unlockedShiny:true,rarityTier:'legendary',craftCount:15,
    recipeHistory:[{first:'Crystal',second:'Fox',count:15,firstSeenAt:123,lastSeenAt:240}]};
  const unrelated: InfiniteElement={id:'two',name:'Crystal Cat',emoji:'🐈',customSpriteUrl:old};
  const material={id:'foundry-fox',displayName:'  crystal FOX  ',customSpriteUrl:old,spriteRendererVersion:2} as Material;
  const payload={version:2,crafting:[ingredient,unrelated],foundry:{materials:[material],oddkinCollection:[]},
    boardLayout:[{id:'tile-1'}],collectorRoom:{theme:'gallery',slots:[]}};
  const next=withUnifiedDiscoveryArtwork(payload,'CRYSTAL fox',png,5);
  assert.equal(next.crafting[0].customSpriteUrl,png);
  assert.equal(next.foundry.materials[0].customSpriteUrl,png);
  assert.equal(next.foundry.materials[0].spriteRendererVersion,5);
  assert.equal(next.crafting[0].craftCount,15);
  assert.equal(next.crafting[0].unlockedShiny,true);
  assert.equal(next.crafting[0].rarityTier,'legendary');
  assert.deepEqual(next.crafting[0].recipeHistory,ingredient.recipeHistory);
  assert.equal(next.crafting[1].customSpriteUrl,old);
  assert.deepEqual(next.boardLayout,payload.boardLayout);
  assert.deepEqual(next.collectorRoom,payload.collectorRoom);
  assert.equal(payload.crafting[0].customSpriteUrl,old);
  assert.equal(validateCraft(next.crafting),true);
  assert.equal(buildSpriteCatalog(next.crafting,next.foundry.materials,[],()=>false)[0].sprite,png);
});

test('Replacing does not alter the mobile layout or hide the existing Sprite editor',()=>{
  const css=file('src/boop.css');
  assert.match(css,/\.boop-sticker-entry/);
  assert.match(css,/\.boop-sprite-quick-replace/);
  assert.match(css,/\.boop-collection-replace/);
  assert.match(css,/@media\(max-width:650px\)/);
  assert.match(file('src/components/SpriteLabModal.tsx'),/ZoomedLabSprite target=\{selected\}/);
});
