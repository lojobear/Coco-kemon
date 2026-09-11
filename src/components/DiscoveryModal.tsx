/**
 * ODDKIN FOUNDRY - Discovery Presentation & Dramatic Oddkin Awakening Modal
 * Includes CRT screen flicker, particle burst, gradual sprite resolve,
 * and interactive branching Ancestry tree ("I CREATED this thing.")
 */

import React, { useState, useEffect } from 'react';
import { useGame } from '../lib/gameStore';
import { sound } from '../lib/audio';
import { Sparkles, GitBranch, ArrowRight, BookOpen, Check } from 'lucide-react';

export function DiscoveryModal() {
  const { recentDiscovery, closeDiscoveryModal, setActiveTab, setInspectedItem } = useGame();
  const [stage, setStage] = useState<'malfunction' | 'resolving' | 'revealed'>('resolving');

  const isOddkin = Boolean(recentDiscovery?.oddkin);
  const oddkin = recentDiscovery?.oddkin;
  const material = recentDiscovery?.material;

  useEffect(() => {
    if (!recentDiscovery) return;

    if (isOddkin) {
      setStage('malfunction');
      const t1 = setTimeout(() => {
        setStage('resolving');
      }, 700);
      const t2 = setTimeout(() => {
        setStage('revealed');
      }, 1600);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else {
      setStage('resolving');
      const t = setTimeout(() => {
        setStage('revealed');
      }, 500);
      return () => clearTimeout(t);
    }
  }, [recentDiscovery, isOddkin]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && recentDiscovery) {
        closeDiscoveryModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recentDiscovery, closeDiscoveryModal]);

  if (!recentDiscovery) return null;

  return (
    <div
      onClick={closeDiscoveryModal}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 select-none font-mono animate-fadeIn"
    >
      {/* Background ambient flash during awakening */}
      {stage === 'malfunction' && (
        <div className="absolute inset-0 bg-red-950/40 animate-ping pointer-events-none" />
      )}

      <div
        onClick={e => e.stopPropagation()}
        className={`relative max-w-sm w-full rounded-2xl border-2 p-5 shadow-2xl transition-all duration-500 overflow-hidden ${
          isOddkin
            ? 'bg-[#15131c] border-[#a855f7] shadow-[0_0_40px_rgba(168,85,247,0.35)]'
            : 'bg-[#181b20] border-[#f59e0b]/80 shadow-[0_0_30px_rgba(245,158,11,0.25)]'
        }`}
      >
        {/* Subtle scanline overlay */}
        <div className="absolute inset-0 crt-scanlines opacity-50 pointer-events-none" />

        {/* 1. MALFUNCTION PHASE (ODDKIN ONLY) */}
        {stage === 'malfunction' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="w-16 h-16 rounded-full border-4 border-dashed border-red-500 animate-spin flex items-center justify-center">
              <span className="text-2xl text-red-400">⚡</span>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-red-400 tracking-widest animate-pulse">
                PRESSURE SURGE DETECTED
              </div>
              <div className="text-xs text-stone-400">
                Lattice reorganizing spontaneously...
              </div>
            </div>
          </div>
        )}

        {/* 2. RESOLVING & REVEALED PHASE */}
        {stage !== 'malfunction' && (
          <div className="flex flex-col items-center text-center space-y-4 relative z-10">
            {/* Header Badge */}
            <div className="space-y-1">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border ${
                  isOddkin
                    ? 'bg-purple-950/60 border-purple-500 text-purple-300'
                    : 'bg-amber-950/60 border-amber-500 text-amber-300'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                {isOddkin ? 'LIFE EMERGENCE' : recentDiscovery.isNew ? 'NEW DISCOVERY' : 'KNOWN MATERIAL'}
              </div>

              {recentDiscovery.isChroma && (
                <div className="inline-block ml-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-amber-400 text-black shadow">
                  CHROMA FORM ★
                </div>
              )}
            </div>

            {/* Sprite with animated reveal & breathing */}
            <div className="relative my-2">
              {/* Particle glow ring */}
              <div
                className={`absolute inset-0 rounded-full blur-xl opacity-60 animate-pulse ${
                  isOddkin ? 'bg-purple-500' : 'bg-amber-500'
                }`}
              />

              <div
                className={`relative w-28 h-28 rounded-2xl p-2 flex items-center justify-center border-2 shadow-inner transition-all duration-700 ${
                  stage === 'resolving' ? 'scale-90 opacity-40 blur-xs' : 'scale-100 opacity-100'
                } ${
                  isOddkin
                    ? 'bg-[#1e1a29] border-purple-400/80'
                    : 'bg-[#1e232d] border-amber-400/80'
                }`}
              >
                <img
                  src={isOddkin ? oddkin?.customSpriteUrl : material?.customSpriteUrl}
                  alt={isOddkin ? oddkin?.speciesName : material?.displayName}
                  className="w-20 h-20 pixelated drop-shadow-xl animate-bounce duration-1000"
                />
              </div>
            </div>

            {/* Name, Classification & Rarity */}
            <div className="space-y-1 w-full">
              <div className="text-xl font-black text-white tracking-wide font-pixel">
                {isOddkin ? oddkin?.speciesName : material?.displayName}
              </div>

              <div className="flex items-center justify-center gap-2 text-xs">
                <span className="text-[#9ca3af]">
                  {isOddkin ? oddkin?.titleOrClassification : material?.category}
                </span>
                <span className="text-[#4b5563]">•</span>
                <span
                  className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                    (isOddkin ? oddkin?.rarity : material?.rarity) === 'MYTHIC'
                      ? 'bg-amber-400 text-black'
                      : (isOddkin ? oddkin?.rarity : material?.rarity) === 'EXOTIC'
                      ? 'bg-purple-600 text-white'
                      : (isOddkin ? oddkin?.rarity : material?.rarity) === 'RARE'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-stone-700 text-stone-200'
                  }`}
                >
                  {isOddkin ? oddkin?.rarity : material?.rarity}
                </span>
              </div>

              <p className="text-xs text-[#cbd5e1] px-2 py-1 leading-relaxed bg-[#111317]/60 rounded-lg border border-[#232833]">
                "{recentDiscovery.explanation}"
              </p>
            </div>

            {/* Interactive ANCESTRY Branching Graph for Oddkin ("I CREATED this thing") */}
            {isOddkin && oddkin?.lineage && (
              <div className="w-full text-left bg-[#100e17] rounded-xl p-3 border border-purple-900/40 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-purple-400 font-bold text-[11px]">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>PROCEDURAL ANCESTRY GENOME</span>
                </div>

                <div className="space-y-1 pl-1 border-l border-purple-800/40 ml-1">
                  {oddkin.lineage.fullAncestryChain.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[10px] text-stone-300">
                      <span className="text-amber-400 font-semibold">{step.inputs.join(' + ')}</span>
                      <ArrowRight className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                      <span className="text-purple-300">[{step.process}]</span>
                      <ArrowRight className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                      <span className="text-white font-bold">{step.result}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-1 flex flex-wrap gap-1 text-[9px] text-[#9ca3af]">
                  <span className="bg-purple-950/70 px-1.5 py-0.5 rounded border border-purple-800/30">
                    Diet: {oddkin.physiology.diet}
                  </span>
                  <span className="bg-purple-950/70 px-1.5 py-0.5 rounded border border-purple-800/30">
                    Surface: {oddkin.morphology.surface}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="w-full flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  sound.playClick();
                  closeDiscoveryModal();
                  setActiveTab('archive');
                  if (isOddkin && oddkin) {
                    setInspectedItem({ type: 'oddkin', item: oddkin });
                  } else if (material) {
                    setInspectedItem({ type: 'material', item: material });
                  }
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#252a36] hover:bg-[#2f3544] border border-[#3c4456] text-[#e5e7eb] text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                ARCHIVE ENTRY
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  closeDiscoveryModal();
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow"
              >
                <Check className="w-3.5 h-3.5" />
                CONTINUE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
