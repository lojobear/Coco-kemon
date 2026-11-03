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
    await page.getByRole('button',{name:'Collection',exact:true}).click();
    await page.waitForTimeout(500);
    await page.screenshot({path:`/tmp/boop-viewport/${label}-collection.png`});
    assert.equal(await page.locator('.boop-navigation button[aria-current="page"]').count(),1);
    console.log(`${label} ${width}x${height}: navigation and page width passed`);
    await page.close();
  }
} finally { await browser.close(); }
