import { isPixelSpriteStyle, type SpriteArtStyle } from './spriteArtStyles';
import { spriteAssets, trackSpriteSync } from './spriteAssets';
import { emojiKey } from './emojiGeometry';
import { spriteVariantKey, spriteProfileKey } from './spriteVariant';
import { requestJson } from './api';
import { removeEdgeConnectedBackground, tidyGeneratedSpritePixels, removeMagentaMask, assertTransparentSprite } from './spritePixelCleanup';
import { composeMiniSpritePixels, MINI_CANVAS_SIZE } from './miniSpriteStyle';

const ELEMENT_SPRITE_CACHE_PREFIX = 'pixelimage-v9-2p5d:';
const LEGACY_NATIVE_IMAGE_V8_CACHE_PREFIX = 'pixelimage-v8:';
const LEGACY_NATIVE_IMAGE_V7_CACHE_PREFIX = 'pixelimage-v7:';
const LEGACY_PIXEL_INVENTORY_CACHE_PREFIX = 'pixelinventory-v6:';
const LEGACY_HD_CACHE_PREFIX = 'collectionhd-v5:';
const LEGACY_3D_CACHE_PREFIX = 'emoji3d-v4:';
const LEGACY_RECOGNIZABLE_CACHE_PREFIX = 'pixel-v3-recognizable:';
const LEGACY_PIXEL_CACHE_PREFIX = 'pixel-v2:';

/** Notify mounted grid cells when a sprite becomes available from any cache source.
 * Without this, opening the detail preview can load a cached image while the
 * already-mounted thumbnail remains stuck on its earlier failed preview.
 * This never requests generation or consumes AI credits. */
function announceSpriteReady(key: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('quarkpop-sprite-ready'));
  window.dispatchEvent(new CustomEvent('oddkin-emoji-retry', { detail: key }));
}

// The URL is also retained by mounted <img> elements; an unbounded extra
// base64 cache quickly consumes tens of MB in Android WebView.
export const MAX_SPRITE_MEMORY_ENTRIES = 48;
const memory = new Map<string, string>();
function recallArtwork(key: string): string | undefined {
  const image = memory.get(key);
  if (image) { memory.delete(key); memory.set(key, image); }
  return image;
}
function rememberArtwork(key: string, image: string) {
  memory.delete(key);
  memory.set(key, image);
  while (memory.size > MAX_SPRITE_MEMORY_ENTRIES) memory.delete(memory.keys().next().value!);
}
const jobs = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();
let database: Promise<IDBDatabase> | undefined;

function db() {
  if (database) return database;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('oddkin-element-emoji', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('art')) request.result.createObjectStore('art');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Sprite storage is unavailable.'));
    request.onblocked = () => reject(new Error('Sprite storage is temporarily blocked.'));
  });
  database = opening;
  // A rejected open promise must never poison all future gallery loads.
  // For example, Android WebView storage can become available after a restart.
  void opening.catch(() => { if (database === opening) database = undefined; });
  return opening;
}

async function stored(key: string): Promise<string | undefined> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const r = database.transaction('art').objectStore('art').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read saved sprite.'));
  });
}

async function save(key: string, data: string) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('art', 'readwrite');
    tx.objectStore('art').put(data, key);
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(new Error('Could not save sprite. Free some browser storage.'));
  });
}

