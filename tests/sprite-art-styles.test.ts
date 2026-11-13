import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpritePrompt } from '../server/emoji.js';
import { compactSchnellImagePrompt } from '../server/gemini.js';
import { SPRITE_ART_STYLES, isSpriteArtStyle, isPixelSpriteStyle, spriteStyleSize, readPromptArtStyle, type SpriteArtStyle } from '../src/lib/spriteArtStyles.js';
test('explicit styles keep subject and survive compact fallback', () => {
  for (const style of Object.keys(SPRITE_ART_STYLES) as SpriteArtStyle[]) {
    const prompt = buildSpritePrompt('Treasure Chest', 'style-test', false, style);
    assert.match(prompt, /Treasure Chest/);
    assert.equal(readPromptArtStyle(prompt), style);
    const compact = compactSchnellImagePrompt(prompt);
    assert.match(compact, /Treasure Chest/);
    assert.match(compact, /#FF00FF/);
    if (style !== 'classic') {
      assert.ok(compact.includes(SPRITE_ART_STYLES[style].prompt));
      assert.doesNotMatch(prompt, /BOOP v19 COMPACT ISOMETRIC/);
    }
  }
});
test('default generation stays classic and unknown styles are rejected', () => {
  assert.equal(buildSpritePrompt('Water'), buildSpritePrompt('Water', '', false, 'classic'));
  assert.equal(isSpriteArtStyle('glossy'), false);
  assert.equal(isSpriteArtStyle('porcelain'), true);
  assert.equal(Object.keys(SPRITE_ART_STYLES).length,19);
  assert.equal(isSpriteArtStyle('__proto__'), false);
  assert.equal(isSpriteArtStyle('arbitrary prompt'), false);
});

test('pixel-first menu has sixteen pixel styles and three smooth experiments',()=>{
 const styles=Object.keys(SPRITE_ART_STYLES) as SpriteArtStyle[];
 assert.equal(styles.filter(isPixelSpriteStyle).length,16);
 assert.equal(styles.filter(s=>!isPixelSpriteStyle(s)).length,3);
 assert.equal(spriteStyleSize('micro'),32);assert.equal(spriteStyleSize('gameboy'),48);assert.equal(spriteStyleSize('hd'),192);assert.equal(spriteStyleSize('glass'),512);
});
