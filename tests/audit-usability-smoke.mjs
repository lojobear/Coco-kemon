import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const output = process.env.BOOP_AUDIT_OUTPUT || '/tmp/boop-audit-fixes';
await mkdir(output, { recursive: true });
const b=await chromium.launch({...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),headless:true,args:['--no-sandbox']});
try {
for(const width of [320,390,412,768,1440]){
 const p=await b.newPage({viewport:{width,height:width===320?740:width===390?844:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.BOOP_BASE_URL || 'http://127.0.0.1:3000',{waitUntil:'networkidle'});await p.getByRole('button', { name: 'Select Water to combine' }).waitFor();await p.waitForTimeout(300);
 const bounds=await p.locator('.boop-board-item').evaluateAll(es=>es.map(e=>({name:e.textContent,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,bottom:e.getBoundingClientRect().bottom})));
 const viewport=await p.locator('.boop-board-viewport').boundingBox();
 assert.equal(bounds.length,4);
 assert.ok(await p.locator('.boop-board-heading small').isVisible());
 assert.ok(await p.locator('.boop-board-heading small').evaluate(e => parseFloat(getComputedStyle(e).fontSize) >= 12));
 for(const box of bounds){assert.ok(box.left>=viewport.x && box.right<=viewport.x+viewport.width,`${width}: ${JSON.stringify(box)} outside ${JSON.stringify(viewport)}`);assert.ok(box.bottom<=viewport.y+viewport.height,`tile below viewport`);}
 const targets=await p.locator('.boop-tile-action').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
 assert.ok(targets.every(t=>t.w>=44&&t.h>=44));
 await p.screenshot({path:`${output}/fixed-craft-${width}.png`});
 if(width===390){
   await p.getByRole('button',{name:'Your profile',exact:true}).click();await p.getByRole('heading',{name:'Explorer',exact:true}).waitFor();
   const profile=await p.locator('main').innerText();assert.match(profile,/0\s+Total crafts/);
   await p.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Craft',exact:true}).click();
   const water=p.getByRole('button',{name:'Select Water to combine'});await water.focus();await p.keyboard.press('Enter');assert.equal(await water.getAttribute('aria-pressed'),'true');
   await p.getByRole('button',{name:'Select Fire to combine'}).focus();await p.keyboard.press('Space');await p.locator('.boop-board-result').waitFor();await p.waitForTimeout(1100);assert.equal(await p.getByRole('button',{name:'Select Steam to combine'}).count(),1);
   await p.getByRole('button',{name:'Your profile',exact:true}).click();await p.getByRole('heading',{name:'Explorer',exact:true}).waitFor();await p.waitForTimeout(300);const after=await p.locator('main').innerText();assert.match(after,/1\s+Total crafts/);assert.match(after,/84 \/ 90 XP/);await p.screenshot({path:`${output}/fixed-profile.png`});
   await p.getByRole('button',{name:'Settings and tools'}).click();const dialog=p.getByRole('dialog',{name:'BOOP SETTINGS & DATA'});await dialog.waitFor();
   for(let i=0;i<16;i++){await p.keyboard.press('Tab');assert.ok(await p.evaluate(()=>document.activeElement===document.body || Boolean(document.activeElement.closest('dialog[open]'))),'focus reached a background control');}
   await p.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.equal(await p.getByRole('button',{name:'Settings and tools'}).evaluate(e=>e===document.activeElement),true);
   await p.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Collection',exact:true}).click();await p.getByRole('button',{name:'Inspect collectible Plant',exact:true}).waitFor();await p.waitForTimeout(200);await p.screenshot({path:`${output}/fixed-collection.png`});
   const card=await p.getByRole('button',{name:'Inspect collectible Plant',exact:true}).boundingBox();const nav=await p.getByRole('navigation',{name:'Main navigation'}).boundingBox();assert.ok(card.y+card.height<nav.y,'first sticker not fully visible');
   await p.locator('.boop-album-refine > summary').click();await p.getByRole('combobox',{name:'Collection category'}).selectOption({label:'Weather & Climate (1)'});assert.equal(await p.getByRole('button',{name:'Inspect collectible Wind',exact:true}).count(),1);assert.equal(await p.getByRole('button',{name:'Inspect collectible Plant',exact:true}).count(),0);
 }
 if(width===1440){
   const water=await p.getByRole('button',{name:'Select Water to combine'}).boundingBox();const fire=await p.getByRole('button',{name:'Select Fire to combine'}).boundingBox();
   await p.mouse.move(water.x+20,water.y+20);await p.mouse.down();await p.mouse.move(fire.x+20,fire.y+20,{steps:15});await p.mouse.up();await p.locator('.boop-board-result').waitFor({timeout:5000});
 }
 assert.deepEqual(errors,[]);console.log(width,'passed');await p.close();
}
// A real touch sequence exercises the pointer path separately from keyboard activation.
const touch = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
await touch.goto(process.env.BOOP_BASE_URL || 'http://127.0.0.1:3000', { waitUntil: 'networkidle' });
await touch.getByRole('button', { name: 'Select Water to combine' }).tap();
await touch.getByRole('button', { name: 'Select Fire to combine' }).tap();
await touch.locator('.boop-board-result').waitFor();
assert.equal(await touch.getByRole('button', { name: 'Select Steam to combine' }).count(), 1);
await touch.close();
console.log('touch crafting passed');
}finally{await b.close();}
