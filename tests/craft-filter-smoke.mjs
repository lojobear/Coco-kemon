function craftEntryURL(value){const url=new URL(value);url.searchParams.set('view','craft');return url.href;}
import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
const output=process.env.BOOP_AUDIT_OUTPUT||'/tmp/boop-craft-filters';await mkdir(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
try{for(const width of [320,412,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('coco_kemon_save_v2',JSON.stringify({version:3,savedAt:1,foundry:{materials:[],oddkinCollection:[],processes:[],experiments:[],habitats:[]},crafting:[{id:'cat',name:'Cat',emoji:'🐈',category:'Animals',rarityTier:'rare',unlockedShiny:true,craftCount:2,discoveredAt:Date.now()}],economy:{version:1,coins:0,sold:{}}})));
 await page.goto(craftEntryURL(process.env.BOOP_BASE_URL||'http://127.0.0.1:3000'),{waitUntil:'networkidle'});
 const trigger=page.getByRole('button',{name:'Filters & tools',exact:true});const panel=page.getByRole('dialog',{name:'Filters & tools',exact:true});
 await trigger.click();assert.ok(await panel.isVisible());
 const source=page.getByLabel('Random spawn source',{exact:true}),category=page.getByLabel('Random spawn category',{exact:true}),rarity=page.getByLabel('Random spawn rarity',{exact:true});
 await source.selectOption('recent');await category.selectOption('Animals');await rarity.selectOption('rare');await page.getByRole('button',{name:'Select 5 elements per spawn',exact:true}).click();
 const bounds=await panel.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);assert.ok(bounds.y>=0&&bounds.y+bounds.height<=901);assert.ok(await page.getByRole('button',{name:'Tidy board',exact:true}).isHidden());
 await page.screenshot({path:`${output}/random-${width}.png`});
 await page.getByRole('button',{name:'Board tools',exact:true}).click();assert.ok(await page.getByRole('button',{name:'Tidy board',exact:true}).isVisible());assert.ok(await source.isHidden());
 await page.keyboard.press('Escape');assert.ok(await panel.isHidden());assert.ok(await trigger.evaluate(e=>e===document.activeElement));
 await page.getByLabel('Open procedures',{exact:true}).click();await page.getByRole('region',{name:'Board procedures'}).getByRole('button',{name:'Melt',exact:true}).click();
 const nav=page.getByRole('navigation',{name:'Main navigation'});await nav.getByRole('button',{name:'Profile',exact:true}).click();await nav.getByRole('button',{name:'Craft',exact:true}).click();
 assert.match(await page.getByLabel('Open procedures',{exact:true}).innerText(),/Melt/);
 await trigger.click();await page.getByRole('button',{name:'Random filters',exact:true}).click();
 assert.equal(await source.inputValue(),'recent');assert.equal(await category.inputValue(),'Animals');assert.equal(await rarity.inputValue(),'rare');assert.equal(await page.getByRole('button',{name:'Select 5 elements per spawn',exact:true}).getAttribute('aria-pressed'),'true');
 await page.reload({waitUntil:'networkidle'});await trigger.click();assert.equal(await category.inputValue(),'Animals');assert.equal(await source.inputValue(),'recent');assert.equal(await rarity.inputValue(),'rare');
 await rarity.selectOption('legendary');assert.equal(await category.inputValue(),'Animals','an empty pool must not silently reset a chosen category');assert.match(await panel.innerText(),/0 eligible discoveries/);
 await page.getByRole('button',{name:'Reset random filters',exact:true}).click();assert.equal(await source.inputValue(),'all');assert.equal(await category.inputValue(),'all');assert.equal(await rarity.inputValue(),'all');assert.equal(await page.getByRole('button',{name:'Select 2 elements per spawn',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Close filters and tools',exact:true}).click();
 if(width===412){
  await page.getByRole('button',{name:'Open element library',exact:true}).click();
  const library=page.getByRole('complementary',{name:'Your element library'});
  await library.getByRole('button',{name:'Shiny',exact:true}).click();await page.getByLabel('Sort ingredients',{exact:true}).selectOption('alpha');
  await page.getByRole('button',{name:'Close ingredients',exact:true}).click();
  await page.route('**/*CollectionAlbum*',async route=>{await new Promise(resolve=>setTimeout(resolve,350));await route.continue();});
  await nav.getByRole('button',{name:'Collection',exact:true}).click();await nav.getByRole('button',{name:'Craft',exact:true}).click();
  await page.getByRole('button',{name:'Open element library',exact:true}).click();
  assert.equal(await page.getByLabel('Sort ingredients',{exact:true}).inputValue(),'alpha');assert.equal(await library.getByRole('button',{name:'Shiny',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Close ingredients',exact:true}).click();
 }
 await trigger.click();await page.evaluate(()=>window.dispatchEvent(new Event('boop-native-back')));assert.ok(await panel.isHidden());assert.deepEqual(errors,[]);
 console.log(`${width}px: organized sections, modal bounds, Escape/focus, cross-page and reload persistence, empty category retention and reset passed`);await page.close();
}}finally{await browser.close();}
