import { emojiKey } from './emojiGeometry';

/** A shiny has its own logical identity, without mutating the item name. */
export function spriteVariantKey(name: string, shiny = false): string {
  const key = emojiKey(name);
  return shiny ? `shiny:${key}` : key;
}

export function spriteProfileKey(name: string, shiny = false): string {
  return `generated:${spriteVariantKey(name, shiny)}`;
}
