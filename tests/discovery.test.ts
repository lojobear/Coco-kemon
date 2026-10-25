import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { DISCOVERY_TRAILS, TRAIL_RECIPES, trailProgress, rollRareVariant } from '../src/lib/discoveryTrails';
import { CANONICAL_INFINITE_CRAFT_RECIPES, makePairKey, STARTER_ELEMENTS } from '../src/lib/infiniteCraftData';
import { ALL_PROCESSES, mergeProcesses, STARTER_MATERIALS } from '../src/lib/starterData';
import { chooseConcept, inheritanceFor, applyInheritance } from '../server/discovery';
import { validateCraft, parseSave } from '../src/lib/saveData';
import { INITIAL_HABITATS } from '../src/lib/starterData';
import { validMaterial } from '../src/lib/validation';

test('each trail is reachable from starter elements and never contradicts an existing recipe', () => {
  for (const trail of DISCOVERY_TRAILS) {
    const names = STARTER_ELEMENTS.map(e => e.name);
    for (const step of trail.steps) {
      assert.ok(names.includes(step.first) && names.includes(step.second), step.result);
      assert.equal(trailProgress(trail, names).ready, true);
      const recipe = CANONICAL_INFINITE_CRAFT_RECIPES[makePairKey(step.first, step.second)] || TRAIL_RECIPES[makePairKey(step.first, step.second)];
      assert.equal(recipe.result, step.result, 'preserve canonical recipe');
      names.push(step.result);
    }
    assert.equal(trailProgress(trail, names).completed, trail.steps.length);
    assert.equal(trailProgress(trail, names).next, undefined);
  }
});

test('rare variants have a 5% boundary and survive backup parsing with their ordinary result', () => {
  assert.equal(rollRareVariant('Glass', () => 0.05), undefined);
  assert.equal(rollRareVariant('Unknown', () => 0), undefined);
  const bonus = rollRareVariant('Glass', () => 0.04999)!;
  assert.equal(bonus.variantOf, 'Glass');
  const crafting = [...STARTER_ELEMENTS, { id: 'glass', name: 'Glass', emoji: '🥃' }, {
    id: 'aurora_glass', name: bonus.result, emoji: bonus.emoji, variantOf: bonus.variantOf,
    explanation: bonus.explanation, recipe: { first: 'Sand', second: 'Fire' },
  }];
  assert.ok(validateCraft(crafting));
  assert.equal(validateCraft([{ id: 'bad', name: 'Bad', emoji: 'x', variantOf: 42 }]), false);
  const foundry = { version: 1, materials: STARTER_MATERIALS, oddkinCollection: [], processes: ALL_PROCESSES, habitats: INITIAL_HABITATS, experiments: [] };
  assert.deepEqual(parseSave(JSON.stringify({ version: 2, crafting, foundry })).crafting, crafting);
});

test('candidate selection rejects incoherence and concatenation, favors a coherent surprise', () => {
  const candidate = (result: string, coherence: number, surprise: number) => ({ result, emoji: '✨', coherence, surprise, connection: 'function', explanation: 'The sand measures time inside glass.' });
  const result = chooseConcept({ candidates: [candidate('Glass Sand', 5, 5), candidate('Nonsense', 2, 5), candidate('Hourglass', 5, 4)] }, 'Glass', 'Sand');
  assert.equal(result?.result, 'Hourglass');
  assert.equal(result?.connection, 'function');
  assert.equal(chooseConcept({ candidates: [candidate('Nonsense', 2, 5)] }, 'Glass', 'Sand'), undefined);
});

test('old saves gain new processes while keeping earned unlocks', () => {
  const saved = ALL_PROCESSES.filter(p => !['FOSSILIZE','ENCHANT','MINIATURIZE','MOONLIGHT'].includes(p.id)).map(p => ({ ...p, unlocked: p.id === 'POLISH' || p.unlocked }));
  const merged = mergeProcesses(saved);
  assert.equal(new Set(merged.map(p => p.id)).size, merged.length);
  for (const id of ['POLISH','FOSSILIZE','ENCHANT','MINIATURIZE','MOONLIGHT','FERMENT']) assert.ok(merged.find(p => p.id === id)?.unlocked);
});

test('both parents affect inherited traits, colors and locomotion', () => {
  const a = STARTER_MATERIALS.find(m => m.canonicalName === 'PLANT')!;
  const b = STARTER_MATERIALS.find(m => m.canonicalName === 'METAL')!;
  const process = ALL_PROCESSES.find(p => p.id === 'MOONLIGHT')!;
  const traits = inheritanceFor(a, b, process);
  assert.ok(traits.traits.some(t => t.startsWith(a.displayName + ':')));
  assert.ok(traits.traits.some(t => t.startsWith(b.displayName + ':')));
  assert.equal(traits.primaryColor, a.spriteDescriptor.primaryColor);
  assert.equal(traits.locomotion, 'hop');
  const result = applyInheritance({ inheritedMaterialTraits: [], morphology: {}, spriteSpecification: { featureDetails: [], outlineColor: '#111111' } } as any, a, b, process);
  assert.equal(result.spriteSpecification.primaryColor, a.spriteDescriptor.primaryColor);
  assert.equal(result.spriteSpecification.secondaryColor, b.spriteDescriptor.secondaryColor);
  assert.ok(result.spriteSpecification.featureDetails.some(t => t.includes('crescent')));
});

test('new trail and process recipes work through API without Gemini', async () => {
  process.env.NODE_ENV = 'test'; delete process.env.GEMINI_API_KEY;
  const { app } = await import('../server');
  const server = app.listen(0); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    for (const trail of DISCOVERY_TRAILS) {
      for (const step of trail.steps) {
        const r = await fetch(`${base}/api/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first: step.first, second: step.second }) });
        assert.equal(r.status, 200); assert.equal((await r.json()).result, step.result);
      }
    }
    for (const [id, input, name] of [['FOSSILIZE','PLANT','Fern Fossil'],['ENCHANT','STONE','Wardstone'],['MINIATURIZE','METAL','Microgear'],['MOONLIGHT','WATER','Moon Dew']]) {
      const r = await fetch(`${base}/api/synthesize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inputMaterialA: STARTER_MATERIALS.find(m => m.canonicalName === input), process: ALL_PROCESSES.find(p => p.id === id) }) });
      const data = await r.json(); assert.equal(r.status, 200); assert.equal(data.material.displayName, name); assert.ok(validMaterial(data.material));
    }
  } finally { server.close(); await once(server, 'close'); }
});
