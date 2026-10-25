import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chooseRandomProcess } from '../src/lib/randomProcess';
import { ALL_PROCESSES } from '../src/lib/starterData';
import { CraftSprite, CraftSprites } from '../src/components/CraftSprite';
import { conceptMaterial } from '../src/lib/conceptMaterial';
import { MATERIAL_SPRITE_RENDERER_VERSION, spriteDescriptorForConcept } from '../src/lib/pixelRenderer';

test('random processes exclude locked and current choices, with empty and single-choice fallbacks', () => {
  const [first, second, third] = ALL_PROCESSES;
  const processes = [{ ...first, unlocked: true }, { ...second, unlocked: true }, { ...third, unlocked: false }];
  assert.equal(chooseRandomProcess(processes, first.id, () => 0)?.id, second.id);
  assert.equal(chooseRandomProcess(processes, first.id, () => 0.999)?.id, second.id);
  assert.equal(chooseRandomProcess([processes[0]], first.id)?.id, first.id);
  assert.equal(chooseRandomProcess([processes[2]]), null);
  assert.equal(chooseRandomProcess([]), null);
});

test('craft visual resolves custom art by name while default discoveries keep their emoji', () => {
  const markup = renderToStaticMarkup(React.createElement(CraftSprites.Provider, {
    value: new Map([['water', 'data:image/png;base64,iVBORw0KGgo=']]),
    children: React.createElement(CraftSprite, { name: 'Water', emoji: '💧' }),
  }));
  assert.match(markup, /<img/);
  assert.match(markup, /data:image\/png;base64/);
  assert.match(renderToStaticMarkup(React.createElement(CraftSprite, { name: 'Water', emoji: '💧' })), /💧/);
});


test('existing elements get recognizable sprite descriptors and the renderer version is bumped', () => {
  assert.equal(MATERIAL_SPRITE_RENDERER_VERSION, 3);
  assert.equal(spriteDescriptorForConcept('Ocean').baseShape, 'droplet');
  assert.equal(spriteDescriptorForConcept('Volcano').baseShape, 'sparks');
  assert.equal(spriteDescriptorForConcept('Forest').baseShape, 'flora');
  assert.equal(spriteDescriptorForConcept('Robot').baseShape, 'ingot');
  assert.equal(conceptMaterial({ result: 'Fish', emoji: '🐟', connection: 'biology' }).semanticTags.includes('biology'), true);
});

