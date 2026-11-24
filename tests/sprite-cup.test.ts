import assert from 'node:assert/strict';
import test from 'node:test';
import { CUP_LIMIT, createCupToken, deviceCupTilt, dragCupToken, shakeCup, stepCup } from '../src/lib/spriteCup';

test('cup tokens rise when shaken and settle when held still', () => {
  const tokens = Array.from({ length: CUP_LIMIT }, (_, index) => createCupToken(String(index), index));
  for (let step = 0; step < 500; step++) stepCup(tokens, 0, 0);
  const settled = tokens.map(token => token.z);
  shakeCup(tokens, 1, () => .2);
  for (let step = 0; step < 15; step++) stepCup(tokens, 0, 0);
  assert.ok(tokens.some((token, index) => token.z > settled[index] + .12));
  for (let step = 0; step < 900; step++) stepCup(tokens, 0, 0);
  assert.ok(tokens.every(token => Math.abs(token.vz) < .01));
});

test('dragging and sustained tilt keep tokens inside the cup', () => {
  const left = createCupToken('left', 0), right = createCupToken('right', 1);
  dragCupToken(left, -7, 9, .016);
  const point = [left.x, left.y, left.z];
  stepCup([left, right], 1, -1, left.id);
  assert.deepEqual([left.x, left.y, left.z], point);
  shakeCup([left, right], 1.45, () => .7);
  for (let step = 0; step < 550; step++) stepCup([left, right], 1, -1);
  assert.ok([left, right].every(token => Math.hypot(token.x, token.y) <= .79 + token.z * .14 - .16 + 1e-10));
  assert.ok([left, right].every(token => token.z >= .16 && token.z <= .93 - .16));
});

test('phone tilt is calibrated and remapped to landscape', () => {
  const center = { beta: 30, gamma: 10 };
  assert.deepEqual(deviceCupTilt(30, 10, center, 0), { x: 0, y: 0 });
  assert.ok(deviceCupTilt(30, 50, center, 0).x > .8);
  assert.ok(deviceCupTilt(30, 50, center, 90).y < -.8);
});
