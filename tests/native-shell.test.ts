import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isNativeTab, NATIVE_TABS, isAndroidNativeShell, sendToAndroid } from '../src/lib/nativeShell';

const file = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('native Android navigation includes every main Boop game screen', () => {
  assert.deepEqual([...NATIVE_TABS], ['kitchen','infinite-craft','foundry','archive','sprite-lab','notebook']);
  for (const tab of NATIVE_TABS) assert.equal(isNativeTab(tab), true);
  assert.equal(isNativeTab('google-auth'), false);
  assert.equal(isNativeTab('https://evil.example'), false);
});

test('browser and PWA users do not attempt Android bridge messages', () => {
  assert.equal(isAndroidNativeShell(), false);
  assert.equal(sendToAndroid({ type: 'tab', tab: 'archive' }), false);
});

test('the Android app has a real native toolbar and bottom bar instead of a Chrome Custom Tab launcher', () => {
  const java = file('android-shell/app/src/main/java/app/boop/collect/MainActivity.java');
  assert.match(java, /buildToolbar\(\)/);
  assert.match(java, /buildBottomNav\(\)/);
  assert.match(java, /new WebView\(this\)/);
  assert.match(java, /WebViewCompat\.addWebMessageListener/);
  assert.match(java, /Collections\.singleton\(ORIGIN\)/);
  assert.match(java, /"kitchen".*"Kitchen"/);
  assert.match(java, /"infinite-craft".*"Craft"/);
  assert.match(java, /"foundry".*"Foundry"/);
  assert.match(java, /"archive".*"Collection"/);
  assert.match(java, /"sprite-lab".*"Sprites"/);
  assert.doesNotMatch(java, /intent\.launchUrl\(this, Uri\.parse\(BOOP_URL\)\)/);
});

test('native tab changes reach React and the website does not display a duplicate bottom bar', () => {
  const app = file('src/App.tsx');
  const css = file('src/boop.css');
  assert.match(app, /boop-native-tab/);
  assert.match(app, /boop-native-profile/);
  assert.match(app, /!nativeShell && <BottomNav/);
  assert.match(css, /html\.boop-native-shell \.boop-app \.boop-navigation/);
});

test('native Google PKCE OAuth uses Chrome and returns its code to the same WebView origin', () => {
  const cloud = file('src/components/CloudSaves.tsx');
  const html = file('index.html');
  const java = file('android-shell/app/src/main/java/app/boop/collect/MainActivity.java');
  const manifest = file('android-shell/app/src/main/AndroidManifest.xml');
  assert.match(cloud, /skipBrowserRedirect: native/);
  assert.match(cloud, /sendToAndroid\(\{ type: 'oauth', url: data\.url \}\)/);
  assert.match(html, /boop_native_oauth/);
  assert.match(html, /boop:\/\/oauth-callback\?code=/);
  assert.match(java, /getQueryParameter\("code"\)/);
  assert.match(manifest, /android:scheme="boop"/);
});
