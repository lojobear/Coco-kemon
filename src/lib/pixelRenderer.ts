/**
 * ODDKIN FOUNDRY - Deterministic 64×64 Pixel Art Sprite Engine
 * Creates authentic handheld-era RPG monster sprites & material icons.
 * Features:
 * - Crisp 64x64 native resolution with transparent backgrounds
 * - Handcrafted silhouette geometry & procedural cluster rasterization
 * - 1-pixel dark outlines & top-left specular highlights
 * - Material-influenced textures (crystals, pores, flakes, molten glow)
 * - Chroma variant palette shifting
 * - Nearest-neighbor pixel accuracy (NO blurry anti-aliasing)
 */

import { Material, Oddkin, SpriteDescriptor } from '../types';

// Helper to parse hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const clamped = Math.max(0, Math.min(255, Math.round(x)));
    const s = clamped.toString(16);
    return s.length === 1 ? '0' + s : s;
  }).join('');
}

// Generate shading variants (highlight, base, shade, dark outline)
export function getPaletteShades(primaryHex: string, secondaryHex: string, accentHex: string) {
  const [pr, pg, pb] = hexToRgb(primaryHex);
  const [sr, sg, sb] = hexToRgb(secondaryHex);
  const [ar, ag, ab] = hexToRgb(accentHex);

  return {
    highlight: rgbToHex(pr * 1.35 + 30, pg * 1.35 + 30, pb * 1.35 + 30),
    primary: primaryHex,
    shade: rgbToHex(pr * 0.7, pg * 0.7, pb * 0.7),
    deepShade: rgbToHex(pr * 0.45, pg * 0.45, pb * 0.45),
    secondary: secondaryHex,
    secondaryHighlight: rgbToHex(sr * 1.3 + 20, sg * 1.3 + 20, sb * 1.3 + 20),
    secondaryShade: rgbToHex(sr * 0.65, sg * 0.65, sb * 0.65),
    accent: accentHex,
    accentHighlight: rgbToHex(ar * 1.4 + 40, ag * 1.4 + 40, ab * 1.4 + 40),
    outline: '#101216',
  };
}

// Pseudo-random hash from string
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Render a 64x64 Material Sprite onto an OffscreenCanvas and return dataURL
 */
