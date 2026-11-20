function craftEntryURL(value){const url=new URL(value);url.searchParams.set('view','craft');return url.href;}
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
const output=process.env.BOOP_AUDIT_OUTPUT||'/tmp/boop-process-profile';await mkdir(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
try {
 for(const width of [320,412,1440]){
  const page=await browser.newPage({viewport:{width,height:900},hasTouch:width<700,isMobile:width<700});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));let fail=true;const requests=[];
  await page.route('**/api/synthesize',async route=>{
   const body=route.request().postDataJSON();requests.push(body);assert.equal(body.process.id,'MELT');
   assert.deepEqual([body.inputMaterialA.displayName,body.inputMaterialB.displayName],['Water','Fire']);
   if(fail){await route.fulfill({status:503,json:{error:'Test temporary failure'}});return;}
   const material={...body.inputMaterialA,id:'melt-drag-test',canonicalName:'MOLTEN WATER',displayName:'Molten Water',discoveredAt:Date.now(),lineage:{parentIds:[body.inputMaterialA.id,body.inputMaterialB.id],processId:'MELT',depth:2,generation:2}};
   await route.fulfill({json:{status:'new_material',material,explanation:'Melt used on the dragged ingredients.'}});
  });
  await page.goto(craftEntryURL(process.env.BOOP_BASE_URL||'http://127.0.0.1:3000'),{waitUntil:'networkidle'});
  const choose=async name=>{await page.getByLabel('Open procedures',{exact:true}).click();await page.getByRole('region',{name:'Board procedures'}).getByRole('button',{name,exact:true}).click();};
  await choose('Melt');
  // Select unrelated pieces first: dragging must use its actual collision pair.
  await page.getByRole('button',{name:'Select Earth to combine',exact:true}).click();
  const drag=async(a,b)=>{
   const from=await page.getByRole('button',{name:`Select ${a} to combine`,exact:true}).boundingBox();
   const to=await page.getByRole('button',{name:`Select ${b} to combine`,exact:true}).boundingBox();
   await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
   await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:15});await page.mouse.up();
  };
  await drag('Water','Fire');await page.getByRole('alert').filter({hasText:'could not finish'}).waitFor();
  assert.equal(await page.locator('.boop-board-item').count(),4,'failed procedure preserves ingredients');
  // Retry must retain the actual dragged pair after the ingredient selection changes.
  await page.getByRole('button',{name:'Select Wind to combine',exact:true}).click();fail=false;await page.getByRole('button',{name:'Retry',exact:true}).click();
  await page.getByRole('button',{name:'Select Molten Water to combine',exact:true}).waitFor();assert.equal(requests.length,2);
  assert.equal(await page.locator('.boop-board-item').count(),3);
  await page.getByRole('button',{name:'Dismiss result',exact:true}).click();
  await choose('Mix');await drag('Earth','Wind');await page.waitForFunction(()=>document.querySelectorAll('.boop-board-item').length===2);
  assert.equal(requests.length,2,'switching back to Mix should use the shared pair resolver');
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Profile',exact:true}).click();
  await page.getByRole('heading',{name:'Milestones',exact:true}).waitFor();
  assert.ok(await page.getByRole('heading',{name:'Categories explored',exact:true}).isVisible());
  const featured=page.getByLabel('Your featured discovery',{exact:true});await featured.selectOption({label:'Molten Water'});
  assert.equal(await page.locator('.boop-profile-feature strong').innerText(),'Molten Water');
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Download stats',exact:true}).click();const download=await downloading;
  const report=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(report.featuredDiscovery,'Molten Water');assert.equal(report.discoveries,2);assert.ok(report.collectionGuideValue>0);assert.equal(report.categories.reduce((s,c)=>s+c.count,0),2);
  await page.getByRole('heading',{name:'Featured discovery',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`${output}/profile-${width}.png`});
  await page.reload({waitUntil:'networkidle'});await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Profile',exact:true}).click();
  await page.locator('.boop-profile-feature strong').waitFor();assert.equal(await page.locator('.boop-profile-feature strong').innerText(),'Molten Water');
  await page.getByLabel('Your featured discovery',{exact:true}).selectOption('');assert.equal(await page.locator('.boop-profile-feature').count(),0);
  const dimensions=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));assert.ok(dimensions.s<=dimensions.w+1,'profile must fit the screen');assert.deepEqual(errors,[]);
  console.log(`${width}px: selected-procedure dragging, failure preservation, exact retry, switch to Mix, profile stats, featured discovery persistence and report download passed`);await page.close();
 }
 const native=await browser.newPage({viewport:{width:412,height:900},userAgent:'Mozilla/5.0 BoopAndroid/3'});
 await native.addInitScript(()=>{window.BoopNative={postMessage:raw=>{window.profileExportMessage=JSON.parse(raw);}};});
 await native.goto(craftEntryURL((process.env.BOOP_BASE_URL||'http://127.0.0.1:3000')+'/?boop_android=1&boop_web_chrome=1'),{waitUntil:'networkidle'});
 await native.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Profile',exact:true}).click();
 await native.getByRole('button',{name:'Download stats',exact:true}).click();
 const message=await native.evaluate(()=>window.profileExportMessage);assert.equal(message.type,'exportProfileStats');assert.equal(JSON.parse(message.text).discoveries,0);
 assert.ok(await native.getByRole('status').filter({hasText:'Choose where to save'}).isVisible());await native.close();
 console.log('Android profile report uses the native save-file bridge');
}finally{await browser.close();}
