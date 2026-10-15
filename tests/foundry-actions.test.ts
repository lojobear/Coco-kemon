import test from 'node:test';
import assert from 'node:assert/strict';
import { FOUNDRY_ACTIONS } from '../src/lib/foundryActions';
import { ALL_PROCESSES } from '../src/lib/starterData';
import { EXTRA_PROCESSES } from '../src/lib/extraProcesses';

test('foundry actions: exactly 50 entries with unique ids', () => {
  assert.equal(FOUNDRY_ACTIONS.length, 50);
  const ids = FOUNDRY_ACTIONS.map(a => a.id);
  assert.equal(new Set(ids).size, 50);
});

test('foundry actions: every entry has the required Process fields and is unlocked', () => {
  for (const a of FOUNDRY_ACTIONS) {
    assert.ok(a.id && /^[A-Z_]+$/.test(a.id), `bad id: ${a.id}`);
    assert.ok(a.name && a.name.length > 0, `missing name: ${a.id}`);
    assert.ok(a.verb && a.verb.length > 0, `missing verb: ${a.id}`);
    assert.ok(a.description && a.description.length > 0, `missing description: ${a.id}`);
    assert.ok(a.symbol && a.symbol.length > 0, `missing symbol: ${a.id}`);
    assert.equal(a.unlocked, true, `${a.id} should be unlocked`);
  }
});

test('foundry actions: no id collides with existing processes', () => {
  const existing = new Set(EXTRA_PROCESSES.map(p => p.id));
  for (const a of FOUNDRY_ACTIONS) {
    assert.ok(!existing.has(a.id), `collision: ${a.id}`);
  }
});

test('foundry actions: merged into ALL_PROCESSES exactly once', () => {
  for (const a of FOUNDRY_ACTIONS) {
    const matches = ALL_PROCESSES.filter(p => p.id === a.id);
    assert.equal(matches.length, 1, `${a.id} should appear exactly once in ALL_PROCESSES`);
  }
});

test('foundry actions: verbs read naturally after the process name', () => {
  for (const a of FOUNDRY_ACTIONS) {
    assert.ok(!a.verb.endsWith(' '), `trailing space in verb: ${a.id}`);
    assert.ok(a.verb[0] === a.verb[0].toLowerCase(), `verb should start lowercase: ${a.id}`);
  }
});
