import type { CapacitorConfig } from '@capacitor/cli';

const appId = (process.env.CAPACITOR_APP_ID || 'com.logaandavid.quarkpop').trim();
const appUrl = (process.env.QUARKPOP_APP_URL || process.env.ODDKIN_APP_URL || 'https://coco-kemon.logaandavid.workers.dev').trim();
const useRemoteApp = process.env.CAPACITOR_BUNDLED !== '1';

if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(appId)) {
  throw new Error(`Invalid Android application id: ${appId}`);
}
if (useRemoteApp && !/^https:\/\//i.test(appUrl)) {
  throw new Error('QUARKPOP_APP_URL must use HTTPS for release builds.');
}

const config: CapacitorConfig = {
  appId,
  appName: 'QuarkPop',
  webDir: 'dist',
  server: useRemoteApp ? {
    url: appUrl,
    cleartext: false,
    androidScheme: 'https',
  } : undefined,
  android: {
    allowMixedContent: false,
    backgroundColor: '#ffffff',
  },
};

export default config;
