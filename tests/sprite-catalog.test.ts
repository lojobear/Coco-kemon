import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSpriteCatalog, withUnifiedDiscoveryArtwork } from '../src/lib/spriteCatalog';
import type { InfiniteElement } from '../src/lib/infiniteCraftData';
import type { Material, Oddkin } from '../src/types';

const png = 'data:image/png;base64,AAAA';
const upload = 'data:image/png;base64,BBBB';
const material = (name:string, sprite?:string, time=0) =>
  ({id:'m-'+name,displayName:name,customSpriteUrl:sprite,discoveredAt:time}) as Material;
const craft = (name:string,sprite?:string,time=0) =>
  ({id:'c-'+name,name,emoji:'✨',customSpriteUrl:sprite,discoveredAt:time,craftCount:7}) as InfiniteElement;

test('one card for Craft + Material with normalized name and the saved image',()=>{
  const rows=buildSpriteCatalog([craft('  ICE   CREAM  ',upload)], [material('ice cream')], [],()=>false);
  assert.equal(rows.length,1);
  assert.deepEqual(rows[0].sources,['craft','material']);
  assert.equal(rows[0].sprite,upload);
  assert.equal(rows[0].craft?.craftCount,7);
});

test('Foundry artwork fills a missing Craft sprite without generating',()=>{
  const rows=buildSpriteCatalog([craft('Dragon')],[material(' dragon ',upload)],[],()=>false);
  assert.equal(rows.length,1);
  assert.equal(rows[0].sprite,upload);
  assert.equal(rows[0].key,'concept:dragon');
});

test('legacy procedural artwork never masquerades as a saved AI sprite',()=>{
  const rows=buildSpriteCatalog([craft('Geode',png)],[material('Geode',png)],[],()=>true);
  assert.equal(rows.length,1);
  assert.equal(rows[0].sprite,undefined);
  assert.equal(rows[0].material?.customSpriteUrl,png);
});

test('newer discoveries appear before older ones and oddkin remain separate',()=>{
  const oddkin={speciesId:'o-1',speciesName:'Rabbit',customSpriteUrl:upload} as Oddkin;
  const rows=buildSpriteCatalog([craft('Old',undefined,1),craft('New',undefined,200)],[material('Old',undefined,1)],[oddkin]);
  assert.deepEqual(rows.map(r=>r.name),['New','Old','Rabbit']);
  assert.equal(rows.find(x=>x.name==='Rabbit')?.key,'oddkin:o-1');
});

test('explicit sprite edits update linked records without deleting progress or mutating input',()=>{
  const oldCraft=craft(' Starlight ',undefined,40);
  const oldMaterial=material('starlight',png,10);
  const another=craft('Ocean',png,11);
  const payload={ crafting:[oldCraft,another], foundry: {materials:[oldMaterial],oddkinCollection: [{speciesName:'other'}] as any[]}, boardLayout:[{id:'one'}], version:2 };
  const changed=withUnifiedDiscoveryArtwork(payload,'STARLIGHT',upload,5);
  assert.notEqual(changed,payload);
  assert.equal(changed.crafting?.[0].customSpriteUrl,upload);
  assert.equal(changed.foundry?.materials?.[0].customSpriteUrl,upload);
  assert.equal(changed.crafting?.[0].craftCount,7);
  assert.equal(changed.crafting?.[1], another);
  assert.equal(changed.foundry?.oddkinCollection,payload.foundry.oddkinCollection);
  assert.equal(changed.boardLayout,payload.boardLayout);
  assert.equal(oldMaterial.customSpriteUrl,png);
  assert.equal(oldCraft.customSpriteUrl,undefined);
});

test('no sprite tab source record disappears merely because two names match',()=>{
  const view=readFileSync(new URL('../src/components/SpriteLabModal.tsx',import.meta.url),'utf8');
  const album=readFileSync(new URL('../src/components/CollectionAlbum.tsx',import.meta.url),'utf8');
  assert.match(view,/buildSpriteCatalog\(craftElements, materials, oddkinCollection/);
  assert.match(view,/item\.sourceTypes\.join\(' · '\)/);
  assert.match(view,/withUnifiedDiscoveryArtwork\(payload/);
  assert.match(view,/items\.slice\(0, galleryLimit\)\.map/);
  assert.match(album,/materialArtwork\.get\(discoveryIdentity\(item\.name\)\)/);
});
