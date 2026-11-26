import { LiveSpriteLogo } from './LiveSpriteLogo';
/** Boop - top bar header */

import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../lib/gameStore';
import { Volume2, VolumeX, Mic, Camera, BookOpen, RotateCcw, Download, Upload, Sparkles, Zap, CheckCircle2, Smartphone, Vibrate, Settings2, Cloud, NotebookPen, X, Search, UserRound, ChefHat } from 'lucide-react';
import { sound } from '../lib/audio';
import { haptics } from '../lib/haptics';
import { PWAInstallButton } from './PWAInstallButton';

const HEALTH_CACHE_TTL_MS = 60 * 1000;
export type SiteTheme = 'light' | 'dark';
type AiHealth = { hasAiKey: boolean; hasGroqKey: boolean; primaryProvider?: string; primaryModel?: string };
let healthCache: { promise: Promise<AiHealth | null>; fetchedAt: number } | null = null;

// Reuses the in-flight or fresh /api/health response across remounts.
function fetchAiStatus(): Promise<AiHealth | null> {
  const now = Date.now();
  if (healthCache && now - healthCache.fetchedAt < HEALTH_CACHE_TTL_MS) return healthCache.promise;
  const promise = fetch('/api/health')
    .then(res => res.json())
    .then(data => data && typeof data.hasAiKey === 'boolean'
      ? { hasAiKey: data.hasAiKey, hasGroqKey: data.hasGroqKey === true, primaryProvider: data.primaryProvider, primaryModel: data.primaryModel }
      : null)
    .catch(() => null);
  healthCache = { promise, fetchedAt: now };
  return promise;
}

