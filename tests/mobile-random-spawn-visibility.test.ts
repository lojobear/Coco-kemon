import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../src/lib/boardGeometry';
import {
  spawnPositions, spreadSpawnPositions, visibleSpawnBounds, type SpawnViewport,
} from '../src/lib/randomSpawn';

const viewportAtZoom=(width:number,height:number,zoom:number,offsetX=900,offsetY=560):SpawnViewport => ({
  scrollLeft:offsetX, scrollTop:offsetY, clientWidth:width/zoom,clientHeight:height/zoom,
});

function expectAllVisible(points:readonly {x:number;y:number}[],viewport:SpawnViewport) {
  const bounds=visibleSpawnBounds(viewport);
  for(const p of points) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(p.x >= bounds.minX-1 && p.x<=bounds.maxX+1, `x ${p.x} outside ${bounds.minX}..${bounds.maxX}`);
    assert.ok(p.y >= bounds.minY-1 && p.y<=bounds.maxY+1, `y ${p.y} outside ${bounds.minY}..${bounds.maxY}`);
    assert.ok(p.x+bounds.tileWidth <= viewport.scrollLeft+viewport.clientWidth-10,
      `tile right edge ${p.x+bounds.tileWidth} clipped by viewport ${viewport.scrollLeft+viewport.clientWidth}`);
    assert.ok(p.y+bounds.tileHeight <= viewport.scrollTop+viewport.clientHeight-10,
      `tile bottom edge ${p.y+bounds.tileHeight} clipped by viewport ${viewport.scrollTop+viewport.clientHeight}`);
    assert.ok(p.x>=8 && p.y>=8);
    assert.ok(p.x+bounds.tileWidth < BOARD_WIDTH);
    assert.ok(p.y+bounds.tileHeight < BOARD_HEIGHT);
  }
}

test('1, 2, 5 and 10 random elements all fit within phone viewports at every zoom',()=>{
  for(const [width,height,zoom] of [
    [320,360,1],[320,360,1.5],[360,560,1],[390,670,1.5],[390,670,0.6],
    [768,720,1],[1200,760,1.5],
  ]) {
    const viewport=viewportAtZoom(width,height,zoom);
    for(const count of [1,2,5,10]) {
      const spots=spawnPositions(count,viewport);
      assert.equal(spots.length,count);
      expectAllVisible(spots,viewport);
      const final=spreadSpawnPositions(spots,[],1,viewport);
      expectAllVisible(final,viewport);
    }
  }
});

test('repeated taps avoid covering nearby tiles but never push elements offscreen',()=>{
  for(const [width,height,zoom] of [[320,520,1.5],[390,670,1],[390,670,0.6]]) {
    const viewport=viewportAtZoom(width,height,zoom);
    const occupied: Array<{x:number;y:number}> = [];
    for(let tap=0;tap<20;tap++) {
      const count=tap%4===0?5:2;
      const chosen=spreadSpawnPositions(spawnPositions(count,viewport),occupied,tap+1,viewport);
      expectAllVisible(chosen,viewport);
      occupied.push(...chosen);
    }
    assert.equal(occupied.length,55);
  }
});

test('offscreen occupied tiles never cause a new random item to disappear',()=>{
  const viewport=viewportAtZoom(360,600,1.25);
  const outside=[
    {x:8,y:8},{x:BOARD_WIDTH-160,y:BOARD_HEIGHT-65},
    {x:viewport.scrollLeft-380,y:viewport.scrollTop-300},
  ];
  const spots=spreadSpawnPositions(spawnPositions(2,viewport),outside,20,viewport);
  expectAllVisible(spots,viewport);
});

test('spawns also remain in view after a pan near world boundaries',()=>{
  for(const zoom of [0.6,1,1.5]) {
    const vw=360/zoom,vh=520/zoom;
    const right=viewportAtZoom(360,520,zoom,BOARD_WIDTH-vw,BOARD_HEIGHT-vh);
    const top=viewportAtZoom(360,520,zoom,0,0);
    for(const viewport of [right,top]) {
      const points=spreadSpawnPositions(spawnPositions(10,viewport),[],4,viewport);
      expectAllVisible(points,viewport);
    }
  }
});

test('random button, suggested pairs and manual ingredient additions share safe viewport placement',()=>{
  const craft=readFileSync(new URL('../src/components/InfiniteCraftView.tsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/boop.css',import.meta.url),'utf8');
  assert.match(craft,/const currentWorldViewport = \(\): SpawnViewport \| null/);
  assert.match(craft,/const viewport = currentWorldViewport\(\);/);
  assert.match(craft,/spreadSpawnPositions\(baseSpots,canvasItemsRef\.current,batchId,viewport\)/);
  assert.match(craft,/spreadSpawnPositions\(spawnPositions\(1, viewport\), canvasItemsRef\.current, sequence, viewport\)/);
  assert.match(craft,/spawnTileMaxWidth=\{spawnTileMaxWidth\}/);
  assert.match(craft,/new ResizeObserver\(update\)/);
  assert.match(css,/\.boop-board-layout \.boop-board-item\.is-random-spawn > span:not\(\.element-emoji\)/);
});
