/** Strict drawing grammar: model output is data, never executable SVG markup. */
export function emojiKey(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function validatePathData(d: string): string {
  if (
    d.length > 3000 ||
    !/^[MLHV CQZ0-9.,\s+\-.]+$/.test(d) ||
    !/^M/.test(d.trim()) ||
    !/Z\s*$/.test(d.trim())
  ) {
    throw new Error('Invalid emoji path.');
  }

  const numbers = d.match(/-?\d+(?:\.\d+)?/g) || [];
  if (!numbers.length) throw new Error('Invalid emoji path.');
  for (const token of numbers) {
    const value = Number(token);
    if (!Number.isFinite(value) || value < 0 || value > 128) {
      throw new Error('Invalid emoji coordinate.');
    }
  }
  return d;
}

export function renderEmojiDrawing(value: unknown): string {
  const paths = (value as { paths?: unknown[] })?.paths;
  if (!Array.isArray(paths) || paths.length < 2 || paths.length > 80) {
    throw new Error('Invalid emoji drawing.');
  }

  const body = paths.map((entry: any) => {
    if (!entry || typeof entry.d !== 'string') throw new Error('Invalid emoji path.');
    if (typeof entry.fill !== 'string' || !/^#[0-9a-f]{6}$/i.test(entry.fill)) {
      throw new Error('Invalid emoji color.');
    }
    if (
      entry.opacity !== undefined &&
      (typeof entry.opacity !== 'number' || !Number.isFinite(entry.opacity) || entry.opacity < 0.08 || entry.opacity > 1)
    ) {
      throw new Error('Invalid emoji opacity.');
    }

    const d = validatePathData(entry.d);
    const opacity = entry.opacity === undefined ? '' : ` opacity="${entry.opacity}"`;
    return `<path d="${d}" fill="${entry.fill}"${opacity}/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" shape-rendering="crispEdges">${body}</svg>`;
}
