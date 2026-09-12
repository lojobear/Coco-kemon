/**
 * ODDKIN FOUNDRY - Top Bar Header
 */

import React, { useState, useEffect } from 'react';
import { useGame } from '../lib/gameStore';
import { Volume2, VolumeX, Mic, Camera, BookOpen, RotateCcw, Download, Upload, Sparkles, Zap, CheckCircle2 } from 'lucide-react';
import { sound } from '../lib/audio';

export function Header({
  onOpenVoice,
  onOpenSeeds,
}: {
  onOpenVoice: () => void;
  onOpenSeeds: () => void;
}) {
  const {
    materials,
    oddkinCollection,
    isMuted,
    toggleMute,
    resetGame,
    exportSaveData,
    importSaveData,
    activeTab,
    setActiveTab,
  } = useGame();

  const [showSettings, setShowSettings] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.hasGeminiKey === 'boolean') {
          setHasGeminiKey(data.hasGeminiKey);
        }
      })
      .catch(() => {});
  }, []);

  const chromaCount = oddkinCollection.filter(o => o.isChromaActive || o.variantFormsDiscovered?.includes('chroma')).length;

  return (
    <header className="sticky top-0 z-30 w-full bg-[#14171c]/95 backdrop-blur-md border-b border-[#282d37] px-3 py-2 shadow-md">
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-y-2">
        {/* Left: Branding & Tagline */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { sound.playClick(); setActiveTab('foundry'); }}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="w-8 h-8 rounded bg-gradient-to-br from-[#f59e0b] via-[#d97706] to-[#78350f] p-0.5 shadow-inner flex items-center justify-center border border-[#fbbf24]/30">
              <span className="text-base font-bold text-black font-mono leading-none">Ω</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-wider text-[#f3f4f6] font-mono group-hover:text-[#f59e0b] transition-colors">
                  ODDKIN FOUNDRY
                </span>
                <span className="hidden xs:inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-[#2a2e37] text-[#9ca3af] border border-[#3e4451]">
                  v1.0
                </span>
              </div>
              <p className="text-[10px] text-[#9ca3af] tracking-widest font-mono uppercase">
                DISCOVER MATTER. CREATE LIFE.
              </p>
            </div>
          </button>
        </div>

        {/* Center: Game Engine Switcher */}
        <div className="order-3 sm:order-none w-full sm:w-auto justify-center flex items-center gap-1 bg-[#1e2229] p-1 rounded-xl border border-[#2f3542]">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('infinite-craft');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
              activeTab === 'infinite-craft'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-[#9ca3af] hover:text-[#f3f4f6]'
            }`}
            title="Infinite Craft by Neal Agarwal"
          >
            <span>🌌</span>
            <span>Infinite Craft</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('foundry');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
              activeTab === 'foundry'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-[#9ca3af] hover:text-[#f3f4f6]'
            }`}
            title="Oddkin Bio-Lab Foundry"
          >
            <span>🧪</span>
            <span>Foundry</span>
          </button>
        </div>

        {/* Center-Right: Quick Counters */}
        <div className="hidden sm:flex items-center gap-2 font-mono">
          <button
            onClick={() => { sound.playClick(); setActiveTab('archive'); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${
              activeTab === 'archive'
                ? 'bg-[#f59e0b]/20 border-[#f59e0b]/50 text-[#f59e0b]'
                : 'bg-[#1e2229] border-[#2f3542] text-[#d1d5db] hover:border-[#4b5563]'
            }`}
            title="Materials Discovered"
          >
            <span className="text-sm">🧪</span>
            <span className="font-bold">{materials.length}</span>
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('archive'); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${
              oddkinCollection.length > 0
                ? 'bg-[#10b981]/20 border-[#10b981]/50 text-[#34d399]'
                : 'bg-[#1e2229] border-[#2f3542] text-[#9ca3af]'
            }`}
            title="Oddkin Collected"
          >
            <span className="text-sm">👾</span>
            <span className="font-bold">{oddkinCollection.length}</span>
            {chromaCount > 0 && (
              <span className="text-[10px] text-[#f59e0b] font-bold flex items-center gap-0.5 ml-0.5">
                <Sparkles className="w-2.5 h-2.5" />
                {chromaCount}
              </span>
            )}
          </button>
        </div>

        {/* Right: Tactile Quick Tools & Audio */}
        <div className="flex items-center gap-1">
          {/* Gemini AI Status Indicator */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-colors ${
              hasGeminiKey
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-950/40 border-amber-500/30 text-amber-400'
            }`}
            title={hasGeminiKey ? 'API key configured; successful requests depend on model access and quota' : 'AI key is not configured'}
          >
            <span className={`w-2 h-2 rounded-full ${hasGeminiKey ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="font-semibold">{hasGeminiKey ? 'AI key configured' : 'AI not configured'}</span>
          </div>

          {/* Seeds (Camera / Sketch) */}
          <button
            onClick={() => { sound.playClick(); onOpenSeeds(); }}
            className="p-1.5 rounded-md text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-[#222731] transition-colors border border-transparent hover:border-[#383f4d]"
            title="Photo & Sketch Seeds"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* Voice Lab */}
          <button
            onClick={() => { sound.playClick(); onOpenVoice(); }}
            className="p-1.5 rounded-md text-[#9ca3af] hover:text-[#f59e0b] hover:bg-[#222731] transition-colors border border-transparent hover:border-[#383f4d]"
            title="Voice Lab"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Mute Toggle */}
          <button
            onClick={() => { sound.playClick(); toggleMute(); }}
            className="p-1.5 rounded-md text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-[#222731] transition-colors border border-transparent hover:border-[#383f4d]"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Settings / Data management */}
          <button
            onClick={() => { sound.playClick(); setShowSettings(!showSettings); }}
            className="p-1.5 rounded-md text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-[#222731] transition-colors border border-transparent hover:border-[#383f4d]"
            title="Save Management"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings / Save Modal dropdown */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181b20] border border-[#2e3440] rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#282d37]">
              <h3 className="text-sm font-bold font-mono text-[#f3f4f6] flex items-center gap-2">
                <span>⚙️</span> FOUNDRY DATA & ARCHIVES
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-xs text-[#9ca3af] hover:text-white px-2 py-1 rounded bg-[#222630]"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-[#9ca3af] font-mono space-y-3">
              {/* Gemini Engine Status Banner */}
              <div
                className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
                  hasGeminiKey
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                }`}
              >
                <div className="mt-0.5">
                  {hasGeminiKey ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Zap className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-[12px] flex items-center gap-1.5">
                    <span>{hasGeminiKey ? 'Gemini API key configured' : 'AI not configured'}</span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-[#9ca3af]">
                    {hasGeminiKey
                      ? 'Powering infinite AI concept crafting, procedural 64x64 pixel-art genetics, and multimodal photo & sketch seeds.'
                      : 'Built-in recipes still work. New AI discoveries require a configured API key.'}
                  </p>
                </div>
              </div>

              <p>Backups include both crafting elements and Foundry collections, creatures, habitats, and experiment history.</p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => {
                    const data = exportSaveData();
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `coco-kemon-save-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    sound.playDiscoveryChime();
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-[#232833] hover:bg-[#2c3340] border border-[#383f4e] text-[#f3f4f6] text-xs font-mono font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" /> Export JSON
                </button>

                <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-[#232833] hover:bg-[#2c3340] border border-[#383f4e] text-[#f3f4f6] text-xs font-mono font-medium cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-cyan-400" /> Import JSON
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        if (content && importSaveData(content)) {
                          sound.playDiscoveryChime('RARE');
                          setShowSettings(false);
                        } else {
                          alert('Import failed. Check the backup format and available browser storage, and finish any active synthesis before retrying. Your existing save has not been replaced.');
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
              </div>

              <div className="pt-2 border-t border-[#282d37]">
                <button
                  onClick={() => {
                    if (window.confirm('Reset collection to starter materials? This cannot be undone.')) {
                      resetGame();
                      setShowSettings(false);
                      sound.playSpark();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 text-xs font-mono font-medium transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset to Six Primordial Materials
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
