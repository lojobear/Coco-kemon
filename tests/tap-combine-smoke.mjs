import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
const output=process.env.BOOP_AUDIT_OUTPUT||'/tmp/boop-tap-combine';await mkdir(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
try{
 for(const width of [320,412,1440]){
  const page=await browser.newPage({viewport:{width,height:width===1440?900:867},hasTouch:width<700,isMobile:width<700});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.BOOP_BASE_URL||'http://127.0.0.1:3000',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Select Water to combine',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:/Arena/}).count(),0);assert.equal(await page.locator('.craft-procedure-drawer').getAttribute('open'),null);
  const board=await page.locator('.boop-board-layout').boundingBox();const composer=await page.getByRole('region',{name:'Tap to combine'}).boundingBox();
  assert.ok(board.y<180,'board should be near the top');assert.ok(board.height>=270);assert.ok(board.y+board.height<=composer.y+1);assert.ok(composer.y+composer.height<(width===1440?900:867),'composer should fit without scrolling');
  await page.screenshot({path:`${output}/initial-${width}.png`});
  const initialCount=await page.locator('.boop-board-item').count();
  await page.getByRole('button',{name:'Choose first element',exact:true}).click();
  await page.getByRole('complementary',{name:'Your element library'}).locator('.boop-board-library-item > button:first-child').filter({hasText:'Water'}).first().click();
  assert.equal(await page.locator('.boop-board-item').count(),initialCount,'slot picker should reuse a matching board piece');
  await page.getByRole('button',{name:'Clear first ingredient',exact:true}).click();

  for(const name of ['Water','Fire']){const tile=page.getByRole('button',{name:`Select ${name} to combine`,exact:true});if(width<700)await tile.tap();else await tile.click();}
  assert.ok(await page.getByRole('button',{name:'Choose first element: Water',exact:true}).isVisible());assert.ok(await page.getByRole('button',{name:'Choose second element: Fire',exact:true}).isVisible());
  await page.getByRole('button',{name:'Combine Water + Fire',exact:true}).click();await page.locator('.boop-board-result strong').filter({hasText:'Steam'}).waitFor();await page.getByRole('button',{name:'Dismiss result',exact:true}).click();
  for(const slot of ['first','second']){
   await page.getByRole('button',{name:`Choose ${slot} element`,exact:true}).click();
   const library=page.getByRole('complementary',{name:'Your element library'});await library.waitFor();
   await library.getByRole('textbox',{name:'Search ingredients'}).fill('Water');
   await library.locator('.boop-board-library-item > button:first-child').filter({hasText:'Water'}).first().click();
  }
  assert.equal(await page.locator('.boop-board-item.is-selected').count(),2);const same=page.getByRole('button',{name:'Combine Water + Water',exact:true});assert.ok(await same.isEnabled());
  await page.waitForFunction(()=>document.activeElement?.classList.contains('toybox-combine'));await page.keyboard.press('Enter');await page.locator('.boop-board-result strong').filter({hasText:'Lake'}).waitFor();await page.getByRole('button',{name:'Dismiss result',exact:true}).click();
  await page.getByLabel('Open procedures',{exact:true}).click();await page.getByRole('region',{name:'Board procedures'}).getByRole('button',{name:'Melt',exact:true}).click();assert.equal(await page.locator('.craft-procedure-drawer').getAttribute('open'),null);
  await page.getByRole('button',{name:'Select Earth to combine',exact:true}).click();assert.ok(await page.getByRole('button',{name:'Apply Melt',exact:true}).isEnabled());
  await page.getByRole('button',{name:'Clear first ingredient',exact:true}).click();assert.ok(await page.getByRole('button',{name:'Apply Melt',exact:true}).isDisabled());
  assert.deepEqual(errors,[]);const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1);
  console.log(`${width}px: board-first screen, tap two pieces, library ingredient slots, same-element pair, keyboard Combine and collapsed procedures passed`);await page.close();
 }
}finally{await browser.close();}
