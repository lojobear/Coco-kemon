/**
 * ODDKIN FOUNDRY - The Archive
 * Comprehensive catalog of all discovered materials & Oddkin species
 * with interactive lineage trees, traits, taxonomy, and transformation tests.
 */

import { MaterialSprite } from './ElementSprite';
import { SkeletonCard } from './SkeletonCard';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { readCraftElements } from '../lib/saveData';
import { conceptMaterial } from '../lib/conceptMaterial';
import { useGame } from '../lib/gameStore';
import { Material, Oddkin, Rarity } from '../types';
import { sound } from '../lib/audio';
import { generatePhysicalData } from '../lib/physicalDataEngine';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { BookOpen, Sparkles, GitBranch, ArrowRight, X, Info, Flame, Shield, Heart, Shuffle } from 'lucide-react';

const FAVORITES_KEY = 'quarkpop_favorites_v1';

// Rarest-first ranking used by the "Rarest first" sort mode.
const RARITY_RANK: Record<Rarity, number> = {
  ANOMALOUS: 5,
  MYTHIC: 4,
  EXOTIC: 3,
  RARE: 2,
  UNCOMMON: 1,
  COMMON: 0,
};

type SortMode = 'newest' | 'name' | 'rarity';

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

function sortArchive<T extends { rarity: Rarity; discoveredAt: number }>(
  items: T[],
  nameOf: (item: T) => string,
  mode: SortMode,
): T[] {
  const copy = [...items];
  if (mode === 'name') {
    copy.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  } else if (mode === 'rarity') {
    copy.sort((a, b) => {
      const byRarity = (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0);
      if (byRarity !== 0) return byRarity;
      return (b.discoveredAt || 0) - (a.discoveredAt || 0);
    });
  } else {
    // Newest: discovery timestamp, newest first (untimestamped sink to the bottom).
    copy.sort((a, b) => (b.discoveredAt || 0) - (a.discoveredAt || 0));
  }
  return copy;
}

