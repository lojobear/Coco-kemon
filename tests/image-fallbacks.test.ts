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

test('Schnell compact prompt fits model limit and keeps accurate Habbo-like isometric style', () => {
  const prompt = compactSchnellImagePrompt(verboseSpritePrompt());
  assert.ok(prompt.length <= 2048);
  assert.match(prompt, /Obsidian Dragon/);
  assert.match(prompt, /upgrade-abc123/);
  assert.match(prompt, /isometric/i);
  assert.match(prompt, /2:1/);
  assert.match(prompt, /true subject colours/i);
  assert.match(prompt, /#FF00FF/);
  assert.doesNotMatch(prompt, /BLACK-NAVY #1C2232/);
});

test('Subject-specific art direction avoids global brown cast and repeated generic shape', async () => {
  const { spriteColorDirection } = await import('../server/spriteStyle.js');
  const lake = spriteColorDirection('Ice Lake');
  const leaf = spriteColorDirection('Green Leaf');
  const battery = spriteColorDirection('Electric Battery');
  const bread = spriteColorDirection('Toasted Bread');
  assert.match(lake, /azure|cyan|teal/i);
  assert.match(leaf, /green|emerald/i);
  assert.match(battery, /silver|cyan/i);
  assert.match(bread, /brown/i);
  assert.notEqual(lake, leaf);
  assert.notEqual(lake, battery);
  const prompt = buildSpritePrompt('Ice Lake');
  assert.match(prompt, /original classic virtual-hotel FURNI/i);
  assert.match(prompt, /orthographic ISOMETRIC 2:1/);
  assert.match(prompt, /BOLD BUT PRECISE FURNI READABILITY/);
  assert.match(prompt, /NO glitch-like artifacts/);
  assert.match(prompt, /broken outlines, stray pixels/);
  assert.match(prompt, /Most non-wooden sprites must contain NO brown/);
  assert.match(prompt, /SUBJECT-BASED PALETTE:.*Aquatic or ice elements/);
  assert.match(prompt, /#FF00FF/);
  assert.doesNotMatch(prompt, /thick nearly-black NAVY outer outline/);
  const compact = compactSchnellImagePrompt(prompt);
  assert.ok(compact.length <= 2048);
  assert.match(compact, /Aquatic or ice elements/);
});

test('Shiny and reroll keep the same object but different palette and geometry', () => {
  const shiny = buildSpritePrompt('Cobalt Battery', '', true);
  assert.match(shiny, /SHINY \/ ALTERNATE COLORWAY/);
  const snabb = compactSchnellImagePrompt(shiny);
  assert.match(snabb, /SHINY: change/);
  assert.match(snabb, /cool silver\/graphite casing/);
  const reroll = buildSpritePrompt('Chess Table', 'new-angle');
  assert.match(reroll, /Variation token: "new-angle"/);
  assert.match(compactSchnellImagePrompt(reroll), /new-angle/);
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


test('concrete semantic subjects survive premium and compact fallback prompts', async () => {
  const {spriteSubjectDirection}=await import('../server/spriteStyle.js');
  assert.match(spriteSubjectDirection('Glassblowing'), /long metal blowpipe/);
  assert.match(spriteSubjectDirection('Space Rations'), /open silver foil pouch/);
  for (const [name, detail] of [['Glassblowing',/blowpipe/],['Space Rations',/food ration KIT/]] as const) {
    const premium=buildSpritePrompt(name);
    assert.match(premium,/SUBJECT DESIGN:/);
    assert.match(premium,detail);
    const compact=compactSchnellImagePrompt(premium);
    assert.ok(compact.length<=2048);
    assert.match(compact,detail);
    assert.match(compact,/RECOGNIZABLE SUBJECT, NOT GEOMETRIC PLACEHOLDER/);
  }
});
