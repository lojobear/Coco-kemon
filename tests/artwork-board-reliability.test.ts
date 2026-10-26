import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseArtworkTasks, ARTWORK_FAILURE_DELAY_MS, ARTWORK_QUEUE_KEY, ARTWORK_RATE_WINDOW_MS, ARTWORK_RATE_MAX_ATTEMPTS, artworkRateLimitDelay, nextArtworkQuotaResetUtc } from '../src/lib/artworkQueue';
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

test('artwork generation automatically resumes after rate-window instead of stopping per session', () => {
  const now = 1_000_000;
  assert.equal(ARTWORK_RATE_WINDOW_MS, 5 * 60_000);
  assert.equal(ARTWORK_RATE_MAX_ATTEMPTS, 6);
  assert.equal(artworkRateLimitDelay(5, now, now + 1000), 0);
  assert.equal(artworkRateLimitDelay(6, now, now + 1000), ARTWORK_RATE_WINDOW_MS - 1000);
  assert.equal(artworkRateLimitDelay(6, now, now + ARTWORK_RATE_WINDOW_MS), 0);
  const queue = readFileSync(new URL('../src/lib/artworkQueue.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(queue, /MAX_SESSION_ATTEMPTS/);
  assert.match(queue, /list\.unshift\(\{name:trimmed/);
  assert.match(queue, /rateLimitDelay\(\)>0/);
});

test('Sprite Lab can repair previously missed discoveries and rare bonus crafts get artwork', () => {
  const lab=readFileSync(new URL('../src/components/SpriteLabModal.tsx',import.meta.url),'utf8');
  assert.match(lab,/queueMissingArtwork\(craftElements, 5\)/);
  assert.match(lab,/Repair missing sprites/);
  assert.match(lab,/Retry queued art/);
  const craft=readFileSync(new URL('../src/components/InfiniteCraftView.tsx',import.meta.url),'utf8');
  assert.match(craft,/enqueueArtwork\(bonus\.result, false\)/);
});

test('quota-exhausted sprite jobs wait for the real Cloudflare UTC reset', () => {
  assert.equal(nextArtworkQuotaResetUtc(Date.UTC(2026, 9, 25, 22, 30)), Date.UTC(2026, 9, 26));
  assert.equal(nextArtworkQuotaResetUtc(Date.UTC(2026, 11, 31, 23, 59)), Date.UTC(2027, 0, 1));
  const queue=readFileSync(new URL('../src/lib/artworkQueue.ts',import.meta.url),'utf8');
  assert.match(queue,/Daily image allowance used up/);
  assert.match(queue,/nextArtworkQuotaResetUtc\(\)/);
});
