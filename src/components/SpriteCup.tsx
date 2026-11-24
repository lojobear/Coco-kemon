import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Smartphone, Vibrate, X } from 'lucide-react';
import { CraftSprite } from './CraftSprite';
import type { InfiniteElement } from '../lib/infiniteCraftData';
import { CUP_LIMIT, CUP_STEP, createCupToken, deviceCupTilt, dragCupToken, shakeCup, stepCup, type CupToken } from '../lib/spriteCup';
import '../styles/sprite-cup.css';

type MotionMode = 'off' | 'requesting' | 'waiting' | 'on' | 'unavailable';
type PermissionConstructor = { requestPermission?: () => Promise<'granted' | 'denied'> };
const motionCopy: Record<MotionMode, string> = {
  off: 'Drag a sprite, tap Shake, or turn on phone motion.',
  requesting: 'Waiting for motion permission…',
  waiting: 'Tilt or gently shake your phone.',
  on: 'Phone motion is on. Tilt or gently shake the cup.',
  unavailable: 'Phone motion is unavailable. Drag a sprite or tap Shake.',
};

export function SpriteCup({ items, onClose }: { items: readonly InfiniteElement[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLSpanElement>());
  const [chosen, setChosen] = useState(() => items.slice(0, 3).map(item => item.id));
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<MotionMode>('off');
  const [sensors, setSensors] = useState({ orientation: false, motion: false });
  const field = useRef({ x: 0, y: 0 });
  const keepUpright = useRef(false);
  const bodies = useRef<CupToken[]>([]);
  const drag = useRef<{ id: string; pointer: number; x: number; y: number; time: number } | null>(null);
  const picked = chosen.flatMap(id => items.find(item => item.id === id) ?? []);
  const matches = items.filter(item => !chosen.includes(item.id) && item.name.toLowerCase().includes(query.trim().toLowerCase()));
  const listening = mode === 'waiting' || mode === 'on';

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    const back = (event: Event) => {
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('boop-native-back', back, true);
    return () => window.removeEventListener('boop-native-back', back, true);
  }, [onClose]);

  useEffect(() => {
    const all = new Set(items.map(item => item.id));
    bodies.current = chosen.flatMap((id, slot) =>
      all.has(id) ? bodies.current.find(token => token.id === id) ?? createCupToken(id, slot) : []);
    if (drag.current && !bodies.current.some(token => token.id === drag.current?.id)) drag.current = null;
  }, [items, chosen]);

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { keepUpright.current = preference.matches; };
    update();
    preference.addEventListener('change', update);
    let frame = 0, previous = performance.now(), remaining = 0;
    const tick = (now: number) => {
      remaining += Math.min(.04, (now - previous) / 1000);
      previous = now;
      while (remaining >= CUP_STEP) {
        stepCup(bodies.current, field.current.x, field.current.y, drag.current?.id);
        remaining -= CUP_STEP;
      }
      for (const token of bodies.current) {
        const element = nodes.current.get(token.id);
        if (!element) continue;
        element.style.left = `${50 + token.x * 47}%`;
        element.style.top = `${61 + token.y * 23 - token.z * 39}%`;
        element.style.zIndex = String(10 + Math.round((token.y + 1) * 30 + token.z * 16));
        element.style.setProperty('--roll', keepUpright.current ? '0rad' : `${token.roll}rad`);
        element.style.setProperty('--pitch', keepUpright.current ? '.2rad' : `${token.pitch}rad`);
        element.style.setProperty('--size', String(.87 + token.y * .11 + token.z * .42));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!listening) return;
    let center: { beta: number; gamma: number } | undefined;
    let gravity: { x: number; y: number; z: number } | undefined;
    let lastShake = -Infinity;
    const ready = () => setMode(current => current === 'waiting' ? 'on' : current);
    const reset = () => {
      center = gravity = undefined;
      field.current = { x: 0, y: 0 };
    };
    const orientation = ({ beta, gamma }: DeviceOrientationEvent) => {
      if (document.hidden || beta == null || gamma == null || !Number.isFinite(beta + gamma)) return;
      center ??= { beta, gamma };
      const next = deviceCupTilt(beta, gamma, center, screen.orientation?.angle ?? window.orientation ?? 0);
      field.current = { x: field.current.x * .34 + next.x * .66, y: field.current.y * .34 + next.y * .66 };
      ready();
    };
    const motion = (event: DeviceMotionEvent) => {
      if (document.hidden) return;
      const { x, y, z } = event.acceleration ?? {};
      let impact: number;
      if (x != null && y != null && z != null && Number.isFinite(x + y + z)) {
        impact = Math.hypot(x, y, z);
      } else {
        const { x, y, z } = event.accelerationIncludingGravity ?? {};
        if (x == null || y == null || z == null || !Number.isFinite(x + y + z)) return;
        gravity ??= { x, y, z };
        impact = Math.hypot(x - gravity.x, y - gravity.y, z - gravity.z);
        gravity = { x: gravity.x * .84 + x * .16, y: gravity.y * .84 + y * .16, z: gravity.z * .84 + z * .16 };
      }
      ready();
      const now = performance.now();
      if (impact > 7 && now - lastShake > 280) {
        shakeCup(bodies.current.filter(token => token.id !== drag.current?.id), Math.min(1.45, .65 + impact / 27));
        lastShake = now;
      }
    };
    if (sensors.orientation) window.addEventListener('deviceorientation', orientation, { passive: true });
    if (sensors.motion) window.addEventListener('devicemotion', motion, { passive: true });
    document.addEventListener('visibilitychange', reset);
    screen.orientation?.addEventListener?.('change', reset);
    const timeout = window.setTimeout(() => setMode(current => current === 'waiting' ? 'unavailable' : current), 4800);
    return () => {
      window.removeEventListener('deviceorientation', orientation);
      window.removeEventListener('devicemotion', motion);
      document.removeEventListener('visibilitychange', reset);
      screen.orientation?.removeEventListener?.('change', reset);
      window.clearTimeout(timeout);
      reset();
    };
  }, [listening, sensors]);

  const toggleMotion = async () => {
    if (listening) { setMode('off'); return; }
    setMode('requesting');
    const permission = (api?: PermissionConstructor) => {
      if (!api) return Promise.resolve(false);
      try { return api.requestPermission?.().then(result => result === 'granted', () => false) ?? Promise.resolve(true); }
      catch { return Promise.resolve(false); }
    };
    // Safari requires both permission requests to begin during the user gesture.
    const [orientation, motion] = await Promise.all([
      permission(window.DeviceOrientationEvent as PermissionConstructor | undefined),
      permission(window.DeviceMotionEvent as PermissionConstructor | undefined),
    ]);
    setSensors({ orientation, motion });
    setMode(orientation || motion ? 'waiting' : 'unavailable');
  };

  const release = (event: PointerEvent<HTMLSpanElement>, cancelled = false) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const token = bodies.current.find(body => body.id === current.id);
    if (token) {
      if (cancelled || event.timeStamp - current.time > 100) token.vx = token.vy = 0;
      else token.vz = Math.min(1.6, Math.hypot(token.vx, token.vy) * .37);
    }
    drag.current = null;
  };

  return (
    <dialog ref={dialog} className="sprite-cup" aria-labelledby="sprite-cup-title"
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <header className="sprite-cup-header">
        <h2 id="sprite-cup-title">Sprite cup</h2>
        <button type="button" aria-label="Close sprite cup" onClick={onClose}><X size={20}/></button>
      </header>
      <div ref={stage} className="sprite-cup-stage" role="group" aria-label="Glass cup with movable sprites">
        <div className="sprite-cup-glass" aria-hidden="true"/>
        {picked.map(item => (
          <span key={item.id} className="sprite-cup-position" data-cup-token={item.id}
            ref={node => { if (node) nodes.current.set(item.id, node); else nodes.current.delete(item.id); }}
            onPointerDown={event => {
              if (drag.current || event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { id: item.id, pointer: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
            }}
            onPointerMove={event => {
              const current = drag.current;
              const bounds = stage.current?.getBoundingClientRect();
              if (!current || current.pointer !== event.pointerId || !bounds) return;
              const token = bodies.current.find(body => body.id === current.id);
              if (token) dragCupToken(token, (event.clientX - current.x) / (bounds.width * .47),
                (event.clientY - current.y) / (bounds.height * .23), Math.max(.01, (event.timeStamp - current.time) / 1000));
              current.x = event.clientX;
              current.y = event.clientY;
              current.time = event.timeStamp;
            }}
            onPointerUp={event => release(event)}
            onPointerCancel={event => release(event, true)}
            onLostPointerCapture={event => release(event, true)}>
            <span className="sprite-cup-token">
              <CraftSprite name={item.name} emoji={item.emoji} category={item.category} idle={false}/>
            </span>
          </span>
        ))}
        {!picked.length && <p className="sprite-cup-empty">Add a sprite to the cup.</p>}
        <div className="sprite-cup-rim" aria-hidden="true"/>
      </div>
      <p className="sprite-cup-status" role="status">{motionCopy[mode]}</p>
      <div className="sprite-cup-controls">
        <button type="button" aria-pressed={listening} disabled={mode === 'requesting'} onClick={() => void toggleMotion()}>
          <Smartphone size={17}/> {listening ? 'Turn motion off' : 'Enable phone motion'}
        </button>
        <button type="button" className="sprite-cup-shake" disabled={!picked.length} onClick={() => shakeCup(bodies.current.filter(token => token.id !== drag.current?.id))}>
          <Vibrate size={18}/> Shake
        </button>
      </div>
      <fieldset className="sprite-cup-picker">
        <legend>In the cup · {picked.length}/{CUP_LIMIT}</legend>
        {picked.length > 0 && <div className="sprite-cup-chips">
          {picked.map(item => <button type="button" key={item.id} aria-label={`Remove ${item.name} from cup`}
            onClick={() => setChosen(ids => ids.filter(id => id !== item.id))}>{item.name} <X size={14}/></button>)}
        </div>}
        {picked.length < CUP_LIMIT && (matches.length > 0 || Boolean(query)) &&
          <label>Find a sprite <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your collection"/></label>}
        {picked.length < CUP_LIMIT && matches.length > 0 && <div className="sprite-cup-chips">
          {matches.slice(0, 8).map(item => <button type="button" key={item.id} aria-label={`Add ${item.name} to cup`}
            onClick={() => setChosen(ids => ids.length < CUP_LIMIT && !ids.includes(item.id) ? [...ids, item.id] : ids)}>+ {item.name}</button>)}
        </div>}
        {picked.length < CUP_LIMIT && !!query && !matches.length && <p>No matching sprites available to add.</p>}
      </fieldset>
    </dialog>
  );
}
