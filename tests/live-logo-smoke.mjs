import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
const output=process.env.BOOP_AUDIT_OUTPUT||'/tmp/boop-live-logo';await mkdir(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
try{for(const width of [320,412,1440]){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:width===320?'reduce':'no-preference'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d');ctx.fillStyle='#2266cc';ctx.fillRect(2,2,28,28);const art=canvas.toDataURL('image/png');ctx.fillStyle='#cc3344';ctx.fillRect(2,2,28,28);const art2=canvas.toDataURL('image/png');localStorage.setItem('coco_kemon_save_v2',JSON.stringify({version:3,savedAt:1,foundry:{materials:[],oddkinCollection:[],processes:[],experiments:[],habitats:[]},crafting:[{id:'tea',name:'Tea',emoji:'🍵',customSpriteUrl:art,discoveredAt:Date.now()},{id:'cat',name:'Cat',emoji:'🐈',customSpriteUrl:art2,discoveredAt:Date.now()}],economy:{version:1,coins:0,sold:{}}}));});
 await page.clock.install();
 await page.goto(process.env.BOOP_BASE_URL||'http://127.0.0.1:3000',{waitUntil:'networkidle'});
 const logo=page.locator('.boop-live-logo-button');await logo.waitFor();const name=()=>logo.getAttribute('aria-label');await page.waitForFunction(()=>/Logo sprite: (Tea|Cat)\./.test(document.querySelector('.boop-live-logo-button')?.getAttribute('aria-label')||''),null,{polling:100});const first=await name();assert.match(first,/Logo sprite: (Tea|Cat)\. Show name/);
 assert.equal(await logo.locator('.boop-sprite-placeholder,.boop-preview-cue').count(),0);assert.ok(await logo.locator('img').last().evaluate(img=>img.complete&&img.naturalWidth>0));
 const size=await logo.boundingBox();assert.ok(size.width>=44&&size.height>=44);
 await page.clock.fastForward(30000);await page.clock.runFor(500);assert.notEqual(await name(),first,'rotate after 30 seconds');
 await logo.click();const revealed=await page.getByRole('status').filter({hasText:/^(Tea|Cat)$/}).innerText();assert.ok((await name()).includes(revealed));
 const held=await name();await page.clock.fastForward(30000);assert.equal(await name(),held,'hold while the name is visible');await page.keyboard.press('Escape');assert.equal(await logo.getAttribute('aria-expanded'),'false');
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));await page.clock.fastForward(30000);assert.equal(await name(),held,'pause in a hidden tab');
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}));await page.clock.fastForward(30000);await page.clock.runFor(500);assert.notEqual(await name(),held);
 await page.clock.runFor(500);if(width===320)assert.equal(await page.locator('.boop-live-logo-art').evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.screenshot({path:`${output}/logo-${width}.png`});
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Profile',exact:true}).click();await page.getByRole('button',{name:'Boop home',exact:true}).click();assert.ok(await page.getByRole('heading',{name:'Craft',exact:true}).isVisible());
 if(width===1440){
  await page.getByRole('button',{name:'Settings and tools',exact:true}).click();
  const backup={version:3,savedAt:Date.now(),foundry:{materials:[],oddkinCollection:[],processes:[],experiments:[],habitats:[]},crafting:[],economy:{version:1,coins:0,sold:{}}};
  await page.locator('.boop-settings-dialog input[type=file]').setInputFiles({name:'empty-logo-save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await page.clock.resume();
  await page.waitForFunction(()=>document.querySelector('.boop-live-logo-button')?.getAttribute('aria-label')==='Logo sprite: Boop. Show name',null,{polling:100,timeout:10000});
 }
 if(width===412){
  await page.evaluate(()=>{
   window.logoHold=false;window.logoFail=false;window.logoPending=[];
   const Original=window.Image;const descriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
   window.Image=new Proxy(Original,{construct(target,args){const image=Reflect.construct(target,args);Object.defineProperty(image,'src',{get(){return descriptor.get.call(image);},set(value){const load=()=>descriptor.set.call(image,window.logoFail?'data:image/png;base64,broken':value);if(window.logoHold)window.logoPending.push(load);else load();}});return image;}});
   window.logoHold=true;
  });
  const stable=await name();const oldSource=await logo.locator('img').last().getAttribute('src');
  // Navigation may leave an earlier decode in flight. Let its completion settle
  // before expecting the next interval to start a held preload.
  for(let attempt=0;attempt<3&&!await page.evaluate(()=>window.logoPending.length);attempt++){
   await page.clock.fastForward(30000);await page.clock.runFor(500);
  }
  assert.equal(await name(),stable);assert.equal(await logo.locator('img').last().getAttribute('src'),oldSource);
  assert.ok(await page.evaluate(()=>window.logoPending.length>0));assert.equal(await logo.locator('.boop-sprite-placeholder').count(),0);
  await page.evaluate(()=>{window.logoHold=false;window.logoPending.splice(0).forEach(load=>load());});await page.clock.runFor(700);assert.notEqual(await name(),stable);
  const loaded=await name();await page.evaluate(()=>window.logoFail=true);await page.clock.fastForward(30000);await page.clock.runFor(700);
  assert.equal(await name(),loaded);assert.ok(await logo.locator('img').last().evaluate(image=>image.complete&&image.naturalWidth>0));assert.equal(await logo.locator('.boop-sprite-placeholder').count(),0);
  await page.evaluate(()=>window.logoFail=false);
 }
 const dims=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));assert.ok(dims.s<=dims.w+1);assert.deepEqual(errors,[]);
 console.log(`${width}px: owned sprites, 30-second rotation, touch target, tap name, hidden-tab/name pause, reduced motion and home navigation passed`);await page.close();
 }
 const empty=await browser.newPage();await empty.goto(process.env.BOOP_BASE_URL||'http://127.0.0.1:3000',{waitUntil:'networkidle'});assert.equal(await empty.locator('.boop-live-logo-button img').getAttribute('src'),'/toybox/boop-planet.png');await empty.close();
 console.log('New collections keep the original Boop planet logo');
}finally{await browser.close();}
