import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/boop.css', import.meta.url), 'utf8');
const block = css.slice(css.indexOf('/* Living sprites:'));

test('living sprites use bounded artwork-only motion and respect reduced motion', () => {
  assert.ok(block.startsWith('/* Living sprites:'));
  assert.match(block, /@media \(prefers-reduced-motion:no-preference\)/);
  for (const motion of ['hop','sway','breathe','react']) {
    assert.ok(block.includes('@keyframes boop-living-' + motion));
  }
  assert.ok(block.includes(':nth-last-child(-n+12 of .boop-board-item)'));
  assert.ok(block.includes('.element-emoji > img'));
  assert.match(block, /\.sprite-idle\s*\{\s*animation:none;\s*will-change:auto;/);
  assert.match(block, /:has\(> \.is-dragging\)[\s\S]*?animation:none;/);
  assert.ok(block.includes('.boop-album-detail-hero'));
  assert.ok(block.includes('.boop-sprite-preview'));
  assert.ok(block.includes('.combine-dock.is-combining'));
  assert.doesNotMatch(block, /will-change:\s*transform/);
});