export function generateMaterialSprite(mat: Material | { id: string; canonicalName: string; spriteDescriptor: SpriteDescriptor }): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;

  const desc = mat.spriteDescriptor;
  const shades = getPaletteShades(desc.primaryColor, desc.secondaryColor, desc.accentColor);
  const seed = hashString(mat.id || mat.canonicalName);

  // Buffer for 32x32 logical pixels, which we scale 2x to 64x64 for chunky retro aesthetic
  const grid: (string | null)[][] = Array(32).fill(null).map(() => Array(32).fill(null));

  const setPixel = (x: number, y: number, color: string) => {
    if (x >= 0 && x < 32 && y >= 0 && y < 32) {
      grid[y][x] = color;
    }
  };

  const drawFilledCircle = (cx: number, cy: number, r: number, color: string) => {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) {
          setPixel(cx + x, cy + y, color);
        }
      }
    }
  };

  const shape = desc.baseShape || 'rock';

  if (shape === 'droplet' || shape === 'fluid') {
    // Teardrop / liquid flask
    for (let y = 6; y <= 26; y++) {
      const progress = (y - 6) / 20;
      const width = progress < 0.4 ? Math.round(progress * 16) : Math.round(Math.sin((progress) * Math.PI) * 11);
      for (let x = 16 - width; x <= 16 + width; x++) {
        // Top-left lighting
        if (x <= 16 && y <= 16) {
          setPixel(x, y, shades.highlight);
        } else if (y > 20 || x > 20) {
          setPixel(x, y, shades.shade);
        } else {
          setPixel(x, y, shades.primary);
        }
      }
    }
    // Glint highlight
    setPixel(13, 11, '#ffffff');
    setPixel(14, 11, '#ffffff');
    setPixel(13, 12, shades.accentHighlight);
  } else if (shape === 'crystal' || shape === 'ingot') {
    // Faceted geometric prism
    const points: [number, number][] = [
      [16, 4], [25, 12], [23, 27], [16, 29], [9, 27], [7, 12]
    ];
    // Fill polygon approximation
    for (let y = 5; y <= 28; y++) {
      const left = y < 12 ? 16 - (y - 4) * 0.8 : 7 + (y - 12) * 0.15;
      const right = y < 12 ? 16 + (y - 4) * 0.8 : 25 - (y - 12) * 0.15;
      for (let x = Math.round(left); x <= Math.round(right); x++) {
        if (x < 16 && y < 18) {
          setPixel(x, y, shades.highlight);
        } else if (x >= 16 && y < 18) {
          setPixel(x, y, shades.primary);
        } else if (x < 16) {
          setPixel(x, y, shades.secondary);
        } else {
          setPixel(x, y, shades.shade);
        }
      }
    }
    // Crystal facet ridges
    for (let y = 5; y <= 28; y++) {
      setPixel(16, y, shades.accentHighlight);
    }
    setPixel(13, 8, '#ffffff');
    setPixel(14, 9, '#ffffff');
  } else if (shape === 'flora') {
    // Leaf sprout / botanical cluster
    drawFilledCircle(16, 18, 7, shades.primary);
    drawFilledCircle(12, 13, 5, shades.highlight);
    drawFilledCircle(20, 13, 5, shades.secondary);
    // Stem
    for (let y = 18; y <= 27; y++) {
      setPixel(16, y, shades.deepShade);
      setPixel(17, y, shades.shade);
    }
    // Veins
    setPixel(14, 14, shades.accentHighlight);
    setPixel(18, 14, shades.accentHighlight);
    setPixel(12, 11, '#ffffff');
  } else if (shape === 'sparks' || desc.glow) {
    // Plasma / Spark core with corona
    drawFilledCircle(16, 16, 6, shades.highlight);
    drawFilledCircle(16, 16, 3, '#ffffff');
    // Plasma discharge spikes
    const spikes: [number, number][] = [
      [16, 5], [16, 6], [16, 26], [16, 25],
      [5, 16], [6, 16], [26, 16], [25, 16],
      [8, 8], [9, 9], [23, 23], [24, 24],
      [8, 24], [9, 23], [24, 8], [23, 9]
    ];
    spikes.forEach(([sx, sy]) => setPixel(sx, sy, shades.accent));
    setPixel(16, 4, shades.accentHighlight);
    setPixel(27, 16, shades.accentHighlight);
    setPixel(16, 27, shades.accentHighlight);
    setPixel(4, 16, shades.accentHighlight);
  } else if (shape === 'powder') {
    // Granular pile / loose earth
    for (let y = 12; y <= 26; y++) {
      const spread = Math.round((y - 11) * 0.95);
      for (let x = 16 - spread; x <= 16 + spread; x++) {
        // Speckled noise
        const rand = ((x * 17 + y * 29 + seed) % 10) / 10;
        if (rand > 0.75) {
          setPixel(x, y, shades.highlight);
        } else if (rand > 0.4) {
          setPixel(x, y, shades.primary);
        } else if (rand > 0.15) {
          setPixel(x, y, shades.secondary);
        } else {
          setPixel(x, y, shades.shade);
        }
      }
    }
  } else {
    // Default Rock / Nugget
    drawFilledCircle(16, 17, 9, shades.primary);
    drawFilledCircle(14, 14, 6, shades.highlight);
    drawFilledCircle(19, 19, 5, shades.shade);
    // Craggy crevices
    setPixel(13, 17, shades.deepShade);
    setPixel(14, 18, shades.deepShade);
    setPixel(18, 14, shades.deepShade);
    setPixel(11, 12, '#ffffff');
  }

  // Draw 1-pixel dark outline around all non-null pixels
  const outlinedGrid: (string | null)[][] = Array(32).fill(null).map(() => Array(32).fill(null));
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (grid[y][x] !== null) {
        outlinedGrid[y][x] = grid[y][x];
      } else {
        // Check 4-neighbors
        let hasNeighbor = false;
        if (y > 0 && grid[y - 1][x] !== null) hasNeighbor = true;
        if (y < 31 && grid[y + 1][x] !== null) hasNeighbor = true;
        if (x > 0 && grid[y][x - 1] !== null) hasNeighbor = true;
        if (x < 31 && grid[y][x + 1] !== null) hasNeighbor = true;
        if (hasNeighbor) {
          outlinedGrid[y][x] = shades.outline;
        }
      }
    }
  }

  // Render to 64x64 canvas (2x2 per logical pixel)
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const col = outlinedGrid[y][x];
      if (col) {
        ctx.fillStyle = col;
        ctx.fillRect(x * 2, y * 2, 2, 2);
      }
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Render a 64x64 Oddkin Creature Sprite
 * Faithful monster RPG silhouette, clear anatomy, animated breathing offset support
 */
