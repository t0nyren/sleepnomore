# SleepNoMore Mobile

Capacitor wrapper for the production SleepNoMore web app.

## Android

The Android app is a Capacitor WebView shell for:

```text
https://sleepnomore.secondlife.today
```

Requirements:

- JDK 21
- Android SDK platform 36
- Android build-tools 35 or newer

Useful commands:

```sh
npm run sync:android
npm run build:android:debug
npm run build:android:release
```

Debug APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Release AAB output:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

Release builds still need a Google Play signing setup before store upload.
