import { cloud } from './cloudSave';
import { readCraftElements } from './saveData';
import { getCachedElementSprite } from './elementEmoji';
import { generateMaterialSprite } from './pixelRenderer';
import type { InfiniteElement } from './infiniteCraftData';

const BUCKET = 'quarkpop-profile-sprites';
const MAX_ITEMS = 2000;
const MAX_BYTES = 4 * 1024 * 1024;
export type SpriteEntry = { id: string; type: 'craft' | 'material' | 'oddkin'; name: string; path: string };
export type SpriteManifest = { version: 1; updatedAt: string; items: SpriteEntry[] };

function requireCloud() {
  if (!cloud) throw new Error('Cloud profiles are not configured.');
  return cloud;
}
async function verifiedUser(userId: string) {
  const { data, error } = await requireCloud().auth.getUser();
  if (error || !data.user || data.user.id !== userId) throw new Error('Please sign in to the correct profile.');
}
function toBlob(dataUrl: string): Blob {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) throw new Error('Invalid sprite PNG.');
  const raw = atob(dataUrl.slice('data:image/png;base64,'.length));
  if (raw.length > MAX_BYTES) throw new Error('Sprite is too large for profile storage.');
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}
async function blobToDataUrl(blob: Blob): Promise<string> {
  if (blob.size > MAX_BYTES) throw new Error('Cloud sprite exceeds maximum size.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}
export async function saveProfileSprites(userId: string, foundryJson: string): Promise<number> {
  await verifiedUser(userId);
  const foundry = JSON.parse(foundryJson);
  const crafting = readCraftElements();
  const collection: Array<{ type: SpriteEntry['type']; id: string; name: string; sprite: string }> = [];
  for (const e of crafting) {
    const image = e.customSpriteUrl || await getCachedElementSprite(e.name);
    if (image?.startsWith('data:image/png;base64,')) collection.push({ type: 'craft', id: e.id, name: e.name, sprite: image });
  }
  for (const m of foundry.materials || []) {
    const defaultSprite = m.customSpriteUrl === generateMaterialSprite(m);
    const image = (!defaultSprite && m.customSpriteUrl) || await getCachedElementSprite(m.displayName);
    if (image?.startsWith('data:image/png;base64,')) collection.push({ type: 'material', id: m.id, name: m.displayName, sprite: image });
  }
  for (const o of foundry.oddkinCollection || []) {
    const image = o.customSpriteUrl || await getCachedElementSprite(o.speciesName);
    if (image?.startsWith('data:image/png;base64,')) collection.push({ type: 'oddkin', id: o.speciesId, name: o.speciesName, sprite: image });
  }
  if (collection.length > MAX_ITEMS) throw new Error('Too many sprites. Save a smaller collection first.');
  const storage = requireCloud().storage.from(BUCKET);
  const manifest: SpriteManifest = { version: 1, updatedAt: new Date().toISOString(), items: [] };
  for (const e of collection) {
    const path = `${userId}/${e.type}/${encodeURIComponent(e.id)}.png`;
    const { error } = await storage.upload(path, toBlob(e.sprite), { upsert: true, contentType: 'image/png' });
    if (error) throw new Error(`Could not upload sprite ${e.name}. Previously uploaded images remain safe.`);
    manifest.items.push({ id: e.id, type: e.type, name: e.name, path });
  }
  // Publish the manifest only once all images are safely uploaded.
  const { error } = await storage.upload(`${userId}/manifest.json`, new Blob([JSON.stringify(manifest)], { type: 'application/json' }), { upsert: true, contentType: 'application/json' });
  if (error) throw new Error('Sprites uploaded, but profile index could not be saved. Retry.');
  return manifest.items.length;
}
export async function loadProfileSprites(userId: string, saveJson: string): Promise<{ json: string; count: number }> {
  await verifiedUser(userId);
  const storage = requireCloud().storage.from(BUCKET);
  const { data, error } = await storage.download(`${userId}/manifest.json`);
  if (error || !data) throw new Error('No profile sprite collection found. Save sprites to your profile first.');
  const manifest = JSON.parse(await data.text()) as SpriteManifest;
  if (manifest?.version !== 1 || !Array.isArray(manifest.items) || manifest.items.length > MAX_ITEMS) throw new Error('Invalid profile sprite index.');
  const payload = JSON.parse(saveJson);
  let count = 0;
  const craft = new Map<string, InfiniteElement>((payload.crafting || []).map((e: InfiniteElement) => [e.id, e]));
  const materials = new Map<string, any>((payload.foundry?.materials || []).map((e: any) => [e.id, e]));
  const oddkins = new Map<string, any>((payload.foundry?.oddkinCollection || []).map((e: any) => [e.speciesId, e]));
  for (const item of manifest.items) {
    if (!item || !['craft', 'material', 'oddkin'].includes(item.type) || typeof item.id !== 'string' || item.path !== `${userId}/${item.type}/${encodeURIComponent(item.id)}.png`) throw new Error('Invalid profile sprite path.');
    const record = item.type === 'craft' ? craft.get(item.id) : item.type === 'material' ? materials.get(item.id) : oddkins.get(item.id);
    if (!record) continue;
    const { data: image, error: imageError } = await storage.download(item.path);
    if (imageError || !image) throw new Error(`Could not load ${item.name} from profile. Your device collection is unchanged.`);
    const sprite = await blobToDataUrl(image);
    if (item.type === 'craft') {
      // Craft save validation limits images to 100,000 base64 characters.
      if (sprite.length > 100000) continue;
      record.customSpriteUrl = sprite;
    } else {
      record.customSpriteUrl = sprite;
    }
    count++;
  }
  return { json: JSON.stringify(payload), count };
}
