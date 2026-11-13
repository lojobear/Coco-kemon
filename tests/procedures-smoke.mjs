import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const output=process.env.BOOP_AUDIT_OUTPUT||'/tmp/boop-procedures';await mkdir(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
try {
 for(const width of [320,412,1440]) {
  const page=await browser.newPage({viewport:{width,height:width===1440?900:867},hasTouch:width<700,isMobile:width<700});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));let requests=0;let responseMode='success';
  await page.route('**/api/synthesize',async route=>{
    requests++;
    if(responseMode==='failure'){await route.fulfill({status:503,json:{error:'Temporarily unavailable'}});return;}
    if(responseMode==='no-reaction'){await route.fulfill({json:{status:'no_reaction',explanation:'The selected element resisted freezing.'}});return;}
    const body=route.request().postDataJSON();assert.equal(body.process.id,'MELT');assert.equal(body.inputMaterialA.displayName,'Water');assert.equal(body.inputMaterialB,undefined);
    const material={...body.inputMaterialA,id:'molten-water-test',canonicalName:'MOLTEN WATER',displayName:'Molten Water',stateOfMatter:'liquid',discoveredAt:Date.now(),lineage:{parentIds:[body.inputMaterialA.id],processId:'MELT',depth:2,generation:2},discoveryExplanation:'Melt transforms Water in this test.'};
    await route.fulfill({json:{status:'new_material',material,explanation:'Melt transforms Water in this test.'}});
  });
  await page.goto(process.env.BOOP_BASE_URL||'http://127.0.0.1:3000',{waitUntil:'networkidle'});
  const procedures=page.locator('.toybox-procedures');
  const openProcedures=async()=>{if(await page.locator('.craft-procedure-drawer').getAttribute('open')===null)await page.getByLabel('Open procedures',{exact:true}).click();};
  const selectProcedure=async(name)=>{await openProcedures();await procedures.getByRole('button',{name,exact:true}).click();};
  const more=page.locator('.boop-board-more > summary');
  await openProcedures();
  const originalCount=await page.locator('.boop-board-item').count();
  await procedures.getByRole('button',{name:'Random procedure',exact:true}).click();
  assert.doesNotMatch(await page.locator('.craft-procedure-drawer > summary').innerText(),/^Procedure: Mix /);
  assert.equal(requests,0,'Random procedure must not synthesize');
  assert.equal(await page.locator('.boop-board-item').count(),originalCount);
  await selectProcedure('Mix');

  await page.getByRole('button',{name:'Select Water to combine',exact:true}).click();
  await selectProcedure('Melt');assert.ok(await page.getByRole('button',{name:'Apply Melt',exact:true}).isEnabled());assert.equal(await page.getByRole('region',{name:'Foundry workspace'}).count(),0);
  const all=procedures.getByRole('button',{name:/^All \d+ procedures/});await openProcedures();await all.click();const dialog=page.getByRole('dialog',{name:'Choose a procedure'});await dialog.waitFor();
  assert.ok(Number((await dialog.getByRole('status').innerText()).split(' ')[0])>=249);
  await dialog.getByRole('textbox',{name:'Search procedures'}).fill('Melt');await dialog.getByRole('button',{name:'Favorite Melt',exact:true}).click();await page.keyboard.press('Escape');
  assert.ok(await procedures.getByRole('group',{name:'Favorites',exact:true}).getByRole('button',{name:'Melt',exact:true}).isVisible());
  await page.getByRole('button',{name:'Apply Melt',exact:true}).click();await page.getByRole('button',{name:'Select Molten Water to combine',exact:true}).waitFor();assert.equal(requests,1);
  assert.equal(await page.locator('dialog[open]').count(),0);await openProcedures();assert.ok(await procedures.getByRole('group',{name:'Recently used'}).getByRole('button',{name:'Melt',exact:true}).isVisible());await page.getByLabel('Open procedures',{exact:true}).click();
  await page.getByRole('button',{name:'Dismiss result',exact:true}).click();
  await page.getByRole('button',{name:'Undo last board action',exact:true}).click();await page.getByRole('button',{name:'Select Water to combine',exact:true}).click();await page.getByRole('button',{name:'Apply Melt',exact:true}).click();await page.getByRole('button',{name:'Select Molten Water to combine',exact:true}).waitFor();assert.equal(requests,1,'cached procedure must not call synthesis again');
  await page.getByRole('button',{name:'Dismiss result',exact:true}).click();
  const count=await page.evaluate(()=>new Promise((resolve,reject)=>{const opening=indexedDB.open('boop-game-progress',1);opening.onsuccess=()=>{const request=opening.result.transaction('saves').objectStore('saves').get('current');request.onsuccess=()=>{opening.result.close();resolve(request.result.envelope.crafting.find(e=>e.name==='Molten Water').craftCount);};request.onerror=()=>reject(request.error);};opening.onerror=()=>reject(opening.error);}));assert.equal(count,2,'repeat procedures must earn another copy');
  const before=await page.locator('.boop-board-item').count();await more.click();await page.getByRole('button',{name:'Random pair',exact:true}).click();await more.click();await page.waitForFunction(n=>document.querySelectorAll('.boop-board-item').length===n+2,before);
  assert.equal(await page.locator('.boop-board-item.is-selected').count(),2);assert.equal(await page.locator('.toybox-combine').innerText(),'Combine');assert.equal(requests,1);
  await more.click();await page.getByRole('button',{name:'Tidy board',exact:true}).click();await more.click();await page.waitForTimeout(150);
  const rects=await page.locator('.boop-board-item').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}}));
  const viewport=await page.locator('.boop-board-viewport').boundingBox();
  for(const [i,r] of rects.entries()){
    assert.ok(r.x>=viewport.x-1&&r.x+r.w<=viewport.x+viewport.width+1,'Tidy fits visible width');
    assert.ok(r.y>=viewport.y-1&&r.y+r.h<=viewport.y+viewport.height+1,'Tidy fits visible height');
    for(let j=0;j<i;j++){const q=rects[j];assert.ok(r.x>=q.x+q.w-1||q.x>=r.x+r.w-1||r.y>=q.y+q.h-1||q.y>=r.y+r.h-1,'Tidy must not overlap pieces');}
  }
  await page.screenshot({path:`${output}/board-${width}.png`});
  await page.reload({waitUntil:'networkidle'});await openProcedures();assert.ok(await page.getByRole('group',{name:'Favorites',exact:true}).getByRole('button',{name:'Melt',exact:true}).isVisible());assert.ok(await page.getByRole('group',{name:'Recently used'}).getByRole('button',{name:'Melt',exact:true}).isVisible());
  await page.getByRole('button',{name:/^All \d+ procedures/}).click();await dialog.getByRole('textbox',{name:'Search procedures'}).fill('Melt');await dialog.getByRole('button',{name:'Favorites only',exact:true}).click();assert.equal(await dialog.getByRole('status').innerText(),'1 procedures');await dialog.getByRole('button',{name:'Favorite Melt',exact:true}).click();assert.match(await dialog.innerText(),/No matching procedures/);await page.keyboard.press('Escape');await page.getByLabel('Open procedures',{exact:true}).click();
  const retained=await page.locator('.boop-board-item').count();
  await page.getByRole('button',{name:/^Select .+ to combine$/}).first().click();await selectProcedure('Freeze');
  responseMode='failure';await page.getByRole('button',{name:'Apply Freeze',exact:true}).click();await page.getByRole('alert').filter({hasText:'could not finish'}).waitFor();assert.equal(await page.locator('.boop-board-item').count(),retained);
  responseMode='no-reaction';await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('status').filter({hasText:'resisted freezing'}).waitFor();assert.equal(await page.locator('.boop-board-item').count(),retained);assert.equal(await page.locator('dialog[open]').count(),0);
  const dimensions=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));assert.ok(dimensions.s<=dimensions.w+1);assert.deepEqual(errors,[]);
  console.log(`${width}px: inline and cached Melt, inventory copies, favorite/recent persistence, searchable picker, Random pair selection and nonoverlapping Tidy passed`);await page.close();
 }
}finally{await browser.close();}
