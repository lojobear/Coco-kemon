import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Gamepad2, X } from 'lucide-react';
import {
  aimClaw, CABINET_HEIGHT, CABINET_WIDTH, CHUTE_X, CLAW_PRIZES, CLAW_STEP, clawTip, DIVIDER_X,
  createClawMachine, dropClaw, FLOOR_Y, RAIL_Y, stepClaw, type ClawMachine,
} from '../lib/clawMachine';
import type { RoomDecoration } from '../lib/roomProgress';
import '../styles/room-claw.css';

const prizeColors = ['#a8edbb', '#ffdf9c', '#b8ebdf', '#acdfff', '#f7aad3'];

function paint(ctx: CanvasRenderingContext2D, machine: ClawMachine, art: HTMLImageElement[]) {
  ctx.clearRect(0, 0, CABINET_WIDTH, CABINET_HEIGHT);
  ctx.fillStyle = '#252442';
  ctx.fillRect(0, 0, CABINET_WIDTH, CABINET_HEIGHT);
  ctx.fillStyle = '#1b1a30';
  ctx.fillRect(DIVIDER_X, 158, CABINET_WIDTH - DIVIDER_X, FLOOR_Y - 158);
  ctx.fillRect(0, FLOOR_Y, CABINET_WIDTH, CABINET_HEIGHT - FLOOR_Y);
  ctx.fillStyle = '#e5c5fd';
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('PRIZE CHUTE', CHUTE_X, FLOOR_Y + 18);
  ctx.fillStyle = '#70638f';
  ctx.fillRect(DIVIDER_X - 2, 158, 4, FLOOR_Y - 158);
  ctx.fillRect(0, RAIL_Y - 5, CABINET_WIDTH, 5);
  ctx.fillRect(0, FLOOR_Y, CABINET_WIDTH, 3);

  machine.prizes.forEach((prize, index) => {
    ctx.save();
    ctx.translate(prize.x, prize.y);
    ctx.rotate(prize.angle);
    ctx.beginPath();
    ctx.arc(0, 0, prize.radius - 1, 0, Math.PI * 2);
    ctx.fillStyle = prizeColors[index];
    ctx.fill();
    ctx.strokeStyle = '#fff9';
    ctx.lineWidth = 2;
    ctx.stroke();
    const image = art[index];
    if (image.complete && image.naturalWidth) ctx.drawImage(image, -15, -15, 30, 30);
    ctx.restore();
  });

  const tip = clawTip(machine);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#d1c1e7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(machine.x, RAIL_Y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.fillStyle = '#f6b3d8';
  ctx.fillRect(machine.x - 15, RAIL_Y - 9, 30, 12);
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(-machine.swing);
  ctx.strokeStyle = '#fde8aa';
  ctx.lineWidth = 5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 6, 0);
    ctx.lineTo(side * (16 + machine.jaw * 11), 12);
    ctx.lineTo(side * (12 + machine.jaw * 14), 26);
    ctx.stroke();
  }
  ctx.fillStyle = '#f6b3d8';
  ctx.fillRect(-10, -5, 20, 10);
  ctx.restore();
}

