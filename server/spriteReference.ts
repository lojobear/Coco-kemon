/** Pixel-perfect user-supplied master: 112x112 transparent PNG.
 * Foreground is x=36..79, y=68..105 and contains eight opaque colors.
 * Style conditioning only: never copy this exact creature into new sprites.
 */
export const BOOP_MINI_REFERENCE_VERSION = 'v14-mini-handheld-112';
export const BOOP_MINI_REFERENCE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAHAAAABwBAMAAAA0zul4AAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAG1BMVEUAAAD4+Pi4uLhgkPCAgHBQeLA4YJBAQEAAAADz4xOXAAAAAXRSTlMAQObYZgAAALdJREFUeNrt1jENBDAIRuFa+C1gAQtYqIVawMKTfeHS+YZLysQLYfsSRtY0TdM0TdM0Tb8DeiHuTifk6CuBLmipc6A0TRCvJPdDB1zpp1wg9xaISzoumiC4IkLauu4xxFJhUoS2d0DMMqyYXfkcphEqqtDOBrhgoZBU/MqX8F5r38mCEq8h+6Rdt1OSeA3POXAdqngLF1Aryy2Ussfwxt57s0gr1wLTd3IPb4ElLvkDzhvV2QdlKZp3syifrwAAAABJRU5ErkJggg==';
export function miniSpriteReferenceBlob(): Blob {
  const bytes = Uint8Array.from(atob(BOOP_MINI_REFERENCE_PNG_BASE64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: 'image/png' });
}
