import test from 'node:test';
import assert from 'node:assert/strict';
import { isScanComplete, spriteInventoryItems } from '../src/lib/missingSpriteInventory';

const item = (name: string, discoveredAt = 1) => ({
  id: name, name, shiny: false, key: name.toLowerCase(), discoveredAt, customArt: false,
});

test('scan is not complete when the list grew mid-scan', () => {
  const oldItems = [item('Old'), item('Older')];
  const scanned = { old: true, older: true };
  // checked matches the old total, but a new item has no result yet.
  assert.equal(isScanComplete([...oldItems, item('New')], scanned, 2), false);
  assert.equal(isScanComplete(oldItems, scanned, 2), true);
});

test('scan is not complete while any item is still unchecked', () => {
  assert.equal(isScanComplete([item('A'), item('B')], { a: true }, 1), false);
});

test('custom-art items do not block scan completion', () => {
  const custom = { ...item('Custom'), customArt: true };
  assert.equal(isScanComplete([item('A'), custom], { a: true }, 1), true);
});

test('inventory sorts newest first so the queue checks new sprites first', () => {
  const items = spriteInventoryItems([
    { id: '1', name: 'Old', discoveredAt: 10 },
    { id: '2', name: 'New', discoveredAt: 99 },
  ] as any[]);
  assert.equal(items[0].name, 'New');
});
