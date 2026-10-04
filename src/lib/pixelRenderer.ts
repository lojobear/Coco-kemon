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

export const MATERIAL_SPRITE_RENDERER_VERSION = 3;

const CONCEPT_PALETTES: Array<{ match: RegExp; descriptor: SpriteDescriptor }> = [
  { match: /water|ocean|lake|river|wave|rain|tsunami|geyser|boiling/, descriptor: { palette: ['#1d4ed8', '#2563eb', '#38bdf8', '#bae6fd'], baseShape: 'droplet', primaryColor: '#2563eb', secondaryColor: '#1d4ed8', accentColor: '#7dd3fc' } },
  { match: /fire|lava|flame|ember|volcano|ash/, descriptor: { palette: ['#7c2d12', '#dc2626', '#f97316', '#facc15'], baseShape: 'sparks', primaryColor: '#f97316', secondaryColor: '#dc2626', accentColor: '#fde047', glow: true } },
  { match: /plant|tree|forest|jungle|flower|seed|leaf|dandelion|swamp/, descriptor: { palette: ['#14532d', '#16a34a', '#22c55e', '#bbf7d0'], baseShape: 'flora', primaryColor: '#22c55e', secondaryColor: '#15803d', accentColor: '#fda4af' } },
  { match: /metal|steel|iron|robot|engine|battery|tool|machine|ai|cyborg/, descriptor: { palette: ['#0f172a', '#475569', '#94a3b8', '#67e8f9'], baseShape: 'ingot', primaryColor: '#64748b', secondaryColor: '#334155', accentColor: '#22d3ee' } },
  { match: /glass|crystal|ice|diamond|lens|obsidian|fulgurite/, descriptor: { palette: ['#164e63', '#0891b2', '#22d3ee', '#ecfeff'], baseShape: 'crystal', primaryColor: '#22d3ee', secondaryColor: '#0891b2', accentColor: '#f0fdff' } },
  { match: /cloud|steam|smoke|wind|storm|tornado|blizzard|sky/, descriptor: { palette: ['#334155', '#64748b', '#cbd5e1', '#f8fafc'], baseShape: 'vapor', primaryColor: '#cbd5e1', secondaryColor: '#64748b', accentColor: '#38bdf8' } },
  { match: /sun|moon|planet|galaxy|universe|star|solar/, descriptor: { palette: ['#312e81', '#7c3aed', '#f59e0b', '#fef3c7'], baseShape: 'orb', primaryColor: '#7c3aed', secondaryColor: '#312e81', accentColor: '#fbbf24', glow: true } },
  { match: /earth|stone|mud|mountain|sand|dune|island|continent|brick|wall/, descriptor: { palette: ['#292524', '#57534e', '#a8a29e', '#fde68a'], baseShape: 'rock', primaryColor: '#78716c', secondaryColor: '#44403c', accentColor: '#fbbf24' } },
  { match: /coffee|tea|food|bread|perfume|oil/, descriptor: { palette: ['#451a03', '#92400e', '#d97706', '#fde68a'], baseShape: 'curio', primaryColor: '#d97706', secondaryColor: '#92400e', accentColor: '#fde68a' } },
  { match: /fish|bird|bug|dragon|human|mermaid|dinosaur|animal/, descriptor: { palette: ['#134e4a', '#0f766e', '#2dd4bf', '#fb923c'], baseShape: 'curio', primaryColor: '#14b8a6', secondaryColor: '#0f766e', accentColor: '#fb923c' } },
];

export function spriteDescriptorForConcept(name: string, connection?: string): SpriteDescriptor {
  const key = `${name} ${connection || ''}`.toLowerCase();
  const found = CONCEPT_PALETTES.find(entry => entry.match.test(key));
  return found ? { ...found.descriptor, palette: [...found.descriptor.palette] } : { palette: ['#38bdf8', '#a78bfa', '#fbbf24'], baseShape: 'curio', primaryColor: '#38bdf8', secondaryColor: '#a78bfa', accentColor: '#fbbf24' };
}

