import test from 'node:test';
import assert from 'node:assert/strict';
import { aimClaw, BOWL_RADIUS, BOWL_X, CLAW_STEP, createClawMachine, dropClaw, stepClaw } from '../src/lib/clawMachine';
import { applyClawReward } from '../src/lib/clawRewards';
import { earnedCopyCounts } from '../src/lib/elementCopies';
import { emptyPersonalRooms, sanitizePersonalRooms, validPersonalRooms, type RoomPiece } from '../src/lib/personalRoom';

const advance = (machine: ReturnType<typeof createClawMachine>, seconds: number) => {
  for (let step = 0; step < seconds / CLAW_STEP; step++) stepClaw(machine);
};

function aimedDrop(x: number, steps: number) {
  const machine = createClawMachine(() => .5);
  aimClaw(machine, x);
  for (let step = 0; step < steps; step++) stepClaw(machine);
  dropClaw(machine);
  return machine;
}

test('the bowl drives free capsule motion and keeps capsules in bounds', () => {
  const machine = createClawMachine(() => .5);
  const before = machine.prizes.map(prize => prize.x);
  const angle = machine.bowlAngle;
  advance(machine, 1);
  assert.notEqual(machine.bowlAngle, angle);
  assert.ok(machine.prizes.some((prize, index) => Math.abs(prize.x - before[index]) > 15));
  assert.ok(machine.prizes.every(prize => Math.hypot(prize.x - BOWL_X, prize.z) <= BOWL_RADIUS - prize.radius + 1));
});

test('a timed grab lifts a capsule and only awards it after reaching the chute', () => {
  const machine = aimedDrop(108, 230);
  for (let step = 0; step < 300 && !machine.held; step++) stepClaw(machine);
  assert.ok(machine.held);
  assert.equal(machine.won, false);
  advance(machine, 7);
  assert.equal(machine.phase, 'done');
  assert.equal(machine.won, true);
});

test('an off-center pinch can lift and then slip without awarding a prize', () => {
  const machine = aimedDrop(101, 235);
  for (let step = 0; step < 300 && !machine.held; step++) stepClaw(machine);
  assert.ok(machine.held);
  advance(machine, 7);
  assert.equal(machine.phase, 'done');
  assert.equal(machine.slipped, true);
  assert.equal(machine.won, false);
});

test('a drop through an empty lane comes back without a prize', () => {
  const machine = aimedDrop(BOWL_X, 240);
  advance(machine, 7);
  assert.equal(machine.phase, 'done');
  assert.equal(machine.slipped, false);
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
