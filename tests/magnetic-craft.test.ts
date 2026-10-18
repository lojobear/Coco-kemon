import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nearestMagneticItem,
  shouldMagnetSnap,
  MAGNET_PREVIEW_RADIUS,
  MAGNET_SNAP_RADIUS_MOUSE,
  MAGNET_SNAP_RADIUS_TOUCH,
} from '../src/lib/magneticCraft';

const items = [
  { instanceId: 'water', x: 20, y: 40 },
  { instanceId: 'fire', x: 150, y: 40 },
  { instanceId: 'wind', x: 150, y: 155 },
];

test('magnetic preview selects only the closest OTHER item within its radius', () => {
  assert.equal(nearestMagneticItem(items, 'water', 125, 45, MAGNET_PREVIEW_RADIUS)?.item.instanceId, 'fire');
  assert.equal(nearestMagneticItem(items, 'water', 125, 45, 10), null);
  assert.equal(nearestMagneticItem([items[0]], 'water', 20, 40, MAGNET_PREVIEW_RADIUS), null);
  assert.equal(nearestMagneticItem(items, 'water', 200, 160, MAGNET_PREVIEW_RADIUS)?.item.instanceId, 'wind');
});

test('magnetic click is triggered by a meaningful approach, not touch-down or a swipe away', () => {
  assert.equal(shouldMagnetSnap(0, 50, 120, MAGNET_SNAP_RADIUS_MOUSE), false);
  assert.equal(shouldMagnetSnap(12, 50, 120, MAGNET_SNAP_RADIUS_MOUSE), false);
  assert.equal(shouldMagnetSnap(35, 90, 130, MAGNET_SNAP_RADIUS_MOUSE), false);
  assert.equal(shouldMagnetSnap(35, 70, 130, MAGNET_SNAP_RADIUS_MOUSE), true);
  assert.equal(shouldMagnetSnap(26, 79, 105, MAGNET_SNAP_RADIUS_TOUCH), true);
  assert.equal(shouldMagnetSnap(24, 82, 78, MAGNET_SNAP_RADIUS_TOUCH), false);
  assert.equal(shouldMagnetSnap(24, 69, 72, MAGNET_SNAP_RADIUS_TOUCH), false);
});
