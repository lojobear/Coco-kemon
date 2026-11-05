import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Discover persists pending artwork and does not show repeated provider quota errors', () => {
  const source=readFileSync(new URL('../src/components/InfiniteCraftView.tsx',import.meta.url),'utf8');
  const queue=readFileSync(new URL('../src/lib/artworkQueue.ts',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  const studio=readFileSync(new URL('../src/components/SpriteLabModal.tsx',import.meta.url),'utf8');
  assert.match(app,/startArtworkQueue/);
  assert.match(studio,/artworkQueueStatus/);
  assert.match(studio,/Repair missing sprites/);
  assert.match(source,/enqueueArtwork\(cleanName, false\)/);
  assert.match(studio,/retryPendingArtwork/);
  assert.match(queue,/ARTWORK_FAILURE_DELAY_MS/);
  assert.match(queue,/pausedUntil/);
  assert.doesNotMatch(source,/\{spriteIssue\.message\} Your discovery is saved and temporary pixel art is available/);
});


test('Sprite Lab rechecks locally recovered art and mounts gallery thumbnails in batches', () => {
  const emoji=readFileSync(new URL('../src/lib/elementEmoji.ts',import.meta.url),'utf8');
  const grid=readFileSync(new URL('../src/components/SpriteLabModal.tsx',import.meta.url),'utf8');
  const element=readFileSync(new URL('../src/components/ElementSprite.tsx',import.meta.url),'utf8');
  const image=readFileSync(new URL('../src/components/SpriteImage.tsx',import.meta.url),'utf8');
  // Local cache/profile reads notify the grid without asking AI to generate anything.
  assert.match(emoji,/memory\.set\(key, cached\);\s*announceSpriteReady\(key\)/);
  assert.match(emoji,/await save\(ELEMENT_SPRITE_CACHE_PREFIX \+ key, data\);\s*announceSpriteReady\(key\)/);
  assert.match(element,/oddkin-emoji-retry/);
  assert.match(element,/rootMargin: '240px 0px'/);
  // A failed Android image decoder can recover when the sprite later appears.
  assert.match(image,/quarkpop-sprite-ready/);
  assert.match(image,/window\.addEventListener\('online', retryFailed\)/);
  // Never mount the entire collection's image decoders into a single mobile view.
  assert.match(grid,/items\.slice\(0, galleryLimit\)\.map/);
  assert.match(grid,/Show more sprites/);
});
