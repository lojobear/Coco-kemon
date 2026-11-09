import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const output=process.env.BOOP_AUDIT_OUTPUT||'/tmp/boop-compact';await mkdir(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
const base=process.env.BOOP_BASE_URL||'http://127.0.0.1:3000';
const names=['Time Machine','Potion of Invisibility','Interdimensional Jellyfish','AReallyLongSingleWordThatMustStayInsideItsTileEvenWithLargerText'];
try{
 for(const width of [320,390,412]){
  for(const fontSize of [14,20]){
   const page=await browser.newPage({viewport:{width,height:width===412?867:844},deviceScaleFactor:width===412?2.625:1,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 9) BoopAndroid/2'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(({names})=>{
    const crafting=names.map((name,i)=>({id:`long-${i}`,name,emoji:'✨',craftCount:1}));
    const boardLayout=crafting.map((e,i)=>({instanceId:`tile-${i}`,name:e.name,emoji:e.emoji,x:980+i%2*156,y:700+Math.floor(i/2)*240}));
    localStorage.setItem('coco_kemon_save_v2',JSON.stringify({version:3,savedAt:1,foundry:{materials:[],oddkinCollection:[],processes:[],experiments:[],habitats:[]},crafting,economy:{version:1,coins:0,sold:{}},boardLayout}));
    localStorage.setItem('boop-craft-board-v1',JSON.stringify(boardLayout));
   },{names});
   await page.goto(`${base}/?boop_android=1&boop_web_chrome=1`,{waitUntil:'networkidle'});
   await page.getByRole('button',{name:`Select ${names[0]} to combine`,exact:true}).waitFor();
   await page.addStyleTag({content:`.boop-toybox.boop-app .boop-tile-select > span:last-child {font-size:${fontSize}px!important}`});
   const labels=await page.locator('.boop-tile-select > span:last-child').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),b=e.closest('button').getBoundingClientRect();return{text:e.textContent,scrollWidth:e.scrollWidth,width:e.clientWidth,scrollHeight:e.scrollHeight,height:e.clientHeight,left:r.left,right:r.right,top:r.top,bottom:r.bottom,button:b.toJSON()};}));
   assert.equal(labels.length,4);
   for(const l of labels){assert.ok(l.scrollWidth<=l.width+1,`${width}/${fontSize}: horizontal name clipping: ${l.text}`);assert.ok(l.scrollHeight<=l.height+1,`${width}/${fontSize}: vertical name clipping`);assert.ok(l.left>=l.button.left-1&&l.right<=l.button.right+1,`${width}/${fontSize}: name exceeds button`);assert.ok(l.top>=l.button.top-1&&l.bottom<=l.button.bottom+1,`${width}/${fontSize}: name exceeds button height`);}
   const sprite=await page.locator('.boop-board-item .craft-emoji').first().boundingBox();assert.ok(sprite.width<=52&&sprite.height<=52);
   await page.getByRole('button',{name:`Select ${names[0]} to combine`,exact:true}).tap();await page.getByRole('button',{name:`Select ${names[1]} to combine`,exact:true}).tap();
   const combine=page.getByRole('button',{name:`Combine ${names[0]} + ${names[1]}`,exact:true});assert.equal(await combine.innerText(),'Combine selected');assert.ok(await combine.isEnabled());
   assert.ok(await page.locator('.boop-tile-action').evaluateAll(es=>es.every(e=>getComputedStyle(e).opacity==='0')),'touch selection must not cover the names with sticky hover controls');
   await page.locator('.boop-board-more > summary').tap();assert.ok(await page.getByRole('button',{name:'Duplicate selected element',exact:true}).isVisible());await page.locator('.boop-board-more > summary').tap();
   assert.deepEqual(errors,[]);await page.screenshot({path:`${output}/compact-${width}-text-${fontSize}.png`});console.log(`${width}px, ${fontSize}px labels: sprites compact, full names contained, selection works`);await page.close();
  }
 }
}finally{await browser.close();}
