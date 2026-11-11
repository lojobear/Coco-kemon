import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Random is on the board, directly to the left of Filter, not beside Combine',()=>{
  const view=file('src/components/InfiniteCraftView.tsx');
  const primary=view.slice(view.indexOf('className="toybox-primary-actions"'),view.indexOf('className="toybox-board-secondary"'));
  assert.match(primary,/className="toybox-combine"/);
  assert.doesNotMatch(primary,/className="toybox-random"/);
  const board=view.slice(view.indexOf('className="boop-board-actions boop-board-actions--quiet"'),
    view.indexOf('<div className="boop-board-more-panel">'));
  assert.match(board,/className="toybox-random"[\s\S]*className="boop-board-more"/);
  assert.equal((view.match(/className="toybox-random"/g)||[]).length,1);
  assert.match(board,/onClick=\{\(\) => spawnRandomBatch\(spawnCount\)\}/);
  assert.match(board,/disabled=\{isSynthesizing \|\| foundryBusy \|\| !spawnPool\.length \|\| canvasItems\.length >= 300\}/);
  assert.match(board,/aria-label=\{`Spawn \$\{spawnCount\} random/);
});

test('The Filter panel still owns random amount, source and category settings',()=>{
  const view=file('src/components/InfiniteCraftView.tsx');
  assert.match(view,/aria-label="Random spawn count"/);
  assert.match(view,/aria-label="Random spawn source"/);
  assert.match(view,/aria-label="Random spawn category"/);
  assert.match(view,/aria-label="Random spawn rarity"/);
  assert.match(view,/className="toybox-board-secondary"/);
  assert.match(view,/Random pair<\/button>/);
  assert.match(view,/className="toybox-combine"/);
});

test('Board controls stay compact and readable on small Android screens',()=>{
  const css=file('src/toybox.css');
  assert.match(css,/\.boop-toybox\.boop-app \.boop-board-toolbar--quiet \{flex-wrap:nowrap;\}/);
  assert.match(css,/\.boop-toybox\.boop-app \.boop-board-actions--quiet > \.toybox-random/);
  assert.match(css,/min-height:40px/);
  assert.match(css,/min-width:0/);
  assert.match(css,/\.boop-toybox\.boop-app \.boop-board-actions--quiet > \.toybox-random span \{[\s\S]*display:inline!important/);
  assert.match(css,/@media\(max-width:359px\)/);
  assert.match(css,/boop-board-more > summary/);
});
