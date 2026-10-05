/** QuarkPop - top bar header */

import React, { useState, useEffect } from 'react';
import { useGame } from '../lib/gameStore';
import { Volume2, VolumeX, Mic, Camera, BookOpen, RotateCcw, Download, Upload, Sparkles, Zap, CheckCircle2, Smartphone, Vibrate, Settings2, Cloud, NotebookPen, X } from 'lucide-react';
import { sound } from '../lib/audio';
import { haptics } from '../lib/haptics';
import { PWAInstallButton } from './PWAInstallButton';
import { CloudSaves } from './CloudSaves';

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
  const [showCloud, setShowCloud] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(false);
  const [hapticsOn, setHapticsOn] = useState<boolean>(() => haptics.isEnabled());

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
    <header className="collection-header">
      <div className="collection-header-inner">
        <button className="collection-brand" aria-label="Open QuarkPop foundry" onClick={() => setActiveTab('foundry')}>
          <img src="/icon.svg" alt="" /><span><strong>QUARKPOP</strong><small>MIX • MUTATE • DISCOVER</small></span>
        </button>
        <div className="header-actions">
          <button aria-label="Cloud saves and sign in" title="Cloud saves and sign in" onClick={() => setShowCloud(true)}><Cloud size={21} /></button>
          <button aria-label="Settings and tools" title="Settings and tools" onClick={() => setShowSettings(true)}><Settings2 size={21} /></button>
        </div>
      </div>

      <CloudSaves open={showCloud} onClose={() => setShowCloud(false)} />
      {/* Settings / Save Modal dropdown */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181b20] border border-[#2e3440] rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#282d37]">
              <h3 className="text-sm font-bold font-mono text-[#f3f4f6] flex items-center gap-2">
                <span>⚙️</span> QUARKPOP SETTINGS & DATA
              </h3>
              <button
                onClick={() => {
                  sound.playClick();
                  haptics.lightTap();
                  setShowSettings(false);
                }}
                aria-label="Close settings" className="text-xs text-[#9ca3af] hover:text-white px-2.5 py-1.5 rounded-lg bg-[#222630] active:scale-95"
              >
                <X size={20} />
              </button>
            </div>

            <div className="settings-quick-tools">
              <button onClick={() => { setShowSettings(false); onOpenSeeds(); }}><Camera size={18} /> Photo & sketch</button>
              <button onClick={() => { setShowSettings(false); onOpenVoice(); }}><Mic size={18} /> Voice lab</button>
              <button onClick={() => { setShowSettings(false); setActiveTab('notebook'); }}><NotebookPen size={18} /> Recipe notebook</button>
              <button onClick={toggleMute}>{isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}{isMuted ? 'Turn sound on' : 'Mute sound'}</button>
            </div>
            <div className="text-xs text-[#9ca3af] font-mono space-y-3">
              {/* In-App PWA Install Banner */}
              <PWAInstallButton variant="settings" />

              {/* Android & Google Pixel Haptics Control */}
              <div className="p-3 rounded-xl bg-[#1e222b] border border-[#2f3542] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Vibrate className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="font-bold text-white text-xs">Tactile Pixel Haptics</div>
                    <div className="text-[10px] text-zinc-400">Vibrations on synthesis & drops</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const next = haptics.toggle();
                    setHapticsOn(next);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    hapticsOn
                      ? 'bg-emerald-500 text-black shadow-sm'
                      : 'bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {hapticsOn ? 'ON' : 'OFF'}
                </button>
              </div>

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
                    haptics.discovery();
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[42px] rounded-xl bg-[#232833] hover:bg-[#2c3340] border border-[#383f4e] text-[#f3f4f6] text-xs font-mono font-medium transition-colors active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" /> Export JSON
                </button>

                <label className="flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[42px] rounded-xl bg-[#232833] hover:bg-[#2c3340] border border-[#383f4e] text-[#f3f4f6] text-xs font-mono font-medium cursor-pointer transition-colors active:scale-95">
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
                          haptics.discovery();
                          setShowSettings(false);
                        } else {
                          haptics.warning();
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
                      haptics.heavyTap();
                    }
                  }}
                  className="w-full min-h-[42px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 text-xs font-mono font-medium transition-colors active:scale-95"
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
