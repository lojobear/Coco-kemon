import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const output=process.env.BOOP_AUDIT_OUTPUT||'/tmp/boop-procedures';await mkdir(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
try {
 for(const width of [320,412,1440]) {
  const page=await browser.newPage({viewport:{width,height:width===1440?900:867},hasTouch:width<700,isMobile:width<700});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.BOOP_BASE_URL||'http://127.0.0.1:3101',{waitUntil:'networkidle'});
  const random=page.getByRole('button',{name:/^Spawn 2 random elements/});await random.waitFor();
  assert.ok(await random.isVisible());assert.equal(await page.locator('.boop-board-more').getAttribute('open'),null);
  const rect=await random.boundingBox();assert.ok(rect.y+rect.height<867,'Random should be visible without scrolling');
  const before=await page.locator('.boop-board-item').count();await random.click();await page.waitForFunction(n=>document.querySelectorAll('.boop-board-item').length===n+2,before);
  await page.getByRole('button',{name:'Undo last board action',exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('.boop-board-item').length===n,before);
  const procedures=page.getByRole('region',{name:'Foundry procedures',exact:true});
  await page.getByRole('button',{name:'Select Water to combine',exact:true}).click();
  await procedures.getByRole('button',{name:'Melt',exact:true}).click();
  const workspace=page.getByRole('region',{name:'Foundry workspace'});await workspace.waitFor();
  assert.equal(await workspace.getByLabel('Process',{exact:false}).count()>0,true);
  assert.equal(await page.locator('#foundry-process').inputValue(),'MELT');
  assert.match(await page.getByRole('button',{name:/^Choose item A:/}).getAttribute('aria-label'),/Water/);
  assert.equal(await page.getByRole('button',{name:'Choose item B',exact:true}).count(),1);
  assert.ok(await page.getByRole('button',{name:'Apply process',exact:true}).isEnabled());
  const options=await page.locator('#foundry-process option').evaluateAll(es=>es.map(e=>({value:e.value,text:e.textContent})));
  assert.ok(options.length>=50);assert.equal(new Set(options.map(o=>o.value)).size,options.length);
  await page.getByRole('textbox',{name:'Find a Foundry process'}).fill('boil');assert.ok(await page.locator('#foundry-process option[value="BOIL"]').count());
  await workspace.getByRole('button',{name:'Craft',exact:true}).click();
  await page.getByRole('button',{name:'Select Fire to combine',exact:true}).click();
  await procedures.getByRole('button',{name:'Mix',exact:true}).click();await workspace.waitFor();
  assert.equal(await page.locator('#foundry-process').inputValue(),'MIX');assert.ok(await page.getByRole('button',{name:'Craft discovery',exact:true}).isEnabled());
  await workspace.getByRole('button',{name:'Craft',exact:true}).click();
  for(const label of ['Heat','Freeze','Crush']){await procedures.getByRole('button',{name:label,exact:true}).click();await workspace.waitFor();assert.equal(await page.locator('#foundry-process').inputValue(),label.toUpperCase());await workspace.getByRole('button',{name:'Craft',exact:true}).click();}
  await page.locator('.boop-board-more > summary').click();await page.getByRole('button',{name:'Select 5 elements per spawn'}).click();await page.locator('.boop-board-more > summary').click();
  const count=await page.locator('.boop-board-item').count();await page.getByRole('button',{name:/^Spawn 5 random elements/}).click();await page.waitForFunction(n=>document.querySelectorAll('.boop-board-item').length===n+5,count);
  const dimensions=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));assert.ok(dimensions.s<=dimensions.w+1);
  assert.deepEqual(errors,[]);await page.screenshot({path:`${output}/procedures-${width}.png`});console.log(`${width}px: visible Random, count settings, undo, selected ingredients, one-item Melt, Mix, Heat/Freeze/Crush and ${options.length} searchable procedures passed`);await page.close();
 }
}finally{await browser.close();}