export function Header({
  onOpenVoice,
  onOpenSeeds,
  onOpenProfile,
  onSearchCollection,
  siteTheme,
  onThemeChange,
}: {
  onOpenVoice: () => void;
  onOpenSeeds: () => void;
  onOpenProfile: () => void;
  onSearchCollection: (query: string) => void;
  siteTheme: SiteTheme;
  onThemeChange: (theme: SiteTheme) => void;
}) {
  const {
    progression,
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
  const settingsDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = settingsDialog.current;
    if (showSettings && dialog && !dialog.open) dialog.showModal();
    if (!showSettings && dialog?.open) dialog.close();
  }, [showSettings]);
  const [query, setQuery] = useState('');
  const [aiHealth, setAiHealth] = useState<AiHealth>({ hasAiKey: false, hasGroqKey: false });
  const [hapticsOn, setHapticsOn] = useState<boolean>(() => haptics.isEnabled());

  useEffect(() => {
    let cancelled = false;
    fetchAiStatus().then(status => {
      if (!cancelled && status) setAiHealth(status);
    });
    return () => { cancelled = true; };
  }, []);

  const chromaCount = oddkinCollection.filter(o => o.isChromaActive || o.variantFormsDiscovered?.includes('chroma')).length;

  return (
    <header className="collection-header">
      <div className="collection-header-inner">
        <div className="collection-brand">
          <LiveSpriteLogo/>
          <button className="collection-brand-name" aria-label="Boop home" onClick={() => setActiveTab('rooms')}><strong>Boop</strong><small>Discover & decorate</small></button>
        </div>
        <form className="boop-header-search boop-search" role="search" onSubmit={event => { event.preventDefault(); onSearchCollection(query); }}><input aria-label="Search your collection" placeholder="Search your discoveries…" value={query} onChange={event => setQuery(event.target.value)} /><button aria-label="Search collection"><Search size={18} /></button></form>
        <span className="boop-level-tag">Level {String(progression.level).padStart(2, '0')}</span>
        <div className="header-actions">
          <button aria-label="Cloud saves and sign in" title="Cloud saves and sign in" onClick={onOpenProfile}><Cloud size={21} /></button>
          <button className="boop-avatar" aria-label="Your profile" title="Your profile" onClick={() => setActiveTab('profile')}><UserRound size={18} /></button>
          <button aria-label="Settings and tools" title="Settings and tools" onClick={() => setShowSettings(true)}><Settings2 size={21} /></button>
        </div>
      </div>

      {/* Settings / Save Modal dropdown */}
      <dialog ref={settingsDialog} aria-labelledby="boop-settings-title" onCancel={() => setShowSettings(false)}
        onClose={() => setShowSettings(false)} className="boop-settings-dialog">
          <div className="boop-settings border rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="boop-settings-divider flex items-center justify-between pb-2 border-b">
              <h3 id="boop-settings-title" className="text-sm font-bold font-mono flex items-center gap-2">
                <span>⚙️</span> BOOP SETTINGS & DATA
              </h3>
              <button
                onClick={() => {
                  sound.playClick();
                  haptics.lightTap();
                  setShowSettings(false);
                }}
                aria-label="Close settings" className="boop-settings-control text-xs px-2.5 py-1.5 rounded-lg active:scale-95"
              >
                <X size={20} />
              </button>
            </div>

            <div className="boop-settings-appearance">
              <label htmlFor="boop-site-theme">Appearance</label>
              <select id="boop-site-theme" className="boop-settings-control" value={siteTheme}
                onChange={event => onThemeChange(event.target.value === 'dark' ? 'dark' : 'light')}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            <div className="settings-quick-tools">
              <button onClick={() => { setShowSettings(false); setActiveTab('kitchen'); }}><ChefHat size={18}/>Kitchen</button>
              <button onClick={() => { setShowSettings(false); onOpenSeeds(); }}><Camera size={18} /> Photo & sketch</button>
              <button onClick={() => { setShowSettings(false); onOpenVoice(); }}><Mic size={18} /> Voice lab</button>
              <button onClick={() => { setShowSettings(false); setActiveTab('notebook'); }}><NotebookPen size={18} /> Recipe notebook</button>
              <button onClick={toggleMute}>{isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}{isMuted ? 'Turn sound on' : 'Mute sound'}</button>
            </div>
            <div className="boop-settings-details text-xs font-mono space-y-3">
              {/* In-App PWA Install Banner */}
              <PWAInstallButton variant="settings" />

              {/* Android & Google Pixel Haptics Control */}
              <div className="boop-settings-control p-3 rounded-xl border flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Vibrate className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="font-bold text-xs">Tactile Pixel Haptics</div>
                    <div className="boop-settings-details text-[10px]">Vibrations on synthesis & drops</div>
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

              {/* AI Engine Status Banner */}
              <div
                className={`boop-ai-status p-2.5 rounded-lg border flex items-start gap-2.5 ${
                  aiHealth.hasAiKey
                    ? 'is-configured'
                    : ''
                }`}
              >
                <div className="mt-0.5">
                  {aiHealth.hasAiKey ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Zap className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-[12px] flex items-center gap-1.5">
                    <span>{aiHealth.hasGroqKey ? 'Groq primary AI configured' : aiHealth.hasAiKey ? 'Fallback AI configured' : 'AI not configured'}</span>
                  </div>
                  <p className="boop-settings-details text-[10px] leading-relaxed">
                    {aiHealth.hasGroqKey
                      ? `Groq is primary for text discoveries (${aiHealth.primaryModel || 'configured model'}); Cloudflare AI and Gemini remain fallbacks.`
                      : aiHealth.hasAiKey
                        ? 'Groq is not configured yet, so Boop is currently using its fallback AI providers.'
                        : 'Built-in recipes still work. Add GROQ_API_KEY for primary AI discoveries.'}
                  </p>
                </div>
              </div>

              <p>Backups include your wallet, sold-copy history, crafting elements, and Foundry collections, creatures, habitats, and experiment history.</p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => {
                    const data = exportSaveData();
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `boop-save-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    sound.playDiscoveryChime();
                    haptics.discovery();
                  }}
                  className="boop-settings-control flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[42px] rounded-xl border text-xs font-mono font-medium transition-colors active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" /> Export JSON
                </button>

                <label className="boop-settings-control flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[42px] rounded-xl border text-xs font-mono font-medium cursor-pointer transition-colors active:scale-95">
                  <Upload className="w-3.5 h-3.5 text-cyan-400" /> Import JSON
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        const content = event.target?.result as string;
                        if (content && await importSaveData(content)) {
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

              <div className="boop-settings-divider pt-2 border-t">
                <button
                  onClick={() => {
                    if (window.confirm('Reset collection to starter materials? This cannot be undone.')) {
                      resetGame();
                      setShowSettings(false);
                      sound.playSpark();
                      haptics.heavyTap();
                    }
                  }}
                  className="boop-settings-reset w-full min-h-[42px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono font-medium transition-colors active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset to Six Primordial Materials
                </button>
              </div>
            </div>
          </div>
      </dialog>
    </header>
  );
}