export async function normalizeGeneratedImage(imageBase64: string, mimeType: string, style: SpriteArtStyle = 'classic'): Promise<string> {
  if (!/^image\/(png|jpeg|jpg|webp)$/i.test(mimeType)) throw new Error('Invalid sprite image type.');
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(imageBase64) || imageBase64.length > 16_000_000) {
    throw new Error('Invalid sprite image data.');
  }

  const image = new Image();
  image.src = `data:${mimeType};base64,${imageBase64}`;
  await image.decode();

  // First key out the chroma background at FULL image resolution.
  // Previous processing keyed magenta only after 512px -> 128px resampling;
  // merged pink edge pixels looked like glitchy holes or pixel fringes.
  const sourceSize = 512;
  const source = document.createElement('canvas');
  source.width = source.height = sourceSize;
  const sourceContext = source.getContext('2d');
  if (!sourceContext) throw new Error('Could not process generated artwork.');
  sourceContext.imageSmoothingEnabled = false;
  sourceContext.clearRect(0, 0, sourceSize, sourceSize);
  sourceContext.drawImage(image, 0, 0, sourceSize, sourceSize);
  if (typeof sourceContext.getImageData === 'function' && typeof sourceContext.putImageData === 'function') {
    const sourcePixels = sourceContext.getImageData(0, 0, sourceSize, sourceSize);
    removeMagentaMask(sourcePixels.data, sourceSize, sourceSize);
    removeEdgeConnectedBackground(sourcePixels.data, sourceSize, sourceSize);
    removeMagentaMask(sourcePixels.data, sourceSize, sourceSize);
    assertTransparentSprite(sourcePixels.data, sourceSize, sourceSize);
    sourceContext.putImageData(sourcePixels, 0, 0);
  }

  // Smooth styles keep the full-resolution alpha cutout, without pixel quantization.
  if (!isPixelSpriteStyle(style)) return source.toDataURL('image/png');
  // New v19 generated art uses a 112px canvas, ~76px max silhouette,
  // and up to 48 well-separated pixel colours for slightly finer details.
  // Process ONLY freshly generated art; saved/uploads keep their exact bytes.
  // Preserve pixel steps and use alpha-masked nearest-neighbour framing.
  const logicalSize = style === 'retro' ? 64 : style === 'hd' ? 192 : style === 'handheld' ? 96 : style === 'arcade' ? 160 : MINI_CANVAS_SIZE;
  const pixels = document.createElement('canvas');
  pixels.width = pixels.height = logicalSize;
  const pixelContext = pixels.getContext('2d');
  if (!pixelContext) throw new Error('Could not process generated pixel art.');
  pixelContext.imageSmoothingEnabled = false;
  pixelContext.clearRect(0, 0, logicalSize, logicalSize);
  pixelContext.drawImage(source, 0, 0, logicalSize, logicalSize);
  // Every modern Android WebView supports pixel access. The canvas capability
  // guard is a graceful fallback for test shims and older embedded browsers.
  if (typeof pixelContext.getImageData !== 'function' || typeof pixelContext.putImageData !== 'function'
      || typeof ImageData === 'undefined') return pixels.toDataURL('image/png');
  const sampled = pixelContext.getImageData(0, 0, logicalSize, logicalSize);
  removeMagentaMask(sampled.data, logicalSize, logicalSize);
  tidyGeneratedSpritePixels(sampled.data, logicalSize, logicalSize);
  removeMagentaMask(sampled.data, logicalSize, logicalSize);
  assertTransparentSprite(sampled.data, logicalSize, logicalSize);
  if (style !== 'classic') { pixelContext.putImageData(sampled, 0, 0); return pixels.toDataURL('image/png'); }
  const composed = composeMiniSpritePixels(sampled.data, logicalSize, logicalSize);
  removeMagentaMask(composed, logicalSize, logicalSize);
  assertTransparentSprite(composed, logicalSize, logicalSize);
  pixelContext.putImageData(new ImageData(composed, logicalSize, logicalSize), 0, 0);
  return pixels.toDataURL('image/png');
}

/** Return locally cached native artwork without generating or spending AI quota. */
export async function getCachedElementSprite(name: string, shiny = false): Promise<string | undefined> {
  const key = spriteVariantKey(name, shiny);
  const inMemory = recallArtwork(key);
  if (inMemory) return inMemory;
  try {
    return await stored(ELEMENT_SPRITE_CACHE_PREFIX + key);
  } catch {
    return undefined;
  }
}

/** Restore a downloaded profile image to the local cache for other collection views. */
export async function storeProfileElementSprite(name: string, data: string, shiny = false): Promise<void> {
  const key = spriteVariantKey(name, shiny);
  rememberArtwork(key, data);
  // Profile downloads remain usable even when browser storage is full.
  try { await save(ELEMENT_SPRITE_CACHE_PREFIX + key, data); }
  catch (error) { console.warn('Artwork available in memory but local storage could not persist it:', error); }
  announceSpriteReady(key);
}

