/** Strict drawing grammar: model output is data, never executable SVG markup. */
export function emojiKey(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}
export function renderEmojiDrawing(value: unknown): string {
  const paths = (value as { paths?: unknown[] })?.paths;
  if (!Array.isArray(paths) || paths.length < 2 || paths.length > 80) throw new Error('Invalid emoji drawing.');
  const body = paths.map((entry: any) => {
    if (!entry || typeof entry.d !== 'string' || entry.d.length > 2500 || !/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+\-]+$/.test(entry.d) || !/^[Mm]/.test(entry.d.trim())) throw new Error('Invalid emoji path.');
    if (typeof entry.fill !== 'string' || !/^#[0-9a-f]{6}$/i.test(entry.fill)) throw new Error('Invalid emoji color.');
    return `<path d="${entry.d}" fill="${entry.fill}" stroke="${entry.fill}" stroke-width="0.35" stroke-linejoin="round"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${body}</svg>`;
}
