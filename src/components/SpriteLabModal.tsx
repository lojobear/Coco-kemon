import { spriteAssets, trackSpriteSync } from '../lib/spriteAssets';
import { PROFILE_SPRITES_UPDATED } from '../lib/profileSprites';
import { SpriteImage } from './SpriteImage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, RefreshCw, RotateCcw, Search, Sparkles, Upload, X } from 'lucide-react';
import { useGame } from '../lib/gameStore';
import { MATERIAL_SPRITE_RENDERER_VERSION, generateMaterialSprite, generateOddkinSprite } from '../lib/pixelRenderer';
import { Material, Oddkin } from '../types';
import { readCraftElements, saveCraftElements, SAVE_IMPORTED_EVENT, getSaveError, MAX_SPRITE_CHARS } from '../lib/saveData';
import { InfiniteElement } from '../lib/infiniteCraftData';
import { sound } from '../lib/audio';
import { ElementSprite, MaterialSprite } from './ElementSprite';
import { retryElementEmoji, upgradeElementEmoji } from '../lib/elementEmoji';

type LabItem =
  | { type: 'craft'; id: string; name: string; sprite?: string; item: InfiniteElement }
  | { type: 'material'; id: string; name: string; sprite?: string; item: Material }
  | { type: 'oddkin'; id: string; name: string; sprite?: string; item: Oddkin };

