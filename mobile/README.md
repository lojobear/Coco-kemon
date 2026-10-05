# QuarkPop Android / Google Play

This folder contains the Android packaging layer for the existing QuarkPop web game.

## Architecture

The Android app uses Capacitor 8 and loads the production QuarkPop site over HTTPS inside a native Android shell. This keeps the existing Gemini API, Supabase cloud saves, live game updates, camera file input, audio, and browser storage behavior together instead of duplicating the backend inside the APK.

Default application ID:

```text
com.logaandavid.oddkinfoundry
```

**Important:** Android package IDs are effectively permanent once the app is published on Google Play. Change `CAPACITOR_APP_ID` before the first Play Console upload if you want a different ID.

## Local Android setup

Requirements:
- Node.js 22+
- Android Studio 2025.2.1 or newer
- Android SDK API 36
- Java/JDK compatible with the Android Studio version

From the repository root:

```sh
cd mobile
npm install
npm run android:init
npm run android:sync
npm run android:assets
ANDROID_VERSION_NAME=1.0.0 ANDROID_VERSION_CODE=1 npm run android:prepare
npm run android:open
```

The generated `mobile/android/` project is intentionally ignored by Git. Recreate it from this source-controlled configuration whenever needed.

## Build in GitHub Actions

Run the **Android Play Bundle** workflow manually from GitHub Actions. It asks for:

- version name, e.g. `1.0.0`
- version code, e.g. `1`
- Android application ID
- production app URL

It produces:

- `app-release.aab` — Google Play App Bundle
- `app-debug.apk` — sideloadable test APK

### Release signing

For a Play-uploadable signed bundle, add these repository Actions secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Create an upload keystore once and keep it backed up securely. Convert it to base64 before saving it as the GitHub secret. Never commit a keystore or signing password.

If the signing secrets are absent, the workflow still builds an unsigned release AAB plus a debug APK for testing.

## Google Play notes

Capacitor 8 targets Android 16 / API 36. The generated app is portrait-oriented, disallows cleartext HTTP traffic, and uses the existing production HTTPS site.

Before public release, finish the Play Console requirements: app listing, screenshots, feature graphic, privacy policy, Data safety form, content rating, target audience, app access instructions if needed, and closed/open testing requirements that apply to the developer account.
