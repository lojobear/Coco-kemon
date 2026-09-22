import { readCraftElements, SAVE_IMPORTED_EVENT } from '../lib/saveData';
import { conceptMaterial } from '../lib/conceptMaterial';
import { generateMaterialSprite } from '../lib/pixelRenderer';
import { chooseRandomProcess } from '../lib/randomProcess';
/**
 * ODDKIN FOUNDRY - Core Mobile-First Workbench Machine
 * High-tactile laboratory interface with brass/graphite detailing,
 * dual slot chamber, process selector, and real-stage latency readout.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useGame } from '../lib/gameStore';
import { Material, Process } from '../types';
import { sound } from '../lib/audio';
import { EXTRA_PROCESSES } from '../lib/extraProcesses';
import { Sparkles, Trash2, X, Plus, Info, Shuffle } from 'lucide-react';

export function WorkBench({
  onInspectMaterial
}: {
  onInspectMaterial: (m: Material) => void;
}) {
  const {
    materials: foundryMaterials,
    processes,
    slotA,
    slotB,
    selectedProcess,
    setSlotA,
    setSlotB,
    setSelectedProcess,
    clearSlots,
    runSynthesis,
    isSynthesizing,
    synthesisStage,
  } = useGame();

  const [craftItems, setCraftItems] = useState(readCraftElements);
  useEffect(() => {
    const reload = () => setCraftItems(readCraftElements());
    window.addEventListener(SAVE_IMPORTED_EVENT, reload);
    return () => window.removeEventListener(SAVE_IMPORTED_EVENT, reload);
  }, []);
  const materials = useMemo(() => {
    const names = new Set(foundryMaterials.map(item => item.displayName.toLowerCase()));
    const imported = craftItems.filter(item => !names.has(item.name.toLowerCase())).map(item => {
      const material = conceptMaterial({ result: item.name, emoji: item.emoji, explanation: item.explanation, connection: item.connection });
      return { ...material, customSpriteUrl: item.customSpriteUrl || generateMaterialSprite(material) };
    });
    return [...foundryMaterials, ...imported];
  }, [foundryMaterials, craftItems]);

  const [activePickerSlot, setActivePickerSlot] = useState<'A' | 'B' | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = ['ALL', ...Array.from(new Set(materials.map(item => item.category))).sort()];
  const availableProcesses = [
    ...processes,
    ...EXTRA_PROCESSES.filter(extra => !processes.some(existing => existing.id === extra.id)),
  ];

  const pickRandomProcess = () => {
    if (isSynthesizing) return;
    const next = chooseRandomProcess(availableProcesses, selectedProcess?.id);
    if (!next) return;
    sound.playClick();
    setSelectedProcess(next);
  };

  const filteredMaterials = materials.filter(m => {
    const matchesCat = filterCategory === 'ALL' || m.category === filterCategory;
    const matchesSearch = !searchQuery || m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || m.canonicalName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const canSynthesize = Boolean(slotA && selectedProcess && !isSynthesizing);

  const pickRandomMaterial = () => {
    if (!materials.length || isSynthesizing) return;
    sound.playClick();
    const excluded = new Set([slotA?.id, slotB?.id].filter(Boolean));
    const pool = materials.filter(mat => !excluded.has(mat.id));
    const candidates = pool.length ? pool : materials;
    const randomMaterial = candidates[Math.floor(Math.random() * candidates.length)];
    if (!randomMaterial) return;
    if (!slotA) setSlotA(randomMaterial);
    else if (!slotB) setSlotB(randomMaterial);
    else setSlotB(randomMaterial);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activePickerSlot) setActivePickerSlot(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePickerSlot]);

  return (
    <div className="w-full flex flex-col flex-1 max-w-xl mx-auto px-3 py-2 space-y-3 font-mono select-none">
      <p className="text-xs text-slate-400">Use your Craft discoveries here too. Mix follows Infinite Craft; other processes transform the idea.</p>
      <div className="relative w-full rounded-2xl bg-[#181b20] border-2 border-[#2b303c] shadow-2xl p-4 overflow-hidden brass-border">
        <div className="flex items-center justify-between pb-3 border-b border-[#2a2f3a] text-[10px] text-[#9ca3af]">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
            <span className="font-bold tracking-wider text-[#e5e7eb]">CORE RESONATOR</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden xs:inline text-[#6b7280]">CHAMBER: SEALED</span>
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${slotA ? 'bg-amber-400' : 'bg-[#374151]'}`} />
              <span className={`w-1.5 h-1.5 rounded-full ${slotB ? 'bg-cyan-400' : 'bg-[#374151]'}`} />
              <span className={`w-1.5 h-1.5 rounded-full ${selectedProcess ? 'bg-purple-400' : 'bg-[#374151]'}`} />
            </div>
          </div>
        </div>

        <div className="relative my-3 rounded-xl bg-[#0f1115] border border-[#232833] p-4 min-h-[160px] flex flex-col items-center justify-center crt-scanlines overflow-hidden">
          <div className="absolute inset-0 bg-radial from-[#f59e0b]/5 via-transparent to-transparent pointer-events-none" />
          {isSynthesizing ? (
            <div className="flex flex-col items-center justify-center space-y-3 py-4 text-center z-10">
              <div className="relative w-16 h-16 rounded-full border-2 border-dashed border-[#f59e0b] animate-spin flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-[#f59e0b]/20 animate-ping" />
                <span className="absolute text-xl font-bold text-[#fbbf24]">Ω</span>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold tracking-widest text-[#fbbf24] animate-pulse">{synthesisStage || 'TRANSMUTING MATTER...'}</div>
                <div className="text-[10px] text-[#9ca3af]">Synthesizing molecular lineage matrix...</div>
              </div>
            </div>
          ) : (
            <div className="w-full flex items-center justify-around z-10">
              <div className="flex flex-col items-center">
                <div onClick={() => { sound.playClick(); setActivePickerSlot('A'); }} className={`group relative w-18 h-18 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all border-2 ${slotA ? 'bg-[#181d26] border-[#f59e0b]/70 shadow-[0_0_12px_rgba(245,158,11,0.2)]' : 'bg-[#13161c] border-dashed border-[#374151] hover:border-[#6b7280]'}`}>
                  {slotA ? <><img src={slotA.customSpriteUrl} alt={slotA.displayName} className="w-11 h-11 pixelated drop-shadow" /><button onClick={(e) => { e.stopPropagation(); sound.playClick(); setSlotA(null); }} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-950 border border-red-500 text-red-300 text-[10px] flex items-center justify-center hover:bg-red-900" title="Remove">✕</button></> : <div className="flex flex-col items-center text-[#6b7280] group-hover:text-[#9ca3af]"><Plus className="w-5 h-5" /><span className="text-[9px] font-bold mt-1">INPUT A</span></div>}
                </div>
                <span className="text-[11px] font-bold text-[#e5e7eb] mt-1.5 text-center max-w-[80px] truncate">{slotA ? slotA.displayName : 'Select'}</span>
              </div>

              <div className="flex flex-col items-center px-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border text-base shadow-inner transition-colors ${selectedProcess ? 'bg-[#251f33] border-[#a855f7] text-[#c084fc] shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'bg-[#181b20] border-[#374151] text-[#6b7280]'}`}>{selectedProcess ? selectedProcess.symbol : '➕'}</div>
                <span className="text-[10px] font-bold text-[#a855f7] mt-1 text-center max-w-[70px] truncate">{selectedProcess ? selectedProcess.name : 'Process'}</span>
              </div>

              <div className="flex flex-col items-center">
                <div onClick={() => { sound.playClick(); setActivePickerSlot('B'); }} className={`group relative w-18 h-18 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all border-2 ${slotB ? 'bg-[#181d26] border-[#38bdf8]/70 shadow-[0_0_12px_rgba(56,189,248,0.2)]' : 'bg-[#13161c] border-dashed border-[#374151] hover:border-[#6b7280]'}`}>
                  {slotB ? <><img src={slotB.customSpriteUrl} alt={slotB.displayName} className="w-11 h-11 pixelated drop-shadow" /><button onClick={(e) => { e.stopPropagation(); sound.playClick(); setSlotB(null); }} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-950 border border-red-500 text-red-300 text-[10px] flex items-center justify-center hover:bg-red-900" title="Remove">✕</button></> : <div className="flex flex-col items-center text-[#6b7280] group-hover:text-[#9ca3af]"><Plus className="w-5 h-5" /><span className="text-[9px] font-bold mt-1">INPUT B</span><span className="text-[8px] text-[#4b5563]">(opt)</span></div>}
                </div>
                <span className="text-[11px] font-bold text-[#e5e7eb] mt-1.5 text-center max-w-[80px] truncate">{slotB ? slotB.displayName : 'Optional'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button onClick={clearSlots} disabled={!slotA && !slotB && !selectedProcess} className="px-3 py-2.5 rounded-xl bg-[#20242d] hover:bg-[#282e3a] disabled:opacity-40 disabled:pointer-events-none border border-[#333a48] text-[#9ca3af] hover:text-[#f3f4f6] text-xs font-bold transition-all flex items-center gap-1.5" title="Reset Chamber"><Trash2 className="w-3.5 h-3.5" /><span className="hidden xs:inline">CLEAR</span></button>
          <button onClick={pickRandomMaterial} disabled={!materials.length || isSynthesizing} className="px-3 py-2.5 rounded-xl bg-[#1b2730] hover:bg-[#223540] disabled:opacity-40 border border-[#35505f] text-cyan-300 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95" title="Drop a random discovered item into the next input slot"><Shuffle className="w-3.5 h-3.5" /><span className="hidden xs:inline">RANDOM</span></button>
          <button onClick={runSynthesis} disabled={!canSynthesize} className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 border shadow-lg ${canSynthesize ? 'bg-gradient-to-r from-[#d97706] via-[#f59e0b] to-[#b45309] hover:from-[#f59e0b] hover:to-[#d97706] text-black border-[#fbbf24] shadow-[0_0_20px_rgba(245,158,11,0.35)] cursor-pointer active:scale-[0.98]' : 'bg-[#1f242d] border-[#2e3542] text-[#6b7280] cursor-not-allowed'}`}><Sparkles className="w-4 h-4" />SYNTHESIZE</button>
        </div>
      </div>

      <div className="w-full rounded-xl bg-[#16181e] border border-[#262b35] p-3 space-y-2">
        <div className="flex items-center justify-between text-xs"><span className="font-bold text-[#9ca3af] flex items-center gap-1.5 text-[11px]"><span>⚙️</span> PROCESS (ACTION) · {availableProcesses.length}</span><button type="button" onClick={pickRandomProcess} disabled={isSynthesizing || !availableProcesses.some(process => process.unlocked)} className="flex items-center gap-1 rounded-lg border border-purple-500/40 px-2 py-2 text-purple-300 disabled:opacity-40" aria-label="Choose a random process"><Shuffle className="w-3.5 h-3.5" /> Random</button>{selectedProcess && <span className="text-[10px] text-[#c084fc] font-semibold">{selectedProcess.verb}</span>}</div>
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
          {availableProcesses.map(proc => { const isSelected = selectedProcess?.id === proc.id; return <button key={proc.id} onClick={() => { sound.playClick(); setSelectedProcess(isSelected ? null : proc); }} className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${isSelected ? 'bg-[#a855f7] border-[#c084fc] text-black font-bold shadow-[0_0_8px_rgba(168,85,247,0.4)]' : 'bg-[#1e222b] hover:bg-[#252b36] border-[#2e3544] text-[#d1d5db]'}`} title={`${proc.category}: ${proc.description}`}><span>{proc.symbol}</span><span>{proc.name}</span></button>; })}
        </div>
      </div>

      <div className="w-full rounded-xl bg-[#16181e] border border-[#262b35] p-3 space-y-2">
        <div className="flex items-center justify-between text-xs"><span className="font-bold text-[#9ca3af] flex items-center gap-1.5 text-[11px]"><span>🧪</span> DISCOVERED ITEMS ({materials.length})</span><span className="text-[10px] text-[#6b7280]">Tap to slot A / B</span></div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1">
          {materials.map(mat => { const isSlotted = slotA?.id === mat.id || slotB?.id === mat.id; return <button key={mat.id} onClick={() => { sound.playClick(); if (!slotA) setSlotA(mat); else if (!slotB && slotA.id !== mat.id) setSlotB(mat); else if (slotA.id === mat.id) setSlotA(null); else if (slotB?.id === mat.id) setSlotB(null); else setSlotB(mat); }} onContextMenu={(e) => { e.preventDefault(); onInspectMaterial(mat); }} className={`relative flex flex-col items-center p-1.5 rounded-xl border transition-all text-center group ${isSlotted ? 'bg-[#f59e0b]/15 border-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.2)]' : 'bg-[#1a1e27] hover:bg-[#222834] border-[#2a303e] text-[#d1d5db]'}`} title={`${mat.displayName} (${mat.category}) - Right-click or hold for details`}><img src={mat.customSpriteUrl} alt={mat.displayName} className="w-9 h-9 pixelated drop-shadow mb-1 group-hover:scale-105 transition-transform" /><span className="text-[10px] font-bold text-[#f3f4f6] truncate w-full">{mat.displayName}</span><span className="text-[8px] text-[#9ca3af] truncate w-full">{mat.category}</span></button>; })}
        </div>
      </div>

      {activePickerSlot && (
        <div onClick={() => setActivePickerSlot(null)} className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div onClick={e => e.stopPropagation()} className="bg-[#181b20] border-2 border-[#333a48] rounded-2xl p-4 max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#282d37]"><div className="flex items-center gap-2"><span className="text-sm font-bold text-[#f59e0b]">CHOOSE ITEM FOR INPUT {activePickerSlot}</span></div><button onClick={() => setActivePickerSlot(null)} className="p-1 rounded-md bg-[#222630] text-[#9ca3af] hover:text-white"><X className="w-4 h-4" /></button></div>
            <div className="space-y-2"><input type="text" placeholder="Search items, animals, brands..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-[#111317] border border-[#2a2f3c] text-xs text-[#f3f4f6] placeholder-[#6b7280] focus:outline-none focus:border-[#f59e0b]" /><div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">{categories.map(cat => <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-2 py-1 rounded whitespace-nowrap transition-colors ${filterCategory === cat ? 'bg-[#f59e0b] text-black font-bold' : 'bg-[#222631] text-[#9ca3af] hover:text-white'}`}>{cat}</button>)}</div></div>
            <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-2 pr-1 min-h-[220px]">{filteredMaterials.map(mat => <div key={mat.id} onClick={() => { sound.playClick(); if (activePickerSlot === 'A') setSlotA(mat); else setSlotB(mat); setActivePickerSlot(null); }} className="flex flex-col items-center p-2 rounded-xl bg-[#13161c] hover:bg-[#1e232e] border border-[#282e3b] hover:border-[#f59e0b]/50 cursor-pointer text-center transition-all group"><img src={mat.customSpriteUrl} alt={mat.displayName} className="w-10 h-10 pixelated drop-shadow mb-1 group-hover:scale-105" /><span className="text-[11px] font-bold text-[#f3f4f6] truncate w-full">{mat.displayName}</span><span className="text-[9px] text-[#9ca3af] truncate w-full">{mat.category}</span></div>)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
