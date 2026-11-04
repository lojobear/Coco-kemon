import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

await mkdir('/tmp/boop-viewport', { recursive: true });
const browser = await chromium.launch({ headless:true, args:['--no-sandbox'] });
try {
  for (const [label,width,height] of [['mobile',390,844],['tablet',768,1024],['desktop',1440,900]]) {
    const page = await browser.newPage({ viewport:{width,height}, deviceScaleFactor:1 });
    await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'Craft',exact:true}).click();
    await page.waitForTimeout(500);
    await page.screenshot({path:`/tmp/boop-viewport/${label}-craft.png`});
    const size = await page.evaluate(()=>({width:document.documentElement.clientWidth, scroll:document.documentElement.scrollWidth}));
    assert.ok(size.scroll<=size.width+1, `${label}: horizontal overflow ${size.scroll} > ${size.width}`);
    const nav = page.locator('.boop-navigation button[aria-current="page"]');
    assert.equal(await nav.count(),1,`${label}: active navigation missing`);
    if (width < 1100) {
      const rows = await page.locator('.boop-navigation .boop-nav-items > button').evaluateAll(buttons => buttons.map(button => Math.round(button.getBoundingClientRect().top)));
      assert.equal(new Set(rows).size,1,`${label}: navigation wraps onto multiple rows`);
    }
    if (label === 'desktop') {
      const water = await page.locator('.boop-board-item').filter({hasText:'Water'}).boundingBox();
      const fire = await page.locator('.boop-board-item').filter({hasText:'Fire'}).boundingBox();
      assert.ok(water && fire, 'starter tiles must be visible');
      await page.mouse.move(water.x + 22, water.y + water.height / 2);
      await page.mouse.down();
      await page.mouse.move(fire.x + 22, fire.y + fire.height / 2, {steps:12});
      await page.mouse.up();
      try { await page.locator('.boop-board-result-new').waitFor({state:'visible',timeout:10000}); }
      catch (error) { await page.screenshot({path:'/tmp/boop-viewport/desktop-reveal-failure.png'}); throw error; }
      await page.screenshot({path:'/tmp/boop-viewport/desktop-new-discovery.png'});
      await page.locator('.boop-board-more > summary').click();
      const before = await page.locator('.boop-board-item').count();
      await page.getByRole('button',{name:/Suggest a discovery/}).click();
      await page.waitForFunction(n => document.querySelectorAll('.boop-board-item').length === n + 2, before);
      assert.match(await page.locator('.boop-board-toast').innerText(),/Try |No known undiscovered pair/);
    }
    await page.getByRole('button',{name:'Collection',exact:true}).click();
    await page.waitForTimeout(500);
    await page.screenshot({path:`/tmp/boop-viewport/${label}-collection.png`});
    assert.equal(await page.locator('.boop-navigation button[aria-current="page"]').count(),1);
    console.log(`${label} ${width}x${height}: navigation and page width passed`);
    await page.close();
  }
} finally { await browser.close(); }
