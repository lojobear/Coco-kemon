import { CraftSprite } from './CraftSprite';
import React, { useState } from 'react';
import { X, Sparkles, PlusCircle, Lock, ArrowRight, CalendarDays } from 'lucide-react';
import { type InfiniteElement } from '../lib/infiniteCraftData';
import { sound } from '../lib/audio';
import { haptics } from '../lib/haptics';

interface ElementDossierModalProps {
  element: InfiniteElement | null;
  onClose: () => void;
  onSpawnOnCanvas?: (name: string, emoji: string, isShiny: boolean) => void;
  onToggleShinyForm?: (elementId: string) => void;
  isDarkMode?: boolean;
}

export function ElementDossierModal({
  element,
  onClose,
  onSpawnOnCanvas,
}: ElementDossierModalProps) {
  const [viewingShiny, setViewingShiny] = useState<boolean>(Boolean(element?.isShiny || element?.unlockedShiny));
  if (!element) return null;

  const isShinyUnlocked = Boolean(element.unlockedShiny || element.isShiny);
  const discovered = element.discoveredAt
    ? new Date(element.discoveredAt).toLocaleDateString()
    : null;

  const handleToggleView = (shiny: boolean) => {
    sound.playClick();
    haptics.lightTap();
    if (shiny && isShinyUnlocked) {
      sound.playShiny();
      haptics.shinySparkle();
    }
    setViewingShiny(shiny);
  };

  const handleSpawn = () => {
    sound.playCraftPop();
    haptics.mediumTap();
    onSpawnOnCanvas?.(element.name, element.emoji, viewingShiny && isShinyUnlocked);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn select-none"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl border border-slate-700/80 bg-[#11141c] shadow-2xl overflow-hidden my-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80">
          <span className="text-xs font-bold tracking-wider text-cyan-400">DISCOVERY</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-col items-center text-center gap-3">
            <div className={`relative w-28 h-28 rounded-2xl flex items-center justify-center bg-slate-900/80 border ${viewingShiny && isShinyUnlocked ? 'border-amber-300 shadow-[0_0_28px_rgba(251,191,36,0.22)]' : 'border-slate-800'}`}>
              <CraftSprite name={element.name} emoji={element.emoji} />
              {viewingShiny && isShinyUnlocked && (
                <span className="absolute -top-2 -right-2 px-2 py-1 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 text-black font-black text-[9px] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> SHINY
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl font-black text-white">{element.name}</h2>
                {element.isNew && <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-bold">NEW</span>}
              </div>
              {element.connection && (
                <div className="mt-1 text-[10px] uppercase tracking-wider text-cyan-400">{element.connection}</div>
              )}
            </div>
          </div>

          {element.explanation && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5">
              <p className="text-sm leading-relaxed text-slate-200">{element.explanation}</p>
            </div>
          )}

          {element.recipe && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">How you made it</div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
                <span className="px-2 py-1 rounded-lg bg-slate-800 font-semibold">{element.recipe.first}</span>
                <span className="text-cyan-400">+</span>
                <span className="px-2 py-1 rounded-lg bg-slate-800 font-semibold">{element.recipe.second}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-bold text-white">{element.name}</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {element.variantOf && (
              <span className="px-2.5 py-1 rounded-full border border-violet-400/30 bg-violet-500/10 text-[10px] text-violet-200">
                Variant of {element.variantOf}
              </span>
            )}
            {discovered && (
              <span className="px-2.5 py-1 rounded-full border border-slate-700 bg-slate-900/60 text-[10px] text-slate-400 flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> {discovered}
              </span>
            )}
            {element.isNew && (
              <span className="px-2.5 py-1 rounded-full border border-amber-400/30 bg-amber-500/10 text-[10px] text-amber-300">
                First discovery
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-white">Rare form</div>
                <div className="text-[10px] text-slate-400">
                  {isShinyUnlocked ? 'You unlocked the shiny form.' : 'Keep combining to uncover rare forms.'}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleToggleView(false)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold ${!viewingShiny ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  Standard
                </button>
                <button
                  onClick={() => handleToggleView(true)}
                  disabled={!isShinyUnlocked}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 ${viewingShiny ? 'bg-amber-400 text-black' : 'bg-slate-800 text-slate-400'} disabled:opacity-45`}
                >
                  {isShinyUnlocked ? <Sparkles className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  Shiny
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
          >
            Close
          </button>
          <button
            onClick={handleSpawn}
            className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            Spawn
          </button>
        </div>
      </div>
    </div>
  );
}
