import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chooseSpawnElements, spawnSourcePool, spawnPositions, spreadSpawnPositions, SPAWN_COUNTS, SPAWN_SOURCES } from '../src/lib/randomSpawn';
import type { InfiniteElement } from '../src/lib/infiniteCraftData';

const items: InfiniteElement[] = [
  { id:'water',name:'Water',emoji:'💧' },
  { id:'fire',name:'Fire',emoji:'🔥' },
  { id:'cloud',name:'Cloud',emoji:'☁️',discoveredAt:1700000000000 },
  { id:'ice',name:'Ice',emoji:'🧊',discoveredAt:1700000001000,unlockedShiny:true },
  { id:'flower',name:'Flower',emoji:'🌸',discoveredAt:1700000000500 },
];

test('spawn menu exposes 1/2/5/10 and all/recent/shiny/starter inventories', () => {
  assert.deepEqual([...SPAWN_COUNTS], [1,2,5,10]);
  assert.deepEqual([...SPAWN_SOURCES], ['all','recent','shiny','starters']);
  assert.equal(spawnSourcePool(items,'all').length,5);
  assert.deepEqual(spawnSourcePool(items,'recent').map(x=>x.name),['Ice','Flower','Cloud']);
  assert.deepEqual(spawnSourcePool(items,'shiny').map(x=>x.name),['Ice']);
  assert.deepEqual(spawnSourcePool(items,'starters').map(x=>x.name),['Water','Fire']);
  assert.deepEqual(spawnSourcePool(items,'recent').filter(x=>x.name==='Water'),[]);
});

test('random spawn selects distinct discoveries whenever possible and does not mutate inventory', () => {
  const before=[...items];
  assert.deepEqual(chooseSpawnElements([],2),[]);
  assert.equal(chooseSpawnElements(items,5,()=>0).length,5);
  assert.equal(new Set(chooseSpawnElements(items,5,()=>0)).size,5);
  assert.equal(chooseSpawnElements(items.slice(0,2),10,()=>0).length,10);
  assert.deepEqual(items,before);
});

test('spawn positions keep tiles near viewport center and inside the world',()=>{
  const viewport={scrollLeft:900,scrollTop:560,clientWidth:380,clientHeight:650};
  for(const count of SPAWN_COUNTS) {
    const positions=spawnPositions(count,viewport);
    assert.equal(positions.length,count);
    const unique=new Set(positions.map(p=>`${p.x},${p.y}`));
    assert.equal(unique.size,count);
    for(const p of positions) {
      assert.ok(p.x>=8 && p.x<=2640);
      assert.ok(p.y>=8 && p.y<=2135);
    }
  }
});

test("Discover Spawn is immediate while count selection lives inside More tools",()=>{
  const component=readFileSync(new URL('../src/components/InfiniteCraftView.tsx',import.meta.url),'utf8');
  assert.match(component,/className="boop-quiet-spawn"/);
  assert.match(component,/className="boop-board-more"/);
  assert.match(component,/aria-label="Random spawn count"/);
  assert.match(component,/aria-pressed=\{spawnCount===count\}/);
  assert.match(component,/onClick=\{\(\)=>setSpawnCount\(count\)\}/);
  assert.match(component,/onClick=\{\(\)=>spawnRandomBatch\(spawnCount\)\}/);
  assert.match(component,/SPAWN_COUNTS\.map/);
  assert.doesNotMatch(component,/spawnMenuOpen|boop-spawn-menu|SPAWN_SOURCES\.map/);
  assert.match(component,/chooseSpawnElements<InfiniteElement>\(spawnPool, count\)/);
  assert.match(component,/setCanvasItems\(previous =>/);
  assert.match(component,/setTimeout\(\(\) => setSpawnToast\(null\), 2400\)/);
});

test('Boop uses white canvas with legible dark controls in web and native Android',()=>{
  const css=readFileSync(new URL('../src/boop.css',import.meta.url),'utf8');
  const java=readFileSync(new URL('../android-shell/app/src/main/java/app/boop/collect/MainActivity.java',import.meta.url),'utf8');
  assert.match(css,/--boop-canvas: #ffffff;/);
  assert.match(css,/\.boop-app \.boop-board-world\s*\{\s*background-color:#fff!important;/);
  assert.match(css,/\.boop-app \.boop-board-layout \.boop-board-item\s*\{\s*background:#fff;/);
  assert.match(css,/\.boop-board-more-counts button\[aria-pressed=true\]/);
  assert.match(java,/setStatusBarColor\(Color\.WHITE\)/);
  assert.match(java,/toolbar\.setBackgroundColor\(Color\.WHITE\)/);
});

test('repeat batches avoid overlapping the same positions and retain owned item count',()=>{
  const viewport={scrollLeft:900,scrollTop:560,clientWidth:380,clientHeight:650};
  const first=spreadSpawnPositions(spawnPositions(2,viewport),[],1);
  const second=spreadSpawnPositions(spawnPositions(2,viewport),first,2);
  assert.equal(new Set([...first,...second].map(p=>`${p.x},${p.y}`)).size,4);
  assert.deepEqual(items.map(p=>p.name),['Water','Fire','Cloud','Ice','Flower']);
});
