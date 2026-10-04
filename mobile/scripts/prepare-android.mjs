import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const versionCode = Number.parseInt(process.env.ANDROID_VERSION_CODE || '1', 10);
const versionName = (process.env.ANDROID_VERSION_NAME || '1.0.0').trim();

if (!Number.isInteger(versionCode) || versionCode < 1) {
  throw new Error('ANDROID_VERSION_CODE must be a positive integer.');
}
if (!/^[0-9A-Za-z][0-9A-Za-z._+-]{0,49}$/.test(versionName)) {
  throw new Error('ANDROID_VERSION_NAME contains unsupported characters.');
}

const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');

const replaceRequired = (input, pattern, replacement, description) => {
  if (!pattern.test(input)) throw new Error(`Could not find ${description} in generated Android project.`);
  return input.replace(pattern, replacement);
};

gradle = replaceRequired(
  gradle,
  /versionCode\s*(?:=\s*)?\d+/,
  `versionCode ${versionCode}`,
  'versionCode',
);
gradle = replaceRequired(
  gradle,
  /versionName\s*(?:=\s*)?["'][^"']+["']/,
  `versionName "${versionName}"`,
  'versionName',
);

fs.writeFileSync(gradlePath, gradle);

const manifestPath = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');

if (!manifest.includes('android:usesCleartextTraffic=')) {
  manifest = manifest.replace(/<application\b/, '<application android:usesCleartextTraffic="false"');
}

if (!manifest.includes('android:screenOrientation=')) {
  manifest = manifest.replace(/<activity\b/, '<activity android:screenOrientation="portrait"');
}

fs.writeFileSync(manifestPath, manifest);

const variablesPath = path.join(root, 'android', 'variables.gradle');
if (fs.existsSync(variablesPath)) {
  const variables = fs.readFileSync(variablesPath, 'utf8');
  const compile = variables.match(/compileSdkVersion\s*=\s*(\d+)/)?.[1];
  const target = variables.match(/targetSdkVersion\s*=\s*(\d+)/)?.[1];
  if (compile !== '36' || target !== '36') {
    throw new Error(`Capacitor 8 Android must compile/target API 36; generated values were compile=${compile}, target=${target}.`);
  }
}

console.log(`Prepared Android release ${versionName} (${versionCode}).`);
