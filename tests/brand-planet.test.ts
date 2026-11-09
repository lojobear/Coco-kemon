import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const file=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Boop uses only Reddit Sans across the web, title, and PWA',()=>{
  const boop=file('src/boop.css');
  const css=file('src/index.css');
  const html=file('index.html');
  assert.match(boop,/--boop-canvas: #ffffff/);
  assert.match(boop,/--boop-forest: #242a31/);
  for (const variable of ['font-sans','font-mono','font-pixel','font-brand']) {
    assert.match(css,new RegExp('--'+variable+': "Reddit Sans"'));
  }
  assert.match(boop,/--font-sans: "Reddit Sans"/);
  assert.match(boop,/--font-brand: "Reddit Sans"/);
  assert.match(boop,/font-family: var\(--font-sans\)/);
  assert.match(boop,/\.boop-app \.collection-brand strong \{ font-family:var\(--font-brand\)/);
  assert.match(css,/@font-face[\s\S]*?font-family: "Reddit Sans";[\s\S]*?RedditSans\.ttf/);
  assert.match(css,/RedditSans-Italic\.ttf/);
  assert.match(css,/font-weight: 200 900/);
  assert.match(css,/\.collection-brand strong \{[\s\S]*?font-family: var\(--font-brand\)/);
  assert.doesNotMatch(html,/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  for (const old of ['Fredoka','Space Grotesk','Outfit','Pixelify Sans']) {
    assert.ok(!boop.includes(old) && !css.includes(old) && !html.includes(old));
  }
  const webFont = readFileSync(new URL('../public/fonts/RedditSans.ttf',import.meta.url));
  assert.ok(webFont.length > 50_000);
  assert.match(file('public/fonts/OFL-RedditSans.txt'),/SIL OPEN FONT LICENSE/);
  assert.ok(readFileSync(new URL('../public/fonts/RedditSans-Italic.ttf',import.meta.url)).length > 100_000);
  assert.ok(!existsSync(new URL('../public/fonts/PixelifySans.ttf',import.meta.url)));
});

test('logo is the sprouting orbit planet, not the prior green creature',()=>{
  const svg=file('public/icon.svg');
  assert.match(svg,/aria-label="Boop planet logo"/);
  assert.match(svg,/fill="#242a31"/);
  assert.match(svg,/stroke="#ffffff"/);
  assert.doesNotMatch(svg,/#d7f879/i);
});

test('Android icon, title, navigation and buttons use the bundled Reddit Sans',()=>{
  const main=file('android-shell/app/src/main/java/app/boop/collect/MainActivity.java');
  const manifest=file('android-shell/app/src/main/AndroidManifest.xml');
  const vector=file('android-shell/app/src/main/res/drawable/ic_boop_planet.xml');
  const workflow=file('.github/workflows/android-apk.yml');
  assert.match(main,/setImageResource\(R\.drawable\.ic_boop_planet\)/);
  assert.match(main,/title\.setTypeface\(redditSansTypeface, Typeface\.BOLD\)/);
  assert.match(main,/item\.setTypeface\(redditSansTypeface/);
  assert.match(main,/button\.setTypeface\(redditSansTypeface/);
  assert.match(main,/Typeface\.createFromAsset\(getAssets\(\), "fonts\/RedditSans\.ttf"\)/);
  const font = readFileSync(new URL('../android-shell/app/src/main/assets/fonts/RedditSans.ttf',import.meta.url));
  const webFont = readFileSync(new URL('../public/fonts/RedditSans.ttf',import.meta.url));
  assert.ok(font.length > 50_000);
  assert.deepEqual(font,webFont);
  assert.match(file('android-shell/app/src/main/assets/fonts/OFL-RedditSans.txt'),/SIL OPEN FONT LICENSE/);
  for (const name of ['Fredoka','SpaceGrotesk','PixelifySans']) {
    assert.ok(!existsSync(new URL('../android-shell/app/src/main/assets/fonts/'+name+'.ttf',import.meta.url)));
    assert.doesNotMatch(main,new RegExp(name));
  }
  assert.match(manifest,/android:icon="@drawable\/ic_boop_planet"/);
  assert.match(vector,/android:viewportWidth="64"/);
  assert.match(workflow,/Verify vector launcher icon/);
  assert.doesNotMatch(workflow,/cp public\/pwa-192x192\.png/);
});

test('all PWA/Apple PNG icon sizes are regenerated on every build',()=>{
  const pkg=JSON.parse(file('package.json'));
  const script=file('scripts/generate-brand-icons.mjs');
  assert.equal(pkg.scripts.prebuild,'node scripts/generate-brand-icons.mjs');
  assert.equal(pkg.scripts.predev,'node scripts/generate-brand-icons.mjs');
  for(const name of ['pwa-192x192.png','pwa-512x512.png','pwa-maskable-512x512.png','apple-touch-icon.png']){
    assert.ok(script.includes(name));
  }
  const vite=file('vite.config.ts');
  assert.match(vite,/theme_color: '#ffffff'/);
  assert.match(vite,/background_color: '#ffffff'/);
});
