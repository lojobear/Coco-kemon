import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import express from 'express';
import { spriteVariantKey, spriteProfileKey } from '../src/lib/spriteVariant';
import { CraftSprite } from '../src/components/CraftSprite';
import { buildSpritePrompt, registerEmojiRoute } from '../server/emoji';

test('normal and shiny have different image and profile identities', () => {
  assert.equal(spriteVariantKey(' Blue  Crystal '), 'blue crystal');
  assert.equal(spriteVariantKey(' Blue  Crystal ', true), 'shiny:blue crystal');
  assert.notEqual(spriteProfileKey('Cloud', false), spriteProfileKey('Cloud', true));
});

test('shiny artwork is visibly recolored even before the model supplies dedicated art', () => {
  const ordinary = renderToStaticMarkup(React.createElement(CraftSprite, { name: 'Cloud', emoji: '☁️' }));
  const shiny = renderToStaticMarkup(React.createElement(CraftSprite, { name: 'Cloud', emoji: '☁️', isShiny: true }));
  assert.doesNotMatch(ordinary, /boop-shiny-sprite/);
  assert.match(shiny, /boop-shiny-sprite/);
  const css = readFileSync(new URL('../src/boop.css', import.meta.url), 'utf8');
  assert.match(css, /\.boop-shiny-sprite:not\(\.boop-shiny-authored\) img\s*\{\s*filter:sepia/);
});

test('AI shiny prompt changes its actual pigments while keeping the same item identity', () => {
  const standard = buildSpritePrompt('cloud');
  const shiny = buildSpritePrompt('cloud', '', true);
  assert.doesNotMatch(standard, /SHINY \/ ALTERNATE COLORWAY/);
  assert.match(shiny, /SHINY \/ ALTERNATE COLORWAY/);
  assert.match(shiny, /Change the primary and secondary pigment colors substantially/);
  assert.match(shiny, /not a different subject/);
});

test('image route keeps shiny and normal in distinct provider cache entries', async () => {
  const app = express();
  app.use(express.json());
  let calls = 0;
  const prompts: string[] = [];
  registerEmojiRoute(app, async prompt => {
    calls++;
    prompts.push(prompt);
    return { data: 'A'.repeat(512), mimeType: 'image/png', model: 'test-provider' };
  });
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
    const send = async (shiny: boolean) => {
      const r = await fetch(base + '/api/element-emoji', {
        method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({ name:'Aurora Mushroom Test Variant', shiny }),
      });
      assert.equal(r.status, 200);
      return r.json() as Promise<{ shiny: boolean; imageBase64:string }>;
    };
    assert.equal((await send(false)).shiny, false);
    assert.equal((await send(true)).shiny, true);
    assert.equal((await send(true)).shiny, true);
    assert.equal(calls, 2, 'one cache entry per colorway, no repeat credit spend');
    assert.doesNotMatch(prompts[0], /SHINY \/ ALTERNATE COLORWAY/);
    assert.match(prompts[1], /SHINY \/ ALTERNATE COLORWAY/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
