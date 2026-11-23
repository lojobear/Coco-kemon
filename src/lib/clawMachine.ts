export const CABINET_WIDTH = 480;
export const CABINET_HEIGHT = 320;
export const RAIL_Y = 28;
export const CHUTE_X = 440;
export const FLOOR_Y = 292;
export const CLAW_STEP = 1 / 120;
export const DIVIDER_X = 396;
export const BOWL_X = 198;
export const BOWL_Y = 240;
export const BOWL_RADIUS = 151;
export const DEPTH_SCALE = .24;
export const BOWL_RIM_Y = BOWL_Y - 19;
const HOME_LENGTH = 48;
const GRIP_OFFSET = 21;
const CAPSULE_RADIUS = 21;
const LOWER_SPEED = 220;

type Phase = 'aim' | 'lower' | 'grip' | 'lift' | 'return' | 'deliver' | 'done';
type Point = { x: number; y: number; z: number };
type Prize = Point & { vx: number; vy: number; vz: number; radius: number; angle: number; inBowl: boolean };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const approach = (value: number, target: number, distance: number) =>
  value + clamp(target - value, -distance, distance);

export function createClawMachine(random = Math.random) {
  const bowlAngle = random() * Math.PI * 2;
  const bowlSpeed = (random() < .5 ? -1 : 1) * (.82 + random() * .26);
  const prizes: Prize[] = Array.from({ length: 5 }, (_, index) => {
    const angle = bowlAngle + index * Math.PI * 2 / 5;
    const distance = 68 + random() * 51;
    const z = Math.sin(angle) * distance;
    const offset = Math.cos(angle) * distance;
    return {
      x: BOWL_X + offset, y: BOWL_Y - CAPSULE_RADIUS - 9 - random() * 20, z,
      vx: -z * bowlSpeed, vy: 0, vz: offset * bowlSpeed,
      radius: CAPSULE_RADIUS, angle, inBowl: true,
    };
  });
  return {
    prizes, phase: 'aim' as Phase, x: BOWL_X, target: BOWL_X, velocity: 0, length: HOME_LENGTH,
    swing: 0, swingSpeed: 0, jaw: 1, timer: 0, held: undefined as Prize | undefined,
    gripStrength: 0, slipped: false, bowlAngle, bowlSpeed,
    released: undefined as Prize | undefined, won: false,
  };
}

export type ClawMachine = ReturnType<typeof createClawMachine>;

export function aimClaw(machine: ClawMachine, x: number) {
  if (machine.phase === 'aim') machine.target = clamp(x, BOWL_X - BOWL_RADIUS + 15, BOWL_X + BOWL_RADIUS - 15);
}

export function dropClaw(machine: ClawMachine) {
  if (machine.phase === 'aim') machine.phase = 'lower';
}

export function clawTip(machine: ClawMachine) {
  return {
    x: machine.x + Math.sin(machine.swing) * machine.length,
    y: RAIL_Y + Math.cos(machine.swing) * machine.length,
  };
}

export const jawAngle = (openness: number) => -.12 - .65 * openness;

function fingertip(machine: ClawMachine, side: number): Point {
  const rotation = jawAngle(machine.jaw);
  // Follow the inside tip of the same pivoting finger drawn on the cabinet.
  const x = side * (11 - 7 * Math.cos(rotation) - 21 * Math.sin(rotation));
  const y = 2 - 7 * Math.sin(rotation) + 21 * Math.cos(rotation);
  const tip = clawTip(machine);
  return {
    x: tip.x + x * Math.cos(machine.swing) + y * Math.sin(machine.swing),
    y: tip.y - x * Math.sin(machine.swing) + y * Math.cos(machine.swing),
    z: 0,
  };
}

function bowlHeight(radius: number) {
  const slope = clamp((radius - 75) / (BOWL_RADIUS - 75), 0, 1);
  return BOWL_Y - 19 * slope * slope;
}

