import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Activity,
  Flame,
  Thermometer,
  Layers,
  Atom,
  Shield,
  Clock,
  Compass,
  Radio,
  Share2,
  PlusCircle,
  Lock,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { type InfiniteElement } from '../lib/infiniteCraftData';
import { generatePhysicalData, getShinyFoilStyle, type ElementPhysicalData } from '../lib/physicalDataEngine';
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
  onToggleShinyForm,
  isDarkMode = true,
}: ElementDossierModalProps) {
  if (!element) return null;

  const isShinyUnlocked = Boolean(element.unlockedShiny || element.isShiny);
  const [viewingShiny, setViewingShiny] = useState<boolean>(Boolean(element.isShiny || isShinyUnlocked));

  const currentData: ElementPhysicalData =
    element.physicalData && element.physicalData.shinyAnomalies === (viewingShiny ? undefined : undefined)
      ? element.physicalData
      : generatePhysicalData(element.name, element.emoji, viewingShiny);

  const foilTheme = getShinyFoilStyle(element.name);

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
    if (onSpawnOnCanvas) {
      onSpawnOnCanvas(element.name, element.emoji, viewingShiny && isShinyUnlocked);
    }
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn select-none"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden my-auto transition-all ${
          viewingShiny && isShinyUnlocked
            ? 'bg-[#0f1422] border-amber-400/50 shadow-[0_0_50px_rgba(251,191,36,0.25)]'
            : isDarkMode
            ? 'bg-[#11141c] border-slate-700/80 shadow-2xl'
            : 'bg-[#161a24] border-slate-700 shadow-2xl'
        }`}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold tracking-wider text-cyan-400">
              PHYSICAL PROPERTIES DOSSIER
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              {currentData.alchemicalFormula}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 max-h-[80vh] overflow-y-auto space-y-5">
          {/* Main Visual Card & Title */}
          <div
            className={`relative rounded-2xl p-5 border flex flex-col sm:flex-row items-center gap-5 transition-all ${
              viewingShiny && isShinyUnlocked
                ? 'shiny-holographic-pill bg-slate-900/90'
                : 'bg-slate-900/60 border-slate-800'
            }`}
          >
            {/* Element Big Badge */}
            <div className="relative group">
              <div
                className={`w-24 h-24 rounded-2xl flex items-center justify-center text-5xl shadow-xl transition-transform ${
                  viewingShiny && isShinyUnlocked
                    ? 'bg-gradient-to-br from-amber-500/20 via-pink-500/20 to-cyan-500/20 border-2 border-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.35)]'
                    : 'bg-slate-800/80 border border-slate-700'
                }`}
              >
                <span>{element.emoji}</span>
              </div>

              {/* Sparkle badge for shiny */}
              {viewingShiny && isShinyUnlocked && (
                <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 text-black font-black text-[10px] flex items-center gap-1 shadow-lg shiny-star-twinkle">
                  <Sparkles className="w-3 h-3" />
                  SHINY
                </div>
              )}
            </div>

            {/* Info and Form Switcher */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                    {element.name}
                  </h2>
                  {element.isNew && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                      FIRST DISCOVERY
                    </span>
                  )}
                </div>

                <div className="text-xs font-semibold text-slate-400 mt-0.5">
                  {viewingShiny && isShinyUnlocked
                    ? currentData.shinyTitle || '✨ Rare Prismatic Anomaly'
                    : `${currentData.cosmicTier} • ${currentData.elementalAspect} Aspect`}
                </div>
              </div>

              {/* Pokémon-Style Form Switcher */}
              <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                <button
                  onClick={() => handleToggleView(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    !viewingShiny
                      ? 'bg-slate-700 text-white shadow'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white'
                  }`}
                >
                  Standard Form
                </button>

                <button
                  onClick={() => handleToggleView(true)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    viewingShiny
                      ? 'bg-gradient-to-r from-amber-400 via-pink-500 to-cyan-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                      : 'bg-slate-800/60 text-slate-400 hover:text-amber-300'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Shiny Variant</span>
                  {!isShinyUnlocked && <Lock className="w-3 h-3 text-slate-500" />}
                </button>
              </div>
            </div>
          </div>

          {/* Shiny Status Banner (Pokémon style) */}
          {viewingShiny && (
            <div
              className={`p-3.5 rounded-2xl border text-xs leading-relaxed flex items-start gap-3 transition-colors ${
                isShinyUnlocked
                  ? 'bg-amber-500/10 border-amber-400/40 text-amber-200'
                  : 'bg-slate-800/50 border-slate-700/80 text-slate-300'
              }`}
            >
              <div
                className={`p-2 rounded-xl mt-0.5 ${
                  isShinyUnlocked
                    ? 'bg-amber-400 text-slate-950 shadow-md'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {isShinyUnlocked ? <Sparkles className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </div>

              <div className="flex-1 space-y-1">
                <div className="font-bold flex items-center justify-between">
                  <span>
                    {isShinyUnlocked
                      ? '✨ 1-IN-512 RARE SHINY FORM UNLOCKED'
                      : '🔒 SHINY FORM UNREGISTERED'}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40">
                    Odds: ~0.195% (1/512)
                  </span>
                </div>
                <p className="text-[11px] opacity-90">
                  {isShinyUnlocked
                    ? 'You have discovered the rare chromatic variant of this concept! Its molecular lattice radiates full-spectrum iridescent light.'
                    : 'Combine elements repeatedly to trigger a spontaneous quantum mutation and unlock this shiny variant.'}
                </p>

                {currentData.shinyAnomalies && (
                  <div className="pt-2 flex flex-wrap gap-1.5">
                    {currentData.shinyAnomalies.map((anom, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[10px] font-mono"
                      >
                        ✦ {anom}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Physical Properties Matrix Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400 border-b border-slate-800 pb-1.5">
              <span>EMPIRICAL PHYSICAL DATA</span>
              <span className="text-[10px] text-cyan-400">SI & COSMIC METRICS</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
              {/* State of Matter */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Atom className="w-3 h-3 text-cyan-400" />
                  <span>STATE OF MATTER</span>
                </div>
                <div className="font-bold text-slate-100 text-sm">{currentData.stateOfMatter}</div>
                <div className="text-[10px] text-slate-400">Class: {currentData.massClass}</div>
              </div>

              {/* Thermal Reading */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-orange-400" />
                  <span>THERMAL SIGNATURE</span>
                </div>
                <div className="font-bold text-slate-100 text-sm truncate" title={currentData.thermalReading}>
                  {currentData.thermalReading}
                </div>
                <div className="text-[10px] text-slate-400">{currentData.temperatureClass}</div>
              </div>

              {/* Density */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-emerald-400" />
                  <span>DENSITY</span>
                </div>
                <div className="font-bold text-slate-100 text-sm">{currentData.density}</div>
                <div className="text-[10px] text-slate-400">Mass: {currentData.massClass}</div>
              </div>

              {/* Mohs Scale Hardness */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-yellow-400" />
                  <span>MOHS HARDNESS</span>
                </div>
                <div className="font-bold text-slate-100 text-sm">{currentData.mohsHardness} / 10</div>
                <div className="text-[10px] text-slate-400 truncate" title={currentData.mohsBenchmark}>
                  {currentData.mohsBenchmark}
                </div>
              </div>

              {/* Electrical Conductivity */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>CONDUCTIVITY</span>
                </div>
                <div className="font-bold text-slate-100 text-sm">{currentData.conductivity}</div>
                <div className="text-[10px] text-slate-400">Field: {currentData.magnetism}</div>
              </div>

              {/* Quantum Resonance */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Radio className="w-3 h-3 text-purple-400" />
                  <span>RESONANCE</span>
                </div>
                <div className="font-bold text-slate-100 text-sm truncate" title={currentData.resonanceHz}>
                  {currentData.resonanceHz}
                </div>
                <div className="text-[10px] text-slate-400">{currentData.stability}</div>
              </div>
            </div>
          </div>

          {/* Optics & Spectral Emission */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5 font-bold">
                <Activity className="w-3.5 h-3.5 text-pink-400" />
                SPECTRAL EMISSION & LUMINESCENCE
              </span>
              <span className="text-[10px] text-slate-400">{currentData.luminescence}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Wavelength:</span>
              <span className="font-semibold text-slate-200">{currentData.spectralBand}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Entropy Score:</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-pink-500 rounded-full"
                    style={{ width: `${currentData.entropyScore}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold">{currentData.entropyScore}/100</span>
              </div>
            </div>
          </div>

          {/* Lineage & Discovery Details */}
          {element.recipe && (
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs space-y-1.5">
              <div className="text-slate-400 font-bold font-mono flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                SYNTHESIS PROVENANCE
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <span className="px-2 py-1 rounded-lg bg-slate-800 font-semibold">
                  {element.recipe.first}
                </span>
                <span className="text-cyan-400 font-bold">+</span>
                <span className="px-2 py-1 rounded-lg bg-slate-800 font-semibold">
                  {element.recipe.second}
                </span>
                <span className="text-slate-500">➔</span>
                <span className="font-bold text-white">{element.name}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-3">
          <div className="text-[11px] font-mono text-slate-400">
            {viewingShiny && isShinyUnlocked
              ? '✨ Spawning Shiny variant on canvas'
              : 'Spawning Standard variant on canvas'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Close
            </button>

            <button
              onClick={handleSpawn}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-transform active:scale-95 ${
                viewingShiny && isShinyUnlocked
                  ? 'bg-gradient-to-r from-amber-400 via-pink-500 to-cyan-400 text-slate-950 shadow-amber-500/20 hover:brightness-110'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/20'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Spawn on Canvas</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
