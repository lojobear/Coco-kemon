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
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = false;
  const d = mat.spriteDescriptor;
  const shades = getPaletteShades(d.primaryColor, d.secondaryColor, d.accentColor);
  // Stable identity: rediscovering an item does not randomly change its appearance.
  const seed = hashString(mat.canonicalName);
  const tags = 'semanticTags' in mat ? mat.semanticTags : [];
  const name = mat.canonicalName.toLowerCase().replace(/_/g, ' ');
  const semantics = `${name} ${tags.join(' ')}`;
  const grid: (string | null)[][] = Array.from({ length: 64 }, () => Array(64).fill(null));
  const pixel = (x: number, y: number, c: string) => {
    x = Math.round(x); y = Math.round(y);
    if (x > 1 && y > 1 && x < 62 && y < 62) grid[y][x] = c;
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, c: string) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) pixel(x, y, c);
    }
  };
  const polygon = (points: number[][], c: string) => {
    for (let y = 2; y < 62; y++) for (let x = 2; x < 62; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) pixel(x, y, c);
    }
  };
  const line = (x1: number, y1: number, x2: number, y2: number, c: string, width = 1) => {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      for (let w = 0; w < width; w++) pixel(x1 + (x2 - x1) * t + w, y1 + (y2 - y1) * t, c);
    }
  };
  const P = shades.primary, H = shades.highlight, S = shades.shade, D = shades.deepShade, A = shades.accent, B = shades.secondary;
  let form = d.baseShape as string;
  // Specific object names take precedence over broad ingredient tags.
  if (/\b(coffee|tea|cocoa|latte|cup|mug)\b/.test(name)) form = 'cup';
  else if (/book|paper|scroll/.test(name)) form = 'book';
  else if (/wire|coil|cable/.test(name)) form = 'coil';
  else if (/sword|knife|blade/.test(name)) form = 'blade';
  else if (/gear|cog|washer/.test(name)) form = 'gear';
  else if (/wood|bark|log|timber/.test(name)) form = 'wood';
  else if (/flower|bloom|rose/.test(name)) form = 'flower';
  else if (/leaf|herb|fern|plant|sprout/.test(name)) form = 'leaf';
  else if (/seed|bean|grain/.test(name)) form = 'seed';
  else if (/crystal|quartz|gem|ice/.test(name)) form = 'crystal';
  else if (/fire|flame|lava|ember/.test(name)) form = 'flame';
  else if (/steam|smoke|cloud|mist|vapor/.test(name)) form = 'vapor';
  else if (/powder|dust|sand|flour|soil|ash/.test(name)) form = 'powder';
  else if (/bread|dough|bun/.test(name)) form = 'bread';
  else if (/glass|bottle|potion/.test(name)) form = 'bottle';
  else if (form === 'flora') form = /flower|petal/.test(semantics) ? 'flower' : 'leaf';

  if (form === 'cup') {
    ellipse(46, 32, 12, 13, B); ellipse(46, 32, 7, 8, shades.outline);
    polygon([[13,21],[44,21],[41,49],[18,49]], P); ellipse(28, 48, 13, 5, S);
    ellipse(28, 21, 16, 6, H); ellipse(28, 22, 12, 3, D);
    line(19,29,21,43,H,2); line(25,14,23,9,A); line(32,13,35,7,A);
  } else if (form === 'leaf' || form === 'flower') {
    line(30,54,33,22,B,2);
    polygon([[31,39],[15,24],[11,32],[17,42],[30,44]], P);
    polygon([[33,29],[42,14],[52,12],[49,26],[35,35]], P);
    line(15,29,29,41,H); line(35,29,49,16,H);
    if (form === 'flower') {
      for (let i=0;i<6;i++) { const a=i*Math.PI/3; ellipse(31+Math.cos(a)*10,19+Math.sin(a)*9,7,7,A); }
      ellipse(31,19,6,6,B); ellipse(29,17,2,2,H);
    } else {
      polygon([[31,30],[23,18],[26,7],[36,15],[37,25]], B);
      line(28,12,32,27,shades.secondaryHighlight);
      for (let y=29;y<40;y+=4) line(21,y,27,y+5,S);
    }
  } else if (form === 'wood') {
    polygon([[13,24],[37,11],[53,31],[29,52]], B);
    for (let i=0;i<5;i++) line(15+i*4,25+i*4,39+i*3,14+i*4,i%2 ? D:P,2);
    ellipse(23,39,13,15,P); ellipse(23,39,9,11,B); ellipse(23,39,6,8,P); ellipse(23,39,3,4,S);
    line(19,30,26,43,H);
  } else if (form === 'crystal') {
    polygon([[10,32],[18,19],[30,28],[28,52],[17,49]], B);
    polygon([[26,17],[37,6],[46,24],[40,53],[25,51]], P);
    polygon([[26,17],[37,6],[34,43],[25,51]], H);
    polygon([[46,24],[40,53],[34,43]], S);
    polygon([[43,37],[53,26],[56,42],[45,54],[38,52]], A);
    line(28,20,27,36,'#ffffff'); line(48,32,46,39,shades.accentHighlight);
  } else if (form === 'coil' || form === 'gear') {
    if (form === 'gear') {
      for (let i=0;i<8;i++) {const a=i*Math.PI/4; ellipse(32+Math.cos(a)*20,32+Math.sin(a)*20,5,5,B);}
      ellipse(32,32,21,21,P); ellipse(32,32,12,12,D); ellipse(32,32,7,7,shades.outline);
      line(18,22,23,17,H,2); line(40,45,46,39,S,2);
    } else {
      for (let i=0;i<4;i++) { ellipse(20+i*7,32,9,18,B); ellipse(20+i*7,32,5,13,D); line(17+i*7,20,17+i*7,27,H,2); }
      line(9,39,15,39,A,3); line(47,26,55,26,A,3);
    }
  } else if (form === 'book') {
    polygon([[12,14],[41,9],[51,16],[51,49],[21,56],[12,48]], B);
    polygon([[20,21],[48,16],[48,47],[20,53]], H);
    for(let y=26;y<49;y+=3) line(23,y,45,y-4,S);
    polygon([[12,14],[40,9],[48,15],[20,22],[20,53],[12,48]], P);
    line(15,17,15,46,H); line(33,18,33,36,A,2);
  } else if (form === 'blade') {
    polygon([[23,40],[42,9],[52,5],[49,18],[29,44]], P);
    polygon([[23,40],[52,5],[29,44]], H);
    line(20,36,35,46,B,4); line(24,44,16,55,B,5); line(19,47,22,49,A,2);
  } else if (form === 'flame' || form === 'sparks') {
    polygon([[16,48],[11,35],[23,41],[22,24],[32,7],[34,27],[43,17],[43,35],[52,29],[49,46],[37,55],[23,54]], B);
    polygon([[20,46],[24,34],[29,39],[34,21],[37,42],[45,35],[42,48],[33,53]], P);
    polygon([[27,47],[33,36],[37,49],[32,52]], A);
    pixel(16,20,H); pixel(48,13,A); line(11,27,13,24,H);
  } else if (form === 'vapor') {
    for(let i=0;i<6;i++) {const x=18+(i%3)*12,y=23+Math.floor(i/3)*15;ellipse(x,y,11,10,i<3?H:P);}
    line(20,47,44,47,S); ellipse(27,16,7,7,H); line(14,30,20,27,'#ffffff');
  } else if (form === 'powder' || form === 'seed') {
    for(let i=0;i<48;i++) {
      const n=((seed+i*7919)>>>0), x=12+n%41, y=29+(n*7)%23;
      if (Math.abs(x-32)<(y-19)*0.8) ellipse(x,y,form==='seed'?3:2,form==='seed'?5:1,i%3===0?H:i%3===1?P:S);
    }
    for(let i=0;i<8;i++) pixel(8+(seed+i*7)%48,51+(i%4),B);
  } else if (form === 'bottle' || form === 'droplet' || form === 'fluid') {
    if (form === 'bottle') {
      polygon([[25,9],[38,9],[38,24],[49,36],[49,49],[42,55],[20,55],[14,49],[14,36],[25,24]], P);
      polygon([[17,38],[46,38],[46,49],[40,52],[23,52],[17,48]], B);
      polygon([[24,8],[39,8],[39,15],[24,15]], A); line(22,29,18,38,H,2);
    } else {
      polygon([[32,7],[47,29],[49,43],[41,53],[24,55],[14,46],[14,34]], P);
      ellipse(31,42,16,12,P); polygon([[32,11],[21,34],[19,44],[16,37],[20,28]],H);
      line(34,51,42,46,S,2); ellipse(23,32,2,4,'#ffffff');
    }
  } else if (form === 'ingot') {
    polygon([[16,22],[42,16],[54,34],[45,47],[14,52],[8,40]], S);
    polygon([[16,22],[42,16],[48,32],[19,39]], H);
    polygon([[19,39],[48,32],[45,47],[14,52]], P); line(20,24,37,20,'#ffffff');
  } else if (form === 'bread') {
    ellipse(32,34,23,18,P); polygon([[10,35],[54,35],[50,49],[16,50]],S);
    for(let i=0;i<3;i++) line(20+i*10,22,16+i*10,33,H,3);
  } else {
    // Irregular mineral or specimen silhouette, with material-specific inclusions.
    polygon([[10,35],[16,19],[30,12],[46,19],[55,37],[44,52],[21,53]],P);
    polygon([[16,19],[30,12],[35,30],[10,35]],H);
    polygon([[35,30],[46,19],[55,37],[44,52],[29,47]],S);
    line(30,14,34,27,B); line(35,30,45,34,B);
    if (form === 'orb') { ellipse(32,32,21,21,P);ellipse(26,24,10,8,H);ellipse(23,21,3,3,'#ffffff'); }
  }
  // Fine 1px grain follows inherited material properties; it is not a scaled 32px image.
  for(let y=4;y<59;y++) for(let x=4;x<59;x++) {
    if (!grid[y][x] || grid[y][x] === shades.outline) continue;
    const noise=(Math.imul(x+seed,374761393)^Math.imul(y+seed,668265263))>>>0;
    if (/metal|conduct|crystal/.test(semantics) && noise%113===0) pixel(x,y,shades.accentHighlight);
    else if (/organic|wood|bark|soil|porous|mineral/.test(semantics) && noise%31===0) pixel(x,y,noise%2?B:S);
  }
  // Single native-pixel outline; transparent corners remain untouched.
  for(let y=1;y<63;y++) for(let x=1;x<63;x++) {
    const c=grid[y][x];
    if(c || grid[y-1][x] || grid[y+1][x] || grid[y][x-1] || grid[y][x+1]) {
      ctx.fillStyle=c || shades.outline; ctx.fillRect(x,y,1,1);
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
