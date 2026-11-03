import { cloud } from './cloudSave';
import { getCachedElementSprite } from './elementEmoji';
import { generateMaterialSprite, generateOddkinSprite, MATERIAL_SPRITE_RENDERER_VERSION } from './pixelRenderer';
import { spriteAssets, SPRITE_BUCKET } from './spriteAssets';
import { isSpriteReference, SPRITE_SCHEME, spritePath } from './spriteReference';

export type SpriteEntry = { id: string; type: 'craft' | 'material' | 'oddkin'; name: string; path: string };
export type SpriteManifest = { version: 1; updatedAt: string; items: SpriteEntry[] };
export type SpriteChange = { type: SpriteEntry['type']; id: string; previous?: string; reference: string };
export const PROFILE_SPRITES_UPDATED = 'quarkpop-profile-sprites-updated';

export async function syncProfileSprites(userId: string, json: string, mode: 'auto' | 'save' | 'restore' = 'auto',
  assets = spriteAssets, cachedSprite = getCachedElementSprite) {
  if (!assets) throw new Error('Cloud profiles are not configured.');
  const payload = JSON.parse(json);
  const remote = new Map((await assets.list(userId)).map(item => [item.sprite_key, item]));
  const records = [
    ...(payload.crafting || []).map((record: any) => ({ type: 'craft' as const, id: record.id, name: record.name, record, defaultArt: false })),
    ...(payload.foundry?.materials || []).map((record: any) => ({ type: 'material' as const, id: record.id, name: record.displayName, record, defaultArt: record.customSpriteUrl === generateMaterialSprite(record) })),
    ...(payload.foundry?.oddkinCollection || []).map((record: any) => ({ type: 'oddkin' as const, id: record.speciesId, name: record.speciesName, record, defaultArt: record.customSpriteUrl === generateOddkinSprite(record, { isChroma: record.isChromaActive }) })),
  ];
  const changes: SpriteChange[] = [];
  let count = 0;
  for (const item of records) {
    const previous = item.record.customSpriteUrl as string | undefined;
    const key = `${item.type}:${item.id}`;
    const existing = remote.get(key);
    if (isSpriteReference(previous)) {
      // Never copy another account's private file into this profile.
      if (previous.startsWith(`${SPRITE_SCHEME}${userId}/`) && mode !== 'restore') {
        if (existing && (mode === 'auto' || existing.path === previous.slice(SPRITE_SCHEME.length))) {
          count++;
          const reference = SPRITE_SCHEME + existing.path;
          spritePath(reference, userId);
          if (reference !== previous) changes.push({ type: item.type, id: item.id, previous, reference });
          continue;
        }
        const image = await assets.resolve(previous);
        const reference = await assets.put(userId, key, item.name, image, mode === 'save');
        count++;
        if (reference !== previous) changes.push({ type: item.type, id: item.id, previous, reference });
        continue;
      }
      if (!existing) continue;
    }
    let reference: string | undefined;
    if (existing && mode !== 'save') {
      // A different local upload is kept intact until the player explicitly chooses save/restore.
      if (mode === 'auto' && previous?.startsWith('data:') && !item.defaultArt) continue;
      reference = SPRITE_SCHEME + existing.path;
      spritePath(reference, userId);
    } else if (mode !== 'restore') {
      const image = (!item.defaultArt && previous) || await cachedSprite(item.name);
      if (!image?.startsWith('data:image/png;base64,')) continue;
      reference = await assets.put(userId, key, item.name, image, mode === 'save');
    }
    if (reference) count++;
    if (reference && reference !== previous) changes.push({ type: item.type, id: item.id, previous, reference });
  }
  await assets.currentUser(userId);
  return { changes, count };
}

export function applySpriteChanges(payload: any, changes: SpriteChange[]) {
  for (const change of changes) {
    const records = change.type === 'craft' ? payload.crafting : change.type === 'material' ? payload.foundry?.materials : payload.foundry?.oddkinCollection;
    const record = records?.find((item: any) => (change.type === 'oddkin' ? item.speciesId : item.id) === change.id);
    if (record && record.customSpriteUrl === change.previous) {
      record.customSpriteUrl = change.reference;
      if (change.type === 'material') record.spriteRendererVersion = MATERIAL_SPRITE_RENDERER_VERSION;
    }
  }
  return payload;
}

export async function saveProfileSprites(userId: string, json: string): Promise<number> {
  const result = await syncProfileSprites(userId, json, 'save');
  return result.count;
}

export async function loadProfileSprites(userId: string, saveJson: string): Promise<{ json: string; count: number }> {
  if (!spriteAssets) throw new Error('Cloud profiles are not configured.');
  // Import the old manual manifest once, so existing backups remain restorable.
  await spriteAssets.currentUser(userId);
  const storage = cloud!.storage.from(SPRITE_BUCKET);
  const { data, error } = await storage.download(`${userId}/manifest.json`);
  if (data && !error) {
    const manifest = JSON.parse(await data.text()) as SpriteManifest;
    if (manifest?.version !== 1 || !Array.isArray(manifest.items) || manifest.items.length > 2000) throw new Error('Invalid profile sprite index.');
    const existing = new Set((await spriteAssets.list(userId)).map(item => item.sprite_key));
    for (const item of manifest.items) {
      if (!item || !['craft', 'material', 'oddkin'].includes(item.type) || typeof item.id !== 'string' || item.path !== `${userId}/${item.type}/${encodeURIComponent(item.id)}.png`) throw new Error('Invalid profile sprite path.');
      const key = `${item.type}:${item.id}`;
      if (existing.has(key)) continue;
      const { data: blob, error: imageError } = await storage.download(item.path);
      if (imageError || !blob || blob.size > 4 * 1024 * 1024) throw new Error('Could not migrate a legacy profile sprite. Your backup is preserved.');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      await spriteAssets.put(userId, key, item.name, `data:image/png;base64,${btoa(binary)}`, false);
    }
  } else if (error && !['404', '400'].includes(String((error as any).statusCode))) {
    throw new Error('Could not check your existing sprite backup. Retry.');
  }
  const result = await syncProfileSprites(userId, saveJson, 'restore');
  return { json: JSON.stringify(applySpriteChanges(JSON.parse(saveJson), result.changes)), count: result.count };
}
