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

const isStrongMagenta = (r: number, g: number, b: number) =>
  r >= 215 && b >= 215 && g <= 62 && Math.abs(r - b) <= 42;
const isShadedMagenta = (r: number, g: number, b: number) =>
  Math.min(r, b) >= 110 && Math.min(r, b) - g >= 50 && Math.abs(r - b) <= 84;

/** Key the backdrop and decontaminate its antialiased edge. Interior details
 * survive unless a solid patch matches a confirmed backdrop almost exactly. */
export function removeMagentaMask(rgba: Uint8ClampedArray, width: number, height: number): boolean {
  if (width < 2 || height < 2 || rgba.length !== width * height * 4) return false;
  const total = width * height;
  const alpha = (i: number) => rgba[i * 4 + 3];
  const matches = (i: number, test: (r: number, g: number, b: number) => boolean) =>
    test(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x, total - width + x);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);
  const shaded = border.filter(i => alpha(i) >= 24 && matches(i, isShadedMagenta));
  const strong = shaded.filter(i => matches(i, isStrongMagenta));
  const hasMask = strong.length >= Math.max(2, border.length * .04) || shaded.length >= border.length * .55;
  if (!hasMask) {
    if (!border.some(i => alpha(i) < 24)) return false;
    let i = 0;
    while (i < total && (alpha(i) < 24 || !matches(i, isStrongMagenta))) i++;
    if (i === total) return false;
  }

  // Estimate the key from the visible border, including uniformly shaded backgrounds.
  const samples = strong.length ? strong : shaded;
  const key = hasMask ? [0, 1, 2].map(channel =>
    Math.round(samples.reduce((sum, i) => sum + rgba[i * 4 + channel], 0) / samples.length),
  ) : [255, 0, 255];
  const matchesKey = (i: number) =>
    key.every((component, channel) => Math.abs(rgba[i * 4 + channel] - component) <= 22);
  const neighbors = (i: number, visit: (other: number) => void, radius = 1) => {
    const x = i % width, y = Math.floor(i / width);
    for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++) {
      for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx++) {
        const other = yy * width + xx;
        if (other !== i) visit(other);
      }
    }
  };

  const visited = new Uint8Array(total);
  const queue: number[] = [];
  const add = (i: number) => {
    if (visited[i]) return;
    visited[i] = 1;
    if (alpha(i) < 24 || matches(i, hasMask ? isShadedMagenta : isStrongMagenta)) queue.push(i);
  };
  for (const i of border) add(i);
  if (hasMask) {
    // An enclosed window or handle can contain background without a path to the border.
    for (let y = 1; y < height - 2; y++) {
      for (let x = 1; x < width - 2; x++) {
        const i = y * width + x;
        if ([i, i + 1, i + width, i + width + 1].every(pixel => alpha(pixel) >= 245 && matchesKey(pixel))) add(i);
      }
    }
  }

  let changed = false;
  const fringe = new Set<number>();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const i = queue[cursor];
    if (alpha(i)) changed = true;
    rgba.fill(0, i * 4, i * 4 + 4);
    neighbors(i, other => {
      add(other);
      if (alpha(other) >= 24) fringe.add(other);
    });
  }
  // Leave intentional translucent pink untouched when there is no key evidence.
  if (!hasMask && !changed) return false;

  const repairs: Array<{ i: number; color: number[]; opacity: number }> = [];
  for (const i of fringe) {
    if (alpha(i) < 24) continue;
    const mixed = [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]];
    let closest = Infinity;
    let repair: (typeof repairs)[number] | undefined;
    neighbors(i, other => {
      if (alpha(other) < 245 || fringe.has(other)) return;
      const color = [rgba[other * 4], rgba[other * 4 + 1], rgba[other * 4 + 2]];
      if (isShadedMagenta(color[0], color[1], color[2])) return;
      const axis = key.map((component, channel) => component - color[channel]);
      const length = axis.reduce((sum, component) => sum + component ** 2, 0);
      if (!length) return;
      const weight = axis.reduce((sum, component, channel) => sum + component * (mixed[channel] - color[channel]), 0) / length;
      if (weight < .20 || weight > .96) return;
      const error = axis.reduce((sum, component, channel) => sum + (mixed[channel] - color[channel] - weight * component) ** 2, 0);
      if (error > 375 || error >= closest) return;
      closest = error;
      repair = { i, color, opacity: Math.round(alpha(i) * (hasMask && alpha(i) >= 245 ? 1 - weight : 1)) };
    }, 2);
    if (repair) repairs.push(repair);
  }
  for (const { i, color, opacity } of repairs) {
    rgba.set([...color, opacity], i * 4);
    changed = true;
  }
  return changed;
}

/** A final inventory sprite needs a visible subject and transparent perimeter.
 * Reject broken generations instead of saving a solid chroma rectangle. */
export function assertTransparentSprite(rgba: Uint8ClampedArray,width:number,height:number):void {
  let visible=0, transparent=0, borderOpaque=0, borderCount=0, borderKey=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=(y*width+x)*4,a=rgba[p+3];
    if(a>=100)visible++;if(a<24)transparent++;
    if(x===0||y===0||x===width-1||y===height-1){
      borderCount++;if(a>=24)borderOpaque++;
      if(a>=24&&rgba[p]>=200&&rgba[p+2]>=200&&rgba[p+1]<=90)borderKey++;
    }
  }
  if(visible<4||transparent<Math.max(4,width*height*.02)||borderOpaque>borderCount*.1||borderKey>0)
    throw new Error('Sprite background could not be cleaned safely. Your existing artwork is unchanged; try another preview.');
}
