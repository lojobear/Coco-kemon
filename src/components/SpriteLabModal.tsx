import { spriteAssets, trackSpriteSync } from '../lib/spriteAssets';
import { PROFILE_SPRITES_UPDATED } from '../lib/profileSprites';
import { SpriteImage } from './SpriteImage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, RefreshCw, RotateCcw, Search, Sparkles, Upload, X } from 'lucide-react';
import { useGame } from '../lib/gameStore';
import { MATERIAL_SPRITE_RENDERER_VERSION, generateMaterialSprite, generateOddkinSprite } from '../lib/pixelRenderer';
import { Material, Oddkin } from '../types';
import { readCraftElements, saveCraftElements, SAVE_IMPORTED_EVENT, SAVE_CHANGED_EVENT, getSaveError, MAX_SPRITE_CHARS } from '../lib/saveData';
import { InfiniteElement } from '../lib/infiniteCraftData';
import { sound } from '../lib/audio';
import { ElementSprite, MaterialSprite, isProceduralDefault } from './ElementSprite';
import { buildSpriteCatalog, withUnifiedDiscoveryArtwork, type SpriteSourceType } from '../lib/spriteCatalog';
import { getElementEmoji, retryElementEmoji, upgradeElementEmoji } from '../lib/elementEmoji';
import { ARTWORK_QUEUE_EVENT, artworkQueueEntries, artworkQueueStatus, queueMissingArtwork, retryPendingArtwork } from '../lib/artworkQueue';
import { MissingSpritesList } from './MissingSpritesList';
import { spriteVariantKey } from '../lib/spriteVariant';
import { spriteLabInventoryElements } from '../lib/spriteLabInventory';
import { discoveryIdentity } from '../lib/unifiedCollection';
import { alphaBounds } from '../lib/miniSpriteStyle';

type LabItem =
  | { type: 'craft'; id: string; name: string; sprite?: string; item: InfiniteElement }
  | { type: 'material'; id: string; name: string; sprite?: string; item: Material }
  | { type: 'oddkin'; id: string; name: string; sprite?: string; item: Oddkin };