async function fileToSprite(file: File): Promise<string> {
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
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable on this device.');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 512, 512);

  const scale = Math.min(512 / image.width, 512 / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const x = Math.floor((512 - width) / 2);
  const y = Math.floor((512 - height) / 2);
  ctx.drawImage(image, x, y, width, height);
  let out = canvas.toDataURL('image/png');
  // Sprites live inside the save, which rejects anything over MAX_SPRITE_CHARS. Halve the size until it fits.
  for (let size = 256; out.length > MAX_SPRITE_CHARS && size >= 64; size /= 2) {
    const small = document.createElement('canvas');
    small.width = small.height = size;
    const smallCtx = small.getContext('2d');
    if (!smallCtx) break;
    smallCtx.imageSmoothingEnabled = false;
    smallCtx.drawImage(canvas, 0, 0, size, size);
    out = small.toDataURL('image/png');
  }
  if (out.length > MAX_SPRITE_CHARS) throw new Error('That image is too detailed to store. Try a simpler one.');
  return out;
}

export function SpriteLabModal({ onClose, embedded = false }: { onClose?: () => void; embedded?: boolean }) {
  const { materials, oddkinCollection, exportSaveData, importSaveData, setActiveTab } = useGame();
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
    () => items.find(item => `${item.type}:${item.id}` === selectedKey) || items[0] || null,
    [items, selectedKey]
  );

  useEffect(() => {
    const update = () => setCraftElements(readCraftElements());
    window.addEventListener(PROFILE_SPRITES_UPDATED, update);
    return () => window.removeEventListener(PROFILE_SPRITES_UPDATED, update);
  }, []);

  const persistSprite = async (target: LabItem, sprite?: string) => {
    const userId = await spriteAssets?.currentUser();
    if (userId && sprite === undefined) await trackSpriteSync(() => spriteAssets!.remove(userId, `${target.type}:${target.id}`));
    if (userId && sprite?.startsWith('data:image/png;base64,')) {
      sprite = await trackSpriteSync(() => spriteAssets!.put(userId, `${target.type}:${target.id}`, target.name, sprite!));
    }
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
    setStatus(mode === 'reroll' ? 'Generating a fresh high-quality 2.5D pixel sprite…' : 'Rebuilding this sprite with premium 2.5D pixel depth…');
    try {
      const sprite = await upgradeElementEmoji(target.name, variation);
      // The generated art must become the selected item's active sprite. Previously
      // it only updated the hidden cache, so any existing custom/procedural sprite
      // kept winning and made both buttons appear broken.
      await persistSprite(target, sprite);
      setStatus(mode === 'reroll'
        ? `${target.name} rerolled with a new high-quality 2.5D pixel sprite.`
        : `${target.name} upgraded to premium 2.5D pixel art.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Pixel sprite generation failed.');
    } finally {
      setUploading(false);
    }
  };

  const reroll = (target: LabItem) => freshPixelSprite(target, 'reroll');

  const restoreDefault = async (target: LabItem) => {
    try {
      if (target.type === 'craft') { await persistSprite(target); setStatus(`${target.name} restored to its saved unique emoji.`); return; }
      const sprite = target.type === 'material'
        ? generateMaterialSprite(target.item)
        : generateOddkinSprite(target.item, { isChroma: target.item.isChromaActive });
      await persistSprite(target, sprite);
      setStatus(`${target.name} restored to its default artwork.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not restore the sprite.');
    }
  };

  const uploadCustom = async (file: File | undefined) => {
    if (!file || !selected || uploading) return;
    setUploading(true);
    try {
      const sprite = await fileToSprite(file);
      await persistSprite(selected, sprite);
      setStatus(`${selected.name} now uses your custom sprite.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Custom sprite upload failed.');
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = '';
    }
  };

  return (
    <div className={embedded ? 'boop-sprite-lab' : 'boop-lab-overlay'} onClick={embedded ? undefined : onClose}>
      <section className="boop-lab-content" onClick={event => event.stopPropagation()} aria-label="Sprite studio">
        <div className="boop-screen-intro"><div><h1>Make it yours.</h1><p>Bring your own art into your collection.</p></div>{!embedded && <button className="boop-secondary" aria-label="Close Sprite Lab" onClick={onClose}><X size={20} /></button>}</div>
        <div className="boop-lab-layout">
          <aside className="boop-sprite-editor">
            {selected ? <>
              <div className="boop-sprite-preview"><span className="boop-preview-tag">LIVE PREVIEW</span><LabSprite target={selected} className="boop-editor-sprite" /></div>
              <div className="boop-sprite-identity"><h2>{selected.name}</h2><span className="boop-category-tag">{selected.type === 'craft' ? 'Discovery' : selected.type === 'oddkin' ? 'Oddkin' : selected.item.rarity.toLowerCase()}</span><span className="boop-category-tag">Your collection</span></div>
              <div className="boop-sprite-actions"><button className="boop-primary" disabled={uploading} onClick={() => uploadRef.current?.click()}><Upload size={18} />Upload artwork</button><button className="boop-secondary" disabled={uploading} onClick={() => void reroll(selected)}><RefreshCw size={18} />{uploading ? 'Working…' : 'Reroll sprite'}</button></div>
              <input ref={uploadRef} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={event => void uploadCustom(event.target.files?.[0])} />
              <div className="boop-artwork-settings"><div><span>Sprite quality</span><strong>High</strong></div><div><span>Upload formats</span><strong>PNG · WebP · JPG</strong></div><div><span>Collection storage</span><strong>Saved automatically</strong></div></div>
              <div className="boop-sprite-tools"><button disabled={uploading} onClick={() => void freshPixelSprite(selected, 'upgrade')}><Sparkles size={16} />Upgrade artwork</button><button disabled={uploading} onClick={() => void restoreDefault(selected)}><RotateCcw size={16} />Restore default</button>{selected.type !== 'oddkin' && <button disabled={uploading} onClick={() => { retryElementEmoji(selected.name); setStatus('Retrying missing art. Existing saved art is reused.'); }}>Retry missing art</button>}</div>
              <p className="boop-library-caption">Uploads and rerolls save as you go. Open your profile to manage cloud backups.</p>
              {status && <div className="boop-notice" role="status" aria-live="polite">{status}</div>}
              {embedded && <button className="boop-primary boop-explore" onClick={() => setActiveTab('archive')}>View collection →</button>}
            </> : <div className="boop-empty"><ImagePlus size={36} /><h2>Your art starts here.</h2><p>Craft a discovery, then give it your own sprite.</p></div>}
          </aside>
          <div className="boop-sprite-picker">
            <div className="boop-section-heading"><h2>Choose a discovery</h2><small>{items.length} items</small></div>
            <label className="boop-search"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search sprites" placeholder="Search discoveries…" /></label>
            <div className="boop-pills" aria-label="Sprite category">{(['all', 'craft', 'material', 'oddkin'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : value === 'craft' ? 'Craft' : value === 'material' ? 'Matter' : 'Oddkin'}</button>)}</div>
            <div className="boop-sprite-picker-grid">{items.map(item => {
              const key = `${item.type}:${item.id}`;
              return <button key={key} disabled={uploading} aria-pressed={selected?.id === item.id && selected?.type === item.type} onClick={() => { sound.playClick(); setSelectedKey(key); setStatus(null); }}><LabSprite target={item} className="boop-picker-sprite" /><strong>{item.name}</strong><small>{item.type}</small></button>;
            })}</div>
            {!items.length && <p className="boop-empty">No matching discoveries. Try another filter.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}



function LabSprite({ target, className }: { target: LabItem; className: string }) {
  if (target.type === 'material') return <MaterialSprite material={target.item} className={className} alt={target.name} />;
  if (target.type === 'craft') return <ElementSprite name={target.name} custom={target.sprite} fallback={target.item.emoji} className={className} alt={target.name} />;
  return <SpriteImage src={target.sprite} alt={target.name} className={`${className} object-contain pixelated`} />;
}