export function RoomClaw({ onClose, onPrize }: {
  onClose: () => void;
  onPrize: (id: RoomDecoration) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controls = useRef({ left: false, right: false });
  const [machine, setMachine] = useState(createClawMachine);
  const [phase, setPhase] = useState(machine.phase);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const won = phase === 'done' ? machine.won : undefined;
  const reward = CLAW_PRIZES.find(item => item.id === won);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    if (won && save === 'idle') {
      setSave('saving');
      void onPrize(won).then(() => setSave('saved'), reason => {
        setError(reason instanceof Error ? reason.message : 'Could not save the prize.');
        setSave('error');
      });
    }
  }, [won, save, onPrize]);

  useEffect(() => {
    const surface = canvas.current!;
    const ctx = surface.getContext('2d');
    if (!ctx) return;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    surface.width = CABINET_WIDTH * scale;
    surface.height = CABINET_HEIGHT * scale;
    ctx.scale(scale, scale);
    const art = CLAW_PRIZES.map(({ id }) => {
      const image = new Image();
      image.src = `/room/${id}.png`;
      return image;
    });
    let frame = 0, previous = performance.now(), accumulator = 0;
    let lastPhase = machine.phase;
    const tick = (now: number) => {
      accumulator += Math.min(Math.max(0, (now - previous) / 1000), .05);
      previous = now;
      while (accumulator >= CLAW_STEP) {
        const direction = Number(controls.current.right) - Number(controls.current.left);
        if (direction) aimClaw(machine, machine.target + direction * 220 * CLAW_STEP);
        stepClaw(machine);
        accumulator -= CLAW_STEP;
      }
      paint(ctx, machine, art);
      if (lastPhase !== machine.phase) {
        lastPhase = machine.phase;
        setPhase(lastPhase);
      }
      if (machine.phase !== 'done' || art.some(image => !image.complete)) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [machine]);

  const reset = () => {
    controls.current = { left: false, right: false };
    setMachine(createClawMachine());
    setPhase('aim');
    setSave('idle');
  };
  const pending = save === 'saving' || (!!won && save === 'idle');
  const status = phase === 'aim' ? 'Drag across the cabinet or use the arrows to aim.'
    : phase !== 'done' ? 'The claw is in motion…'
    : pending ? 'Saving your prize…'
    : save === 'saved' ? `${reward?.name} is ready to place under Edit room → Decorations.`
    : save === 'error' ? error : 'The claw came back empty. Try another drop.';

  return (
    <dialog ref={dialog} className="room-claw" aria-labelledby="room-claw-title"
      onCancel={event => { event.preventDefault(); if (!pending) onClose(); }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) controls.current = { left: false, right: false };
      }}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          controls.current[event.key === 'ArrowLeft' ? 'left' : 'right'] = true;
        }
      }}
      onKeyUp={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          controls.current[event.key === 'ArrowLeft' ? 'left' : 'right'] = false;
        }
      }}>
      <header className="room-claw-heading">
        <h2 id="room-claw-title"><Gamepad2 size={23}/> Boop Claw</h2>
        <button type="button" aria-label="Close claw machine" onClick={onClose} disabled={pending}><X size={21}/></button>
      </header>
      <canvas ref={canvas} width={CABINET_WIDTH} height={CABINET_HEIGHT} aria-hidden="true"
        onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const bounds = event.currentTarget.getBoundingClientRect();
          aimClaw(machine, (event.clientX - bounds.left) * CABINET_WIDTH / bounds.width);
        }}
        onPointerMove={event => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          aimClaw(machine, (event.clientX - bounds.left) * CABINET_WIDTH / bounds.width);
        }}/>
      <p className="room-claw-status" role="status">{status}</p>
      <div className="room-claw-controls">
        {(['left', 'right'] as const).map(direction => {
          const Icon = direction === 'left' ? ArrowLeft : ArrowRight;
          return (
            <button type="button" key={direction} aria-label={`Move claw ${direction}`} disabled={phase !== 'aim'}
              onPointerDown={event => {
                event.currentTarget.setPointerCapture(event.pointerId);
                controls.current[direction] = true;
              }}
              onLostPointerCapture={() => { controls.current[direction] = false; }}
              onClick={() => aimClaw(machine, machine.target + (direction === 'left' ? -24 : 24))}>
              <Icon size={20}/>
            </button>
          );
        })}
        {phase === 'done'
          ? <button type="button" className="room-primary" disabled={pending}
              onClick={save === 'error' ? () => setSave('idle') : reset}>{save === 'error' ? 'Retry save' : 'Play again'}</button>
          : <button type="button" className="room-primary" disabled={phase !== 'aim'} onClick={() => dropClaw(machine)}>Drop claw</button>}
      </div>
    </dialog>
  );
}
