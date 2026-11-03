/**
 * Non-destructive cleanup for NEW AI-generated sprites only.
 * No existing uploaded, locally cached or account-synced art passes through it.
 *
 * Chroma removal happens at source resolution BEFORE pixel-grid downscaling.
 * This prevents magenta backgrounds being resampled into the outline.
 */
export function removeEdgeConnectedBackground(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  if (width < 2 || height < 2 || rgba.length !== width * height * 4) return;
  const corners = [0, width - 1, width * (height - 1), width * height - 1];
  if (corners.every(i => rgba[4 * i + 3] < 24)) return;
  const average = [0, 0, 0];
  for (const i of corners) for (let c = 0; c < 3; c++) average[c] += rgba[4 * i + c] / 4;
  const dist = (i: number) => {
    const o = 4 * i;
    return (rgba[o] - average[0]) ** 2
      + (rgba[o + 1] - average[1]) ** 2
      + (rgba[o + 2] - average[2]) ** 2;
  };

  // An inconsistent background is not safe to erase.
  if (corners.some(i => dist(i) > 32 * 32 * 3)) return;

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const add = (i: number) => {
    if (visited[i]) return;
    visited[i] = 1;
    if (rgba[4 * i + 3] < 16 || dist(i) <= 32 * 32 * 3) queue.push(i);
  };
  for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { add(y * width); add(y * width + width - 1); }

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const i = queue[cursor], x = i % width, y = Math.floor(i / width);
    rgba[i * 4 + 3] = 0;
    if (x > 0) add(i - 1);
    if (x + 1 < width) add(i + 1);
    if (y > 0) add(i - width);
    if (y + 1 < height) add(i + width);
  }
}

/** Quiet single-pixel glitches and magenta fringe without blurring pixel art. */
export function tidyGeneratedSpritePixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  if (width < 4 || height < 4 || rgba.length !== width * height * 4) return;
  const total = width * height;
  const visible = (i: number) => rgba[i * 4 + 3] >= 100;
  // Pixels with almost no alpha are phantom edge flecks, not meaningful glass.
  for (let i = 0; i < total; i++) if (rgba[i * 4 + 3] < 35) rgba[i * 4 + 3] = 0;

  // A bright magenta ring after chroma removal is an unwanted background halo.
  // Only target colours extremely close to the explicit #FF00FF key, and only
  // at the *outer* edge; interior purples and pinks remain untouched.
  const removed: number[] = [];
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x, p = i * 4;
    if (!visible(i)) continue;
    const red = rgba[p], green = rgba[p + 1], blue = rgba[p + 2];
    if (red < 222 || green > 65 || blue < 222 || Math.abs(red - blue) > 35) continue;
    if (![i - width, i + width, i - 1, i + 1].some(k => rgba[4 * k + 3] < 35)) continue;
    removed.push(i);
  }
  for (const i of removed) rgba[4 * i + 3] = 0;

  // Clean tiny disconnected specks, but preserve real detached components
  // (e.g. a floating magical accessory) that have 3+ logical pixels.
  const seen = new Uint8Array(total);
  const fragments: number[][] = [];
  let largest = 0;
  for (let i = 0; i < total; i++) {
    if (seen[i] || !visible(i)) continue;
    const group: number[] = [i];
    seen[i] = 1;
    for (let cursor = 0; cursor < group.length; cursor++) {
      const n = group[cursor], x = n % width, y = Math.floor(n / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const j = yy * width + xx;
        if (!seen[j] && visible(j)) { seen[j] = 1; group.push(j); }
      }
    }
    largest = Math.max(largest, group.length);
    fragments.push(group);
  }
  if (largest >= 16) {
    for (const group of fragments) if (group.length <= 2)
      for (const i of group) rgba[4 * i + 3] = 0;
  }

  // A solitary hole inside a solid colour plane is almost always a broken
  // generated pixel. Repair only fully four-sided isolated holes.
  const repairs: Array<{ offset: number; rgb: number[] }> = [];
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    if (visible(i)) continue;
    const neighbors = [i - width, i + width, i - 1, i + 1];
    if (!neighbors.every(visible)) continue;
    const rgb = [0, 0, 0];
    for (const k of neighbors) for (let c = 0; c < 3; c++) rgb[c] += rgba[k * 4 + c] / 4;
    repairs.push({ offset: i * 4, rgb });
  }
  for (const { offset, rgb } of repairs) {
    for (let c = 0; c < 3; c++) rgba[offset + c] = Math.round(rgb[c]);
    rgba[offset + 3] = 255;
  }
}
