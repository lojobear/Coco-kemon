import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProcedurePreferences, rememberProcedure } from '../src/lib/procedurePreferences';
import { tidyBoard } from '../src/lib/tidyBoard';

test('procedure preferences tolerate corrupt storage and bound recent history without duplicates', () => {
  assert.deepEqual(parseProcedurePreferences('invalid'), { favorites: [], recent: [] });
  assert.deepEqual(parseProcedurePreferences('{"favorites":["MELT","MELT",5,"<script>"],"recent":null}'), { favorites: ['MELT'], recent: [] });
  let preferences = { favorites: ['MELT'], recent: [] as string[] };
  for (const id of ['MIX', 'MELT', 'HEAT', 'FREEZE', 'CRUSH', 'BOIL', 'MELT', 'GRIND']) preferences = rememberProcedure(preferences, id);
  assert.deepEqual(preferences.recent, ['GRIND', 'MELT', 'BOIL', 'CRUSH', 'FREEZE', 'HEAT']);
  assert.deepEqual(preferences.favorites, ['MELT']);
});

test('Tidy fits measured, uneven tiles inside a zoomed and panned phone viewport', () => {
  const tiles = Array.from({ length: 6 }, (_, i) => ({ instanceId: String(i), width: 136, height: i === 2 ? 180 : 104 }));
  const view = { width: 290, height: 360, left: 2600, top: 1800 };
  const result = tidyBoard(tiles, view, 1.5);
  assert.equal(result.fits, true);
  assert.ok(result.zoom >= .6 && result.zoom <= 1.5);
  for (const [i, position] of result.positions.entries()) {
    assert.ok(position.x >= result.left && position.x + tiles[i].width <= result.left + view.width / result.zoom);
    assert.ok(position.y >= result.top && position.y + tiles[i].height <= result.top + view.height / result.zoom);
    for (let j = 0; j < i; j++) {
      const other = result.positions[j];
      assert.ok(position.x >= other.x + tiles[j].width || other.x >= position.x + tiles[i].width || position.y >= other.y + tiles[j].height || other.y >= position.y + tiles[i].height);
    }
  }
  assert.equal(new Set(result.positions.map(p => p.instanceId)).size, tiles.length);
});

test('overflow Tidy preserves every tile in reachable vertical rows without horizontal overflow', () => {
  const tiles = Array.from({ length: 300 }, (_, i) => ({ instanceId: String(i), width: 156, height: 200 }));
  const result = tidyBoard(tiles, { width: 300, height: 350, left: 900, top: 700 }, 1);
  assert.equal(result.fits, false);
  assert.equal(result.positions.length, 300);
  assert.ok(result.positions.every(p => p.x + 156 <= result.left + 300 / result.zoom));
  assert.ok(result.positions[299].y > result.positions[0].y);
});
