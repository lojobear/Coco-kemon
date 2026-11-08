import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = (name: string) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('Boop prevents browser auto darkening before first paint and for all sprite views', () => {
  const html = file('index.html');
  const css = file('src/index.css');
  const app = file('src/App.tsx');
  const sprite = file('src/components/ElementSprite.tsx');
  // Chrome explicitly documents "only light" as an Auto Dark Theme opt-out.
  assert.match(html, /<meta name="color-scheme" content="only light"\s*\/>/);
  assert.ok(html.indexOf('name="color-scheme"') < html.indexOf('<script>'),
    'HTML colour-scheme must be declared before JavaScript/CSS to avoid a dark flash');
  assert.match(css, /:root\s*\{[^}]*color-scheme:\s*only light\s*;/);
  assert.match(app, /data-theme="quark-light"/);
  // Preserve original image pixels without adding broad image filters.
  assert.doesNotMatch(sprite, /filter:\s*invert\s*\(/);
});

test('Android native WebView explicitly opts out of Force Dark and algorithmic darkening', () => {
  const manifest = file('android-shell/app/src/main/AndroidManifest.xml');
  const activity = file('android-shell/app/src/main/java/app/boop/collect/MainActivity.java');
  assert.match(manifest, /android:forceDarkAllowed="false"/);
  assert.match(activity, /webView\.setForceDarkAllowed\(false\)/);
  assert.match(activity, /WebViewFeature\.isFeatureSupported\(WebViewFeature\.ALGORITHMIC_DARKENING\)/);
  assert.match(activity, /WebSettingsCompat\.setAlgorithmicDarkeningAllowed\(settings, false\)/);
  assert.match(activity, /new WebView\(this\)/);
});

test('intentional rarity visual effects remain available', () => {
  const css = file('src/boop.css');
  assert.match(css, /boop-album-art--celestial img\s*\{filter:/);
  assert.match(css, /boop-album-art--glitch img\s*\{filter:/);
  assert.match(css, /boop-shiny-sprite/);
});
