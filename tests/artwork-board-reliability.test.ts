import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseArtworkTasks, ARTWORK_FAILURE_DELAY_MS, ARTWORK_QUEUE_KEY } from '../src/lib/artworkQueue';
import { beginBoardHistory,recordBoardHistory,undoBoard,redoBoard,clampBoardZoom } from '../src/lib/boardHistory';

test('artwork retries survive reload without duplicates or unsafe provider data',()=>{
  const raw=[
    {name:'Glacier Quill',shiny:false,attempts:1,nextAttemptAt:200,lastError:'offline'},
    {name:'glacier quill',shiny:false,attempts:99,nextAttemptAt:0},
    {name:'Glacier Quill',shiny:true,attempts:0,nextAttemptAt:0},
    {name:'',shiny:false},{name:'x'.repeat(200),shiny:false},
  ];
  const tasks=parseArtworkTasks(raw);
  assert.equal(tasks.length,2);
  assert.equal(tasks[0].name,'Glacier Quill');
  assert.equal(tasks[1].shiny,true);
  assert.equal(ARTWORK_FAILURE_DELAY_MS,30*60_000);
  assert.equal(ARTWORK_QUEUE_KEY,'boop-artwork-pending-v1');
});

test('undo and redo only rewind board snapshots',()=>{
  const initial=[{id:'a',x:1}];
  let h=beginBoardHistory(initial);
  h=recordBoardHistory(h,[...initial,{id:'b',x:2}]);
  h=recordBoardHistory(h,[{id:'a',x:22}]);
  assert.equal(h.past.length,2);
  h=undoBoard(h);
  assert.equal(h.present.length,2);
  assert.equal(h.future.length,1);
  h=redoBoard(h);
  assert.equal(h.present[0].x,22);
  h=undoBoard(h);
  h=recordBoardHistory(h,[{id:'a',x:30}]);
  assert.equal(h.future.length,0);
  assert.equal(clampBoardZoom(.2),.6);
  assert.equal(clampBoardZoom(1.9),1.5);
  assert.equal(clampBoardZoom(1.13),1.13);
});

test('craft board uses artwork queue, zoom-safe pointer geometry and accessible controls',()=>{
  const src=readFileSync(new URL('../src/components/InfiniteCraftView.tsx',import.meta.url),'utf8');
  assert.match(src,/enqueueArtwork\(cleanName, false\)/);
  assert.match(src,/enqueueArtwork\(cleanName, true\)/);
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  assert.match(app,/startArtworkQueue\(\)/);
  assert.doesNotMatch(src,/startArtworkQueue\(\)/);
  assert.match(src,/Undo last board action/);
  assert.match(src,/Redo board action/);
  assert.match(src,/Zoom in/);
  assert.match(src,/Zoom out/);
  assert.doesNotMatch(src,/boop-artwork-queue|Drawing artwork|artStatus\.pending/);
  assert.match(src,/zoom:boardZoom/);
  assert.match(src,/drag\.currentX - drag\.startX\) \/ zoomRef\.current/);
  assert.doesNotMatch(src,/AI artwork pending: \{spriteIssue\.name\}/);
});
