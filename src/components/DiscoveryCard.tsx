import React, { memo } from 'react';
import { Info } from 'lucide-react';
import { CraftSprite } from './CraftSprite';

/** Shared card; artwork comes from the player's saved collection. */
export const DiscoveryCard = memo(function DiscoveryCard({ name, emoji, detail, selected = false, compact = false, disabled = false, onSelect, onInspect }: {
  name: string; emoji: string; detail: string; selected?: boolean; compact?: boolean;
  disabled?: boolean; onSelect: () => void; onInspect: () => void;
}) {
  return <div className={`boop-discovery-card ${selected ? 'is-selected' : ''} ${compact ? 'is-compact' : ''}`}>
    <button className="boop-discovery-pick" disabled={disabled} onClick={onSelect} aria-label={`Select ${name}`} aria-pressed={selected}
      draggable={!disabled} onDragStart={event => event.dataTransfer.setData('application/x-boop-ingredient', name)}>
      <CraftSprite name={name} emoji={emoji} className="boop-card-sprite" />
      <strong>{name}</strong><small>{selected ? 'Selected' : detail}</small>
    </button>
    <button className="boop-card-info" aria-label={`Details for ${name}`} onClick={onInspect}><Info size={16} /></button>
  </div>;
});
