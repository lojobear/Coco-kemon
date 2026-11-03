import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpriteImage } from '../src/components/SpriteImage';
import { BottomNav } from '../src/components/BottomNav';
import { DiscoveryCard } from '../src/components/DiscoveryCard';

test('unavailable sprite displays an accessible placeholder while a valid sprite is rendered', () => {
  const missing = renderToStaticMarkup(React.createElement(SpriteImage, { alt: 'Rocket' }));
  assert.match(missing, /Rocket: artwork unavailable/);
  assert.match(missing, /boop-placeholder-shape/);
  assert.doesNotMatch(missing, /◌/);
  const available = renderToStaticMarkup(React.createElement(SpriteImage, { alt:'Rocket', src:'data:image/png;base64,AAA=' }));
  assert.match(available, /<img/);
  assert.doesNotMatch(available, /boop-placeholder-shape/);
});

test('navigation exposes the selected tab and cards prioritize selection status', () => {
  const nav = renderToStaticMarkup(React.createElement(BottomNav, { activeTab:'archive', setActiveTab:()=>{}, onOpenProfile:()=>{} }));
  assert.equal((nav.match(/aria-current="page"/g) || []).length, 1);
  const card = renderToStaticMarkup(React.createElement(DiscoveryCard, {name:'Moon',emoji:'🌙',detail:'Shiny',selected:true,isShiny:true,onSelect:()=>{},onInspect:()=>{}}));
  assert.match(card, /aria-pressed="true"/);
  assert.match(card, />Selected</);
  assert.doesNotMatch(card, />Shiny</);
});
