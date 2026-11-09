# Bundled Boop preview APK

The Android APK workflow bundles the frontend from the exact checked-out revision. It builds **Boop Preview** (`app.boop.collect.preview`) with web navigation matching the selected redesign. This installs separately from the production shell.

The existing Android bridge and trusted HTTPS origin remain available. API requests use the existing backend; local static assets use the copy inside the APK. Service-worker generation is disabled for the embedded build so a website update cannot replace the bundled interface.

The workflow artifact is `Boop-Preview-APK`. The debug APK includes `assets/web/source-commit.txt` for revision verification. It includes no private API keys. Local recipes and the wallet use the bundled code. AI requires connectivity; wallet-aware cloud backups require the migration described in `docs/element-economy.md`. This is a test installer rather than a Play release.

## Local build

With Java 17+, Gradle 8.11.1, Android SDK platform 36 and build-tools 36.0.0 installed:

```sh
BOOP_BUNDLED_WEB=1 npm run build
mkdir -p android-shell/app/src/main/assets/web
cp -R dist/. android-shell/app/src/main/assets/web/
git rev-parse HEAD > android-shell/app/src/main/assets/web/source-commit.txt
BOOP_BUNDLED_WEB=1 BOOP_VERSION_NAME=3.0.0-preview gradle --no-daemon -p android-shell assembleDebug
```

The output is `android-shell/app/build/outputs/apk/debug/app-debug.apk`. Debug signing is intended for testing. This package has independent app storage, so use an exported backup to move an existing collection into the preview.
