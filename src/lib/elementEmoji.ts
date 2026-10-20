import { spriteAssets, trackSpriteSync } from './spriteAssets';
import { emojiKey } from './emojiGeometry';
import { spriteVariantKey, spriteProfileKey } from './spriteVariant';
import { requestJson } from './api';

const ELEMENT_SPRITE_CACHE_PREFIX = 'pixelimage-v9-2p5d:';
const LEGACY_NATIVE_IMAGE_V8_CACHE_PREFIX = 'pixelimage-v8:';
const LEGACY_NATIVE_IMAGE_V7_CACHE_PREFIX = 'pixelimage-v7:';
const LEGACY_PIXEL_INVENTORY_CACHE_PREFIX = 'pixelinventory-v6:';
const LEGACY_HD_CACHE_PREFIX = 'collectionhd-v5:';
const LEGACY_3D_CACHE_PREFIX = 'emoji3d-v4:';
const LEGACY_RECOGNIZABLE_CACHE_PREFIX = 'pixel-v3-recognizable:';
const LEGACY_PIXEL_CACHE_PREFIX = 'pixel-v2:';

const memory = new Map<string, string>();
const jobs = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();
let database: Promise<IDBDatabase> | undefined;

function db() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('oddkin-element-emoji', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('art');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Sprite storage is unavailable.'));
  });
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

function colorDistanceSq(data: Uint8ClampedArray, offset: number, rgb: [number, number, number]) {
  const dr = data[offset] - rgb[0];
  const dg = data[offset + 1] - rgb[1];
  const db = data[offset + 2] - rgb[2];
  return dr * dr + dg * dg + db * db;
}

/**
 * Image models are much better at finished pixel art than structured SVG paths, but they can
 * occasionally paint the requested flat backdrop instead of returning alpha. Remove only the
 * edge-connected flat background so similarly coloured pixels inside the outlined sprite survive.
 */
function clearFlatEdgeBackground(context: CanvasRenderingContext2D, size: number) {
  if (typeof context.getImageData !== 'function' || typeof context.putImageData !== 'function') return;

  const image = context.getImageData(0, 0, size, size);
  const { data } = image;
  const cornerPixels = [
    0,
    (size - 1) * 4,
    ((size - 1) * size) * 4,
    ((size * size) - 1) * 4,
  ];

  // Already transparent: preserve native alpha exactly.
  if (cornerPixels.every(offset => data[offset + 3] < 24)) return;

  const rgb: [number, number, number] = [0, 0, 0];
  for (const offset of cornerPixels) {
    rgb[0] += data[offset];
    rgb[1] += data[offset + 1];
    rgb[2] += data[offset + 2];
  }
  rgb[0] = Math.round(rgb[0] / 4);
  rgb[1] = Math.round(rgb[1] / 4);
  rgb[2] = Math.round(rgb[2] / 4);

  // Only treat the corners as a removable backdrop if they agree closely.
  const cornerTolerance = 34 * 34 * 3;
  if (cornerPixels.some(offset => colorDistanceSq(data, offset, rgb) > cornerTolerance)) return;

  const threshold = 46 * 46 * 3;
  const visited = new Uint8Array(size * size);
  const queuePixels: number[] = [];

  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const index = y * size + x;
    if (visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    if (data[offset + 3] < 8 || colorDistanceSq(data, offset, rgb) <= threshold) {
      queuePixels.push(index);
    }
  };

  for (let x = 0; x < size; x++) {
    push(x, 0);
    push(x, size - 1);
  }
  for (let y = 1; y < size - 1; y++) {
    push(0, y);
    push(size - 1, y);
  }

  for (let cursor = 0; cursor < queuePixels.length; cursor++) {
    const index = queuePixels[cursor];
    const offset = index * 4;
    data[offset + 3] = 0;
    const x = index % size;
    const y = Math.floor(index / size);
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }

  context.putImageData(image, 0, 0);
}

async function normalizeGeneratedImage(imageBase64: string, mimeType: string): Promise<string> {
  if (!/^image\/(png|jpeg|jpg|webp)$/i.test(mimeType)) throw new Error('Invalid sprite image type.');
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(imageBase64) || imageBase64.length > 16_000_000) {
    throw new Error('Invalid sprite image data.');
  }

  const image = new Image();
  image.src = `data:${mimeType};base64,${imageBase64}`;
  await image.decode();

  // Keep substantially more detail than the old 64px renderer while limiting IndexedDB growth.
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not process generated art.');

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, size, size);
  context.drawImage(image, 0, 0, size, size);
  clearFlatEdgeBackground(context, size);
  return canvas.toDataURL('image/png');
}

