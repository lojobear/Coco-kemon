import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Discover persists pending artwork and does not show repeated provider quota errors', () => {
  const source=readFileSync(new URL('../src/components/InfiniteCraftView.tsx',import.meta.url),'utf8');
  const queue=readFileSync(new URL('../src/lib/artworkQueue.ts',import.meta.url),'utf8');
  assert.match(source,/artworkQueueStatus/);
  assert.match(source,/startArtworkQueue/);
  assert.match(source,/boop-artwork-queue/);
  assert.match(source,/enqueueArtwork\(cleanName, false\)/);
  assert.match(source,/retryPendingArtwork/);
  assert.match(queue,/ARTWORK_FAILURE_DELAY_MS/);
  assert.match(queue,/pausedUntil/);
  assert.doesNotMatch(source,/\{spriteIssue\.message\} Your discovery is saved and temporary pixel art is available/);
});
