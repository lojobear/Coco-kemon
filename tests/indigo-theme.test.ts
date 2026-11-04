import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/boop.css', import.meta.url), 'utf8');
// The indigo typography block: everything from its comment to the suggest-pair comment.
const block = css.slice(
  css.indexOf('/* Indigo typography on light surfaces.'),
  css.indexOf('/* A useful optional random suggestion'),
);

test('indigo light-surface text uses theme variables, not !important overrides', () => {
  assert.ok(block.length > 0, 'indigo block must exist');
  assert.doesNotMatch(block, /!important/, 'the indigo block must not force colours with !important');
  assert.match(block, /color:var\(--boop-ink\)/);
  assert.match(block, /color:var\(--boop-muted\)/);
  // The variables themselves still carry the audited contrast values on white:
  // #312e81 primary at 11.42:1, #514b8f secondary at 7.63:1.
  assert.match(css, /--boop-ink:\s*#312e81/);
  assert.match(css, /--boop-muted:\s*#514b8f/);
});

test('dark controls keep white text and are not overridden by the indigo block', () => {
  // Active navigation and dark dock controls are defined with white text.
  assert.match(css, /\.boop-navigation \.boop-nav-items button\[aria-current="page"\][\s\S]{0,200}?color:white/);
  assert.match(css, /\.combine-dock \.ingredient > span[\s\S]{0,120}?color:white/);
  // The indigo block only touches non-active nav buttons.
  assert.match(block, /\.boop-navigation \.boop-nav-items button:not\(\[aria-current="page"\]\)/);
  assert.doesNotMatch(block, /aria-current="page"\][\s\S]{0,80}?color:var\(--boop-ink\)/);
});
