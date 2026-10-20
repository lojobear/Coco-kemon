import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Discover shows one concise transient image failure instead of a sticky verbose quota error', () => {
  const source = readFileSync(new URL('../src/components/InfiniteCraftView.tsx', import.meta.url), 'utf8');
  assert.match(source, /setTimeout\(\(\) => setSpriteIssue\(null\), 12_000\)/);
  assert.match(source, /lastSpriteNoticeAtRef\.current < 90_000/);
  assert.match(source, /setSpriteIssue\(null\);\s*latestSpriteRequestRef\.current = cleanName/);
  assert.match(source, /Runware needs a valid API key in Cloudflare/);
  assert.doesNotMatch(source, /\{spriteIssue\.message\} Your discovery is saved and temporary pixel art is available/);
});
