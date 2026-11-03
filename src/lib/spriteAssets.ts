import type { SupabaseClient } from '@supabase/supabase-js';
import { cloud } from './cloudSave';
import { isSpriteReference, SPRITE_SCHEME, spritePath } from './spriteReference';

export const SPRITE_BUCKET = 'quarkpop-profile-sprites';
export const SPRITE_SYNC_EVENT = 'quarkpop-sprite-sync';
export type SpriteAsset = { user_id: string; sprite_key: string; name: string; path: string };
export type SpriteSyncStatus = { pending: number; error: string };
let status: SpriteSyncStatus = { pending: 0, error: '' };
export const getSpriteSyncStatus = () => status;
function updateStatus(patch: Partial<SpriteSyncStatus>) {
  status = { ...status, ...patch };
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SPRITE_SYNC_EVENT));
}
export async function trackSpriteSync<T>(work: () => Promise<T>): Promise<T> {
  updateStatus({ pending: status.pending + 1 });
  try { const result = await work(); updateStatus({ error: '' }); return result; }
  catch (error) { updateStatus({ error: error instanceof Error ? error.message : 'Sprite sync failed. Retry in Cloud saves.' }); throw error; }
  finally { updateStatus({ pending: status.pending - 1 }); }
}

/** Injectable client keeps storage/auth failure behavior testable without real credentials. */
export function createSpriteAssets(client: SupabaseClient) {
  const downloads = new Map<string, Promise<string>>();
  async function currentUser(expected?: string): Promise<string | undefined> {
    const { data, error } = await client.auth.getSession();
    const id = data.session?.user.id;
    if (error || (expected && id !== expected)) throw new Error('Your profile changed. Sign in again to sync sprites.');
    return id;
  }
  async function list(userId: string): Promise<SpriteAsset[]> {
    await currentUser(userId);
    const assets: SpriteAsset[] = [];
    for (let start = 0; ; start += 1000) {
      const { data, error } = await client.from('sprite_assets').select('user_id,sprite_key,name,path')
        .eq('user_id', userId).order('sprite_key').range(start, start + 999);
      if (error) throw new Error('Could not read your sprite library. Retry in Cloud saves.');
      assets.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    await currentUser(userId);
    return assets;
  }
  async function find(userId: string, key: string): Promise<string | undefined> {
    await currentUser(userId);
    const { data, error } = await client.from('sprite_assets').select('path').eq('user_id', userId).eq('sprite_key', key).maybeSingle();
    if (error) throw new Error('Could not read your saved sprite. Retry in Cloud saves.');
    await currentUser(userId);
    if (!data) return undefined;
    spritePath(SPRITE_SCHEME + data.path, userId);
    return SPRITE_SCHEME + data.path;
  }
  async function findByName(userId: string, name: string): Promise<string | undefined> {
    await currentUser(userId);
    const { data, error } = await client.from('sprite_assets').select('path').eq('user_id', userId)
      .eq('name', name.trim().toLowerCase()).limit(1).maybeSingle();
    if (error) throw new Error('Could not read your saved artwork. Retry in Cloud saves.');
    await currentUser(userId);
    if (!data) return undefined;
    const reference = SPRITE_SCHEME + data.path;
    spritePath(reference, userId);
    return reference;
  }
  async function remove(userId: string, key: string) {
    await currentUser(userId);
    const { error } = await client.from('sprite_assets').delete().eq('user_id', userId).eq('sprite_key', key);
    if (error) throw new Error('Could not reset the profile sprite. Retry.');
    await currentUser(userId);
  }
  async function put(userId: string, key: string, name: string, dataUrl: string, replace = true): Promise<string> {
    await currentUser(userId);
    if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) throw new Error('Invalid sprite PNG.');
    const binary = atob(dataUrl.slice('data:image/png;base64,'.length));
    if (binary.length > 4 * 1024 * 1024) throw new Error('Sprite exceeds the 4 MB upload limit.');
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    const path = `${userId}/auto/${hash}.png`;
    const { error: uploadError } = await client.storage.from(SPRITE_BUCKET).upload(path,
      new Blob([bytes], { type: 'image/png' }), { upsert: false, contentType: 'image/png', cacheControl: '31536000' });
    if (uploadError && !['409', 'Duplicate'].includes(String((uploadError as any).statusCode)) && uploadError.message !== 'The resource already exists') {
      throw new Error('Sprite upload failed. Your local artwork is preserved. Retry in Cloud saves.');
    }
    await currentUser(userId);
    const { error } = await client.from('sprite_assets').upsert({ user_id: userId, sprite_key: key, name: name.trim().toLowerCase(), path },
      { onConflict: 'user_id,sprite_key', ignoreDuplicates: !replace });
    if (error) throw new Error('Sprite uploaded, but its profile entry could not be saved. Retry in Cloud saves.');
    await currentUser(userId);
    return replace ? SPRITE_SCHEME + path : (await find(userId, key))!;
  }
  async function resolve(reference: string): Promise<string> {
    const userId = await currentUser();
    if (!userId) throw new Error('Sign in to view your profile sprites.');
    const path = spritePath(reference, userId);
    const cacheKey = `${userId}:${path}`;
    if (!downloads.has(cacheKey)) {
      const job = (async () => {
        const { data, error } = await client.storage.from(SPRITE_BUCKET).download(path);
        if (error || !data) throw new Error('Could not download your sprite. Retry in Cloud saves.');
        if (data.size > 4 * 1024 * 1024) throw new Error('Saved sprite exceeds the size limit.');
        await currentUser(userId);
        const bytes = new Uint8Array(await data.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return `data:image/png;base64,${btoa(binary)}`;
      })();
      downloads.set(cacheKey, job);
      void job.catch(() => downloads.delete(cacheKey));
    }
    const image = await downloads.get(cacheKey)!;
    await currentUser(userId);
    return image;
  }
  function clear() { downloads.clear(); }
  return { currentUser, list, find, findByName, put, remove, resolve, clear };
}
export const spriteAssets = cloud ? createSpriteAssets(cloud) : null;
export async function resolveSpriteSource(source?: string): Promise<string | undefined> {
  if (!isSpriteReference(source)) return source;
  if (!spriteAssets) throw new Error('Profile sprites are not configured.');
  return spriteAssets.resolve(source);
}
