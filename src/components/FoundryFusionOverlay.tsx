import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Zap, Flame, Snowflake, Droplets, Hammer, Orbit } from 'lucide-react';
import { useGame, type SynthesisStage } from '../lib/gameStore';
import { MaterialSprite } from './ElementSprite';

const stageCopy: Record<Exclude<SynthesisStage, null>, string[]> = {
  'ANALYZING MATERIALS': ['Reading structure…', 'Mapping properties…', 'Comparing lineages…'],
  'APPLYING PROCESS': ['Charging the chamber…', 'Forcing the reaction…', 'Matter is destabilizing…'],
  'CHECKING LINEAGE': ['Searching inherited traits…', 'Following recipe echoes…', 'Looking for a viable branch…'],
  'RESOLVING RESULT': ['Possibilities are collapsing…', 'A silhouette is forming…', 'Holding the reaction open…', 'Something is taking shape…'],
  'CATALOGUING DISCOVERY': ['Locking the identity…', 'Checking rarity…', 'Cataloguing the discovery…'],
  'RENDERING SPRITE': ['Crystallizing the final form…', 'Polishing the sprite…', 'Preparing reveal…'],
};

function ProcessGlyph({ id }: { id?: string }) {
  if (id === 'HEAT') return <Flame size={25} />;
  if (id === 'FREEZE' || id === 'COOL') return <Snowflake size={25} />;
  if (id === 'SOAK' || id === 'MIX') return <Droplets size={25} />;
  if (id === 'CRUSH' || id === 'PRESS') return <Hammer size={25} />;
  if (id === 'CHARGE') return <Zap size={25} />;
  return <Orbit size={25} />;
}

export function FoundryFusionOverlay() {
  const { isSynthesizing, synthesisStage, slotA, slotB, selectedProcess } = useGame();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isSynthesizing) { setSeconds(0); return; }
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [isSynthesizing]);

  const copy = useMemo(() => {
    if (!synthesisStage) return 'Opening reaction chamber…';
    const options = stageCopy[synthesisStage];
    return options[Math.floor(seconds / 2) % options.length];
  }, [synthesisStage, seconds]);

  if (!isSynthesizing || !slotA) return null;
  const processClass = (selectedProcess?.id || 'MIX').toLowerCase();

  return <div className="fusion-overlay" role="status" aria-live="polite" aria-label="Combination in progress">
    <div className={`fusion-reactor fusion-process-${processClass}`}>
      <div className="fusion-stars" aria-hidden="true">
        {Array.from({length: 18}, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}
      </div>
      <div className="fusion-ring fusion-ring-one" />
      <div className="fusion-ring fusion-ring-two" />

      <div className="fusion-material fusion-material-a">
        <MaterialSprite material={slotA} className="fusion-material-art" />
        <span>{slotA.displayName}</span>
      </div>

      {slotB && <div className="fusion-material fusion-material-b">
        <MaterialSprite material={slotB} className="fusion-material-art" />
        <span>{slotB.displayName}</span>
      </div>}

      <div className="fusion-core">
        <div className="fusion-core-glow" />
        <div className="fusion-process-icon"><ProcessGlyph id={selectedProcess?.id} /></div>
        <div className="fusion-mystery">?</div>
      </div>

      <div className="fusion-status-card">
        <div className="fusion-status-top"><Sparkles size={16} /><strong>{selectedProcess?.name || 'Combine'}</strong><span>{seconds}s</span></div>
        <p>{copy}</p>
        <div className="fusion-progress"><span /></div>
      </div>
    </div>
  </div>;
}
