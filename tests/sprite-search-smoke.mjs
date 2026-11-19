import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
const items=[...Array.from({length:120},(_,i)=>({id:`search-item-${i}`,name:`Element ${String(i).padStart(3,'0')}`,emoji:'✨',discoveredAt:1700000000000+i})),{id:'coffee',name:'Coffee',emoji:'☕',discoveredAt:1700000001000},{id:'cactus',name:'Cactus',emoji:'🌵',discoveredAt:1700000001001}];
try{for(const width of [320,412,1440]){
 const page=await browser.newPage({viewport:{width,height:915},hasTouch:width<700});const errors=[];page.on('pageerror',e=>errors.push(e.message));let artworkRequests=0;
 await page.addInitScript(items=>localStorage.setItem('coco_kemon_save_v2',JSON.stringify({version:3,savedAt:1,foundry:{materials:[],oddkinCollection:[],processes:[],experiments:[],habitats:[]},crafting:items,economy:{version:1,coins:0,sold:{}}})),items);
 await page.route('**/api/element-emoji',async route=>{artworkRequests++;await route.abort();});
 await page.goto(process.env.BOOP_BASE_URL||'http://127.0.0.1:3000',{waitUntil:'networkidle'});
 const nav=page.getByRole('navigation',{name:'Main navigation'});await nav.getByRole('button',{name:'Sprites',exact:true}).click();const search=page.getByRole('textbox',{name:'Search sprites',exact:true});await search.waitFor();
 for(const query of ['no-such-discovery-9831','☃ unmatched','   nowhere matches   ']){
  await search.fill(query);await page.getByRole('heading',{name:'No matching sprite',exact:true}).waitFor();
  await page.evaluate(()=>{window.dispatchEvent(new CustomEvent('oddkin-emoji-retry',{detail:'water'}));window.dispatchEvent(new Event('quarkpop-profile-sprites-updated'));});
  assert.ok(await search.isVisible());await search.fill('Coffee');await page.locator('.boop-sprite-identity h2').filter({hasText:/^Coffee$/}).waitFor();
 }
 await search.fill('');await search.pressSequentially('Coffee',{delay:15});await page.locator('.boop-sprite-identity h2').filter({hasText:/^Coffee$/}).waitFor();
 await page.locator('[aria-label="Sprite category"]').getByRole('button',{name:'Oddkin',exact:true}).click();await page.getByRole('heading',{name:'No matching sprite',exact:true}).waitFor();
 await page.evaluate(()=>{window.dispatchEvent(new CustomEvent('oddkin-emoji-retry',{detail:'coffee'}));window.dispatchEvent(new Event('quarkpop-profile-sprites-updated'));});
 await page.locator('[aria-label="Sprite category"]').getByRole('button',{name:'All',exact:true}).click();await page.locator('.boop-sprite-identity h2').filter({hasText:/^Coffee$/}).waitFor();await search.fill('Element 119');assert.equal(await page.locator('.boop-sprite-card').count(),1);assert.match(await page.locator('.boop-sprite-card').innerText(),/Element 119/);
 await search.fill('no-match-again');await nav.getByRole('button',{name:'Craft',exact:true}).click();await page.getByRole('heading',{name:'Craft',exact:true}).waitFor();await nav.getByRole('button',{name:'Sprites',exact:true}).click();await search.waitFor();await search.fill('Cactus');await page.locator('.boop-sprite-identity h2').filter({hasText:/^Cactus$/}).waitFor();
 const saved=await page.evaluate(()=>new Promise((resolve,reject)=>{const opening=indexedDB.open('boop-game-progress',1);opening.onsuccess=()=>{const request=opening.result.transaction('saves').objectStore('saves').get('current');request.onsuccess=()=>{opening.result.close();resolve(request.result.envelope.crafting.map(e=>e.name));};request.onerror=()=>reject(request.error);};opening.onerror=()=>reject(opening.error);}));assert.ok(items.every(item=>saved.includes(item.name)),'searching must preserve every saved discovery');assert.equal(artworkRequests,0);assert.deepEqual(errors,[]);
 console.log(`${width}px: 122-element search, zero-match typing, clear/recovery, empty category, background sprite events and page switching passed without crashes or artwork generation`);await page.close();
}}finally{await browser.close();}
