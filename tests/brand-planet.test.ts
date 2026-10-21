import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Boop keeps the white and charcoal palette while switching to Pixelify Sans',()=>{
  const boop=file('src/boop.css');
  const css=file('src/index.css');
  const html=file('index.html');
  assert.match(boop,/--boop-canvas: #ffffff/);
  assert.match(boop,/--boop-forest: #242a31/);
  assert.match(boop,/--font-sans: "Pixelify Sans"/);
  assert.match(css,/--font-pixel: "Pixelify Sans"/);
  assert.match(html,/family=Pixelify\+Sans/);
});

test('logo is the sprouting orbit planet, not the prior green creature',()=>{
  const svg=file('public/icon.svg');
  assert.match(svg,/aria-label="Boop planet logo"/);
  assert.match(svg,/fill="#242a31"/);
  assert.match(svg,/stroke="#ffffff"/);
  assert.doesNotMatch(svg,/#d7f879/i);
});

test('Android launcher and native toolbar use the same planet icon',()=>{
  const main=file('android-shell/app/src/main/java/app/boop/collect/MainActivity.java');
  const manifest=file('android-shell/app/src/main/AndroidManifest.xml');
  const vector=file('android-shell/app/src/main/res/drawable/ic_boop_planet.xml');
  const workflow=file('.github/workflows/android-apk.yml');
  assert.match(main,/setImageResource\(R\.drawable\.ic_boop_planet\)/);
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
