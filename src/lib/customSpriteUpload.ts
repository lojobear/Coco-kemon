/**
 * Single, validated sprite-replacement pathway shared by Collection and Sprite Lab.
 * Uses Sprite Lab's original PNG conversion, save guards and profile sprite
 * storage. Does not call image-generation endpoints or modify crafting metadata.
 */
import { spriteAssets, trackSpriteSync } from './spriteAssets';
import { readCraftElements, saveCraftElements, getSaveError, MAX_SPRITE_CHARS, waitForLocalSave } from './saveData';
import { withUnifiedDiscoveryArtwork } from './spriteCatalog';
import { MATERIAL_SPRITE_RENDERER_VERSION } from './pixelRenderer';
import { discoveryIdentity } from './unifiedCollection';
import type { Material, Oddkin } from '../types';

export type SpriteEditTarget = { type: 'craft'|'material'|'oddkin'; id:string; name:string };
export type SpriteEditContext = {
  materials: readonly Material[];
  exportSaveData:()=>string;
  importSaveData:(json:string)=>boolean|Promise<boolean>;
};

export async function fileToSprite(file: File): Promise<string> {
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


/** A custom replacement follows all linked Craft and Foundry inventory keys.
 * If cloud sync fails before commit, we leave local artwork untouched instead
 * of allowing the next profile sync to bring back the previous image. */
export async function persistSpriteEdit(
  target: SpriteEditTarget,
  sprite: string | undefined,
  context: SpriteEditContext,
): Promise<void> {
  const linkedCraft = readCraftElements().filter(item => discoveryIdentity(item.name) === discoveryIdentity(target.name));
  const linkedMaterials = context.materials.filter(item => discoveryIdentity(item.displayName) === discoveryIdentity(target.name));
  const cloudKeys = target.type === 'oddkin'
    ? [`oddkin:${target.id}`]
    : [...linkedCraft.map(item => `craft:${item.id}`), ...linkedMaterials.map(item => `material:${item.id}`)];
  const userId = await spriteAssets?.currentUser();
  if (userId) {
    const uploadedData = sprite?.startsWith('data:image/png;base64,') ? sprite : undefined;
    for (const key of [...new Set(cloudKeys)]) {
      if (!sprite) {
        await trackSpriteSync(() => spriteAssets!.remove(userId, key));
      } else if (uploadedData) {
        const stored = await trackSpriteSync(() => spriteAssets!.put(userId, key, target.name, uploadedData));
        sprite = stored;
      }
    }
  }
  const payload = JSON.parse(context.exportSaveData());
  if (target.type !== 'oddkin') {
    const updated = withUnifiedDiscoveryArtwork(payload, target.name, sprite, MATERIAL_SPRITE_RENDERER_VERSION);
    if (!linkedMaterials.length && target.type === 'craft') {
      const current = readCraftElements();
      const changed = current.map(item => discoveryIdentity(item.name) === discoveryIdentity(target.name)
        ? {...item,customSpriteUrl:sprite} : item);
      saveCraftElements(changed);
      await waitForLocalSave();
      if (getSaveError()) throw new Error(getSaveError()!);
    } else if (!await context.importSaveData(JSON.stringify(updated))) {
      throw new Error('The linked artwork could not be saved. Try again after Craft or Foundry finishes.');
    }
  } else {
    const saved = payload?.foundry?.oddkinCollection?.find((item:Oddkin) => item.speciesId === target.id);
    if (!saved) throw new Error('Oddkin could not be found in the save.');
    saved.customSpriteUrl = sprite;
    if (!await context.importSaveData(JSON.stringify(payload))) throw new Error('The updated sprite could not be saved.');
  }
}
