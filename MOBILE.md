# VoxSign — Android & iOS app

VoxSign is now packaged as a real native app (Capacitor). It installs from an
app icon and opens full screen, with no browser bar.

## One-time setup on your computer

You need a computer with Node.js installed. For Android you also need
[Android Studio](https://developer.android.com/studio); for iPhone you need a
Mac with Xcode.

1. Push this project to GitHub ("Export to GitHub" in Lovable), then clone it:
   ```bash
   git clone <your-repo-url>
   cd <your-repo>
   npm install
   ```
2. Create the native projects:
   ```bash
   npx cap add android
   npx cap add ios
   ```
3. Sync the settings:
   ```bash
   npx cap sync
   ```

## Run it on a phone

- Android: `npx cap run android` (or `npx cap open android` and press Run)
- iPhone: `npx cap open ios`, pick your device, press Run

## After you publish changes in Lovable

The app loads the live published site, so new features appear automatically —
no rebuild needed. Rebuild only when you change the app name, icon, or
permissions, then run `npx cap sync` again.

## Publishing to the stores

- Google Play: in Android Studio, Build → Generate Signed Bundle (AAB), upload
  to the Play Console.
- App Store: in Xcode, Product → Archive, then Distribute App.

## Notes

- Bluetooth speaker output uses the phone's own audio, so any speaker paired
  with the phone works.
- Microphone/Bluetooth permissions are requested by the system the first time
  they are used.
