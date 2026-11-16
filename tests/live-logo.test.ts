import test from 'node:test';import assert from 'node:assert/strict';
import {logoDiscoveries,nextLogoName,LIVE_LOGO_INTERVAL_MS} from '../src/lib/liveLogo';
import type {InfiniteElement} from '../src/lib/infiniteCraftData';
test('logo uses unique earned discoveries and excludes untouched supplied inventory',()=>{
 const items:InfiniteElement[]=[{id:'water',name:'Water',emoji:'💧'}, {id:'tea',name:'Tea',emoji:'🍵',discoveredAt:1}, {id:'tea-copy',name:'TEA',emoji:'🍵'}, {id:'cat',name:'Cat',emoji:'🐈',customSpriteUrl:'/cat.png',discoveredAt:2}];
 const pool=logoDiscoveries(items);assert.deepEqual(pool.map(x=>x.name),['Tea','Cat']);assert.equal(pool[1].customSpriteUrl,'/cat.png');
 assert.equal(nextLogoName(pool,'tea',()=>0),'cat');assert.equal(nextLogoName(pool,'cat',()=>0),'tea');assert.equal(nextLogoName([pool[0]],'tea',()=>0),'tea');assert.equal(nextLogoName([],null),null);assert.equal(LIVE_LOGO_INTERVAL_MS,30000);
});
