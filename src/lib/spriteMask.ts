import { assertTransparentSprite, removeMagentaMask } from './spritePixelCleanup';

const RASTER_DATA = /^data:image\/(png|jpeg|jpg|webp);base64,/i;

export const canRepairSpriteMask = (source?: string): source is string => Boolean(source && RASTER_DATA.test(source));

/** Return a transparent preview at the original size. The caller owns persistence. */
export async function repairSpriteMask(source: string): Promise<string | undefined> {
  if (!canRepairSpriteMask(source)) throw new Error('Choose saved raster artwork first.');
  const image = new Image();
  image.src = source;
  await image.decode();
  if (image.width < 2 || image.height < 2 || image.width > 2048 || image.height > 2048) {
    throw new Error('Sprite dimensions are unsupported.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable.');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  if (!removeMagentaMask(pixels.data, canvas.width, canvas.height)) return;
  assertTransparentSprite(pixels.data, canvas.width, canvas.height);
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/png');
}

const previews = new Map<string, Promise<string>>();
export function spriteWithoutMask(source: string): Promise<string> {
  const cached = previews.get(source);
  if (cached) return cached;
  // Share preview work across room pieces, the collection and Sprite Lab.
  const preview = repairSpriteMask(source).then(repaired => repaired ?? source, () => source);
  if (previews.size >= 64) previews.delete(previews.keys().next().value!);
  previews.set(source, preview);
  return preview;
}
