import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpritePrompt, SPRITE_ENGINE_VERSION } from '../server/emoji';
import { compactSchnellImagePrompt } from '../server/gemini';

test('future sprite prompts describe the reference style for both image models', () => {
  const full = buildSpritePrompt('Grandfather Clock');
  assert.match(full, /richly rendered collectible game pixel art/i);
  assert.match(full, /layered midtones/i);
  assert.match(full, /glass reflections/i);
  assert.match(full, /do not force unrelated items/i);
  const compact = compactSchnellImagePrompt(full);
  assert.ok(compact.length <= 2048);
  assert.match(compact, /hand-placed pixel clusters/i);
  assert.match(compact, /rich layered shading/i);
  assert.match(compact, /#FF00FF/);
  assert.equal(SPRITE_ENGINE_VERSION, 'v13-semantic-object-furni', 'existing cached sprites remain reusable');
});

test('shiny prompts retain a distinct colourway and the subject', () => {
  const full = buildSpritePrompt('Fox', '', true);
  assert.match(full, /SHINY \/ ALTERNATE COLORWAY/);
  assert.match(compactSchnellImagePrompt(full), /Fox/);
  assert.match(compactSchnellImagePrompt(full), /SHINY:/);
});
