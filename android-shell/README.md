# Boop Android 2 — Native navigation, live game engine

The APK now provides a **native Android UI shell**:

- Android toolbar for refresh and cloud/profile
- Five native navigation tabs: Kitchen, Craft, Foundry, Collection, Sprites
- Native Android back handling, touch feedback, file selection, dialogs and loading progress
- Online WebView for Boop's real, continuously updated Cloudflare-based game screens
- Live AI combination results, shiny sprites, image generation and Supabase cloud saves

It is not an offline/native rendering engine or a rewrite in Compose. Those
screens remain React, deliberately, so new web game and sprite releases go live
without rebuilding the APK.

## Google sign-in

OAuth never runs inside an Android WebView. Boop starts its Supabase PKCE
request inside the WebView, opens Google sign-in in external Chrome, and
returns the authorization code to `boop://oauth-callback?code=...` via a
safe browser-to-app handoff. The Android WebView then exchanges the code with
its own original verifier. A Return to Boop fallback link appears if Chrome
blocks automatic custom-scheme return.

**Supabase Authentication → URL Configuration** must allow the callback
`https://coco-kemon.logaandavid.workers.dev/?boop_native_oauth=1` (or
an appropriate wildcard for that HTTPS origin). Do not redirect Google itself
to the `boop://` custom scheme—use the Supabase HTTPS callback.

The Android WebView has isolated site storage, unlike the older Chrome
Custom Tab launcher. Existing Chrome discoveries remain in Chrome, not
automatically imported into the app. After Google sign-in, use **Load from
cloud** to restore your earlier saved collection. Save important Chrome
discoveries to cloud before switching.

## APK install and upgrades

GitHub Actions workflow **Boop Android APK** builds `app-debug.apk` and
uploads the artifact `Boop-Android-APK` for 30 days. These debug APKs are
for direct testing, not Google Play publishing. Each ephemeral GitHub runner
may sign with a different debug certificate. Android may therefore reject an
update over an older debug installer until that older app is uninstalled.
Back up any in-app collection data first; the old Chrome-backed launcher
used Chrome's own separate data storage.

For production upgrades configure an Android release signing keystore via
protected CI secrets. The APK includes no image API keys or user OAuth tokens.

## Local building

Java 17, Android SDK platform 35, Gradle 8.9. Run from repo root:

    mkdir -p android-shell/app/src/main/res/drawable-nodpi
    cp public/pwa-192x192.png android-shell/app/src/main/res/drawable-nodpi/boop_icon.png
    gradle --no-daemon -p android-shell assembleDebug

Production game backend: https://coco-kemon.logaandavid.workers.dev/
