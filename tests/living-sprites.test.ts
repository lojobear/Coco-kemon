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

import { livingSpriteMotion } from '../src/lib/livingSpriteMotion';
test('semantic animation follows the subject, not its ingredient or name length', () => {
  const examples = [
    ['Water','liquid'],['Ocean','liquid'],['Fire','flame'],['Lava','flame'],
    ['Fire Truck','vehicle'],['Fire Dragon','creature'],['Fox','creature'],
    ['Robot','machine'],['Engine','machine'],['Computer','machine'],
    ['Tree','plant'],['Moon','orbit'],['Galaxy','orbit'],['Ghost','ghost'],
    ['Cloud','weather'],['Steam','weather'],['Diamond','crystal'],['Chair','object'],
  ] as const;
  for (const [name,motion] of examples) assert.equal(livingSpriteMotion(name),motion,name);
  assert.equal(livingSpriteMotion('Ferrum Hopper','Oddkin & Creatures'),'creature');
  assert.equal(livingSpriteMotion('Python (programming)'),'machine');
  assert.equal(livingSpriteMotion('Python (snake)'),'creature');
});
test('semantic effects preserve art, use CSS transforms and have a reduced-motion stop',()=>{
  const semantic=css.slice(css.indexOf('/* Subject-specific living sprite motion.'));
  for(const motion of ['creature','liquid','flame','plant','machine','vehicle','orbit','ghost','weather','crystal'])
    assert.ok(semantic.includes('@keyframes boop-life-'+motion));
  assert.match(semantic,/prefers-reduced-motion:reduce/);
  assert.match(semantic,/:nth-last-child\(-n\+12 of \.boop-board-item\)/);
  assert.match(semantic,/:has\(> \.is-dragging\)/);
  assert.doesNotMatch(semantic,/filter:\s*(?:invert|hue-rotate)/);
});
