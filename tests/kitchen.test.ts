import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createCraftingPlan } from '../src/lib/kitchen/originalPlanner';
import { PRESET_IDEAS } from '../src/lib/kitchen/catalog';
import { collectKitchenStep, validKitchenPlan, runKitchenStep, sourceInventory, type KitchenRecipe } from '../src/lib/kitchen/engine';
import { validateCraft } from '../src/lib/saveData';
import { registerKitchenRoute } from '../server/kitchen';

test('original Kitchen sample plans have executable dependency chains', () => {
  for (const idea of PRESET_IDEAS) {
    const plan = createCraftingPlan(idea.name);
    assert.equal(validKitchenPlan(plan), true, idea.name);
    let inventory = sourceInventory(plan);
    for (const step of plan.steps) inventory = runKitchenStep(step, inventory);
    assert.ok(inventory.has(idea.name.toLowerCase()));
  }
});
test('Kitchen never executes missing dependencies or accepts malformed plans', () => {
  const plan = createCraftingPlan('Macchiato');
  assert.throws(() => runKitchenStep(plan.steps.at(-1)!, new Set()));
  assert.equal(validKitchenPlan({ ...plan, steps: [...plan.steps].reverse() }), false);
  assert.equal(validKitchenPlan({ ...plan, steps: [] }), false);
});
test('completed recipes preserve uploads, deduplicate and survive the shared save format', () => {
  const plan = createCraftingPlan('Macchiato');
  const recipe: KitchenRecipe = { ...plan, goal: 'Macchiato', source: 'local', createdAt: 100 };
  const prior = [{ id: 'my-coffee', name: 'MACCHIATO', emoji: '☕', customSpriteUrl: 'data:image/png;base64,dGVzdA==', discoveredAt: 20 }];
  const next = collectKitchenStep(prior, plan.steps.at(-1)!, recipe);
  assert.equal(next.length, 1); assert.equal(next[0].customSpriteUrl, prior[0].customSpriteUrl);
  assert.equal(next[0].discoveredAt, 20);
  assert.ok(validateCraft(JSON.parse(JSON.stringify(next))));
  assert.deepEqual(next[0].kitchenRecipe, recipe);
});
test('AI Kitchen route validates requests, caches plans and rejects broken recipes', async () => {
  let calls = 0;
  const app = express(); app.use(express.json());
  registerKitchenRoute(app, async () => { calls++; return JSON.stringify(createCraftingPlan('Macchiato')); });
  const server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}/api/kitchen/plan`;
  const post = (goal: unknown) => fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({goal}) });
  try {
    assert.equal((await post('')).status,400);
    assert.equal((await post('Macchiato')).status,200);
    assert.equal((await post('Macchiato')).status,200); assert.equal(calls,1);
    assert.equal((await post('Wrong Goal')).status,502);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
