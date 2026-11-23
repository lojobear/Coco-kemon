import test from 'node:test';
import assert from 'node:assert/strict';
import { aimClaw, CLAW_STEP, createClawMachine, dropClaw, stepClaw } from '../src/lib/clawMachine';
import { applyClawReward } from '../src/lib/clawRewards';
import { earnedCopyCounts } from '../src/lib/elementCopies';
import { emptyPersonalRooms, sanitizePersonalRooms, validPersonalRooms, type RoomPiece } from '../src/lib/personalRoom';

const advance = (machine: ReturnType<typeof createClawMachine>, seconds: number) => {
  for (let step = 0; step < seconds / CLAW_STEP; step++) stepClaw(machine);
};

test('a centered grab lifts its prize and only awards it after delivery', () => {
  const machine = createClawMachine(() => .5);
  const prize = machine.prizes[0];
  advance(machine, 2);
  aimClaw(machine, prize.x);
  advance(machine, 2);
  dropClaw(machine);
  advance(machine, 2);
  assert.equal(machine.won, false);
  advance(machine, 5);
  assert.equal(machine.phase, 'done');
  assert.equal(machine.won, true);
});

test('a drop between prizes returns empty', () => {
  const machine = createClawMachine(() => .5);
  aimClaw(machine, 95);
  advance(machine, 2);
  dropClaw(machine);
  advance(machine, 7);
  assert.equal(machine.phase, 'done');
  assert.equal(machine.won, false);
});

test('a saved claw prize can be placed without a discovery or reputation unlock', () => {
  const rooms = emptyPersonalRooms();
  const fern: RoomPiece = {
    id: 'won-fern', kind: 'decoration', name: 'fern', nickname: '', variant: 'normal',
    x: 4, y: 4, size: 1, flipped: false,
  };
  rooms.rooms[0].pieces.push(fern);
  assert.deepEqual(sanitizePersonalRooms(rooms, [], 0).rooms[0].pieces, []);
  rooms.clawPrizes = ['fern'];
  assert.deepEqual(sanitizePersonalRooms(rooms, [], 0), rooms);
  assert.equal(validPersonalRooms({ ...rooms, clawPrizes: ['unknown'] }), false);
  assert.equal(validPersonalRooms({ ...rooms, clawPrizes: ['fern', 'fern'] }), false);
});

test('claw rewards favor new items, then add one copy after the pool is collected', () => {
  const first = applyClawReward([], 0, 100);
  assert.equal(first.item.name, 'Amber Bell');
  assert.equal(first.item.recipe, undefined);
  assert.equal(earnedCopyCounts(first.item).normal, 1);
  assert.notEqual(applyClawReward([], .9).item.name, first.item.name);

  let owned = first.elements;
  for (let index = 1; index < 64; index++) {
    const reward = applyClawReward(owned, 0, 100 + index);
    assert.equal(reward.item.isNew, true);
    owned = reward.elements;
  }
  const repeat = applyClawReward(owned, 0, 500);
  assert.equal(repeat.elements.length, 64);
  assert.equal(repeat.item.id, first.item.id);
  assert.equal(repeat.item.discoveredAt, 100);
  assert.equal(repeat.item.lastCraftedAt, 500);
  assert.equal(earnedCopyCounts(repeat.item).normal, 2);
});
