import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Gamepad2, X } from 'lucide-react';
import { aimClaw, CABINET_HEIGHT, CABINET_WIDTH, CLAW_STEP, createClawMachine, dropClaw, stepClaw } from '../lib/clawMachine';
import { paintClawCabinet } from '../lib/clawArtwork';
import type { InfiniteElement } from '../lib/infiniteCraftData';
import { commitClawReward } from '../lib/saveData';
import { CraftSprite } from './CraftSprite';
import '../styles/room-claw.css';

export function RoomClaw({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controls = useRef({ left: false, right: false });
  const [machine, setMachine] = useState(createClawMachine);
  const [phase, setPhase] = useState(machine.phase);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const [reward, setReward] = useState<InfiniteElement>();
  const rewardRoll = useRef<number | undefined>(undefined);

  const claimPrize = useCallback(() => {
    rewardRoll.current ??= Math.random();
    setSave('saving');
    void commitClawReward(rewardRoll.current).then(item => {
      setReward(item);
      setSave('saved');
    }, reason => {
      setError(reason instanceof Error ? reason.message : 'Could not save the prize.');
      setSave('error');
    });
  }, []);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    const surface = canvas.current!;
    const ctx = surface.getContext('2d');
    if (!ctx) return;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    surface.width = CABINET_WIDTH * scale;
    surface.height = CABINET_HEIGHT * scale;
    ctx.scale(scale, scale);
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
      paintClawCabinet(ctx, machine);
      if (lastPhase !== machine.phase) {
        lastPhase = machine.phase;
        setPhase(lastPhase);
        if (lastPhase === 'done' && machine.won) claimPrize();
      }
      if (machine.phase !== 'done') frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [machine, claimPrize]);

  const reset = () => {
    controls.current = { left: false, right: false };
    setMachine(createClawMachine());
    setPhase('aim');
    setSave('idle');
    setReward(undefined);
    rewardRoll.current = undefined;
  };
  const pending = save === 'saving';
  const status = phase === 'aim' ? 'Drag across the cabinet or use the arrows to aim.'
    : phase !== 'done' ? 'The claw is in motion…'
    : pending ? 'Opening your mystery capsule…'
    : save === 'saved' ? `You won ${reward?.name}! Find it in Collection or Edit room → Discoveries.`
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
      <div className="room-claw-status" role="status">
        {reward && <CraftSprite name={reward.name} emoji={reward.emoji} category={reward.category} idle={false}/>}
        <span>{status}</span>
      </div>
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
              onClick={save === 'error' ? claimPrize : reset}>{save === 'error' ? 'Retry save' : 'Play again'}</button>
          : <button type="button" className="room-primary" disabled={phase !== 'aim'} onClick={() => dropClaw(machine)}>Drop claw</button>}
      </div>
    </dialog>
  );
}
