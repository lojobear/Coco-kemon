export const CABINET_WIDTH = 480;
export const CABINET_HEIGHT = 320;
export const RAIL_Y = 28;
export const CHUTE_X = 440;
export const FLOOR_Y = 292;
export const CLAW_STEP = 1 / 120;
export const DIVIDER_X = 396;
const HOME_LENGTH = 48;
const GRIP_OFFSET = 19;

type Phase = 'aim' | 'lower' | 'grip' | 'lift' | 'return' | 'deliver' | 'done';
type Prize = { x: number; y: number; vx: number; vy: number; radius: number; angle: number };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const approach = (value: number, target: number, distance: number) =>
  value + clamp(target - value, -distance, distance);

export function createClawMachine(random = Math.random) {
  const slots = [0, 1, 2, 3, 4];
  for (let index = slots.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [slots[index], slots[swap]] = [slots[swap], slots[index]];
  }
  const prizes: Prize[] = slots.map(slot => ({
    x: 50 + slot * 68 + random() * 22, y: 204 - random() * 66,
    vx: random() * 44 - 22, vy: 0, radius: 21, angle: 0,
  }));
  return {
    prizes, phase: 'aim' as Phase, x: 190, target: 190, velocity: 0, length: HOME_LENGTH,
    swing: 0, swingSpeed: 0, jaw: 1, timer: 0, held: undefined as Prize | undefined,
    released: undefined as Prize | undefined, won: false,
  };
}

export type ClawMachine = ReturnType<typeof createClawMachine>;

export function aimClaw(machine: ClawMachine, x: number) {
  if (machine.phase === 'aim') machine.target = clamp(x, 34, DIVIDER_X - 32);
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

export function stepClaw(machine: ClawMachine) {
  const dt = CLAW_STEP;
  const previousVelocity = machine.velocity;
  machine.velocity = approach(machine.velocity, clamp((machine.target - machine.x) * 6, -240, 240), 920 * dt);
  machine.x += machine.velocity * dt;
  const acceleration = (machine.velocity - previousVelocity) / dt;
  machine.swingSpeed += (-22 * Math.sin(machine.swing) - 4 * machine.swingSpeed - acceleration / 170) * dt;
  machine.swing = clamp(machine.swing + machine.swingSpeed * dt, -.48, .48);

  const tip = clawTip(machine);
  for (const prize of machine.prizes) {
    if (prize === machine.held) continue;
    prize.vy += 860 * dt;
    prize.x += prize.vx * dt;
    prize.y += prize.vy * dt;
    prize.angle += prize.vx * dt / prize.radius;
    const left = prize === machine.released ? DIVIDER_X + prize.radius : prize.radius;
    const right = (prize === machine.released ? CABINET_WIDTH : DIVIDER_X) - prize.radius;
    if (prize.x < left || prize.x > right) {
      prize.x = clamp(prize.x, left, right);
      prize.vx *= -.46;
    }
    if (prize.y + prize.radius >= FLOOR_Y) {
      prize.y = FLOOR_Y - prize.radius;
      prize.vy = prize.vy > 34 ? -prize.vy * .37 : 0;
      prize.vx *= .92;
    }
  }

  for (const [index, a] of machine.prizes.entries()) {
    if (a === machine.held || a === machine.released) continue;
    for (let other = index + 1; other < machine.prizes.length; other++) {
      const b = machine.prizes[other];
      if (b === machine.held || b === machine.released) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= a.radius + b.radius) continue;
      const nx = distance ? dx / distance : 1, ny = distance ? dy / distance : 0;
      const separation = (a.radius + b.radius - distance) / 2;
      a.x -= separation * nx;
      a.y -= separation * ny;
      b.x += separation * nx;
      b.y += separation * ny;
      const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (closing <= 0) continue;
      const impulse = closing * .66;
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;
    }
  }

  switch (machine.phase) {
    case 'lower': {
      machine.length += 188 * dt;
      const updatedTip = clawTip(machine);
      const near = machine.prizes.filter(prize =>
        Math.abs(prize.x - updatedTip.x) < 31 && Math.abs(prize.y - updatedTip.y - GRIP_OFFSET) < 11,
      ).sort((a, b) => Math.abs(a.x - updatedTip.x) - Math.abs(b.x - updatedTip.x))[0];
      if (near || updatedTip.y >= FLOOR_Y - 27) {
        machine.phase = 'grip';
        machine.timer = 0;
      }
      break;
    }
    case 'grip':
      machine.timer += dt;
      machine.jaw = Math.max(0, 1 - machine.timer / .24);
      if (!machine.jaw) {
        machine.held = machine.prizes.find(prize =>
          Math.abs(prize.x - tip.x) < 17 && Math.abs(prize.y - tip.y - GRIP_OFFSET) < 16,
        );
        machine.phase = 'lift';
      }
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
          machine.released.vx = machine.velocity;
          machine.released.vy = 0;
          machine.held = undefined;
          machine.phase = 'deliver';
        } else {
          machine.phase = 'done';
        }
      }
      break;
    case 'deliver':
      if (machine.released && machine.released.y + machine.released.radius >= FLOOR_Y && !machine.released.vy) {
        machine.won = true;
        machine.phase = 'done';
      }
      break;
  }

  if (machine.held) {
    const grip = clawTip(machine);
    machine.held.x = approach(machine.held.x, grip.x, 420 * dt);
    machine.held.y = approach(machine.held.y, grip.y + GRIP_OFFSET, 420 * dt);
    machine.held.angle = machine.swing;
  }
}
