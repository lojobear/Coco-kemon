import test from 'node:test';
import assert from 'node:assert/strict';
import { compactSchnellImagePrompt, generateGeminiImage, getGeminiImageModels, nextWorkersAiResetUtc } from '../server/gemini.js';
import { setWorkersAiBinding } from '../server/workersAi.js';
import { buildSpritePrompt } from '../server/emoji.js';

function verboseSpritePrompt() {
  return [
    'Create one premium pixel-art inventory sprite for this exact subject: "Obsidian Dragon".',
    'This is a reroll. Variation token: "upgrade-abc123". Keep the exact subject identity.',
    ...Array.from({ length: 30 }, () => 'Long high-quality material shading and distinctive anatomy instructions repeated for the premium image model.'),
  ].join('\n');
}

test('Schnell prompt fits 2048 characters while preserving Boop reference style', () => {
  const prompt = compactSchnellImagePrompt(verboseSpritePrompt());
  assert.ok(prompt.length <= 2048);
  assert.match(prompt, /Obsidian Dragon/);
  assert.match(prompt, /upgrade-abc123/);
  assert.match(prompt, /16-bit RPG item sprite/);
  assert.match(prompt, /BLACK-NAVY #1C2232/);
  assert.match(prompt, /48x48 or 64x64 logical grid/);
  assert.match(prompt, /#FF00FF/);
});

test('New native sprites use the user-supplied visual style without invalidating existing art', () => {
  const prompt = buildSpritePrompt('Sunflower');
  assert.match(prompt, /Sunflower/);
  assert.match(prompt, /LOCKED BOOP PIXEL ART STYLE/);
  assert.match(prompt, /thick nearly-black NAVY outer outline #1C2232/);
  assert.match(prompt, /Large connected blocks of saturated flat colors/);
  assert.match(prompt, /no soft gradients/i);
  assert.match(prompt, /#FF00FF/);
  const reroll = buildSpritePrompt('Sunflower', 'new-colors');
  assert.match(reroll, /Variation token: "new-colors"/);
  const compact = compactSchnellImagePrompt(prompt);
  assert.ok(compact.length <= 2048);
  assert.match(compact, /#1C2232/);
});

test('Shiny and compound sprites retain locked style across image providers', () => {
  const shiny = buildSpritePrompt('Moonstone Battery', '', true);
  assert.match(shiny, /SHINY \/ ALTERNATE COLORWAY/);
  assert.match(shiny, /#1C2232/);
  const shinySchnell = compactSchnellImagePrompt(shiny);
  assert.match(shinySchnell, /SHINY: switch the actual subject surface colors/);
  assert.match(shinySchnell, /#1C2232/);
  assert.ok(shinySchnell.length <= 2048);

  const reroll = buildSpritePrompt('Cheeseburger Combo', 'another-angle');
  assert.match(reroll, /Variation token: "another-angle"/);
  assert.match(reroll, /named meal\/set\/combination/);
  assert.match(reroll, /#FF00FF/);
  assert.match(reroll, /nearest-neighbor/);
  assert.match(compactSchnellImagePrompt(reroll), /another-angle/);
});

test('FLUX.2 receives the original detailed prompt; Schnell fallback receives the compact one', async () => {
  const calls: Array<{ model: string; input: any }> = [];
  setWorkersAiBinding({
    run: async (model: string, input: any) => {
      calls.push({ model, input });
      if (model.includes('flux-2-klein-4b')) throw new Error('quota exhausted');
      return { image: 'A'.repeat(200) };
    },
  });
  try {
    const output = await generateGeminiImage(verboseSpritePrompt());
    assert.equal(output.model, '@cf/black-forest-labs/flux-1-schnell');
    assert.deepEqual(calls.map(call => call.model), [
      '@cf/black-forest-labs/flux-2-klein-4b',
      '@cf/black-forest-labs/flux-1-schnell',
    ]);
    assert.ok(calls[0].input.multipart, 'FLUX.2 must retain its detailed multipart input');
    assert.ok(calls[1].input.prompt.length <= 2048);
    assert.match(calls[1].input.prompt, /Obsidian Dragon/);
    assert.match(calls[1].input.prompt, /#FF00FF/);
  } finally {
    setWorkersAiBinding(undefined);
  }
});

test('Gemini image fallback defaults to valid image model IDs', () => {
  const original = process.env.GEMINI_IMAGE_MODEL;
  try {
    delete process.env.GEMINI_IMAGE_MODEL;
    assert.deepEqual(getGeminiImageModels(), [
      'gemini-3.1-flash-lite-image',
      'gemini-3.1-flash-image',
    ]);
  } finally {
    if (original === undefined) delete process.env.GEMINI_IMAGE_MODEL;
    else process.env.GEMINI_IMAGE_MODEL = original;
  }
});

test('Gemini image retries a second image model after an unavailable first model', async () => {
  const original = process.env.GEMINI_IMAGE_MODEL;
  const calls: string[] = [];
  setWorkersAiBinding(undefined);
  try {
    delete process.env.GEMINI_IMAGE_MODEL;
    const fakeClient = {
      models: {
        generateContent: async ({ model }: { model: string }) => {
          calls.push(model);
          if (calls.length === 1) throw Object.assign(new Error('not found'), { status: 404 });
          return { candidates: [{ content: { parts: [{
            inlineData: { mimeType: 'image/png', data: 'B'.repeat(200) },
          }] } }] };
        },
      },
    };
    const result = await generateGeminiImage('one pixel-art item', fakeClient as any);
    assert.equal(result.model, 'gemini-3.1-flash-image');
    assert.deepEqual(calls, ['gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image']);
  } finally {
    if (original === undefined) delete process.env.GEMINI_IMAGE_MODEL;
    else process.env.GEMINI_IMAGE_MODEL = original;
  }
});

test('Workers AI quota cooldown ends at the next UTC midnight (also across year boundary)', () => {
  assert.equal(nextWorkersAiResetUtc(Date.UTC(2026, 9, 25, 23, 45)), Date.UTC(2026, 9, 26));
  assert.equal(nextWorkersAiResetUtc(Date.UTC(2026, 11, 31, 23, 59)), Date.UTC(2027, 0, 1));
});