function movePrize(prize: Prize, machine: ClawMachine) {
  const dt = CLAW_STEP;
  prize.vy += 860 * dt;
  prize.x += prize.vx * dt;
  prize.y += prize.vy * dt;
  prize.z += prize.vz * dt;
  prize.angle += prize.vx * dt / (prize.radius * 2);
  const offset = prize.x - BOWL_X;
  const radius = Math.hypot(offset, prize.z);
  const limit = BOWL_RADIUS - prize.radius;
  const bowlFloor = bowlHeight(Math.min(radius, BOWL_RADIUS));

  if (!prize.inBowl && prize !== machine.released && radius <= limit && prize.y + prize.radius >= bowlFloor) {
    prize.inBowl = true;
  }
  if (prize.inBowl) {
    if (radius > limit) {
      const nx = offset / radius, nz = prize.z / radius;
      prize.x = BOWL_X + nx * limit;
      prize.z = nz * limit;
      const outward = Math.max(0, prize.vx * nx + prize.vz * nz) * 1.28;
      prize.vx -= nx * outward;
      prize.vz -= nz * outward;
    }
    if (prize.y + prize.radius >= bowlFloor) {
      prize.y = bowlFloor - prize.radius;
      prize.vy = prize.vy > 46 ? -prize.vy * .29 : 0;
      // Surface friction transfers the spin to the capsule without pinning it to a slot.
      prize.vx += (-prize.z * machine.bowlSpeed - prize.vx) * 8 * dt;
      prize.vz += ((prize.x - BOWL_X) * machine.bowlSpeed - prize.vz) * 8 * dt;
      const inward = machine.bowlSpeed ** 2 + Math.max(0, radius - 95) * .014;
      prize.vx -= offset * inward * dt;
      prize.vz -= prize.z * inward * dt;
    }
    return;
  }

  const inChute = prize === machine.released;
  const left = (inChute ? DIVIDER_X : 0) + prize.radius;
  const right = (inChute ? CABINET_WIDTH : DIVIDER_X) - prize.radius;
  if (prize.x < left || prize.x > right) {
    prize.x = clamp(prize.x, left, right);
    prize.vx *= -.38;
  }
  if (prize.y + prize.z * DEPTH_SCALE + prize.radius >= FLOOR_Y) {
    prize.y = FLOOR_Y - prize.z * DEPTH_SCALE - prize.radius;
    prize.vy = prize.vy > 34 ? -prize.vy * .37 : 0;
    prize.vx *= .92;
    prize.vz *= .92;
  }
}

function collidePrizes(a: Prize, b: Prize) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance >= a.radius + b.radius) return;
  const nx = distance ? dx / distance : 1, ny = distance ? dy / distance : 0, nz = distance ? dz / distance : 0;
  const separation = (a.radius + b.radius - distance) / 2;
  a.x -= separation * nx;
  a.y -= separation * ny;
  a.z -= separation * nz;
  b.x += separation * nx;
  b.y += separation * ny;
  b.z += separation * nz;
  const impulse = Math.max(0, (a.vx - b.vx) * nx + (a.vy - b.vy) * ny + (a.vz - b.vz) * nz) * .64;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  a.vz -= impulse * nz;
  b.vx += impulse * nx;
  b.vy += impulse * ny;
  b.vz += impulse * nz;
}

function closeJaws(machine: ClawMachine) {
  const left = fingertip(machine, -1), right = fingertip(machine, 1);
  const tip = clawTip(machine);
  for (const prize of machine.prizes) {
    const reach = prize.radius + 2;
    const leftContact = Math.hypot(prize.x - left.x, prize.y - left.y, prize.z * .72) <= reach;
    const rightContact = Math.hypot(prize.x - right.x, prize.y - right.y, prize.z * .72) <= reach;
    if (leftContact && rightContact && prize.x >= left.x && prize.x <= right.x) {
      machine.held = prize;
      prize.inBowl = false;
      const alignment = Math.hypot(prize.x - tip.x, prize.y - tip.y - GRIP_OFFSET, prize.z);
      machine.gripStrength = clamp(1.08 - alignment / 55 - Math.abs(prize.vz) / 550, .22, 1);
      return;
    }
    if (leftContact !== rightContact) {
      // A single finger can move a capsule but cannot lift it on its own.
      const contact = leftContact ? left : right;
      const distance = Math.hypot(prize.x - contact.x, prize.y - contact.y, prize.z) || 1;
      const push = Math.max(0, reach - distance) * 31 * CLAW_STEP / distance;
      prize.vx += (prize.x - contact.x) * push;
      prize.vz += prize.z * push;
    }
  }
}

