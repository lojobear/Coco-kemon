# Boop Android APK

Boop's Android installer is a lightweight browser-backed launcher for
https://coco-kemon.logaandavid.workers.dev/ .

It uses the installed Android browser's Custom Tabs, so Google login and
Chrome-origin collection storage remain available. The game needs internet
access and displays browser controls: it is not an offline native game.

The GitHub Actions workflow **Boop Android APK** builds and uploads
app-debug.apk inside the Boop-Android-APK artifact for sideload installation.

For local builds, install Java 17, Android SDK 35 and Gradle 8.9 and run:

    mkdir -p android-shell/app/src/main/res/drawable-nodpi
    cp public/pwa-192x192.png android-shell/app/src/main/res/drawable-nodpi/boop_icon.png
    gradle --no-daemon -p android-shell assembleDebug

Debug builds from different GitHub runners might use different signing
certificates. For reliably updating installs, add a protected release keystore.
A verified fullscreen Trusted Web Activity additionally requires Digital
Asset Links deployed to the web origin.
