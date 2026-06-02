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

For direct APK distribution, configure release signing in `android/local.properties`
(ignored by git):

```properties
SLEEPNOMORE_KEYSTORE_FILE=/Users/dongniren/work/sleepnomore-android.keystore
SLEEPNOMORE_KEYSTORE_PASSWORD=<password>
SLEEPNOMORE_KEY_ALIAS=sleepnomore
SLEEPNOMORE_KEY_PASSWORD=<password>
```

Then run:

```sh
cd android
./gradlew assembleRelease
```

Signed release APK output:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Keep the keystore permanently. Losing it means future APKs cannot upgrade
existing installs.
