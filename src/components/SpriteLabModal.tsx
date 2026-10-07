import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, RefreshCw, RotateCcw, Search, Sparkles, Upload, X } from 'lucide-react';
import { useGame } from '../lib/gameStore';
import { MATERIAL_SPRITE_RENDERER_VERSION, generateMaterialSprite, generateOddkinSprite } from '../lib/pixelRenderer';
import { Material, Oddkin } from '../types';
import { readCraftElements, saveCraftElements, SAVE_IMPORTED_EVENT, getSaveError } from '../lib/saveData';
import { InfiniteElement } from '../lib/infiniteCraftData';
import { sound } from '../lib/audio';
import { ElementSprite, MaterialSprite } from './ElementSprite';
import { retryElementEmoji, upgradeElementEmoji } from '../lib/elementEmoji';

type LabItem =
  | { type: 'craft'; id: string; name: string; sprite?: string; item: InfiniteElement }
  | { type: 'material'; id: string; name: string; sprite?: string; item: Material }
  | { type: 'oddkin'; id: string; name: string; sprite?: string; item: Oddkin };

async function fileTo64pxSprite(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a PNG, WebP, or JPG image.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Please keep sprite images under 8 MB.');

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode that image.'));
    img.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable on this device.');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 64);

  const scale = Math.min(64 / image.width, 64 / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const x = Math.floor((64 - width) / 2);
  const y = Math.floor((64 - height) / 2);
  ctx.drawImage(image, x, y, width, height);
  return canvas.toDataURL('image/png');
}

export function SpriteLabModal({ onClose, embedded = false }: { onClose?: () => void; embedded?: boolean }) {
  const { materials, oddkinCollection, exportSaveData, importSaveData } = useGame();
  const [craftElements, setCraftElements] = useState(readCraftElements);
  useEffect(() => {
    const reload = () => setCraftElements(readCraftElements());
    window.addEventListener(SAVE_IMPORTED_EVENT, reload);
    return () => window.removeEventListener(SAVE_IMPORTED_EVENT, reload);
  }, []);
  const [uploading, setUploading] = useState(false);
  const latest = useRef({ exportSaveData, importSaveData });
  latest.current = { exportSaveData, importSaveData };
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'craft' | 'material' | 'oddkin'>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const rerollNonce = useRef(0);
  const uploadRef = useRef<HTMLInputElement>(null);

  const items = useMemo<LabItem[]>(() => {
    const all: LabItem[] = [
      ...craftElements.map(item => ({ type: 'craft' as const, id: item.id, name: item.name, sprite: item.customSpriteUrl, item })),
      ...materials.map(item => ({ type: 'material' as const, id: item.id, name: item.displayName, sprite: item.customSpriteUrl, item })),
      ...oddkinCollection.map(item => ({ type: 'oddkin' as const, id: item.speciesId, name: item.speciesName, sprite: item.customSpriteUrl, item })),
    ];
    const normalizedQuery = query.trim().toLowerCase();
    return all.filter(item =>
      (filter === 'all' || item.type === filter) &&
      (!normalizedQuery || item.name.toLowerCase().includes(normalizedQuery))
    );
  }, [materials, oddkinCollection, craftElements, query, filter]);

  const selected = useMemo(
    () => items.find(item => `${item.type}:${item.id}` === selectedKey) || null,
    [items, selectedKey]
  );

  const persistSprite = (target: LabItem, sprite?: string) => {
    if (target.type === 'craft') {
      const current = readCraftElements();
      if (!current.some(item => item.id === target.id)) throw new Error('Discovery no longer exists.');
      const next = current.map(item => item.id === target.id ? { ...item, customSpriteUrl: sprite } : item);
      saveCraftElements(next);
      setCraftElements(next);
      if (getSaveError()) throw new Error(getSaveError()!);
      setStatus(`${target.name} sprite updated.`);
      return;
    }
    const payload = JSON.parse(latest.current.exportSaveData());
    const foundry = payload?.foundry;
    if (!foundry) throw new Error('Foundry save data is unavailable.');

    if (target.type === 'material') {
      const saved = foundry.materials?.find((item: Material) => item.id === target.id);
      if (!saved) throw new Error('Material could not be found in the save.');
      saved.customSpriteUrl = sprite;
      // Keep the custom sprite from being replaced by the renderer migration on reload.
      saved.spriteRendererVersion = MATERIAL_SPRITE_RENDERER_VERSION;
    } else {
      const saved = foundry.oddkinCollection?.find((item: Oddkin) => item.speciesId === target.id);
      if (!saved) throw new Error('Oddkin could not be found in the save.');
      saved.customSpriteUrl = sprite;
    }

    if (!latest.current.importSaveData(JSON.stringify(payload))) throw new Error('The updated sprite could not be saved.');
    sound.playDiscoveryChime('UNCOMMON');
    setStatus(`${target.name} sprite updated.`);
  };

  const freshPixelSprite = async (target: LabItem, mode: 'upgrade' | 'reroll') => {
    if (uploading) return;
    setUploading(true);
    rerollNonce.current += 1;
    const variation = `${mode}-${Date.now().toString(36)}-${rerollNonce.current}`;
    setStatus(mode === 'reroll' ? 'Generating a fresh pixel inventory reroll…' : 'Upgrading this sprite to pixel inventory style…');
    try {
      const sprite = await upgradeElementEmoji(target.name, variation);
      // The generated art must become the selected item's active sprite. Previously
      // it only updated the hidden cache, so any existing custom/procedural sprite
      // kept winning and made both buttons appear broken.
      persistSprite(target, sprite);
      setStatus(mode === 'reroll'
        ? `${target.name} rerolled with a new pixel inventory sprite.`
        : `${target.name} upgraded to the pixel inventory style.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Pixel sprite generation failed.');
    } finally {
      setUploading(false);
    }
  };

  const reroll = (target: LabItem) => freshPixelSprite(target, 'reroll');

  const restoreDefault = (target: LabItem) => {
    try {
      if (target.type === 'craft') { persistSprite(target); setStatus(`${target.name} restored to its saved unique emoji.`); return; }
      const sprite = target.type === 'material'
        ? generateMaterialSprite(target.item)
        : generateOddkinSprite(target.item, { isChroma: target.item.isChromaActive });
      persistSprite(target, sprite);
      setStatus(`${target.name} restored to its default artwork.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not restore the sprite.');
    }
  };

  const uploadCustom = async (file: File | undefined) => {
    if (!file || !selected || uploading) return;
    setUploading(true);
    try {
      const sprite = await fileTo64pxSprite(file);
      persistSprite(selected, sprite);
      setStatus(`${selected.name} now uses your custom sprite.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Custom sprite upload failed.');
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = '';
    }
  };

  return (
    <div className={embedded ? "w-full flex-1 min-h-0 flex p-2 sm:p-4" : "fixed inset-0 z-[80] bg-black/85 backdrop-blur-md p-3 sm:p-5 flex items-center justify-center"} onClick={embedded ? undefined : onClose}>
      <div className="w-full mx-auto max-w-4xl h-full min-h-0 overflow-hidden rounded-2xl border border-[#343b49] bg-[#11141a] shadow-2xl flex flex-col" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#292f3b]">
          <div>
            <div className="flex items-center gap-2 text-white font-black"><Sparkles className="w-4 h-4 text-amber-400" /> SPRITE LAB</div>
            <div className="text-[10px] text-[#8b95a7]">Customize Infinite Craft, materials, and Oddkin. Names, stats, and recipes stay unchanged.</div>
          </div>
          {!embedded && <button onClick={onClose} className="p-2 rounded-lg bg-[#1b2029] text-[#9ca3af] hover:text-white" aria-label="Close Sprite Lab"><X className="w-4 h-4" /></button>}
        </div>

        <div className="p-3 border-b border-[#252b36] flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-[#697386]" />
            <input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search sprites" placeholder="Search discoveries..." className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0b0d11] border border-[#2b313d] text-sm text-white outline-none focus:border-amber-500" />
          </div>
          <div className="flex gap-1 bg-[#0b0d11] border border-[#2b313d] rounded-xl p-1">
            {(['all', 'craft', 'material', 'oddkin'] as const).map(value => (
              <button key={value} onClick={() => setFilter(value)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${filter === value ? 'bg-amber-400 text-black' : 'text-[#9ca3af]'}`}>{value}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto grid grid-rows-[minmax(160px,1fr)_auto] md:grid-rows-1 md:grid-cols-[1fr_300px]">
          <div className="overflow-y-auto p-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 content-start">
            {items.length === 0 && <p className="col-span-full text-sm text-slate-400 p-3">No matching discoveries. Try another filter or keep crafting.</p>}
            {items.map(item => {
              const key = `${item.type}:${item.id}`;
              const active = key === selectedKey;
              return (
                <button key={key} onClick={() => { sound.playClick(); setSelectedKey(key); setStatus(null); }} className={`rounded-xl border p-2 text-center min-w-0 transition ${active ? 'border-amber-400 bg-amber-400/10' : 'border-[#272e39] bg-[#161a21] hover:border-[#4a5568]'}`}>
                  <div className="aspect-square rounded-lg bg-[#0b0d11] flex items-center justify-center mb-1.5 overflow-hidden">
                    <LabSprite target={item} className="w-[80%] h-[80%]" />
                  </div>
                  <div className="text-[10px] font-bold text-white truncate">{item.name}</div>
                  <div className="text-[9px] text-[#6b7280] capitalize">{item.type}</div>
                </button>
              );
            })}
          </div>

          <aside className="border-t md:border-t-0 md:border-l border-[#292f3b] bg-[#0e1116] p-4 overflow-y-auto">
            {selected ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-40 h-40 mx-auto rounded-2xl bg-[#07090c] border border-[#303744] flex items-center justify-center overflow-hidden">
                    <LabSprite target={selected} className="w-32 h-32" />
                  </div>
                  <div className="mt-2 font-black text-white">{selected.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[#788397]">{selected.type}</div>
                </div>

                <button disabled={uploading} onClick={() => void reroll(selected)} className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" /> REROLL PIXEL SPRITE
                </button>
                <p className="text-[10px] text-[#80899a] leading-relaxed">New discoveries now use a clean pixel-inventory style by default: chunky pixels, dark outline, limited palette, top-left highlights, simple shadows, and a strong readable silhouette. Upgrade applies that style to an older item; reroll creates a visibly different pixel version. Uploads still override generated art.</p>

                <button disabled={uploading} className="w-full py-3 rounded-xl border text-xs font-bold" onClick={() => void freshPixelSprite(selected, 'upgrade')}>
                  UPGRADE TO PIXEL INVENTORY STYLE
                </button>
                {selected.type !== 'oddkin' && <button className="w-full py-2 text-xs underline" onClick={() => { retryElementEmoji(selected.name); setStatus('Retrying missing art. Existing saved art is reused.'); }}>Retry missing art</button>}
                <input ref={uploadRef} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={event => void uploadCustom(event.target.files?.[0])} />
                <button disabled={uploading} onClick={() => uploadRef.current?.click()} className="w-full py-2.5 rounded-xl bg-[#18202a] border border-[#344154] text-white text-xs font-bold flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" /> USE MY IMAGE
                </button>
                <button disabled={uploading} onClick={() => restoreDefault(selected)} className="w-full py-2.5 rounded-xl bg-[#14181f] border border-[#2b323e] text-[#aab2bf] text-xs font-bold flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" /> RESTORE DEFAULT
                </button>

                {status && <div role="status" aria-live="polite" className="rounded-lg border border-[#303846] bg-[#171c24] p-2.5 text-[10px] text-[#cbd5e1]">{status}</div>}
              </div>
            ) : (
              <div className="h-full min-h-48 flex items-center justify-center text-center text-xs text-[#697386] px-4">Choose a discovery to edit its sprite.</div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}


function LabSprite({ target, className }: { target: LabItem; className: string }) {
  if (target.type === 'material') return <MaterialSprite material={target.item} className={className} alt={target.name} />;
  if (target.type === 'craft') return <ElementSprite name={target.name} custom={target.sprite} fallback={target.item.emoji} className={className} alt={target.name} />;
  return <img src={target.sprite} alt={target.name} className={`${className} object-contain pixelated`} />;
}