export function ArchiveView({
  inspectedItem,
  onCloseInspect,
}: {
  inspectedItem: { type: 'material' | 'oddkin'; item: Material | Oddkin } | null;
  onCloseInspect: () => void;
}) {
  const { materials: foundryMaterials, oddkinCollection, setInspectedItem, transformOddkinWithCatalyst } = useGame();

  const [craftItems] = useState(readCraftElements);
  const materials = useMemo(() => {
    const names = new Set(foundryMaterials.map(item => item.displayName.trim().toLowerCase()));
    return [...foundryMaterials, ...craftItems.filter(item => !names.has(item.name.trim().toLowerCase())).map(item => ({
      ...conceptMaterial({ result: item.name, emoji: item.emoji, explanation: item.explanation, connection: item.connection }),
      discoveredAt: item.discoveredAt || 0, customSpriteUrl: item.customSpriteUrl,
    }))];
  }, [foundryMaterials, craftItems]);
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'oddkin' | 'materials'>('all');
  const [selectedRarity, setSelectedRarity] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedCatalyst, setSelectedCatalyst] = useState<Material | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search so the filter computation only re-runs once typing pauses.
  const debouncedSearch = useDebouncedValue(searchFilter, 250);
  const isDebouncing = searchFilter !== debouncedSearch;

  const rarities = ['ALL', 'COMMON', 'UNCOMMON', 'RARE', 'EXOTIC', 'MYTHIC', 'ANOMALOUS'];

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(fav => fav !== id) : [...prev, id];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable (e.g. private mode) — keep the in-memory copy.
      }
      return next;
    });
  };

  const filteredOddkin = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const favSet = new Set(favorites);
    const filtered = oddkinCollection.filter(o => {
      const matchesRarity = selectedRarity === 'ALL' || o.rarity === selectedRarity;
      const matchesSearch = !q || o.speciesName.toLowerCase().includes(q) || o.titleOrClassification.toLowerCase().includes(q);
      const matchesFavorite = !showFavoritesOnly || favSet.has(o.speciesId);
      return matchesRarity && matchesSearch && matchesFavorite;
    });
    return sortArchive(filtered, o => o.speciesName, sortMode);
  }, [oddkinCollection, selectedRarity, debouncedSearch, favorites, showFavoritesOnly, sortMode]);

  const filteredMaterials = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const favSet = new Set(favorites);
    const filtered = materials.filter(m => {
      const matchesRarity = selectedRarity === 'ALL' || m.rarity === selectedRarity;
      const matchesSearch = !q || m.displayName.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
      const matchesFavorite = !showFavoritesOnly || favSet.has(m.id);
      return matchesRarity && matchesSearch && matchesFavorite;
    });
    return sortArchive(filtered, m => m.displayName, sortMode);
  }, [materials, selectedRarity, debouncedSearch, favorites, showFavoritesOnly, sortMode]);

  const activeInspected = inspectedItem;

  // Opens a random discovery exactly the way tapping its card does.
  const handleSurpriseMe = () => {
    type Inspected = { type: 'oddkin'; item: Oddkin } | { type: 'material'; item: Material };
    const filteredPool: Inspected[] = [
      ...filteredOddkin.map((item): Inspected => ({ type: 'oddkin', item })),
      ...filteredMaterials.map((item): Inspected => ({ type: 'material', item })),
    ];
    const pool = filteredPool.length > 0
      ? filteredPool
      : [
          ...oddkinCollection.map((item): Inspected => ({ type: 'oddkin', item })),
          ...materials.map((item): Inspected => ({ type: 'material', item })),
        ];
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    sound.playClick();
    if (pick.type === 'oddkin') {
      sound.playOddkinChirp(pick.item.chirpToneHz, pick.item.temperament);
    }
    setInspectedItem(pick);
  };

  const renderFavoriteStar = (id: string) => {
    const isFav = favorites.includes(id);
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          sound.playClick();
          toggleFavorite(id);
        }}
        aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
        className={`absolute top-2 left-2 z-10 w-7 h-7 flex items-center justify-center rounded-lg bg-black/40 border border-transparent hover:border-amber-400/60 transition-colors text-base leading-none ${
          isFav ? 'text-amber-400' : 'text-[#5b6474] hover:text-amber-300'
        }`}
      >
        {isFav ? '★' : '☆'}
      </button>
    );
  };

  const skeletonGrid = (count = 8) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );

  // Handle Escape key to close inspector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeInspected) {
        onCloseInspect();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeInspected, onCloseInspect]);

  // Press "/" to focus the archive search (when not already typing somewhere).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="w-full flex-1 max-w-4xl mx-auto px-3 py-4 space-y-4 font-mono select-none">
      {/* Archive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#282d37]">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#f3f4f6] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#f59e0b]" />
            YOUR COLLECTION
          </h2>
          <p className="text-xs text-[#9ca3af]">
            The things you discovered and the Oddkin you brought to life.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 bg-[#181b20] p-1 rounded-xl border border-[#2c3240] text-xs">
          <button
            onClick={() => { sound.playClick(); setActiveSubTab('all'); }}
            className={`px-3 py-1 rounded-lg transition-colors font-semibold ${
              activeSubTab === 'all'
                ? 'bg-[#f59e0b] text-black'
                : 'text-[#9ca3af] hover:text-white'
            }`}
          >
            All ({materials.length + oddkinCollection.length})
          </button>
          <button
            onClick={() => { sound.playClick(); setActiveSubTab('oddkin'); }}
            className={`px-3 py-1 rounded-lg transition-colors font-semibold flex items-center gap-1 ${
              activeSubTab === 'oddkin'
                ? 'bg-[#a855f7] text-white'
                : 'text-[#9ca3af] hover:text-white'
            }`}
          >
            Oddkin ({oddkinCollection.length})
          </button>
          <button
            onClick={() => { sound.playClick(); setActiveSubTab('materials'); }}
            className={`px-3 py-1 rounded-lg transition-colors font-semibold ${
              activeSubTab === 'materials'
                ? 'bg-[#3b82f6] text-white'
                : 'text-[#9ca3af] hover:text-white'
            }`}
          >
            Matter ({materials.length})
          </button>
        </div>
      </div>

      {/* Search, Sort & Surprise Controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Filter by name, classification, or traits...  (press /)"
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded-lg bg-[#16181e] border border-[#2a2f3d] text-xs text-[#f3f4f6] placeholder-[#6b7280] focus:outline-none focus:border-[#f59e0b]"
        />

        <div className="flex items-center gap-2">
          <select
            value={sortMode}
            onChange={e => { sound.playClick(); setSortMode(e.target.value as SortMode); }}
            aria-label="Sort archive"
            className="px-2 py-1.5 rounded-lg bg-[#16181e] border border-[#2a2f3d] text-xs text-[#f3f4f6] focus:outline-none focus:border-[#f59e0b]"
          >
            <option value="newest">Newest first</option>
            <option value="name">Name A–Z</option>
            <option value="rarity">Rarest first</option>
          </select>

          <button
            onClick={handleSurpriseMe}
            title="Open a random discovery"
            className="px-3 py-1.5 rounded-lg bg-[#181b20] border border-[#2c3240] text-xs font-semibold text-[#9ca3af] hover:text-white hover:border-[#a855f7] transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Surprise me
          </button>
        </div>
      </div>

      {/* Rarity & Favorites Filters */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
        {rarities.map(r => (
          <button
            key={r}
            onClick={() => { sound.playClick(); setSelectedRarity(r); }}
            className={`px-2 py-1 rounded whitespace-nowrap transition-colors border ${
              selectedRarity === r
                ? 'bg-[#2b313f] border-[#f59e0b] text-[#f59e0b] font-bold'
                : 'bg-[#181b20] border-[#292e3a] text-[#9ca3af] hover:text-white'
            }`}
          >
            {r}
          </button>
        ))}
        <button
          onClick={() => { sound.playClick(); setShowFavoritesOnly(v => !v); }}
          className={`px-2 py-1 rounded whitespace-nowrap transition-colors border ${
            showFavoritesOnly
              ? 'bg-[#2b313f] border-amber-400 text-amber-400 font-bold'
              : 'bg-[#181b20] border-[#292e3a] text-[#9ca3af] hover:text-white'
          }`}
        >
          ★ Favorites ({favorites.length})
        </button>
      </div>

      {/* Grid of Archive Items */}
      <div className="space-y-4">
        {/* ODDKIN SECTION */}
        {(activeSubTab === 'all' || activeSubTab === 'oddkin') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#c084fc]">
              <span className="flex items-center gap-1.5">
                <span>👾</span> ODDKIN SPECIES ({filteredOddkin.length})
              </span>
            </div>

            {filteredOddkin.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#15171d] border border-dashed border-[#2b303d] text-center text-xs text-[#6b7280]">
                No living Oddkin species discovered matching filters. Experiment with high life-potential matter & bio-processes!
              </div>
            ) : isDebouncing ? (
              skeletonGrid()
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredOddkin.map(odd => (
                  <div
                    key={odd.speciesId}
                    data-rarity={odd.rarity}
                    onClick={() => {
                      sound.playClick();
                      sound.playOddkinChirp(odd.chirpToneHz, odd.temperament);
                      setInspectedItem({ type: 'oddkin', item: odd });
                    }}
                    className="p-3 rounded-xl bg-[#181622] hover:bg-[#201d2d] border border-[#382f4e] hover:border-[#a855f7] cursor-pointer transition-all flex flex-col items-center text-center group relative shadow"
                  >
                    {renderFavoriteStar(odd.speciesId)}
                    {odd.isChromaActive && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold px-1 rounded bg-amber-400 text-black">
                        ★
                      </span>
                    )}

                    <div className="w-16 h-16 rounded-lg bg-[#110e18] p-1 mb-2 flex items-center justify-center border border-[#2b243b] group-hover:scale-105 transition-transform">
                      <img
                        src={odd.customSpriteUrl}
                        alt={odd.speciesName}
                        className="w-14 h-14 pixelated drop-shadow"
                      />
                    </div>

                    <div className="text-xs font-bold text-white truncate w-full font-pixel text-[11px]">
                      {odd.speciesName}
                    </div>
                    <div className="text-[10px] text-[#c084fc] truncate w-full">
                      {odd.titleOrClassification}
                    </div>
                    <div className="text-[9px] text-[#9ca3af] mt-1 flex items-center gap-1">
                      <span className="px-1 py-0.2 rounded bg-purple-950/80 border border-purple-800/40">
                        {odd.rarity}
                      </span>
                      <span>Depth {odd.lineage.depth}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MATERIALS SECTION */}
        {(activeSubTab === 'all' || activeSubTab === 'materials') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#38bdf8]">
              <span className="flex items-center gap-1.5">
                <span>🧪</span> DISCOVERED ITEMS ({filteredMaterials.length})
              </span>
            </div>

            {isDebouncing ? (
              skeletonGrid()
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredMaterials.map(mat => (
                  <div
                    key={mat.id}
                    data-rarity={mat.rarity}
                    onClick={() => {
                      sound.playClick();
                      setInspectedItem({ type: 'material', item: mat });
                    }}
                    className="p-3 rounded-xl bg-[#161920] hover:bg-[#1d222b] border border-[#282f3d] hover:border-[#38bdf8] cursor-pointer transition-all flex flex-col items-center text-center group relative shadow"
                  >
                    {renderFavoriteStar(mat.id)}
                    <div className="w-14 h-14 rounded-lg bg-[#11141a] p-1 mb-2 flex items-center justify-center border border-[#232936] group-hover:scale-105 transition-transform">
                      <MaterialSprite material={mat} alt={mat.displayName} className="w-11 h-11" />
                    </div>

                    <div className="text-xs font-bold text-white truncate w-full">
                      {mat.displayName}
                    </div>
                    <div className="text-[10px] text-[#9ca3af] truncate w-full">
                      {mat.category}
                    </div>
                    <div className="text-[9px] text-[#6b7280] mt-1">
                      {mat.rarity} • Depth {mat.lineage.depth}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FULL INSPECTED ITEM MODAL */}
      {activeInspected && (
        <div
          onClick={onCloseInspect}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-mono animate-fadeIn"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-[#181b22] border-2 border-[#333b4b] rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 relative"
          >
            {/* Close */}
            <button
              onClick={onCloseInspect}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#222733] text-[#9ca3af] hover:text-white hover:bg-[#2b3240]"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header info */}
            <div className="flex items-center gap-4 pb-3 border-b border-[#282f3d]">
              <div className="w-20 h-20 rounded-xl bg-[#111317] border border-[#2f3747] flex items-center justify-center p-1">
                {activeInspected.type === 'material' ? <MaterialSprite material={activeInspected.item as Material} className="w-16 h-16" /> : <img src={activeInspected.item.customSpriteUrl} alt={(activeInspected.item as Oddkin).speciesName} className="w-16 h-16 pixelated" />}
              </div>

              <div>
                <div className="text-lg font-black text-white font-pixel">
                  {activeInspected.type === 'oddkin'
                    ? (activeInspected.item as Oddkin).speciesName
                    : (activeInspected.item as Material).displayName}
                </div>
                <div className="text-xs text-[#f59e0b] font-semibold">
                  {activeInspected.type === 'oddkin'
                    ? (activeInspected.item as Oddkin).titleOrClassification
                    : (activeInspected.item as Material).category}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[#9ca3af] mt-1">
                  <span className="px-1.5 py-0.5 rounded bg-[#282e3b] font-bold text-white">
                    {activeInspected.item.rarity}
                  </span>
                  <span>Depth {activeInspected.item.lineage.depth}</span>
                  <span>Discovered {new Date(activeInspected.item.discoveredAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-[#cbd5e1] leading-relaxed bg-[#121419] p-3 rounded-xl border border-[#232833]">
              "{activeInspected.item.description}"
            </p>

            {/* ODDKIN-SPECIFIC DETAILS */}
            {activeInspected.type === 'oddkin' && (() => {
              const odd = activeInspected.item as Oddkin;
              return (
                <div className="space-y-3">
                  {/* Taxonomy & Physiology */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#14121b] border border-purple-900/30 space-y-1">
                      <span className="text-[10px] font-bold text-purple-400">MORPHOLOGY</span>
                      <div className="text-[11px] text-stone-300">Plan: {odd.morphology.bodyPlan}</div>
                      <div className="text-[11px] text-stone-300">Surface: {odd.morphology.surface}</div>
                      <div className="text-[11px] text-stone-300">Locomotion: {odd.morphology.locomotion}</div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#14121b] border border-purple-900/30 space-y-1">
                      <span className="text-[10px] font-bold text-purple-400">PHYSIOLOGY</span>
                      <div className="text-[11px] text-stone-300">Diet: {odd.physiology.diet}</div>
                      <div className="text-[11px] text-stone-300">Energy: {odd.physiology.energySource}</div>
                      <div className="text-[11px] text-stone-300">Habitat: {odd.habitatPreferences.join(', ')}</div>
                    </div>
                  </div>

                  {/* Ancestry Genome Tree */}
                  <div className="p-3 rounded-xl bg-[#110f18] border border-purple-900/40 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs">
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>PROCEDURAL ANCESTRY GRAPH</span>
                    </div>

                    <div className="space-y-1 pl-2 border-l border-purple-800/40">
                      {odd.lineage.fullAncestryChain.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-stone-300">
                          <span className="text-amber-400 font-semibold">{step.inputs.join(' + ')}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                          <span className="text-purple-300">[{step.process}]</span>
                          <ArrowRight className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                          <span className="text-white font-bold">{step.result}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Transformation Catalyst Testing */}
                  <div className="p-3 rounded-xl bg-[#181920] border border-[#2b303d] space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#f59e0b] text-[11px]">
                        METAMORPHIC TRANSFORMATION
                      </span>
                      <span className="text-[10px] text-[#9ca3af]">
                        {odd.transformationPotential.hint || 'Expose to reactive catalyst'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        onChange={(e) => {
                          const found = materials.find(m => m.id === e.target.value);
                          setSelectedCatalyst(found || null);
                        }}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#111317] border border-[#2d3342] text-xs text-white"
                      >
                        <option value="">Select Catalyst Material...</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>{m.displayName} ({m.category})</option>
                        ))}
                      </select>

                      <button
                        onClick={() => {
                          if (selectedCatalyst) {
                            transformOddkinWithCatalyst(odd.speciesId, selectedCatalyst);
                            onCloseInspect();
                          }
                        }}
                        disabled={!selectedCatalyst}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs"
                      >
                        Expose
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* MATERIAL-SPECIFIC DETAILS */}
            {activeInspected.type === 'material' && (() => {
              const mat = activeInspected.item as Material;
              const phys = generatePhysicalData(mat.displayName, '⚗️', false);

              return (
                <div className="space-y-3">
                  {/* Empirical Telemetry Matrix */}
                  <div className="p-3 rounded-xl bg-[#121419] border border-[#252b37] space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#38bdf8] uppercase tracking-wider">
                        EMPIRICAL DATA MATRIX
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        {phys.cosmicTier}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="p-1.5 rounded bg-[#161a22] border border-[#262c3a] flex flex-col">
                        <span className="text-[9px] text-zinc-400">STATE / MASS</span>
                        <span className="text-zinc-200 font-bold">{phys.stateOfMatter} ({phys.massClass})</span>
                      </div>
                      <div className="p-1.5 rounded bg-[#161a22] border border-[#262c3a] flex flex-col">
                        <span className="text-[9px] text-zinc-400">THERMAL / DENSITY</span>
                        <span className="text-amber-300 font-bold">{phys.thermalReading} ({phys.density})</span>
                      </div>
                      <div className="p-1.5 rounded bg-[#161a22] border border-[#262c3a] flex flex-col">
                        <span className="text-[9px] text-zinc-400">MOHS / CONDUCTIVITY</span>
                        <span className="text-emerald-300 font-bold">{phys.mohsHardness} / 10 ({phys.conductivity})</span>
                      </div>
                      <div className="p-1.5 rounded bg-[#161a22] border border-[#262c3a] flex flex-col">
                        <span className="text-[9px] text-zinc-400">QUANTUM RESONANCE</span>
                        <span className="text-purple-300 font-bold">{phys.resonanceHz} Hz</span>
                      </div>
                    </div>
                  </div>

                  {/* Physical Properties Flags */}
                  <div className="p-3 rounded-xl bg-[#121419] border border-[#252b37] space-y-2 text-xs">
                    <span className="text-[10px] font-bold text-[#38bdf8] uppercase">
                      TACTILE PHENOTYPE
                    </span>

                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      {Object.entries(mat.properties).map(([key, val]) => (
                        <div
                          key={key}
                          className={`px-2 py-1 rounded flex items-center justify-between ${
                            val ? 'bg-[#1e232e] text-[#f3f4f6] font-semibold' : 'bg-[#15171d] text-[#4b5563]'
                          }`}
                        >
                          <span className="capitalize">{key}</span>
                          <span>{val ? '✓' : '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recipe Lineage */}
                  <div className="p-3 rounded-xl bg-[#121419] border border-[#252b37] space-y-1 text-xs">
                    <span className="text-[10px] font-bold text-amber-400 uppercase">
                      SYNTHESIS ORIGIN
                    </span>
                    <p className="text-stone-300 text-[11px]">
                      {mat.lineage.recipeDesc || 'Primordial source matter.'}
                    </p>
                    <p className="text-[10px] text-[#9ca3af]">
                      Process Affinities: {mat.possibleProcessAffinities.join(', ')}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}