/**
 * COMBINE ANIMATION OVERLAY
 * Renders a slight, elegant animation directly around the boxes on the canvas as they are combined.
 * Replaces the heavy LiDAR modal with a responsive, in-place fusion aura and particle burst.
 */

import React from 'react';
import { Sparkles } from 'lucide-react';

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

export function CombineAnimationOverlay({
  combination,
  isDarkMode,
}: CombineAnimationOverlayProps) {
  if (!combination) return null;

  const { nameA, emojiA, nameB, emojiB, midX, midY, isShiny } = combination;

  return (
    <div
      id="in-place-combine-animation"
      className="absolute pointer-events-none z-30 flex items-center justify-center select-none"
      style={{
        left: midX,
        top: midY,
        transform: 'translate(-50%, -50%)',
        width: 220,
        height: 120,
      }}
    >
      {/* 1. Luminous Diffuse Glow Aura */}
      <div
        className={`absolute inset-0 rounded-3xl blur-xl transition-all duration-300 animate-pulse ${
          isShiny
            ? 'bg-gradient-to-r from-amber-400/30 via-pink-500/30 to-cyan-400/30'
            : isDarkMode
            ? 'bg-gradient-to-r from-amber-500/25 via-yellow-400/20 to-orange-500/25'
            : 'bg-gradient-to-r from-amber-400/35 via-yellow-300/30 to-orange-400/35'
        }`}
      />

      {/* 2. Sleek Energy Border Ring around the combining boxes */}
      <div
        className={`absolute inset-1 rounded-2xl border-2 transition-all ${
          isShiny
            ? 'border-amber-300/80 shadow-[0_0_25px_rgba(251,191,36,0.6)] animate-pulse'
            : 'border-amber-400/70 shadow-[0_0_20px_rgba(245,158,11,0.45)]'
        }`}
      />

      {/* 3. Subtle Rotating Particle Sparkle Ring */}
      <div className="absolute inset-0 flex items-center justify-center animate-spin" style={{ animationDuration: '4s' }}>
        <div className="absolute -top-1 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
        <div className="absolute -bottom-1 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
        <div className="absolute -left-1 w-1.5 h-1.5 rounded-full bg-yellow-300 shadow-[0_0_6px_#fde047]" />
        <div className="absolute -right-1 w-1.5 h-1.5 rounded-full bg-pink-400 shadow-[0_0_6px_#f472b6]" />
      </div>

      {/* 4. Converging Preview Badges */}
      <div className="relative z-10 flex items-center gap-1.5 scale-95">
        {/* Left Box converging */}
        <div
          className={`px-2.5 py-1 rounded-xl border font-sans text-xs font-semibold shadow-md flex items-center gap-1.5 animate-pulse ${
            isDarkMode
              ? 'bg-[#181a20]/95 border-amber-500/50 text-amber-200'
              : 'bg-white/95 border-amber-400 text-zinc-900'
          }`}
        >
          <span className="text-base">{emojiA}</span>
          <span className="max-w-[70px] truncate">{nameA}</span>
        </div>

        {/* Center Sparkle Icon */}
        <div className="p-1 rounded-full bg-amber-500 text-black shadow-md animate-bounce">
          <Sparkles className="w-3.5 h-3.5" />
        </div>

        {/* Right Box converging */}
        <div
          className={`px-2.5 py-1 rounded-xl border font-sans text-xs font-semibold shadow-md flex items-center gap-1.5 animate-pulse ${
            isDarkMode
              ? 'bg-[#181a20]/95 border-amber-500/50 text-amber-200'
              : 'bg-white/95 border-amber-400 text-zinc-900'
          }`}
        >
          <span className="text-base">{emojiB}</span>
          <span className="max-w-[70px] truncate">{nameB}</span>
        </div>
      </div>

      {/* 5. Overhead Subtle Status Tag */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold tracking-wider uppercase bg-amber-500 text-black shadow-md whitespace-nowrap flex items-center gap-1">
        <Sparkles className="w-2.5 h-2.5 animate-spin" />
        <span>Fusing Matter...</span>
      </div>
    </div>
  );
}
