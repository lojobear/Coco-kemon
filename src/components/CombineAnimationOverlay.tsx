import React, { useEffect, useState } from 'react';
import { Sparkles, Atom, Zap } from 'lucide-react';

export interface ActiveCombination {
  idA: string;
  idB: string;
  nameA: string;
  emojiA: string;
  x1: number;
  y1: number;
  nameB: string;
  emojiB: string;
  x2: number;
  y2: number;
  midX: number;
  midY: number;
  isShiny?: boolean;
}

interface CombineAnimationOverlayProps {
  combination: ActiveCombination | null;
  isDarkMode: boolean;
}

const statusLines = [
  'Pulling concepts into the crucible…',
  'Breaking the ingredients into ideas…',
  'Searching possible connections…',
  'Testing strange possibilities…',
  'A new concept is starting to form…',
  'Holding the reaction together…',
  'Almost ready to reveal…',
];

export function CombineAnimationOverlay({ combination }: CombineAnimationOverlayProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!combination) { setElapsed(0); return; }
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [combination]);

  if (!combination) return null;
  const { nameA, emojiA, nameB, emojiB, isShiny } = combination;
  const line = statusLines[Math.floor(elapsed / 2) % statusLines.length];

  return <div className={`craft-fusion-overlay ${isShiny ? 'is-shiny' : ''}`} role="status" aria-live="polite">
    <div className="craft-fusion-stage">
      <div className="craft-fusion-nebula" />
      <div className="craft-fusion-orbit orbit-a" />
      <div className="craft-fusion-orbit orbit-b" />
      <div className="craft-fusion-specks" aria-hidden="true">
        {Array.from({ length: 22 }, (_, i) => <i key={i} style={{ '--n': i } as React.CSSProperties} />)}
      </div>

      <div className="craft-fusion-item item-a">
        <div className="craft-fusion-emoji">{emojiA}</div>
        <span>{nameA}</span>
      </div>
      <div className="craft-fusion-item item-b">
        <div className="craft-fusion-emoji">{emojiB}</div>
        <span>{nameB}</span>
      </div>

      <div className="craft-fusion-center">
        <div className="craft-fusion-core" />
        <Atom className="craft-fusion-atom" size={44} />
        <div className="craft-fusion-question">?</div>
      </div>

      <div className="craft-fusion-copy">
        <div><Sparkles size={16} /><strong>QUARKPOP REACTION</strong><span>{elapsed}s</span></div>
        <p>{line}</p>
        <div className="craft-fusion-loader"><span /></div>
      </div>

      {isShiny && <div className="craft-fusion-shiny"><Zap size={15} /> RARE SIGNAL DETECTED</div>}
    </div>
  </div>;
}
