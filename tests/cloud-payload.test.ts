import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCloudPayload } from '../src/lib/cloudSave';
import { STARTER_MATERIALS, ALL_PROCESSES, INITIAL_HABITATS } from '../src/lib/starterData';
import { STARTER_ELEMENTS } from '../src/lib/infiniteCraftData';

test('cloud backup preserves the current version’s shiny discoveries and both collections', () => {
  const payload = {
    version: 2,
    crafting: [...STARTER_ELEMENTS, { id: 'shiny-coffee', name: 'Coffee', emoji: '☕', isShiny: true, unlockedShiny: true, recipe: { first: 'Bean', second: 'Water' } }],
    foundry: { materials: STARTER_MATERIALS, oddkinCollection: [], processes: ALL_PROCESSES, habitats: INITIAL_HABITATS, experiments: [] },
  };
  assert.deepEqual(JSON.parse(validateCloudPayload(payload)), payload);
  assert.throws(() => validateCloudPayload({ ...payload, version: 3 }), /Unsupported/);
  assert.throws(() => validateCloudPayload({ ...payload, crafting: [{ id: 'broken', isShiny: 'yes' }] }), /Invalid/);
  assert.throws(() => validateCloudPayload({ ...payload, extra: 'x'.repeat(8 * 1024 * 1024) }), /cloud limit/);
});
