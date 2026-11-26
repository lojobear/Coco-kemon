function craftEntryURL(value){const url=new URL(value);url.searchParams.set('view','craft');return url.href;}
import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
try{for(const width of [320,412,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let requests=0;
 await page.route('**/api/element-emoji',async route=>{requests++;await route.abort();});
 await page.goto(craftEntryURL(process.env.BOOP_BASE_URL||'http://127.0.0.1:3000'),{waitUntil:'networkidle'});
 const app = page.locator('#boop-app');
 assert.equal(await app.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)');
 await page.getByRole('button', { name: 'Settings and tools' }).click();
 const appearance = page.getByLabel('Appearance', { exact: true });
 assert.equal(await appearance.inputValue(), 'light');
 await appearance.selectOption('dark');
 assert.equal(await app.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(21, 23, 27)');
 await page.reload();
 await page.getByRole('button', { name: 'Settings and tools' }).click();
 assert.equal(await appearance.inputValue(), 'dark');
 await appearance.selectOption('light');
 await page.getByRole('button', { name: 'Close settings' }).click();
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Sprites',exact:true}).click();
 const style=page.getByLabel('Change art style',{exact:true});await style.waitFor();assert.equal(await style.inputValue(),'classic');assert.equal(await style.locator('option:checked').innerText(),'Classic Boop');
 await style.selectOption('boop');assert.equal(await style.inputValue(),'boop');await style.selectOption('classic');assert.equal(requests,0,'opening the style menu must not generate artwork');assert.deepEqual(errors,[]);
 console.log(`${width}px: Classic Boop defaults, Boop Starter Pixel remains selectable and no artwork generation is triggered`);await page.close();
}}finally{await browser.close();}
