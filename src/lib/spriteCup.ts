export const CUP_LIMIT = 8;
export const CUP_STEP = 1 / 120;
const TOKEN_RADIUS = .16;
const FLOOR = TOKEN_RADIUS;
const TOP = .93 - TOKEN_RADIUS;

export type CupToken = {
  id: string;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  roll: number; pitch: number; spin: number;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const wallRadius = (z: number) => .79 + z * .14 - TOKEN_RADIUS;

export function createCupToken(id: string, slot: number): CupToken {
  const angle = slot * 2.39996;
  const distance = slot === 0 ? 0 : .27 + slot * .036;
  return {
    id, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, z: .43,
    vx: 0, vy: 0, vz: 0, roll: angle, pitch: .65, spin: 0,
  };
}

export function shakeCup(tokens: readonly CupToken[], strength = 1, random = Math.random) {
  for (const token of tokens) {
    const angle = random() * Math.PI * 2;
    token.vx += Math.cos(angle) * strength * 2;
    token.vy += Math.sin(angle) * strength * 2;
    token.vz = Math.max(token.vz, 2.25 * strength);
    token.spin += (random() - .5) * 14 * strength;
  }
}

function constrain(token: CupToken) {
  token.z = clamp(token.z, FLOOR, TOP);
  const radius = wallRadius(token.z);
  const distance = Math.hypot(token.x, token.y);
  if (distance <= radius) return;
  token.x *= radius / distance;
  token.y *= radius / distance;
}

export function dragCupToken(token: CupToken, dx: number, dy: number, elapsed: number) {
  const x = token.x, y = token.y;
  token.x += dx;
  token.y += dy;
  token.z = Math.max(token.z, .34);
  constrain(token);
  token.vx = clamp((token.x - x) / elapsed, -4, 4);
  token.vy = clamp((token.y - y) / elapsed, -4, 4);
  token.vz = 0;
}

export function stepCup(tokens: readonly CupToken[], tiltX: number, tiltY: number, dragged?: string) {
  const dt = CUP_STEP;
  for (const token of tokens) {
    if (token.id === dragged) continue;
    token.vx = clamp((token.vx + tiltX * 7 * dt) * .993, -5, 5);
    token.vy = clamp((token.vy + tiltY * 7 * dt) * .993, -5, 5);
    token.vz = clamp(token.vz - 5.9 * dt, -5, 5);
    token.x += token.vx * dt;
    token.y += token.vy * dt;
    token.z += token.vz * dt;
    if (token.z <= FLOOR) {
      token.vz = token.vz < -.32 ? -token.vz * .53 : 0;
      token.vx *= .973;
      token.vy *= .973;
    }
    if (token.z >= TOP && token.vz > 0) token.vz *= -.6;
    const distance = Math.hypot(token.x, token.y);
    if (distance > wallRadius(token.z)) {
      const nx = token.x / distance, ny = token.y / distance;
      const normalSpeed = Math.max(0, token.vx * nx + token.vy * ny);
      token.vx -= nx * normalSpeed * 1.62;
      token.vy -= ny * normalSpeed * 1.62;
      token.spin += (nx * token.vy - ny * token.vx) * normalSpeed;
    }
    constrain(token);
    token.spin *= .985;
    token.roll = (token.roll + (token.spin + token.vx * 1.5) * dt) % (2 * Math.PI);
    token.pitch = (token.pitch + (token.vy * 3 + token.spin * .38) * dt) % (2 * Math.PI);
    if (token.z === FLOOR) token.pitch += Math.atan2(Math.sin(.65 - token.pitch), Math.cos(.65 - token.pitch)) * .07;
  }

  for (let first = 0; first < tokens.length; first++) {
    const a = tokens[first];
    for (let second = first + 1; second < tokens.length; second++) {
      const b = tokens[second];
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance >= TOKEN_RADIUS * 2) continue;
      const nx = distance ? dx / distance : 1, ny = distance ? dy / distance : 0, nz = distance ? dz / distance : 0;
      const weightA = a.id === dragged ? 0 : 1, weightB = b.id === dragged ? 0 : 1;
      const gap = (TOKEN_RADIUS * 2 - distance) / (weightA + weightB);
      const impulse = Math.max(0, (a.vx - b.vx) * nx + (a.vy - b.vy) * ny + (a.vz - b.vz) * nz)
        * 1.48 / (weightA + weightB);
      a.x -= nx * gap * weightA; a.y -= ny * gap * weightA; a.z -= nz * gap * weightA;
      b.x += nx * gap * weightB; b.y += ny * gap * weightB; b.z += nz * gap * weightB;
      a.vx -= nx * impulse * weightA; a.vy -= ny * impulse * weightA; a.vz -= nz * impulse * weightA;
      b.vx += nx * impulse * weightB; b.vy += ny * impulse * weightB; b.vz += nz * impulse * weightB;
      constrain(a);
      constrain(b);
    }
  }
}

export function deviceCupTilt(beta: number, gamma: number, center: { beta: number; gamma: number }, angle: number) {
  const x = clamp(Math.sin((gamma - center.gamma) * Math.PI / 180) * 1.5, -1, 1);
  const y = clamp(Math.sin((beta - center.beta) * Math.PI / 180) * 1.5, -1, 1);
  const radians = angle * Math.PI / 180;
  return { x: x * Math.cos(radians) + y * Math.sin(radians), y: y * Math.cos(radians) - x * Math.sin(radians) };
}
