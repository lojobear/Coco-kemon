import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Guard against performance regressions that don't need live credentials. */
test('sprite overhaul preserves offline previews and consumes no AI for gallery reads', () => {
  const artwork = readFileSync(new URL('../src/lib/elementEmoji.ts', import.meta.url), 'utf8');
  const viewport = readFileSync(new URL('../src/lib/spriteViewport.ts', import.meta.url), 'utf8');
  const tile = readFileSync(new URL('../src/components/ElementSprite.tsx', import.meta.url), 'utf8');
  assert.match(artwork, /if \(!generateIfMissing\)/);
  assert.match(artwork, /if \(localStorageError\) throw localStorageError/);
  assert.match(artwork, /MAX_SPRITE_MEMORY_ENTRIES = 48/);
  assert.match(artwork, /if \(database === opening\) database = undefined/);
  assert.match(artwork, /Generated artwork is available but not persisted locally/);
  assert.match(tile, /observeSpriteViewport\(host.current, load\)/);
  assert.doesNotMatch(tile, /new IntersectionObserver/);
  assert.match(viewport, /new IntersectionObserver/);
});

test('recovery scans yield to paint and never regenerate known cached art on browse', () => {
  const recovery = readFileSync(new URL('../src/lib/spriteRecoveryClient.ts', import.meta.url), 'utf8');
  const profile = readFileSync(new URL('../src/lib/spriteAssets.ts', import.meta.url), 'utf8');
  const image = readFileSync(new URL('../src/components/SpriteImage.tsx', import.meta.url), 'utf8');
  assert.match(recovery, /SCAN_BATCH_SIZE = 8/);
  assert.match(recovery, /setTimeout\(resolve,32\)/);
  assert.match(recovery, /getElementEmoji\(item.name,false,'',false,item.shiny\)/);
  assert.match(profile, /MAX_PROFILE_DOWNLOADS = 48/);
  assert.match(image, /if \(!hasFailed\) return/);
  assert.doesNotMatch(image, /window\.addEventListener\('quarkpop-sprite-ready'/);
});
