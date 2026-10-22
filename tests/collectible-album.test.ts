import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALBUM_SETS, albumSetProgress, availableVariants, evolutionFor, rollCelestial,
  SHINY_ODDS, CELESTIAL_ODDS, sanitizeTrophyRoom, TROPHY_SLOTS } from '../src/lib/collectorData';
import type { InfiniteElement } from '../src/lib/infiniteCraftData';

const element=(name:string,count:number,recipes=1):InfiniteElement=>({
  id:name.toLowerCase(),name,emoji:'🧪',discoveredAt:1000,craftCount:count,
  recipeHistory:Array.from({length:recipes},(_,i)=>({first:'Water',second:'Recipe '+i,count:1,firstSeenAt:1000,lastSeenAt:1000}))
});
const file=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('evolution rewards repeated crafting AND distinct combinations',()=>{
  assert.equal(evolutionFor(element('Cloud',1)).tier.name,'Discovered');
  assert.equal(evolutionFor(element('Cloud',5)).tier.name,'Awakened');
  assert.equal(evolutionFor(element('Cloud',20,1)).tier.name,'Awakened');
  assert.equal(evolutionFor(element('Cloud',20,2)).tier.name,'Ascended');
  assert.equal(evolutionFor(element('Cloud',50,2)).tier.name,'Ascended');
  assert.equal(evolutionFor(element('Cloud',50,3)).tier.name,'Legendary');
  assert.equal(evolutionFor(element('Cloud',50,3)).progress,100);
});

test('published rare palette odds are explicit and independent of model output',()=>{
  assert.equal(SHINY_ODDS,512);
  assert.equal(CELESTIAL_ODDS,4096);
  assert.equal(rollCelestial(()=>0),true);
  assert.equal(rollCelestial(()=>0.5),false);
  assert.equal(rollCelestial(()=>4095/4096),false);
  assert.equal(availableVariants(element('Cloud',4)).length,1);
  assert.deepEqual(availableVariants({...element('Cloud',4),unlockedShiny:true,unlockedCelestial:true}),['normal','shiny','celestial']);
});

test('sticker sets have permanent names and accurate visible empty-slot progress',()=>{
  assert.equal(ALBUM_SETS.length,6);
  for(const set of ALBUM_SETS){
    assert.equal(set.names.length,8);
    assert.equal(new Set(set.names).size,8);
    assert.equal(albumSetProgress([],set.names).count,0);
    assert.equal(albumSetProgress(set.names.map(name=>element(name,1)),set.names).complete,true);
  }
  assert.deepEqual(albumSetProgress([element('Cloud',1)],['Cloud','Wind']),{count:1,total:2,complete:false});
});

test('trophy room has 12 owned-only slots and blocks unearned rare variants',()=>{
  const owned=[element('Cloud',20)];
  const malicious={theme:'arbitrary',slots:[
    {name:'Cloud',variant:'celestial',frame:'gold'},
    {name:'Item never discovered',variant:'normal',frame:'classic'},
    {name:'Cloud',variant:'normal',frame:'bad'},
  ]};
  const room=sanitizeTrophyRoom(malicious,owned);
  assert.equal(room.theme,'gallery');
  assert.equal(room.slots.length,TROPHY_SLOTS);
  assert.deepEqual(room.slots[0],{name:'Cloud',variant:'normal',frame:'gold'});
  assert.equal(room.slots[1],null);
  assert.equal(room.slots[2]?.frame,'classic');
  assert.deepEqual(sanitizeTrophyRoom(null,owned).slots,Array(12).fill(null));
});

test('collection navigation and trophy room save travel with normal cloud backups',()=>{
  const app=file('src/App.tsx');
  const save=file('src/lib/saveData.ts');
  const album=file('src/components/CollectionAlbum.tsx');
  assert.match(app, /CollectionAlbum/);
  assert.match(album,/boop-sticker-grid/);
  assert.match(album,/boop-sticker-locked/);
  assert.match(album,/boop-album-art--/);
  assert.match(album,/boop-trophy-room/);
  assert.match(album,/boop-album-evolution/);
  assert.match(album,/boop-open-trophy-room/);
  assert.match(album,/exportTrophyPostcard/);
  assert.match(save,/collectorRoom: readCollectorRoom\(\)/);
  assert.match(save,/write\(parsed\.foundry, parsed\.crafting, true, parsed\.collectorRoom, parsed\.boardLayout\)/);
  assert.match(save,/saveCollectorRoom\(room: TrophyRoom\)/);
});

test('native Android still uses existing Collection destination and live web game',()=>{
  const java=file('android-shell/app/src/main/java/app/boop/collect/MainActivity.java');
  assert.match(java,/"archive", "Collection"/);
  assert.match(java,/new WebView\(this\)/);
  assert.match(file('src/boop.css'),/\.boop-sticker-card/);
  assert.match(file('src/boop.css'),/\.boop-album-art--evolution-3/);
});
