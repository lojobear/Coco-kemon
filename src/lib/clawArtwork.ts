import {
  BOWL_RADIUS, BOWL_RIM_Y, BOWL_X, BOWL_Y, CABINET_HEIGHT, CABINET_WIDTH, CHUTE_X, clawTip,
  DEPTH_SCALE, DIVIDER_X, FLOOR_Y, jawAngle, RAIL_Y, type ClawMachine,
} from './clawMachine';

type Context = CanvasRenderingContext2D;
const ink = '#15162e';
const shell = '#40325f';
const lights = [
  ['#6b285f', '#ea76a4'], ['#235c72', '#70dece'], ['#754229', '#ffc276'],
  ['#3d4288', '#aaa3ff'], ['#346043', '#a1dc82'],
];

function block(ctx: Context, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function plate(ctx: Context, color: string, x: number, y: number, width: number, height: number, corner: number) {
  block(ctx, color, x + corner, y, width - 2 * corner, height);
  block(ctx, color, x, y + corner, width, height - 2 * corner);
}

function ellipse(ctx: Context, color: string, y: number, radius: number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(BOWL_X, y, radius, radius * DEPTH_SCALE, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintBowl(ctx: Context, machine: ClawMachine) {
  ellipse(ctx, ink, BOWL_Y + 18, BOWL_RADIUS - 12);
  ellipse(ctx, '#5a4779', BOWL_Y + 11, BOWL_RADIUS - 8);
  ellipse(ctx, '#b38cc2', BOWL_RIM_Y, BOWL_RADIUS);
  ellipse(ctx, '#28213c', BOWL_RIM_Y, BOWL_RADIUS - 4);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(BOWL_X, BOWL_RIM_Y, BOWL_RADIUS - 4, (BOWL_RADIUS - 4) * DEPTH_SCALE, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(BOWL_X, BOWL_Y);
  ctx.scale(1, DEPTH_SCALE);
  ctx.rotate(machine.bowlAngle);
  const floorRadius = BOWL_RADIUS - 27;
  ctx.strokeStyle = '#514064';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, floorRadius, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    block(ctx, i % 2 ? '#867098' : '#a88cca', 99, -9, 22, 18);
    block(ctx, '#4b385f', 35, -4, 65, 8);
  }
  ctx.restore();
  if (machine.phase === 'aim') {
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = '#d9cbea8c';
    ctx.beginPath();
    const tip = clawTip(machine);
    ctx.moveTo(tip.x, tip.y + 29);
    ctx.lineTo(tip.x, BOWL_Y - 2);
    ctx.stroke();
    ctx.setLineDash([]);
    block(ctx, '#faf0bf', tip.x - 6, BOWL_Y - 2, 12, 2);
  }
}

function paintCapsule(ctx: Context, prize: ClawMachine['prizes'][number], index: number) {
  const [shade, light] = lights[index];
  ctx.save();
  ctx.translate(prize.x, prize.y + prize.z * DEPTH_SCALE);
  ctx.rotate(prize.angle);
  plate(ctx, ink, -21, -21, 42, 42, 7);
  plate(ctx, shade, -18, -18, 36, 36, 6);
  plate(ctx, light, -18, -18, 36, 20, 5);
  block(ctx, '#fff9', -11, -14, 13, 3);
  block(ctx, ink, -18, -1, 36, 3);
  plate(ctx, ink, -9, -9, 18, 18, 3);
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = light;
  ctx.fillText('?', 0, 5);
  ctx.restore();
}

export function paintClawCabinet(ctx: Context, machine: ClawMachine) {
  block(ctx, '#272745', 0, 0, CABINET_WIDTH, CABINET_HEIGHT);
  block(ctx, '#343353', 6, 36, CABINET_WIDTH - 12, FLOOR_Y - 36);
  for (let y = 50; y < FLOOR_Y; y += 16) {
    for (let x = 12; x < CABINET_WIDTH; x += 16) {
      block(ctx, '#474568', x, y, 2, 2);
    }
  }
  block(ctx, ink, 0, 0, CABINET_WIDTH, 27);
  block(ctx, '#554572', 0, 4, CABINET_WIDTH, 4);
  block(ctx, '#a28bb3', 0, 18, CABINET_WIDTH, 4);
  block(ctx, shell, 0, FLOOR_Y, CABINET_WIDTH, CABINET_HEIGHT - FLOOR_Y);
  block(ctx, '#756088', 0, FLOOR_Y, CABINET_WIDTH, 4);
  block(ctx, ink, DIVIDER_X + 3, 158, CABINET_WIDTH - DIVIDER_X - 3, FLOOR_Y - 158);
  block(ctx, '#ad82bb', DIVIDER_X - 3, 158, 6, FLOOR_Y - 158);
  block(ctx, '#e7a3c8', DIVIDER_X - 3, 158, 6, 5);
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = machine.won ? '#9ff5c7' : '#e8c8ef';
  ctx.fillText('CHUTE', CHUTE_X, FLOOR_Y + 18);

  paintBowl(ctx, machine);
  const paintOrder = machine.prizes.map((prize, index) => ({ prize, index })).sort((a, b) => a.prize.z - b.prize.z);
  for (const { prize, index } of paintOrder) {
    if (prize !== machine.held) paintCapsule(ctx, prize, index);
  }
  ctx.strokeStyle = '#b38cc2';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(BOWL_X, BOWL_RIM_Y, BOWL_RADIUS - 2, (BOWL_RADIUS - 2) * DEPTH_SCALE, 0, 0, Math.PI);
  ctx.stroke();
  if (machine.held) paintCapsule(ctx, machine.held, machine.prizes.indexOf(machine.held));

  ctx.save();
  ctx.translate(machine.x, RAIL_Y);
  plate(ctx, ink, -21, -15, 42, 27, 5);
  plate(ctx, '#b14869', -18, -12, 36, 20, 4);
  block(ctx, '#f78d98', -14, -10, 28, 5);
  block(ctx, '#ffd38f', -6, 0, 12, 4);
  ctx.rotate(-machine.swing);
  block(ctx, ink, -4, 8, 8, machine.length - 6);
  block(ctx, '#a7a2ba', -2, 8, 3, machine.length - 6);
  for (let y = 13; y < machine.length - 4; y += 7) block(ctx, '#5b536f', -2, y, 4, 2);
  ctx.restore();

  const tip = clawTip(machine);
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(-machine.swing);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.translate(11, 2);
    ctx.rotate(jawAngle(machine.jaw));
    block(ctx, ink, -4, -5, 12, 23);
    block(ctx, ink, -11, 14, 19, 12);
    block(ctx, '#c87878', -1, -3, 6, 23);
    block(ctx, '#ffd79a', 0, -3, 3, 19);
    block(ctx, '#f5a080', -8, 17, 13, 6);
    block(ctx, '#fff1b8', -9, 19, 4, 4);
    ctx.restore();
  }
  plate(ctx, ink, -18, -12, 36, 25, 5);
  plate(ctx, '#bd4e71', -15, -9, 30, 19, 4);
  block(ctx, '#fa8e98', -11, -8, 22, 5);
  block(ctx, '#742b52', -11, 5, 22, 4);
  block(ctx, '#ffdc93', -5, -2, 10, 6);
  block(ctx, '#fff3bd', -3, -2, 5, 2);
  ctx.restore();
}
