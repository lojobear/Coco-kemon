function craftEntryURL(value){const url=new URL(value);url.searchParams.set('view','craft');return url.href;}
import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
try{for(const width of [320,412,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let requests=0;
 await page.route('**/api/element-emoji',async route=>{requests++;await route.abort();});
 await page.goto(craftEntryURL(process.env.BOOP_BASE_URL||'http://127.0.0.1:3000'),{waitUntil:'networkidle'});
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Sprites',exact:true}).click();
 const style=page.getByLabel('Change art style',{exact:true});await style.waitFor();assert.equal(await style.inputValue(),'tactics');assert.equal(await style.locator('option:checked').innerText(),'Tactical Isometric');
 await style.selectOption('classic');assert.equal(await style.inputValue(),'classic');await style.selectOption('tactics');assert.equal(requests,0,'opening the style menu must not generate artwork');assert.deepEqual(errors,[]);
 console.log(`${width}px: Tactical Isometric defaults, Classic remains selectable and no artwork generation is triggered`);await page.close();
}}finally{await browser.close();}