export function getElementEmoji(name: string, upgrade = false, variation = '', generateIfMissing = true, isShiny = false, style: SpriteArtStyle = 'classic', previewOnly = false): Promise<string> {
  const key = spriteVariantKey(name, isShiny);
  // Collection previews may read cached/local/profile art but cannot trigger AI.
  const jobKey = upgrade ? `${key}:upgrade:${style}:${previewOnly ? 'preview:' : ''}${variation || 'fresh'}` : generateIfMissing ? key : `${key}:cache-only`;

  const inMemory = upgrade ? undefined : recallArtwork(key);
  if (inMemory) return Promise.resolve(inMemory);
  if (jobs.has(jobKey)) return jobs.get(jobKey)!;

  const work = async () => {
    // Local storage trouble is not proof that an existing sprite is missing.
    // Cache-only recovery scans must never spend AI credits on that basis.
    let localStorageError: unknown;
    const readLocal = async (cacheKey: string): Promise<string | undefined> => {
      if (localStorageError) return undefined;
      try { return await stored(cacheKey); }
      catch (error) { localStorageError = error; return undefined; }
    };
    // New discoveries use native image generation. Older cached art remains valid until the
    // player explicitly upgrades/rerolls it, preventing surprise regeneration costs.
    const cached = upgrade
      ? undefined
      : (await readLocal(ELEMENT_SPRITE_CACHE_PREFIX + key))
        // Old sprite versions contain normal artwork only. Never resolve those
        // as shiny art: it would make normal and shiny visually identical.
        || (isShiny ? undefined : await readLocal(LEGACY_NATIVE_IMAGE_V8_CACHE_PREFIX + key))
        || (isShiny ? undefined : await readLocal(LEGACY_NATIVE_IMAGE_V7_CACHE_PREFIX + key))
        || (isShiny ? undefined : await readLocal(LEGACY_PIXEL_INVENTORY_CACHE_PREFIX + key))
        || (isShiny ? undefined : await readLocal(LEGACY_HD_CACHE_PREFIX + key))
        || (isShiny ? undefined : await readLocal(LEGACY_3D_CACHE_PREFIX + key))
        || (isShiny ? undefined : await readLocal(LEGACY_RECOGNIZABLE_CACHE_PREFIX + key))
        || (isShiny ? undefined : await readLocal(LEGACY_PIXEL_CACHE_PREFIX + key))
        || (isShiny ? undefined : await readLocal(key));

    if (cached) {
      // The caller(s) awaiting this cache read already receive the image.
      // Broadcasting per-item events on gallery mount caused quadratic
      // listener work and repeated profile-sync scheduling on Android.
      rememberArtwork(key, cached);
      return cached;
    }

    // Account sync can fail independently (expired session / offline). It must
    // not block access to the public image service or locally cached artwork.
    const userId = await spriteAssets?.currentUser().catch(() => undefined);
    if (!upgrade && userId) {
      try {
        const reference = await spriteAssets!.find(userId, spriteProfileKey(name, isShiny))
          || (!isShiny ? await spriteAssets!.findByName(userId, name) : undefined);
        if (reference) {
          const data = await spriteAssets!.resolve(reference);
          rememberArtwork(key, data);
          try { await save(ELEMENT_SPRITE_CACHE_PREFIX + key, data); }
          catch (error) { console.warn('Profile sprite loaded, local cache write deferred:', error); }
          // Existing callers share this promise; do not send a global event
          // for every cached image mounted in a large collection.
          return data;
        }
      } catch (error) {
        console.warn('Saved sprite unavailable, checking image generation:', error);
      }
    }

    // Viewing a collection must not exhaust the daily Workers AI image allocation.
    // Only a new discovery or an explicit Sprite Lab action requests new artwork.
    if (!generateIfMissing) {
      if (localStorageError) throw localStorageError;
      return '';
    }

    const response = await requestJson<{
      imageBase64: string;
      mimeType: string;
      engineVersion?: string;
    }>('/api/element-emoji', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, regenerate: upgrade, variation: upgrade ? variation : undefined, shiny: isShiny, ...(upgrade ? { style } : {}) }),
    }, 60000);

    if (typeof response.imageBase64 !== 'string' || typeof response.mimeType !== 'string') {
      throw new Error('Invalid sprite response.');
    }

    const data = await normalizeGeneratedImage(response.imageBase64, response.mimeType, style);
    // Style edits are previews until the existing sprite edit pathway saves them.
    // Never overwrite the shared default cache or profile art before confirmation.
    if (upgrade && (previewOnly || style !== 'classic')) return data;
    rememberArtwork(key, data);
    // A successful paid or free image request must remain a success even if
    // IndexedDB quota/permissions prevent a persistent local write.
    try { await save(ELEMENT_SPRITE_CACHE_PREFIX + key, data); }
    catch (error) { console.warn('Generated artwork is available but not persisted locally:', error); }
    if (userId) void trackSpriteSync(() => spriteAssets!.put(userId, spriteProfileKey(name, isShiny), name, data)).catch(() => undefined);
    announceSpriteReady(key);
    return data;
  };

  // If a new-discovery generation is already running, reuse it in collection previews.
  if (!upgrade && !generateIfMissing && jobs.has(key)) return jobs.get(key)!;

  // Cache-only artwork reads should NEVER queue behind expensive AI generation.
  // During an exhausted quota, one hung render could otherwise delay the entire
  // collection's cached sprites even though no new images are being requested.
  const job = !upgrade && !generateIfMissing
    ? work()
    : queue.then(() => typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request(`oddkin-emoji:${jobKey}`, work)
      : work());

  if (generateIfMissing || upgrade) queue = job.catch(() => undefined);
  jobs.set(jobKey, job);
  // Never permanently cache rejected or completed promises: the player can retry
  // after quota resets without refreshing the page.
  void job.then(
    () => { if (jobs.get(jobKey) === job) jobs.delete(jobKey); },
    () => { if (jobs.get(jobKey) === job) jobs.delete(jobKey); },
  );
  return job;
}

