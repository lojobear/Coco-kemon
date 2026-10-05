import type { CapacitorConfig } from '@capacitor/cli';

const appId = (process.env.CAPACITOR_APP_ID || 'com.logaandavid.oddkinfoundry').trim();
const appUrl = (process.env.ODDKIN_APP_URL || 'https://oddkin-foundry.vercel.app').trim();
const useRemoteApp = process.env.CAPACITOR_BUNDLED !== '1';

if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(appId)) {
  throw new Error(`Invalid Android application id: ${appId}`);
}
if (useRemoteApp && !/^https:\/\//i.test(appUrl)) {
  throw new Error('ODDKIN_APP_URL must use HTTPS for release builds.');
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
