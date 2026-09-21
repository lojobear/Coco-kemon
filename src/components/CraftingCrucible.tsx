import { CraftSprite } from './CraftSprite';
/**
 * CRAFTING CRUCIBLE - High-Visibility Designated Combine Zone
 * Optimized for Android / Google Pixel 9 touch interaction.
 * Provides a clear, high-contrast drop target so users can easily see
 * and combine elements without finger occlusion or small hitbox struggles.
 */

import React from 'react';
import { Sparkles, Plus, X, ArrowLeftRight, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { sound } from '../lib/audio';
import { haptics } from '../lib/haptics';

export interface CrucibleSlotItem {
  id?: string;
  name: string;
  emoji: string;
  isShiny?: boolean;
}

interface CraftingCrucibleProps {
  slotA: CrucibleSlotItem | null;
  slotB: CrucibleSlotItem | null;
  onClearSlotA: () => void;
  onClearSlotB: () => void;
  onClearAll: () => void;
  onSwapSlots: () => void;
  onCombine: () => void;
  isSynthesizing: boolean;
  isDarkMode: boolean;
  isDropTargetActive: boolean;
  crucibleRef: React.RefObject<HTMLDivElement | null>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function CraftingCrucible({
  slotA,
  slotB,
  onClearSlotA,
  onClearSlotB,
  onClearAll,
  onSwapSlots,
  onCombine,
  isSynthesizing,
  isDarkMode,
  isDropTargetActive,
  crucibleRef,
  isCollapsed = false,
  onToggleCollapse,
}: CraftingCrucibleProps) {
  const hasBoth = Boolean(slotA && slotB);

  return (
    <div
      ref={crucibleRef}
      id="crafting-crucible-dock"
      className={`absolute bottom-16 sm:bottom-14 left-1/2 -translate-x-1/2 z-20 transition-all duration-200 select-none ${
        isDropTargetActive ? 'scale-105' : 'scale-100'
      }`}
      style={{
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      {isCollapsed ? (
        <button
          id="crucible-expand-btn"
          onClick={() => {
            sound.playClick();
            haptics.lightTap();
            onToggleCollapse?.();
          }}
          className={`px-3.5 py-1.5 rounded-full border shadow-lg font-mono text-xs font-semibold flex items-center gap-2 backdrop-blur-md transition-transform active:scale-95 ${
            isDarkMode
              ? 'bg-[#181a20]/95 border-amber-500/40 text-amber-400 hover:bg-[#22252e]'
              : 'bg-white/95 border-amber-500/50 text-amber-600 hover:bg-amber-50'
          }`}
          title="Open Combine Crucible"
        >
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>Combine Pad</span>
          {slotA && <span className="text-[11px] opacity-80">(<CraftSprite name={slotA.name} emoji={slotA.emoji} />)</span>}
          {slotB && <span className="text-[11px] opacity-80">(<CraftSprite name={slotB.name} emoji={slotB.emoji} />)</span>}
          <ChevronUp className="w-3.5 h-3.5 text-zinc-400 ml-0.5" />
        </button>
      ) : (
        <div
          className={`rounded-2xl border p-2.5 sm:p-3 shadow-2xl backdrop-blur-md flex flex-col gap-2 transition-all ${
            isDropTargetActive
              ? 'border-amber-400 bg-amber-500/15 shadow-[0_0_30px_rgba(245,158,11,0.35)] ring-2 ring-amber-400/50'
              : isDarkMode
              ? 'bg-[#12151c]/95 border-[#2b313d] text-zinc-100 shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
              : 'bg-white/95 border-[#d1d5db] text-zinc-900 shadow-[0_8px_32px_rgba(0,0,0,0.12)]'
          }`}
        >
          {/* Header Row: Label, Swap, Clear, Collapse */}
          <div className="flex items-center justify-between gap-2 px-1 text-[11px] font-mono font-medium">
            <div className="flex items-center gap-1.5 text-amber-500">
              <Zap className="w-3.5 h-3.5 animate-pulse" />
              <span className="font-bold tracking-wider uppercase text-[10px] sm:text-xs">Combine Zone</span>
              <span className={`text-[10px] hidden sm:inline ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
                • Drag items here or tap canvas
              </span>
            </div>

            <div className="flex items-center gap-1">
              {(slotA || slotB) && (
                <>
                  <button
                    id="crucible-swap-btn"
                    onClick={() => {
                      sound.playClick();
                      haptics.lightTap();
                      onSwapSlots();
                    }}
                    className="p-1 rounded-lg hover:bg-zinc-700/20 text-zinc-400 hover:text-zinc-200 transition-colors"
                    title="Swap elements"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                  </button>
                  <button
                    id="crucible-clear-btn"
                    onClick={() => {
                      sound.playClick();
                      haptics.lightTap();
                      onClearAll();
                    }}
                    className="p-1 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"
                    title="Clear slots"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              )}
              {onToggleCollapse && (
                <button
                  id="crucible-collapse-btn"
                  onClick={() => {
                    sound.playClick();
                    haptics.lightTap();
                    onToggleCollapse();
                  }}
                  className="p-1 rounded-lg hover:bg-zinc-700/20 text-zinc-400 hover:text-zinc-200 transition-colors ml-1"
                  title="Minimize combine pad"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Slots Row: Slot A + Slot B = Action */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Slot A */}
            <div
              id="crucible-slot-a"
              className={`flex-1 min-w-[100px] sm:min-w-[125px] h-11 sm:h-12 px-2.5 rounded-xl border-2 border-dashed flex items-center justify-between gap-1.5 transition-all text-xs font-semibold ${
                slotA
                  ? isDarkMode
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-200 border-solid shadow-sm'
                    : 'border-amber-500 bg-amber-50 text-amber-900 border-solid shadow-sm'
                  : isDarkMode
                  ? 'border-zinc-700/70 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600'
                  : 'border-zinc-300 bg-zinc-50 text-zinc-500 hover:border-zinc-400'
              }`}
            >
              {slotA ? (
                <>
                  <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                    <span className="text-base select-none"><CraftSprite name={slotA.name} emoji={slotA.emoji} /></span>
                    <span className="truncate text-xs font-bold">{slotA.name}</span>
                    {slotA.isShiny && <span className="text-amber-400 text-[10px]">✨</span>}
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      sound.playClick();
                      onClearSlotA();
                    }}
                    className="p-0.5 rounded hover:bg-black/20 text-zinc-400 hover:text-zinc-100"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <span className="text-[11px] font-mono text-center w-full opacity-60">1st Element</span>
              )}
            </div>

            {/* Plus Indicator */}
            <div className="flex items-center justify-center text-zinc-400">
              <Plus className="w-4 h-4" />
            </div>

            {/* Slot B */}
            <div
              id="crucible-slot-b"
              className={`flex-1 min-w-[100px] sm:min-w-[125px] h-11 sm:h-12 px-2.5 rounded-xl border-2 border-dashed flex items-center justify-between gap-1.5 transition-all text-xs font-semibold ${
                slotB
                  ? isDarkMode
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-200 border-solid shadow-sm'
                    : 'border-amber-500 bg-amber-50 text-amber-900 border-solid shadow-sm'
                  : isDarkMode
                  ? 'border-zinc-700/70 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600'
                  : 'border-zinc-300 bg-zinc-50 text-zinc-500 hover:border-zinc-400'
              }`}
            >
              {slotB ? (
                <>
                  <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                    <span className="text-base select-none"><CraftSprite name={slotB.name} emoji={slotB.emoji} /></span>
                    <span className="truncate text-xs font-bold">{slotB.name}</span>
                    {slotB.isShiny && <span className="text-amber-400 text-[10px]">✨</span>}
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      sound.playClick();
                      onClearSlotB();
                    }}
                    className="p-0.5 rounded hover:bg-black/20 text-zinc-400 hover:text-zinc-100"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <span className="text-[11px] font-mono text-center w-full opacity-60">2nd Element</span>
              )}
            </div>

            {/* Combine Action Button */}
            <button
              id="crucible-combine-action-btn"
              disabled={!hasBoth || isSynthesizing}
              onClick={() => {
                if (hasBoth && !isSynthesizing) {
                  sound.playClick();
                  haptics.fusionPulse();
                  onCombine();
                }
              }}
              className={`h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md ${
                hasBoth && !isSynthesizing
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:brightness-110 shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse'
                  : 'bg-zinc-700/30 text-zinc-500 border border-zinc-700/40 cursor-not-allowed'
              }`}
              title={hasBoth ? 'Fuse elements now' : 'Add 2 elements to combine'}
            >
              <Sparkles className={`w-3.5 h-3.5 ${isSynthesizing ? 'animate-spin' : ''}`} />
              <span>{isSynthesizing ? 'Fusing...' : 'Combine'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