export function retryElementEmoji(name: string, shiny = false): Promise<string> {
  const key = spriteVariantKey(name, shiny);
  // An in-flight generation remains deduplicated; deleting its job could send
  // two expensive requests for the same name while the first is still running.
  if (jobs.has(key)) return jobs.get(key)!;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('oddkin-emoji-retry', { detail: key }));
  // Let the Sprite Lab display the actual API error instead of claiming success.
  return getElementEmoji(name, false, '', true, shiny);
}

/** Explicit upgrade/reroll bypasses old art and asks the native image model for a fresh sprite. */
export async function upgradeElementEmoji(name: string, variation = '', style: SpriteArtStyle = 'classic') {
  if (style !== 'classic') return getElementEmoji(name, true, variation, true, false, style);
  const key = emojiKey(name);
  const pending = jobs.get(key);
  if (pending) await pending.catch(() => undefined);

  memory.delete(key);
  jobs.delete(key);
  for (const jobKey of [...jobs.keys()]) if (jobKey.startsWith(`${key}:upgrade:`)) jobs.delete(jobKey);

  const art = await getElementEmoji(name, true, variation);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('oddkin-emoji-retry', { detail: key }));
  return art;
}

/** Explicit, free repair of saved artwork. Keep original resolution and colours;
 * only commit after the player previews and applies the cleaned result. */
export async function cleanSavedSpriteMask(dataUrl:string):Promise<string> {
  if(!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(dataUrl))throw new Error('Choose saved raster artwork first.');
  const image=new Image();image.src=dataUrl;await image.decode();
  if(image.width<2||image.height<2||image.width>2048||image.height>2048)throw new Error('Sprite dimensions are unsupported.');
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas is unavailable.');
  ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  if(!removeMagentaMask(pixels.data,canvas.width,canvas.height))throw new Error('No removable magenta background was found.');
  assertTransparentSprite(pixels.data,canvas.width,canvas.height);
  ctx.putImageData(pixels,0,0);
  return canvas.toDataURL('image/png');
}
