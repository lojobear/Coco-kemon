import React from 'react';
import { ArrowLeftRight, ArrowRight, Plus, Sparkles, X } from 'lucide-react';
import { CraftSprite } from './CraftSprite';

export interface CrucibleSlotItem { id?: string; name: string; emoji: string; isShiny?: boolean }
interface CraftingCrucibleProps {
  slotA: CrucibleSlotItem | null; slotB: CrucibleSlotItem | null;
  onClearSlotA: () => void; onClearSlotB: () => void; onClearAll: () => void;
  onSwapSlots: () => void; onCombine: () => void; isSynthesizing: boolean;
  isDarkMode: boolean; isDropTargetActive: boolean; crucibleRef: React.RefObject<HTMLDivElement | null>;
  isCollapsed?: boolean; onToggleCollapse?: () => void;
  quickPickVersion?: number;
}
export function CraftingCrucible({ slotA, slotB, onClearSlotA, onClearSlotB, onClearAll, onSwapSlots, onCombine, isSynthesizing, isDropTargetActive, crucibleRef, quickPickVersion = 0 }: CraftingCrucibleProps) {
  const ready = Boolean(slotA && slotB);
  return <div ref={crucibleRef} id="crafting-crucible-dock" className={`boop-combination-pad ${isDropTargetActive ? 'is-drop-target' : ''} ${ready ? 'is-ready' : ''} ${isSynthesizing ? 'is-synthesizing' : ''}`} aria-label="Combination pad">
    <div className="boop-pad-heading"><span>COMBINATION PAD</span><span className="boop-ready-tag">{ready ? 'Ready to discover' : `${Number(!!slotA) + Number(!!slotB)} selected`}</span></div>
    <div className="boop-pad-slots">
      {(['a', 'b'] as const).map((key, index) => {
        const slot = index === 0 ? slotA : slotB;
        return <React.Fragment key={key}>
          {index === 1 && <span className="boop-pad-plus"><Plus size={24} /></span>}
          <div key={`${key}:${slot?.name || 'empty'}:${quickPickVersion}`} id={`crucible-slot-${key}`} className={`boop-pad-slot ${slot ? 'is-filled' : ''} ${quickPickVersion && slot ? 'is-quick-picked' : ''}`}>
            {slot ? <><CraftSprite name={slot.name} emoji={slot.emoji} isShiny={slot.isShiny} className="boop-pad-sprite" /><strong>{slot.name}{slot.isShiny ? ' ✦' : ''}</strong>
              <button disabled={isSynthesizing} aria-label={`Remove ${slot.name} from slot ${key.toUpperCase()}`} onClick={index === 0 ? onClearSlotA : onClearSlotB}><X size={16} /></button></>
              : <><span className="boop-empty-pixel" aria-hidden="true"><Plus size={28} /></span><span>Pick {index === 0 ? 'first' : 'second'} ingredient</span></>}
          </div>
        </React.Fragment>;
      })}
    </div>
    <button id="crucible-combine-action-btn" className="boop-primary boop-combine" disabled={!ready || isSynthesizing} onClick={onCombine}>
      <Sparkles size={18} />{isSynthesizing ? 'Discovering…' : 'Combine & discover'}<ArrowRight size={18} />
    </button>
    <div className="boop-pad-tools"><span>Tap discoveries below, or drag them here.</span><button disabled={isSynthesizing || (!slotA && !slotB)} onClick={onSwapSlots} aria-label="Swap ingredients"><ArrowLeftRight size={16} /></button><button disabled={isSynthesizing || (!slotA && !slotB)} onClick={onClearAll} aria-label="Clear ingredients"><X size={16} /></button></div>
  </div>;
}
