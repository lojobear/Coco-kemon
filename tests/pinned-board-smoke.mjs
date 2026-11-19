import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
try{for(const width of [320,412,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.BOOP_BASE_URL||'http://127.0.0.1:3000',{waitUntil:'networkidle'});
 const water=page.getByRole('button',{name:'Select Water to combine',exact:true});await water.click();await page.getByRole('button',{name:'Pin Water',exact:true}).click();
 const tile=page.locator('.boop-board-item.is-pinned');const position=()=>tile.evaluate(e=>e.style.transform);const anchored=await position();
 const from=await water.boundingBox();await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(from.x+70,from.y+120,{steps:8});await page.mouse.up();assert.equal(await position(),anchored);
 await page.getByRole('button',{name:'Clear unpinned elements',exact:true}).click();assert.equal(await page.locator('.boop-board-item').count(),1);
 for(const slot of ['first','second']){
  await page.getByRole('button',{name:`Choose ${slot} element`,exact:true}).click();const library=page.getByRole('complementary',{name:'Your element library'});
  await library.getByRole('textbox',{name:'Search ingredients'}).fill(slot==='first'?'Water':'Fire');await library.locator('.boop-board-library-item > button:first-child').first().click();
 }
 if(width===412){
 await page.getByRole('button',{name:'Filters & tools',exact:true}).click();await page.getByRole('button',{name:'Board tools',exact:true}).click();await page.getByRole('button',{name:'Tidy board',exact:true}).click();await page.getByRole('button',{name:'Close filters and tools',exact:true}).click();await page.getByRole('status').filter({hasText:'Saving device progress…'}).waitFor({state:'hidden'});
 const fire=await page.getByRole('button',{name:'Select Fire to combine',exact:true}).boundingBox();const target=await water.boundingBox();await page.mouse.move(fire.x+fire.width/2,fire.y+fire.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:12});await page.mouse.up();}else await page.getByRole('button',{name:'Combine Water + Fire',exact:true}).click();await page.locator('.boop-board-result strong').filter({hasText:'Steam'}).waitFor();assert.equal(await page.locator('.boop-board-item').count(),2);assert.equal(await position(),anchored);
 await page.getByRole('button',{name:'Dismiss result',exact:true}).click();
 if(width===412){
  await page.route('**/api/synthesize',async route=>{const body=route.request().postDataJSON();assert.equal(body.process.id,'MELT');assert.equal(body.inputMaterialA.displayName,'Water');assert.equal(body.inputMaterialB,undefined);await route.fulfill({json:{status:'new_material',material:{...body.inputMaterialA,id:'pinned-melt-test',canonicalName:'MOLTEN WATER',displayName:'Molten Water',discoveredAt:Date.now(),lineage:{parentIds:[body.inputMaterialA.id],processId:'MELT',depth:2,generation:2}},explanation:'Melt transforms the reusable pinned input.'}});});
  await water.click();await page.getByLabel('Open procedures',{exact:true}).click();await page.getByRole('region',{name:'Board procedures'}).getByRole('button',{name:'Melt',exact:true}).click();await page.getByRole('button',{name:'Apply Melt',exact:true}).click();await page.getByRole('button',{name:'Select Molten Water to combine',exact:true}).waitFor();assert.equal(await position(),anchored);await page.getByRole('button',{name:'Dismiss result',exact:true}).click();
  await page.screenshot({path:'/tmp/boop-pinned-board.png'});
 }

 await page.getByRole('button',{name:'Filters & tools',exact:true}).click();await page.getByRole('button',{name:'Board tools',exact:true}).click();await page.getByRole('button',{name:'Tidy board',exact:true}).click();await page.getByRole('button',{name:'Close filters and tools',exact:true}).click();assert.equal(await position(),anchored);
 await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Unpin Water',exact:true}).waitFor();assert.equal(await position(),anchored);
 await page.getByLabel('Open procedures',{exact:true}).click();await page.getByRole('button',{name:'All 500 procedures →',exact:true}).click();const picker=page.getByRole('dialog',{name:'Choose a procedure'});assert.equal(await picker.getByRole('status').innerText(),'500 procedures');await picker.getByRole('textbox',{name:'Search procedures'}).fill('Mycelium Bind');assert.equal(await picker.getByRole('status').innerText(),'1 procedures');assert.ok(await picker.getByRole('button').filter({hasText:'Mycelium Bind'}).first().isEnabled());await page.keyboard.press('Escape');await page.getByLabel('Open procedures',{exact:true}).click();
 await page.getByRole('button',{name:'Unpin Water',exact:true}).click();await page.getByRole('button',{name:'Clear unpinned elements',exact:true}).click();assert.equal(await page.locator('.boop-board-item').count(),0);assert.deepEqual(errors,[]);
 console.log(`${width}px: pin, fixed position, Clear protection, reusable Mix input, Tidy, reload, unpin and 500-process picker passed`);await page.close();
}}finally{await browser.close();}