/** Return locally cached native artwork without generating or spending AI quota. */
export async function getCachedElementSprite(name: string, shiny = false): Promise<string | undefined> {
  const key = spriteVariantKey(name, shiny);
  if (memory.has(key)) return memory.get(key);
  try {
    return await stored(ELEMENT_SPRITE_CACHE_PREFIX + key);
  } catch {
    return undefined;
  }
}

/** Restore a downloaded profile image to the local cache for other collection views. */
export async function storeProfileElementSprite(name: string, data: string, shiny = false): Promise<void> {
  const key = spriteVariantKey(name, shiny);
  memory.set(key, data);
  await save(ELEMENT_SPRITE_CACHE_PREFIX + key, data);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('oddkin-emoji-retry', { detail: key }));
}

export function getElementEmoji(name: string, upgrade = false, variation = '', generateIfMissing = true, isShiny = false): Promise<string> {
  const key = spriteVariantKey(name, isShiny);
  // Collection previews may read cached/local/profile art but cannot trigger AI.
  const jobKey = upgrade ? `${key}:upgrade:${variation || 'fresh'}` : generateIfMissing ? key : `${key}:cache-only`;

  if (!upgrade && memory.has(key)) return Promise.resolve(memory.get(key)!);
  if (jobs.has(jobKey)) return jobs.get(jobKey)!;

  const work = async () => {
    // New discoveries use native image generation. Older cached art remains valid until the
    // player explicitly upgrades/rerolls it, preventing surprise regeneration costs.
    const cached = upgrade
      ? undefined
      : (await stored(ELEMENT_SPRITE_CACHE_PREFIX + key))
        // Old sprite versions contain normal artwork only. Never resolve those
        // as shiny art: it would make normal and shiny visually identical.
        || (isShiny ? undefined : await stored(LEGACY_NATIVE_IMAGE_V8_CACHE_PREFIX + key))
        || (isShiny ? undefined : await stored(LEGACY_NATIVE_IMAGE_V7_CACHE_PREFIX + key))
        || (isShiny ? undefined : await stored(LEGACY_PIXEL_INVENTORY_CACHE_PREFIX + key))
        || (isShiny ? undefined : await stored(LEGACY_HD_CACHE_PREFIX + key))
        || (isShiny ? undefined : await stored(LEGACY_3D_CACHE_PREFIX + key))
        || (isShiny ? undefined : await stored(LEGACY_RECOGNIZABLE_CACHE_PREFIX + key))
        || (isShiny ? undefined : await stored(LEGACY_PIXEL_CACHE_PREFIX + key))
        || (isShiny ? undefined : await stored(key));

    if (cached) {
      memory.set(key, cached);
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
          memory.set(key, data);
          await save(ELEMENT_SPRITE_CACHE_PREFIX + key, data);
          return data;
        }
      } catch (error) {
        console.warn('Saved sprite unavailable, checking image generation:', error);
      }
    }

    // Viewing a collection must not exhaust the daily Workers AI image allocation.
    // Only a new discovery or an explicit Sprite Lab action requests new artwork.
    if (!generateIfMissing) return '';

    const response = await requestJson<{
      imageBase64: string;
      mimeType: string;
      engineVersion?: string;
    }>('/api/element-emoji', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, regenerate: upgrade, variation: upgrade ? variation : undefined, shiny: isShiny }),
    }, 60000);

    if (typeof response.imageBase64 !== 'string' || typeof response.mimeType !== 'string') {
      throw new Error('Invalid sprite response.');
    }

    const data = await normalizeGeneratedImage(response.imageBase64, response.mimeType);
    memory.set(key, data);
    await save(ELEMENT_SPRITE_CACHE_PREFIX + key, data);
    if (userId) void trackSpriteSync(() => spriteAssets!.put(userId, spriteProfileKey(name, isShiny), name, data)).catch(() => undefined);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('quarkpop-sprite-ready'));
      window.dispatchEvent(new CustomEvent('oddkin-emoji-retry', { detail: key }));
    }
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
export async function upgradeElementEmoji(name: string, variation = '') {
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