type LabDisplayItem = LabItem & {
  catalogKey: string;
  sourceTypes: SpriteSourceType[];
  sharedSprite?: string;
};

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
    window.addEventListener(SAVE_CHANGED_EVENT, reload);
    return () => { window.removeEventListener(SAVE_IMPORTED_EVENT, reload); window.removeEventListener(SAVE_CHANGED_EVENT, reload); };
  }, []);
  const [uploading, setUploading] = useState(false);
  const [artworkStatus, setArtworkStatus] = useState(artworkQueueStatus);
  useEffect(() => {
    const update = () => setArtworkStatus(artworkQueueStatus());
    window.addEventListener(ARTWORK_QUEUE_EVENT, update);
    return () => window.removeEventListener(ARTWORK_QUEUE_EVENT, update);
  }, []);

  const latest = useRef({ exportSaveData, importSaveData });
  latest.current = { exportSaveData, importSaveData };
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'craft' | 'material' | 'oddkin'>('all');
  // Mount thumbnails in batches, not hundreds of SVG/PNG decoders at once.
  // Large all-at-once galleries exhaust Android WebView image memory.
  const [galleryLimit, setGalleryLimit] = useState(72);
  const galleryMoreRef = useRef<HTMLButtonElement>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const rerollNonce = useRef(0);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Deduplicate by concept rather than creating separate Craft/Material cards.
  // Keep this projection independent of the search query so typing doesn't
  // rerender hundreds of procedural sprites or change source records.
  const catalog = useMemo(
    () => buildSpriteCatalog(craftElements, materials, oddkinCollection, isProceduralDefault),
    [craftElements, materials, oddkinCollection],
  );
  const items = useMemo<LabDisplayItem[]>(() => {
    const normalizedQuery = discoveryIdentity(query);
    return catalog.flatMap(entry => {
      if (filter !== 'all' && !entry.sources.includes(filter)) return [];
      if (normalizedQuery && !discoveryIdentity(entry.name).includes(normalizedQuery)) return [];
      const target: LabItem | undefined =
        filter === 'material' && entry.material
          ? { type: 'material', id: entry.material.id, name: entry.name, sprite: entry.material.customSpriteUrl, item: entry.material }
        : filter === 'oddkin' && entry.oddkin
          ? { type: 'oddkin', id: entry.oddkin.speciesId, name: entry.name, sprite: entry.oddkin.customSpriteUrl, item: entry.oddkin }
        : entry.craft
          ? { type: 'craft', id: entry.craft.id, name: entry.name, sprite: entry.craft.customSpriteUrl, item: entry.craft }
        : entry.material
          ? { type: 'material', id: entry.material.id, name: entry.name, sprite: entry.material.customSpriteUrl, item: entry.material }
        : entry.oddkin
          ? { type: 'oddkin', id: entry.oddkin.speciesId, name: entry.name, sprite: entry.oddkin.customSpriteUrl, item: entry.oddkin }
        : undefined;
      return target ? [{ ...target, catalogKey: entry.key, sourceTypes: entry.sources, sharedSprite: entry.sprite }] : [];
    });
  }, [catalog, query, filter]);

  useEffect(() => {
    if (galleryLimit >= items.length || typeof IntersectionObserver === 'undefined') return;
    const node = galleryMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setGalleryLimit(count => Math.min(count + 72, items.length));
      }
    }, { rootMargin: '240px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [galleryLimit, items.length]);

  // Combine live Foundry materials with Craft without changing either save.
  // Do not count a known procedural Foundry placeholder as saved AI artwork.
  const inventoryElements = useMemo(
    () => spriteLabInventoryElements(craftElements, materials, generateMaterialSprite),
    [craftElements, materials],
  );

  const selected = useMemo(
    () => items.find(item => item.catalogKey === selectedKey) || items[0] || null,
    [items, selectedKey]
  );

  // Show whether the preview is actual saved artwork or just a temporary
  // offline placeholder. The old "LIVE PREVIEW" label was misleading.
  const [savedPreview, setSavedPreview] = useState(false);
  const [previewChecked, setPreviewChecked] = useState(false);
  useEffect(() => {
    let disposed = false;
    const refresh = () => {
      if (selected?.type === 'oddkin' || selected?.sharedSprite) {
        setSavedPreview(false);
        setPreviewChecked(true);
        return;
      }
      void getElementEmoji(selected.name, false, '', false)
        .then(sprite => { if (!disposed) { setSavedPreview(Boolean(sprite)); setPreviewChecked(true); } })
        .catch(() => { if (!disposed) { setSavedPreview(false); setPreviewChecked(true); } });
    };
    setSavedPreview(false);
    setPreviewChecked(false);
    refresh();
    const onSprite = (event: Event) => {
      const key = (event as CustomEvent<string>).detail;
      if (selected?.type !== 'oddkin' && key === spriteVariantKey(selected.name)) refresh();
    };
    window.addEventListener('oddkin-emoji-retry', onSprite);
    window.addEventListener(PROFILE_SPRITES_UPDATED, refresh);
    return () => {
      disposed = true;
      window.removeEventListener('oddkin-emoji-retry', onSprite);
      window.removeEventListener(PROFILE_SPRITES_UPDATED, refresh);
    };
  }, [selected?.catalogKey, selected?.name, selected?.type, selected?.sharedSprite]);

  const previewQueued = selected?.type !== 'oddkin' && artworkQueueEntries()
    .some(item => !item.shiny && item.name.toLowerCase() === selected.name.toLowerCase());
  const previewLabel = selected?.sharedSprite
    ? 'SAVED SPRITE'
    : selected?.type === 'oddkin'
      ? 'ITEM PREVIEW'
      : !previewChecked
        ? 'CHECKING ARTWORK'
        : savedPreview
          ? 'SAVED SPRITE'
          : previewQueued ? 'ARTWORK QUEUED · PLACEHOLDER' : 'TEMPORARY PLACEHOLDER';

  useEffect(() => {
    const update = () => setCraftElements(readCraftElements());
    window.addEventListener(PROFILE_SPRITES_UPDATED, update);
    return () => window.removeEventListener(PROFILE_SPRITES_UPDATED, update);
  }, []);

  const persistSprite = async (target: LabDisplayItem, sprite?: string) => {
    // Explicit artwork edits are concept-wide: every matching Craft and
    // Foundry record gets the same art. This does not merge/delete histories.
    const linkedCraft = readCraftElements().filter(item => discoveryIdentity(item.name) === discoveryIdentity(target.name));
    const linkedMaterials = materials.filter(item => discoveryIdentity(item.displayName) === discoveryIdentity(target.name));
    const cloudKeys = target.type === 'oddkin'
      ? [`oddkin:${target.id}`]
      : [...linkedCraft.map(item => `craft:${item.id}`), ...linkedMaterials.map(item => `material:${item.id}`)];
    const userId = await spriteAssets?.currentUser();
    if (userId) {
      // Update every linked cloud metadata key before publishing the new
      // reference locally. Otherwise the next automatic profile sync could
      // restore a stale image from the still-unmodified Material record.
      const uploadedData = sprite?.startsWith('data:image/png;base64,') ? sprite : undefined;
      const uniqueKeys = [...new Set(cloudKeys)];
      for (const key of uniqueKeys) {
        if (!sprite) {
          await trackSpriteSync(() => spriteAssets!.remove(userId, key));
        } else if (uploadedData) {
          const stored = await trackSpriteSync(() => spriteAssets!.put(userId, key, target.name, uploadedData));
          sprite = stored;
        }
      }
    }
    const payload = JSON.parse(latest.current.exportSaveData());
    if (target.type !== 'oddkin') {
      const next = withUnifiedDiscoveryArtwork(payload, target.name, sprite, MATERIAL_SPRITE_RENDERER_VERSION);
      const hasMaterial = linkedMaterials.length > 0;
      if (!hasMaterial && target.type === 'craft') {
        const current = readCraftElements();
        const changed = current.map(item => discoveryIdentity(item.name) === discoveryIdentity(target.name)
          ? { ...item, customSpriteUrl: sprite } : item);
        saveCraftElements(changed);
        if (getSaveError()) throw new Error(getSaveError()!);
        setCraftElements(changed);
      } else {
        if (!latest.current.importSaveData(JSON.stringify(next))) throw new Error('The linked artwork could not be saved.');
        setCraftElements(readCraftElements());
      }
    } else {
      const foundry = payload?.foundry;
      const saved = foundry?.oddkinCollection?.find((item: Oddkin) => item.speciesId === target.id);
      if (!saved) throw new Error('Oddkin could not be found in the save.');
      saved.customSpriteUrl = sprite;
      if (!latest.current.importSaveData(JSON.stringify(payload))) throw new Error('The updated sprite could not be saved.');
      setCraftElements(readCraftElements());
    }
    sound.playDiscoveryChime('UNCOMMON');
    setStatus(`${target.name} sprite updated across linked collection entries.`);
  };
  const freshPixelSprite = async (target: LabDisplayItem, mode: 'upgrade' | 'reroll') => {
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

  const retryMissingArt = async (target: LabDisplayItem) => {
    if (uploading) return;
    setUploading(true);
    setStatus(`Checking cached artwork and requesting an AI sprite for ${target.name}…`);
    try {
      const art = await retryElementEmoji(target.name);
      if (!art) throw new Error('No sprite was returned. Please try again later.');
      setStatus(`${target.name} artwork is ready and saved to your sprite cache.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The AI image service is unavailable right now.');
    } finally {
      setUploading(false);
    }
  };

  const repairMissing = async () => {
    if (uploading) return;
    setUploading(true);
    setStatus('Checking recent discoveries for missing artwork…');
    try {
      // Reads existing cache/profile sprites before spending any generation
      // requests; one tap schedules at most five truly missing items.
      const { checked, queued } = await queueMissingArtwork(inventoryElements, 5);
      if (queued) {
        setStatus(`Queued ${queued} missing ${queued === 1 ? 'sprite' : 'sprites'}. They will appear as generation finishes.`);
      } else {
        setStatus(checked
          ? 'Checked recent discoveries. Artwork is already saved or pending; use Retry queued art if it is stuck.'
          : 'No unqueued missing artwork found in recent discoveries.');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not scan missing artwork.');
    } finally {
      setUploading(false);
    }
  };

  const reroll = (target: LabDisplayItem) => freshPixelSprite(target, 'reroll');

  const restoreDefault = async (target: LabDisplayItem) => {
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
              <div className="boop-sprite-preview"><span className="boop-preview-tag">{previewLabel}</span><ZoomedLabSprite key={selected.catalogKey} target={selected}/></div>
              {selected.type !== 'oddkin' && previewChecked && !selected.sharedSprite && !savedPreview && <p className="boop-preview-notice" role="status">
                This is a temporary offline icon, not finished AI artwork. Its unique sprite still needs generating.
              </p>}
              <div className="boop-sprite-identity"><h2>{selected.name}</h2>{selected.sourceTypes.map(source => <span key={source} className="boop-category-tag">{source === 'craft' ? 'Craft' : source === 'material' ? 'Material' : 'Oddkin'}</span>)}<span className="boop-category-tag">Your collection</span></div>
              <div className="boop-sprite-actions"><button className="boop-primary" disabled={uploading} onClick={() => uploadRef.current?.click()}><Upload size={18} />Upload artwork</button><button className="boop-secondary" disabled={uploading} onClick={() => void reroll(selected)}><RefreshCw size={18} />{uploading ? 'Working…' : 'Reroll sprite'}</button></div>
              <input ref={uploadRef} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={event => void uploadCustom(event.target.files?.[0])} />
              <div className="boop-artwork-settings"><div><span>Sprite quality</span><strong>High</strong></div><div><span>Upload formats</span><strong>PNG · WebP · JPG</strong></div><div><span>Collection storage</span><strong>Saved automatically</strong></div></div>
              <div className="boop-sprite-tools"><button disabled={uploading} onClick={() => void freshPixelSprite(selected, 'upgrade')}><Sparkles size={16} />Upgrade artwork</button><button disabled={uploading} onClick={() => void restoreDefault(selected)}><RotateCcw size={16} />Restore default</button>{selected.type !== 'oddkin' && <button disabled={uploading} onClick={() => void retryMissingArt(selected)}>Retry missing art</button>}</div>
              <p className="boop-library-caption">Uploads and rerolls save as you go. Open your profile to manage cloud backups.</p>
              {status && <div className="boop-notice" role="status" aria-live="polite">{status}</div>}
              {embedded && <button className="boop-primary boop-explore" onClick={() => setActiveTab('archive')}>View collection →</button>}
            </> : <div className="boop-empty"><ImagePlus size={36} /><h2>Your art starts here.</h2><p>Craft a discovery, then give it your own sprite.</p></div>}
          </aside>
          <div className="boop-sprite-picker">
            <div className="boop-section-heading"><h2>Choose a discovery</h2><small>{items.length} unique discoveries · {catalog.length} total</small></div>
            <label className="boop-search"><Search size={18} /><input value={query} onChange={event => { setQuery(event.target.value); setGalleryLimit(72); }} aria-label="Search sprites" placeholder="Search discoveries…" /></label>
            <div className="boop-pills" aria-label="Sprite category">{(['all', 'craft', 'material', 'oddkin'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setGalleryLimit(72); }}>{value === 'all' ? 'All' : value === 'craft' ? 'Craft' : value === 'material' ? 'Matter' : 'Oddkin'}</button>)}</div>
            <div className="boop-sprite-repair">
              <button type="button" disabled={uploading} onClick={() => void repairMissing()}>
                Repair missing sprites
              </button>
              {artworkStatus.pending > 0 && <>
                <span role="status">{artworkStatus.pending} queued{artworkStatus.blocked ? ' · retry scheduled' : artworkStatus.running ? ' · generating' : ''}</span>
                <button type="button" disabled={uploading || artworkStatus.running} onClick={retryPendingArtwork}>Retry queued art</button>
              </>}
            </div>
            <MissingSpritesList elements={inventoryElements} onSelect={id => {
              const entry = inventoryElements.find(item => item.id === id);
              if (!entry) return;
              setFilter('all');
              setQuery(entry.name);
              setGalleryLimit(72);
              setSelectedKey(`concept:${discoveryIdentity(entry.name)}`);
              setStatus(null);
            }} />
            <p className="boop-library-caption">Showing {Math.min(items.length, galleryLimit)} of {items.length} · Newest discoveries first. Search finds the entire collection.</p>
            <div className="boop-sprite-picker-grid">{items.slice(0, galleryLimit).map(item => {
              const key = item.catalogKey;
              return <button key={key} disabled={uploading} aria-pressed={selected?.catalogKey === key} onClick={() => { sound.playClick(); setSelectedKey(key); setStatus(null); }}><LabSprite target={item} className="boop-picker-sprite" /><strong>{item.name}</strong><small>{item.sourceTypes.join(' · ')}</small></button>;
            })}</div>
            {items.length > galleryLimit && (
              <button ref={galleryMoreRef} type="button" className="boop-secondary"
                onClick={() => setGalleryLimit(count => Math.min(count + 72, items.length))}>
                Show more sprites · {items.length - galleryLimit} remaining
              </button>
            )}
            {!items.length && <p className="boop-empty">No matching discoveries. Try another filter.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}



// Enlarges just the displayed preview, never the underlying downloaded/saved
// PNG. Transparent padding in a user sprite must not waste the whole preview.
// Pixel nearest-neighbour scaling preserves crisp sprite outlines on Android.
function ZoomedLabSprite({target}:{target:LabDisplayItem}) {
  const [zoom,setZoom]=useState({scale:1,x:0,y:0});
  const onImageLoaded=(event: React.SyntheticEvent<HTMLDivElement>)=>{
    const image=event.target as HTMLImageElement;
    if(image.tagName!=='IMG'||!image.naturalWidth||!image.naturalHeight)return;
    try{
      const width=Math.min(256,image.naturalWidth);
      const height=Math.min(256,image.naturalHeight);
      const canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(!ctx)return;
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(image,0,0,width,height);
      const pixels=ctx.getImageData(0,0,width,height);
      const b=alphaBounds(pixels.data,width,height);
      if(!b)return;
      const boxSize=190,targetSize=158;
      // Images without transparency are left as ordinary contain previews.
      const fraction=Math.max(b.width/width,b.height/height);
      const scale=fraction<.92?Math.max(1,Math.min(3.4,targetSize/(boxSize*fraction))):1;
      const cx=(b.left+b.right+1)/2/width*boxSize;
      const cy=(b.top+b.bottom+1)/2/height*boxSize;
      const x=Math.round((boxSize/2-cx)*scale);
      const y=Math.round((boxSize/2-cy)*scale);
      setZoom(before=>before.scale===scale&&before.x===x&&before.y===y?before:{scale,x,y});
    } catch {
      // Cross-origin remote art can taint canvas; show its original image safely.
      setZoom(before=>before.scale===1&&before.x===0&&before.y===0?before:{scale:1,x:0,y:0});
    }
  };
  return <div className="boop-preview-viewport" onLoadCapture={onImageLoaded}>
    <div className="boop-preview-zoom" style={{transform:`translate(${zoom.x}px,${zoom.y}px) scale(${zoom.scale})`}}>
      <LabSprite target={target} className="boop-editor-sprite"/>
    </div>
  </div>;
}


function LabSprite({ target, className }: { target: LabDisplayItem; className: string }) {
  // A single concept image is shared by its Craft and Foundry versions.
  if (target.type === 'material' && !target.sharedSprite) {
    return <MaterialSprite material={target.item} className={className} alt={target.name} />;
  }
  if (target.type !== 'oddkin') {
    return <ElementSprite name={target.name} custom={target.sharedSprite} fallback={target.type === 'craft' ? target.item.emoji : undefined} className={className} alt={target.name} />;
  }
  return <SpriteImage src={target.sharedSprite} alt={target.name} className={`${className} object-contain pixelated`} />;
}
