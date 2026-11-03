import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { boardCenter, clampBoardTile, BOARD_WIDTH, BOARD_HEIGHT } from '../src/lib/boardGeometry';
import { parseBoardLayout } from '../src/lib/boardLayout';
import { playerCraftStats } from '../src/lib/playerStats';
import type { InfiniteElement } from '../src/lib/infiniteCraftData';

const source = (path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('board uses stable world-space coordinates while panning',()=>{
  assert.deepEqual(boardCenter(800,550,400,700),{x:1000,y:900});
  assert.deepEqual(clampBoardTile(-50,3000),{x:8,y:BOARD_HEIGHT-65});
  assert.deepEqual(clampBoardTile(9000,-20),{x:BOARD_WIDTH-160,y:8});
});
test('profile aggregates deduplicated saved stats without counting starter ingredients as discoveries',()=>{
  const input:InfiniteElement[]=[
    {id:'water',name:'Water',emoji:'💧'},
    {id:'cloud',name:'Cloud',emoji:'☁️',discoveredAt:Date.now()-1000,isNew:true,craftCount:7,unlockedShiny:true,shinyCraftCount:2,recipe:{first:'Wind',second:'Steam'}},
    {id:'cloud-copy',name:'CLOUD',emoji:'☁️',craftCount:99},
    {id:'tea',name:'Tea',emoji:'🍵',discoveredAt:Date.now()-1000,craftCount:3,recipe:{first:'Water',second:'Plant'}}
  ];
  const stats=playerCraftStats(input);
  assert.equal(stats.totalElements,3);
  assert.equal(stats.uniqueDiscoveries,2);
  assert.equal(stats.shinyVariants,1);
  assert.equal(stats.firstFinds,1);
  assert.equal(stats.totalCrafts,10);
  assert.equal(stats.shinyCrafts,2);
  assert.equal(stats.uniqueRecipes,2);
  assert.equal(stats.mostCrafted[0].name,'Cloud');
  assert.ok(stats.activity.some(d=>d.count>0));
});
test('Discover uses the full board with tappable tiles, deliberate collisions and a drawer',()=>{
  const react=source('src/components/InfiniteCraftView.tsx');
  const css=source('src/boop.css');
  assert.match(react,/boop-board-viewport/);
  assert.match(react,/boop-board-world/);
  assert.match(react,/handlePointerDown\(item,e\)/);
  assert.match(react,/findCraftDropTarget/);
  assert.match(react,/boop-board-fusion/);
  assert.match(react,/boop-board-ingredient-grid/);
  assert.doesNotMatch(react,/Open freeform board/);
  assert.match(css,/@keyframes boop-board-click/);
  assert.match(css,/touch-action:pan-x pan-y/);
});
test('profiles are navigable on Android and web and use saved records',()=>{
  const profile=source('src/components/PlayerProfile.tsx');
  const app=source('src/App.tsx');
  const native=source('android-shell/app/src/main/java/app/boop/collect/MainActivity.java');
  assert.match(profile,/playerCraftStats\(elements\)/);
  assert.match(profile,/cloud\.auth\.updateUser/);
  assert.match(profile,/SAVE_CHANGED_EVENT/);
  assert.match(profile,/onOpenCloud/);
  assert.match(app,/activeTab === 'profile'/);
  assert.match(native,/"profile", "Profile"/);
});

test('board layout restoration preserves positions but cannot leak forgotten items or malformed records',()=>{
  const collection:InfiniteElement[]=[{id:'water',name:'Water',emoji:'💧'},{id:'ice',name:'Ice',emoji:'🧊',unlockedShiny:true}];
  const parsed=parseBoardLayout([
    {instanceId:'good',name:'Ice',emoji:'wrong',x:1400,y:800,isShiny:true},
    {instanceId:'duplicate',name:'Unknown Item',x:1300,y:800},
    {instanceId:'broken',name:'Ice',x:Infinity,y:0},
    {instanceId:'good',name:'Water',x:600,y:400}
  ],collection);
  assert.equal(parsed?.length,1);
  assert.deepEqual(parsed?.[0],{instanceId:'good',name:'Ice',emoji:'🧊',x:1400,y:800,isShiny:true});
  assert.equal(parseBoardLayout(null,collection),null);
});
