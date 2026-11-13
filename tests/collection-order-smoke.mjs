import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
const items=Array.from({length:90},(_,i)=>({id:`item-${i}`,name:`${['Fox','Robot','Pizza'][i%3]} ${String(i).padStart(2,'0')}`,emoji:'✨',category:['Animals','Technology','Food & Drink'][i%3],discoveredAt:1700000000000+i,craftCount:90-i}));
items.push({id:'biochar',name:'Biochar',emoji:'⬛',category:'Animals',discoveredAt:1700000000099,craftCount:1});
items.push({id:'cat-food',name:'Cat Food',emoji:'🥣',category:'Animals',discoveredAt:1700000000100,craftCount:1});
items.push({id:'fire-truck',name:'Fire Truck',emoji:'🚒',category:'Elements & Energy',discoveredAt:1700000000101,craftCount:2});
const expected=[...items].sort((a,b)=>b.discoveredAt-a.discoveredAt).map(item=>item.name);
try{
 for(const width of [412,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(items=>{localStorage.setItem('coco_kemon_save_v2',JSON.stringify({version:3,savedAt:1,foundry:{materials:[],oddkinCollection:[],processes:[],experiments:[],habitats:[]},crafting:items,economy:{version:1,coins:0,sold:{}}}));},items);
  await page.goto(process.env.BOOP_BASE_URL||'http://127.0.0.1:3000',{waitUntil:'networkidle'});
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Collection',exact:true}).click();
  const cards=page.locator('.boop-sticker-card');const names=()=>cards.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label').replace('Inspect collectible ','')));
  await cards.first().waitFor();assert.deepEqual(await names(),expected.slice(0,72));
  await page.getByRole('button',{name:'Show more stickers',exact:false}).click();assert.deepEqual((await names()).filter(name=>expected.includes(name)),expected);
  await page.locator('.boop-album-refine > summary').click();const sort=page.getByRole('combobox',{name:'Sort collectibles'});const category=page.getByRole('combobox',{name:'Collection category'});
  await sort.selectOption('az');const az=await names();assert.deepEqual(az,[...az].sort((a,b)=>a.localeCompare(b)));assert.ok(az.indexOf('Biochar')<az.indexOf('Cat Food'));
  await sort.selectOption('crafted');assert.deepEqual(await names(),[...items].sort((a,b)=>b.craftCount-a.craftCount).slice(0,72).map(item=>item.name));
  await sort.selectOption('category');assert.ok(await page.getByRole('region',{name:'Animals',exact:true}).isVisible());
  await category.selectOption('Food & Drink');await sort.selectOption('recent');assert.equal((await names())[0],'Cat Food');assert.ok(!(await names()).some(name=>name.startsWith('Fox')));
  await category.selectOption('Vehicles');assert.deepEqual(await names(),['Fire Truck']);
  await category.selectOption('Materials & Minerals');assert.ok((await names()).includes('Biochar'));
  await category.selectOption('Animals');assert.ok(!(await names()).includes('Biochar'));
  const saved=await page.evaluate(()=>new Promise((resolve,reject)=>{const opening=indexedDB.open('boop-game-progress',1);opening.onsuccess=()=>{const request=opening.result.transaction('saves').objectStore('saves').get('current');request.onsuccess=()=>{opening.result.close();resolve(request.result.envelope.crafting);};request.onerror=()=>reject(request.error);};opening.onerror=()=>reject(opening.error);}));assert.equal(saved.find(item=>item.name==='Cat Food').category,'Animals','display correction must not rewrite saved categories or pricing inputs');
  assert.deepEqual(errors,[]);console.log(`${width}px: global newest/A–Z/most-crafted, pagination, explicit category grouping, filtered newest and corrected display categories passed`);await page.close();
 }
}finally{await browser.close();}