function carryPrize(machine: ClawMachine) {
  const prize = machine.held;
  if (!prize) return;
  const tip = clawTip(machine);
  const dx = tip.x + Math.sin(machine.swing) * GRIP_OFFSET - prize.x;
  const dy = tip.y + Math.cos(machine.swing) * GRIP_OFFSET - prize.y;
  const stretch = Math.hypot(dx, dy, prize.z);
  // The capsule hangs on a damped grip. Off-center catches have less tolerance for load.
  machine.gripStrength -= Math.max(0, stretch - 7) * .06 * CLAW_STEP;
  if (stretch > 11 + machine.gripStrength * 40 || machine.gripStrength <= 0) {
    machine.held = undefined;
    machine.slipped = true;
    return;
  }
  prize.vx += (dx * 510 - prize.vx * 28) * CLAW_STEP;
  prize.vy += (dy * 510 - prize.vy * 28) * CLAW_STEP;
  prize.vz += (-prize.z * 510 - prize.vz * 28) * CLAW_STEP;
  prize.x += prize.vx * CLAW_STEP;
  prize.y += prize.vy * CLAW_STEP;
  prize.z += prize.vz * CLAW_STEP;
  prize.angle = approach(prize.angle, machine.swing, 6 * CLAW_STEP);
}

export function stepClaw(machine: ClawMachine) {
  const dt = CLAW_STEP;
  machine.bowlAngle = (machine.bowlAngle + machine.bowlSpeed * dt) % (Math.PI * 2);
  const previousVelocity = machine.velocity;
  machine.velocity = approach(machine.velocity, clamp((machine.target - machine.x) * 6, -240, 240), 920 * dt);
  machine.x += machine.velocity * dt;
  const acceleration = (machine.velocity - previousVelocity) / dt;
  machine.swingSpeed += (-22 * Math.sin(machine.swing) - 4 * machine.swingSpeed - acceleration / 170) * dt;
  machine.swing = clamp(machine.swing + machine.swingSpeed * dt, -.48, .48);

  const loose = machine.prizes.filter(prize => prize !== machine.held);
  for (const prize of loose) movePrize(prize, machine);
  for (const [index, a] of loose.entries()) {
    if (!a.inBowl) continue;
    for (let other = index + 1; other < loose.length; other++) {
      const b = loose[other];
      if (b.inBowl) collidePrizes(a, b);
    }
  }

  switch (machine.phase) {
    case 'lower': {
      machine.length += LOWER_SPEED * dt;
      const tip = clawTip(machine);
      const nearCapsule = loose.some(prize =>
        Math.abs(prize.z) < 27 && Math.abs(prize.x - tip.x) < 27 &&
        Math.abs(prize.y - tip.y - GRIP_OFFSET) < 5,
      );
      if (nearCapsule || tip.y + GRIP_OFFSET >= bowlHeight(Math.abs(tip.x - BOWL_X)) - CAPSULE_RADIUS) {
        machine.phase = 'grip';
        machine.timer = 0;
      }
      break;
    }
    case 'grip':
      machine.timer += dt;
      machine.jaw = Math.max(0, 1 - machine.timer / .20);
      closeJaws(machine);
      if (machine.held || !machine.jaw) machine.phase = 'lift';
      break;
    case 'lift':
      machine.length = approach(machine.length, HOME_LENGTH, 196 * dt);
      if (machine.length === HOME_LENGTH) {
        machine.phase = 'return';
        machine.target = CHUTE_X;
      }
      break;
    case 'return':
      if (Math.abs(machine.x - CHUTE_X) < 1 && Math.abs(machine.swing) < .025) {
        machine.jaw = 1;
        if (machine.held) {
          machine.released = machine.held;
          machine.held = undefined;
          machine.phase = 'deliver';
        } else {
          machine.phase = 'done';
        }
      }
      break;
    case 'deliver':
      if (machine.released && machine.released.y + machine.released.z * DEPTH_SCALE + machine.released.radius >= FLOOR_Y - .001 && !machine.released.vy) {
        machine.won = true;
        machine.phase = 'done';
      }
      break;
  }

  carryPrize(machine);
}
