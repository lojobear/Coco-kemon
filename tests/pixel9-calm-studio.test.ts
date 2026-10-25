import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateFreshPixelArt, pixelArtFormFor } from '../src/lib/freshPixelArt';
const file=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('offline original pixel icons replace generic visuals in Craft and Combine',()=>{
  const named: Array<[string,string]> = [
    ['Turkish Coffee','turkishcoffee'],['Toaster Strudel','strudel'],
    ['Lime-Ginger Infusion','gingerinfusion'],['Cheesy Steak Casserole','casserole'],
    ['Aurora Borealis','aurora'],['Kraken','kraken'],
    ['Bubble Tea','bubbletea'],['Hologram','hologram'],
  ];
  const result=new Set<string>();
  for (const [name,form] of named) {
    assert.equal(pixelArtFormFor(name),form,`A specific, newly drawn icon is needed for ${name}`);
    const data=generateFreshPixelArt(name);
    assert.ok(data.startsWith('data:image/svg+xml;charset=utf-8,'));
    assert.match(decodeURIComponent(data), /shape-rendering="crispEdges"/);
    assert.match(decodeURIComponent(data), /<rect/);
    result.add(data);
  }
  assert.equal(result.size,named.length,'Each distinct object must have distinct actual pixel artwork');
  assert.notEqual(generateFreshPixelArt('Glowing Mango Clock'),generateFreshPixelArt('Banana Dust Automaton'));
});

test('the actual screen components use pixel sprites before AI art is available',()=>{
  const src=file('src/components/ElementSprite.tsx');
  const craft=file('src/components/InfiniteCraftView.tsx');
  const combine=file('src/components/WorkBench.tsx');
  assert.match(src,/generateFreshPixelArt\(name\)/);
  assert.match(src,/SpriteImage/);
  assert.match(craft,/<CraftSprite name=\{item\.name\}/);
  assert.match(combine,/<MaterialSprite material=\{item\}/);
});

test('Pixel 9 focus mode keeps board browsing and secondary actions reachable without toolbar congestion',()=>{
  const css=file('src/boop.css');
  const board=file('src/components/InfiniteCraftView.tsx');
  assert.match(css,/@media \(max-width: 480px\)/);
  assert.match(css,/\.boop-board-toolbar--quiet \.boop-quiet-spawn,/);
  assert.match(css,/\.boop-board-toolbar--quiet \.boop-board-library-toggle,/);
  assert.match(board,/boop-mobile-craft-library/);
  assert.match(board,/boop-more-spawn-action/);
  assert.match(board,/Undo board action/);
  assert.match(board,/Redo board action/);
  assert.match(board,/setIsSidebarOpen\(true\)/);
});

test('Combine offers large touch targets and keeps optional controls in More',()=>{
  const src=file('src/components/WorkBench.tsx');
  const css=file('src/boop.css');
  const options=src.indexOf('<details className="boop-combine-settings">');
  const tools=src.indexOf('<div className="recipe-tools">');
  assert.ok(options>0 && tools>options,'Swap/clear belong in More options');
  assert.match(src,/Combine/);
  assert.match(src,/Choose ingredients/);
  assert.match(css,/min-height:106px!important/);
  assert.match(css,/min-height:50px!important/);
  assert.match(css,/overscroll-behavior:contain/);
});

test('new discovery messaging does not claim an unverified world-first record',()=>{
  const src=file('src/components/InfiniteCraftView.tsx');
  assert.doesNotMatch(src,/You are the very first crafter to unlock this combination in the global matrix/);
  assert.match(src,/Added to your collection/);
});