export function generateOddkinSprite(
  oddkin: Oddkin,
  options?: { isChroma?: boolean; frameOffset?: number }
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;

  const spec = oddkin.spriteSpecification;
  const morph = oddkin.morphology;
  const isChroma = options?.isChroma || spec.isChroma || oddkin.isChromaActive;
  const isAnomalous = spec.isAnomalous || oddkin.rarity === 'ANOMALOUS';

  // Chroma palette shift: Iridescent Gold / Bioluminescent Cyan / Royal Purple
  let primary = spec.primaryColor;
  let secondary = spec.secondaryColor;
  let accent = spec.accentColor;

  if (isChroma) {
    // Rare majestic chromatic shift
    primary = '#fbbf24'; // Amber Gold
    secondary = '#c026d3'; // Mystic Magenta
    accent = '#22d3ee'; // Neon Cyan
  }

  if (isAnomalous) {
    // Void-touched / cosmic anomaly
    primary = '#a855f7';
    secondary = '#0f172a';
    accent = '#4ade80';
  }

  const shades = getPaletteShades(primary, secondary, accent);
  const seed = hashString(oddkin.speciesId || oddkin.speciesName);

  // 32x32 logical canvas
  const grid: (string | null)[][] = Array(32).fill(null).map(() => Array(32).fill(null));

  const setPixel = (x: number, y: number, color: string) => {
    if (x >= 0 && x < 32 && y >= 0 && y < 32) {
      grid[y][x] = color;
    }
  };

  const drawFilledCircle = (cx: number, cy: number, r: number, color: string) => {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) {
          setPixel(cx + x, cy + y, color);
        }
      }
    }
  };

  // Center coordinates with subtle breathing bobbing
  const cy = 17 + (options?.frameOffset ? 1 : 0);
  const cx = 16;

  // 1. Morphology-specific Anatomy
  const plan = morph.bodyPlan || 'quadruped';

  if (plan === 'blob' || plan === 'fungoid') {
    // Organic bulbous base
    drawFilledCircle(cx, cy + 2, 8, shades.primary);
    drawFilledCircle(cx - 2, cy - 2, 6, shades.highlight);
    drawFilledCircle(cx + 4, cy + 4, 6, shades.shade);

    // Mushroom cap or jelly crown
    for (let x = 8; x <= 24; x++) {
      const arc = Math.round(Math.sin(((x - 8) / 16) * Math.PI) * 7);
      for (let y = cy - 4 - arc; y <= cy - 1; y++) {
        setPixel(x, y, x < 16 ? shades.secondaryHighlight : shades.secondary);
      }
    }
    // Spores or spots
    setPixel(cx - 4, cy - 5, shades.accentHighlight);
    setPixel(cx + 3, cy - 6, shades.accentHighlight);
    setPixel(cx, cy - 8, '#ffffff');

  } else if (plan === 'serpentine') {
    // S-coiled serpentine body
    for (let deg = 0; deg <= 180; deg += 10) {
      const rad = (deg * Math.PI) / 180;
      const sx = Math.round(cx + Math.sin(rad * 2) * 8);
      const sy = Math.round(cy + (deg / 180) * 10 - 3);
      drawFilledCircle(sx, sy, 3, shades.primary);
    }
    // Head
    drawFilledCircle(cx - 5, cy - 5, 5, shades.highlight);

  } else if (plan === 'avian' || plan === 'floating_orb') {
    // Floating core with wings/fins
    drawFilledCircle(cx, cy, 7, shades.primary);
    drawFilledCircle(cx - 2, cy - 2, 5, shades.highlight);

    // Left Wing
    for (let i = 0; i < 7; i++) {
      setPixel(cx - 7 - i, cy - 2 - Math.round(i * 0.7), shades.secondaryHighlight);
      setPixel(cx - 7 - i, cy - 1 - Math.round(i * 0.5), shades.secondary);
      setPixel(cx - 7 - i, cy, shades.secondaryShade);
    }
    // Right Wing
    for (let i = 0; i < 7; i++) {
      setPixel(cx + 7 + i, cy - 2 - Math.round(i * 0.7), shades.secondaryHighlight);
      setPixel(cx + 7 + i, cy - 1 - Math.round(i * 0.5), shades.secondary);
      setPixel(cx + 7 + i, cy, shades.secondaryShade);
    }

    // Feather / tail plumes
    setPixel(cx - 1, cy + 8, shades.accent);
    setPixel(cx, cy + 9, shades.accentHighlight);
    setPixel(cx + 1, cy + 8, shades.accent);

  } else if (plan === 'biped') {
    // Upright bipedal stance (torso + head + 2 legs)
    drawFilledCircle(cx, cy + 3, 6, shades.primary); // Torso
    drawFilledCircle(cx, cy - 5, 5, shades.highlight); // Head

    // Legs
    for (let y = cy + 6; y <= cy + 10; y++) {
      setPixel(cx - 4, y, shades.shade);
      setPixel(cx - 3, y, shades.primary);
      setPixel(cx + 3, y, shades.primary);
      setPixel(cx + 4, y, shades.shade);
    }
    // Feet
    setPixel(cx - 5, cy + 10, shades.deepShade);
    setPixel(cx + 5, cy + 10, shades.deepShade);

    // Small arms
    setPixel(cx - 7, cy + 2, shades.highlight);
    setPixel(cx - 8, cy + 3, shades.highlight);
    setPixel(cx + 7, cy + 2, shades.primary);
    setPixel(cx + 8, cy + 3, shades.primary);

  } else {
    // Quadruped (default creature: head, body, 4 legs, tail)
    drawFilledCircle(cx + 2, cy + 1, 6, shades.primary); // Body
    drawFilledCircle(cx - 5, cy - 4, 5, shades.highlight); // Head

    // 4 sturdy legs
    const legX = [cx - 7, cx - 4, cx + 5, cx + 8];
    legX.forEach((lx, idx) => {
      const legColor = idx % 2 === 0 ? shades.shade : shades.primary;
      for (let y = cy + 5; y <= cy + 9; y++) {
        setPixel(lx, y, legColor);
      }
      setPixel(lx + (idx < 2 ? -1 : 1), cy + 9, shades.deepShade);
    });

    // Tail
    setPixel(cx + 8, cy - 1, shades.accent);
    setPixel(cx + 9, cy - 2, shades.accentHighlight);
    setPixel(cx + 10, cy - 4, shades.accentHighlight);
  }

  // 2. Head Appendages (Horns / Ears / Antennae / Crest)
  const appSeed = seed % 4;
  if (appSeed === 0) {
    // Dual Horns
    setPixel(cx - 7, cy - 10, shades.accentHighlight);
    setPixel(cx - 6, cy - 9, shades.accent);
    setPixel(cx + 5, cy - 10, shades.accentHighlight);
    setPixel(cx + 4, cy - 9, shades.accent);
  } else if (appSeed === 1) {
    // Leaf / Feather Crest
    setPixel(cx - 5, cy - 10, shades.secondaryHighlight);
    setPixel(cx - 5, cy - 11, '#ffffff');
    setPixel(cx - 4, cy - 9, shades.secondary);
  } else if (appSeed === 2) {
    // Antennae with glowing bulbs
    setPixel(cx - 6, cy - 10, shades.outline);
    setPixel(cx - 7, cy - 11, shades.accentHighlight);
    setPixel(cx - 3, cy - 10, shades.outline);
    setPixel(cx - 2, cy - 11, shades.accentHighlight);
  } else {
    // Crystal protrusion
    setPixel(cx - 5, cy - 10, shades.accentHighlight);
    setPixel(cx - 4, cy - 11, '#ffffff');
    setPixel(cx - 5, cy - 9, shades.accent);
  }

  // 3. Expressive Pixel Eyes
  const eyeStyle = spec.eyeStyle || 'beady';
  const eyeY = cy - 4;
  if (eyeStyle === 'luminescent' || isAnomalous) {
    // Bright luminous cyan/amber eyes
    setPixel(cx - 7, eyeY, shades.accentHighlight);
    setPixel(cx - 6, eyeY, '#ffffff');
    setPixel(cx - 4, eyeY, shades.accentHighlight);
    setPixel(cx - 3, eyeY, '#ffffff');
  } else if (eyeStyle === 'slits') {
    // Feline / reptile slits
    setPixel(cx - 6, eyeY - 1, shades.outline);
    setPixel(cx - 6, eyeY, shades.accentHighlight);
    setPixel(cx - 6, eyeY + 1, shades.outline);
  } else if (eyeStyle === 'single') {
    // Monocle / Cyclops eye
    setPixel(cx - 5, eyeY, shades.outline);
    setPixel(cx - 4, eyeY, shades.accentHighlight);
    setPixel(cx - 4, eyeY - 1, '#ffffff');
  } else {
    // Classic handheld RPG beady eyes with specular gleam
    setPixel(cx - 7, eyeY, shades.outline);
    setPixel(cx - 6, eyeY, shades.outline);
    setPixel(cx - 7, eyeY - 1, '#ffffff'); // Glint

    setPixel(cx - 3, eyeY, shades.outline);
    setPixel(cx - 2, eyeY, shades.outline);
    setPixel(cx - 3, eyeY - 1, '#ffffff');
  }

  // 4. Surface Texture (Scales / Fur / Molten crackles / Shell)
  if (morph.surface === 'molten' || morph.surface === 'crystalline') {
    // Specular flecks
    setPixel(cx + 2, cy + 2, shades.accentHighlight);
    setPixel(cx - 1, cy + 1, '#ffffff');
    setPixel(cx + 4, cy - 1, shades.accent);
  } else if (morph.surface === 'chitin' || morph.surface === 'metallic') {
    // Shiny carapace sheen
    setPixel(cx - 3, cy - 1, shades.highlight);
    setPixel(cx - 2, cy - 1, '#ffffff');
    setPixel(cx + 1, cy + 3, shades.highlight);
  }

  // 5. Special Anomalous / Chroma Aura Sparks
  if (isChroma || isAnomalous) {
    const auraSparks = [
      [cx - 10, cy - 6], [cx + 10, cy - 6],
      [cx - 8, cy + 6], [cx + 9, cy + 7],
      [cx, cy - 12]
    ];
    auraSparks.forEach(([ax, ay]) => {
      setPixel(ax, ay, isChroma ? '#fef08a' : '#86efac');
    });
  }

  // 6. Draw 1-pixel dark outline around the full silhouette
  const outlinedGrid: (string | null)[][] = Array(32).fill(null).map(() => Array(32).fill(null));
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (grid[y][x] !== null) {
        outlinedGrid[y][x] = grid[y][x];
      } else {
        let hasNeighbor = false;
        if (y > 0 && grid[y - 1][x] !== null) hasNeighbor = true;
        if (y < 31 && grid[y + 1][x] !== null) hasNeighbor = true;
        if (x > 0 && grid[y][x - 1] !== null) hasNeighbor = true;
        if (x < 31 && grid[y][x + 1] !== null) hasNeighbor = true;
        if (hasNeighbor) {
          outlinedGrid[y][x] = shades.outline;
        }
      }
    }
  }

  // Render to 64x64 canvas
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const col = outlinedGrid[y][x];
      if (col) {
        ctx.fillStyle = col;
        ctx.fillRect(x * 2, y * 2, 2, 2);
      }
    }
  }

  return canvas.toDataURL('image/png');
}