export function generateConceptSprite(name: string, connection?: string): string {
  const clean = name.trim();
  if (!clean) return '';
  return generateMaterialSprite({ id: `concept_${encodeURIComponent(clean.toLowerCase())}`, canonicalName: clean.toUpperCase(), spriteDescriptor: spriteDescriptorForConcept(clean, connection) });
}

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
  if (/\b(coffee|tea|cocoa|latte|cup|mug|teapot)\b/.test(name)) form = 'cup';
  else if (/hourglass|\btime\b/.test(name)) form = 'hourglass';
  else if (/lightning|battery|\benergy\b/.test(name)) form = 'lightning';
  else if (/\bsun\b/.test(name)) form = 'sun';
  else if (/\bmoon\b/.test(name)) form = 'moon';
  else if (/planet|galaxy|universe|solar system|\bearth\b/.test(name)) form = 'planet';
  else if (/mountain|island|continent|dune|volcano/.test(name)) form = /volcano/.test(name) ? 'volcano' : 'mountain';
  else if (/wave|ocean|lake|river|tsunami|geyser/.test(name)) form = 'wave';
  else if (/tree|forest|jungle/.test(name)) form = 'tree';
  else if (/fish|mermaid/.test(name)) form = 'fish';
  else if (/bird|pterodactyl|kite/.test(name)) form = 'bird';
  else if (/dragon/.test(name)) form = 'dragon';
  else if (/bug|bacteria/.test(name)) form = 'bug';
  else if (/robot|cyborg|\bai\b/.test(name)) form = 'robot';
  else if (/human|engineer|warrior|woodsman|statue|\bold\b/.test(name)) form = 'figure';
  else if (/fossil|dinosaur|jurassic/.test(name)) form = 'fossil';
  else if (/house|village|town|city|metropolis|greenhouse/.test(name)) form = 'house';
  else if (/brick|wall/.test(name)) form = 'brick';
  else if (/boat|steamboat/.test(name)) form = 'boat';
  else if (/airplane|train|car/.test(name)) form = 'vehicle';
  else if (/mushroom/.test(name)) form = 'mushroom';
  else if (/book|paper|scroll/.test(name)) form = 'book';
  else if (/wire|coil|cable/.test(name)) form = 'coil';
  else if (/sword|knife|blade|axe|tool/.test(name)) form = 'blade';
  else if (/gear|cog|washer|engine/.test(name)) form = 'gear';
  else if (/wood|bark|log|timber/.test(name)) form = 'wood';
  else if (/flower|bloom|rose|perfume|dandelion/.test(name)) form = 'flower';
  else if (/leaf|herb|fern|plant|sprout/.test(name)) form = 'leaf';
  else if (/seed|bean|grain/.test(name)) form = 'seed';
  else if (/crystal|quartz|gem|ice|glass|lens|obsidian|fulgurite/.test(name)) form = 'crystal';
  else if (/fire|flame|lava|ember/.test(name)) form = 'flame';
  else if (/steam|smoke|cloud|mist|vapor|storm|tornado|blizzard|wind/.test(name)) form = 'vapor';
  else if (/powder|dust|sand|flour|soil|ash|mud/.test(name)) form = 'powder';
  else if (/bread|dough|bun/.test(name)) form = 'bread';
  else if (/bottle|potion|oil/.test(name)) form = 'bottle';
  else if (form === 'flora') form = /flower|petal/.test(semantics) ? 'flower' : 'leaf';

  const rect = (x: number, y: number, w: number, h: number, c: string) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) pixel(xx, yy, c); };
  if (form === 'wave') {
    ellipse(32, 39, 24, 13, B); ellipse(27, 35, 20, 12, P); ellipse(39, 30, 13, 9, H);
    line(12, 43, 52, 43, S, 2); line(18, 49, 48, 49, B, 2);
    ellipse(43, 25, 6, 5, '#ffffff'); ellipse(35, 22, 4, 3, '#ffffff'); pixel(24, 28, '#ffffff');
  } else if (form === 'mountain' || form === 'volcano') {
    polygon([[8,52],[27,16],[39,34],[46,22],[57,52]], B);
    polygon([[14,52],[30,20],[43,52]], P); polygon([[30,20],[36,31],[31,35],[26,30]], '#ffffff');
    line(18,45,48,45,S,2); line(24,38,39,38,S);
    if (form === 'volcano') { polygon([[29,18],[35,18],[34,8],[30,8]], A); ellipse(32,7,5,3, shades.accentHighlight); line(31,20,29,31,A,2); }
  } else if (form === 'tree') {
    rect(29, 38, 7, 15, B); line(31, 43, 24, 49, B, 2); line(34, 43, 42, 48, B, 2);
    ellipse(32, 27, 18, 15, P); ellipse(22, 33, 11, 9, B); ellipse(43, 33, 11, 9, B); ellipse(27, 20, 8, 6, H); ellipse(43, 22, 3, 3, A);
  } else if (form === 'fish') {
    polygon([[14,32],[4,20],[5,44]], B); ellipse(34, 32, 19, 12, P); ellipse(28, 27, 10, 5, H);
    ellipse(43, 30, 2, 2, shades.outline); line(24, 40, 39, 40, S, 2); line(31, 22, 36, 31, A, 2);
  } else if (form === 'bird') {
    ellipse(31, 36, 17, 11, P); polygon([[43,31],[57,27],[45,39]], A); ellipse(44, 29, 7, 6, B); pixel(46, 28, shades.outline);
    polygon([[24,30],[10,18],[15,36],[27,38]], B); line(27, 45, 24, 54, A, 2); line(36, 45, 38, 54, A, 2); line(20, 27, 28, 23, H, 2);
  } else if (form === 'dragon') {
    ellipse(31, 38, 18, 11, P); polygon([[20,29],[8,13],[27,18],[35,28]], B); polygon([[43,30],[55,25],[47,39]], A);
    ellipse(46, 31, 7, 6, B); pixel(48, 30, shades.outline); line(47, 24, 44, 18, A, 2); line(52, 24, 53, 18, A, 2);
    line(17, 42, 7, 50, B, 3); ellipse(35, 32, 3, 3, shades.accentHighlight);
  } else if (form === 'bug') {
    ellipse(32, 35, 13, 16, P); ellipse(32, 18, 8, 7, B); line(32, 22, 32, 50, S, 2);
    for (let i = 0; i < 3; i++) { line(20, 29 + i * 7, 9, 24 + i * 8, B, 2); line(44, 29 + i * 7, 55, 24 + i * 8, B, 2); }
    line(27, 12, 20, 5, B, 2); line(37, 12, 44, 5, B, 2); pixel(29, 18, H); pixel(35, 18, H);
  } else if (form === 'robot') {
    rect(18, 22, 28, 24, P); rect(23, 12, 18, 12, B); line(32, 12, 32, 5, A, 2); pixel(32, 4, shades.accentHighlight);
    pixel(27, 18, A); pixel(37, 18, A); rect(27, 30, 10, 3, S); rect(24, 36, 16, 5, B);
    rect(12, 26, 5, 14, B); rect(47, 26, 5, 14, B); rect(24, 47, 6, 7, B); rect(35, 47, 6, 7, B);
  } else if (form === 'figure') {
    ellipse(32, 17, 8, 8, B); polygon([[22,29],[42,29],[46,52],[36,52],[32,39],[27,52],[18,52]], P);
    line(22, 32, 12, 43, B, 3); line(42, 32, 52, 25, B, 3); line(48, 20, 55, 12, A, 2); pixel(29, 16, H);
  } else if (form === 'fossil') {
    line(16, 38, 45, 25, B, 4); ellipse(14, 39, 7, 6, B); ellipse(18, 35, 6, 5, B); ellipse(43, 24, 7, 6, B); ellipse(47, 28, 6, 5, B);
    line(22, 43, 39, 34, S, 2); ellipse(30, 45, 12, 5, shades.secondaryShade);
  } else if (form === 'house') {
    rect(17, 31, 30, 21, P); polygon([[12,32],[32,14],[52,32]], B); rect(28, 41, 8, 11, B); rect(21, 35, 6, 6, H); rect(39, 35, 6, 6, H);
    rect(29, 18, 6, 8, S); line(15, 52, 50, 52, S, 2);
  } else if (form === 'brick') {
    rect(10, 20, 44, 30, P); for (let y = 20; y <= 50; y += 8) line(10, y, 54, y, H, 2);
    for (let row = 0; row < 4; row++) for (let x = row % 2 ? 18 : 10; x < 54; x += 16) line(x, 20 + row * 8, x, 27 + row * 8, H, 2);
    line(14, 24, 25, 24, S, 2);
  } else if (form === 'boat') {
    polygon([[14,42],[50,42],[43,54],[21,54]], B); rect(30, 18, 4, 24, S); polygon([[34,20],[34,39],[51,39]], H); polygon([[30,24],[30,39],[17,39]], A);
    line(10, 57, 54, 57, shades.secondaryHighlight, 2);
  } else if (form === 'vehicle') {
    rect(13, 36, 38, 11, P); polygon([[22,36],[29,25],[45,25],[52,36]], B); rect(25, 28, 8, 7, H); rect(36, 28, 8, 7, H);
    ellipse(22, 49, 6, 6, shades.outline); ellipse(43, 49, 6, 6, shades.outline); pixel(22, 49, H); pixel(43, 49, H);
  } else if (form === 'mushroom') {
    ellipse(32, 27, 21, 13, A); ellipse(32, 31, 20, 9, A); rect(25, 34, 14, 17, H); ellipse(32, 51, 12, 4, B);
    ellipse(23, 24, 4, 3, '#ffffff'); ellipse(39, 21, 3, 2, '#ffffff'); line(18, 39, 46, 39, S);
  } else if (form === 'hourglass') {
    rect(16, 10, 32, 5, B); rect(16, 50, 32, 5, B); polygon([[20,16],[44,16],[34,32],[44,50],[20,50],[30,32]], P);
    polygon([[26,43],[38,43],[34,36],[30,36]], A); line(24, 20, 39, 20, H, 2);
  } else if (form === 'lightning') {
    polygon([[36,5],[16,37],[29,37],[24,59],[50,25],[36,25]], A); polygon([[36,10],[24,34],[30,34],[27,48],[43,25],[35,25]], shades.accentHighlight);
  } else if (form === 'sun') {
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; line(32 + Math.cos(a) * 15, 32 + Math.sin(a) * 15, 32 + Math.cos(a) * 23, 32 + Math.sin(a) * 23, A, 2); }
    ellipse(32, 32, 14, 14, A); ellipse(27, 27, 6, 5, shades.accentHighlight); pixel(28, 31, shades.outline); pixel(37, 31, shades.outline);
  } else if (form === 'moon') {
    ellipse(35, 31, 18, 20, A); polygon([[24,15],[39,11],[49,24],[45,43],[29,50],[18,36]], A); ellipse(28, 24, 4, 3, shades.accentHighlight); pixel(51, 14, H); pixel(15, 18, H);
  } else if (form === 'planet') {
    ellipse(32, 32, 17, 17, P); ellipse(26, 25, 7, 5, H); line(13, 41, 52, 27, A, 3); line(12, 45, 53, 31, B, 2); pixel(48, 15, shades.accentHighlight); pixel(16, 14, H);
  } else if (form === 'cup') {
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
  } else if (form === 'curio') {
    ellipse(32, 32, 19, 19, P); ellipse(25, 24, 8, 6, H); polygon([[32,16],[38,29],[51,32],[38,36],[32,49],[26,36],[13,32],[26,29]], B); ellipse(32, 32, 6, 6, A); pixel(24, 22, '#ffffff');
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

  // Visible details are grounded in inherited material traits, not a random species seed.
  const inherited = (oddkin.inheritedMaterialTraits || []).join(' ').toLowerCase();
  if (inherited.includes('faceted translucent')) {
    for (const x of [cx, cx + 4]) {
      setPixel(x, cy - 3, shades.accentHighlight);
      setPixel(x - 1, cy - 2, shades.secondary);
      setPixel(x + 1, cy - 2, '#ffffff');
      setPixel(x, cy - 1, shades.accent);
    }
  }
  if (inherited.includes('leaflike frills')) {
    for (let i = 0; i < 4; i++) {
      setPixel(cx + 7 + i, cy - 3 - i, shades.secondaryHighlight);
      setPixel(cx + 7 + i, cy - 2 - i, shades.secondary);
    }
  }
  if (inherited.includes('metal armor') || inherited.includes('mineral ridges')) {
    for (let x = cx - 1; x <= cx + 5; x++) {
      setPixel(x, cy + 2, shades.secondary);
      setPixel(x, cy + 4, shades.highlight);
    }
  }
  if (inherited.includes('luminous veins')) {
    for (let i = 0; i < 5; i++) {
      setPixel(cx + i % 2, cy + i - 2, shades.accentHighlight);
      if (i % 2 === 0) setPixel(cx + 2, cy + i - 3, shades.accent);
    }
  }
  if (inherited.includes('crescent markings')) {
    for (const [dx, dy] of [[4, -5], [3, -4], [3, -3], [4, -2], [5, -2]]) setPixel(cx + dx, cy + dy, '#ede9fe');
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
