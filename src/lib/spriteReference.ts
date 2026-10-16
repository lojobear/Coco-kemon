/** Permanent private object reference; never persist expiring signed URLs. */
export const SPRITE_SCHEME = 'sprite://';
export function isSpriteReference(value: unknown): value is string {
  return typeof value === 'string' && /^sprite:\/\/[0-9a-f-]{36}\/auto\/[0-9a-f]{64}\.png$/.test(value);
}
export function spritePath(reference: string, userId: string): string {
  if (!isSpriteReference(reference) || !reference.startsWith(`${SPRITE_SCHEME}${userId}/`)) throw new Error('This sprite belongs to a different profile.');
  return reference.slice(SPRITE_SCHEME.length);
}
