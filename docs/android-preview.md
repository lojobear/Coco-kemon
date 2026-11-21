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

## Lightweight online APK

The `Boop Lightweight Online APK` workflow builds **Boop Online** (`app.boop.collect.online`) with `BOOP_LIVE_WEB=1` and `BOOP_BUNDLED_WEB=0`. It loads the current HTTPS game, including its normal web navigation, Settings, local saves and Android export bridge. Room artwork and JavaScript are fetched by the game instead of embedded in the installer. It needs connectivity to load the live game; it does not pin a frontend revision.

This package installs alongside Boop Preview. It has separate app storage: export a JSON game save from the existing app and import it in Boop Online, or restore a cloud backup. Do not uninstall the existing app before transferring progress. Routine website updates do not require another APK download.

The workflow verifies the APK stays below 10 MiB and contains no `assets/web/` files. The small `assets/source-commit.txt` identifies the Android shell revision. The artifact is `Boop-Online-APK`; debug signing remains for testing only. With the same SDK/Gradle prerequisites as above, build locally with `BOOP_LIVE_WEB=1 BOOP_BUNDLED_WEB=0 BOOP_VERSION_NAME=3.14.1-online gradle --no-daemon -p android-shell assembleDebug` from a checkout without generated `assets/web/` files.
