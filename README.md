# Gillie

Gillie is a mobile-first quit-vaping wellness companion centered around a supportive aquatic buddy.

The root `index.html` remains the GitHub Pages preview. The iOS App Store build is now handled through Capacitor and serves the same static app from `www/`.

## Web Preview

Open `index.html` directly or use GitHub Pages:

- App: `https://lavish9999.github.io/-Gillie/`
- Privacy: `https://lavish9999.github.io/-Gillie/privacy.html`
- Support: `https://lavish9999.github.io/-Gillie/support.html`

## iOS Build Setup

Install dependencies:

```bash
npm install
```

Prepare and sync the iOS app:

```bash
npm run cap:sync:ios
```

Open the native project in Xcode:

```bash
npm run cap:open:ios
```

In Xcode:

1. Select the `App` target.
2. Confirm bundle ID is `com.lavish9999.gillie`.
3. Select your Apple Developer Team.
4. Build on a simulator/device.
5. Archive and upload to App Store Connect for TestFlight/App Store review.

## Build iOS without a Mac

Gillie includes a root `codemagic.yaml` workflow for building the Capacitor iOS app in Codemagic on macOS.

1. Connect the GitHub repo `Lavish9999/-Gillie` to Codemagic.
2. Select the `native-ios-launch` branch.
3. In Codemagic, connect an App Store Connect API key integration.
4. Set the Bundle ID to `com.lavish9999.gillie`.
5. Create an Apple Distribution certificate and App Store provisioning profile through Codemagic automatic code signing, or upload profiles from Apple Developer.
6. Run the `Gillie iOS App Store` workflow.
7. Codemagic will install npm dependencies, prepare the Capacitor web assets, sync iOS, install pods if needed, build `ios/App/App.xcworkspace` with scheme `App`, and produce an App Store IPA.
8. Use the generated IPA for TestFlight/App Store Connect upload, or keep `submit_to_testflight: true` once signing is confirmed.

Add these in Codemagic only. Do not commit them to GitHub:

- App Store Connect API key issuer ID
- App Store Connect API key ID
- App Store Connect API private key `.p8`
- Apple Developer team ID
- Apple Distribution certificate, if not created automatically
- Certificate password, if uploading a `.p12`
- App Store provisioning profile for `com.lavish9999.gillie`, if not created automatically

## Gillie Plus Purchase Architecture

Gillie Plus is not unlocked by URL params, console commands, or localStorage-only state.

The web app calls a native Capacitor plugin:

- `GilliePurchases.purchase({ productId })`
- `GilliePurchases.restorePurchases()`
- `GilliePurchases.getEntitlementStatus()`

Product IDs and launch pricing:

- Monthly: `gillie.plus.monthly` — `$3.99 / month`
- Yearly: `gillie.plus.yearly` — `$29.99 / year`

The native iOS file is:

- `ios/App/App/GilliePurchasesPlugin.swift`

That file uses StoreKit 2 and only returns `active: true` after a verified current entitlement for one of the Gillie Plus product IDs.

## App Store Connect Checklist

1. Create the app record in App Store Connect.
2. Use bundle ID `com.lavish9999.gillie`.
3. Create an auto-renewable subscription group named `Gillie Plus`.
4. Add monthly product ID `gillie.plus.monthly`.
5. Add yearly product ID `gillie.plus.yearly`.
6. Match App Store prices to the prices shown in the app:
   - `$3.99 / month`
   - `$29.99 / year`
7. Add Privacy Policy URL:
   - `https://lavish9999.github.io/-Gillie/privacy.html`
8. Add Support URL:
   - `https://lavish9999.github.io/-Gillie/support.html`
9. Add App Store screenshots.
10. Archive/upload the build from Xcode.
11. Test subscriptions in TestFlight sandbox.
12. Submit the app and the first in-app purchases together.

## App Icons

Master icon:

- `assets/app-icon-1024.png`

Web/PWA icons:

- `assets/gillie-icon-64.png`
- `assets/gillie-icon-180.png`
- `assets/gillie-icon-192.png`
- `assets/gillie-icon-512.png`
- `assets/app-icon-1024.png`

iOS icon catalog:

- `ios/App/App/Assets.xcassets/AppIcon.appiconset`

Regenerate iOS icon sizes from the master icon:

```bash
npm run icons:ios
```

## Privacy And Safety Positioning

Gillie is a wellness companion, not medical treatment.

Gillie does not diagnose, treat, cure, or prevent any disease or condition. It does not replace professional medical advice, therapy, quitline support, or emergency care. The app is designed to support behavior change through tracking, reflection, and supportive prompts.

Current quit data is local-first and stored on device unless future optional sync features are added.

## Development Notes

Before syncing iOS, run:

```bash
npm run prepare:cap
```

This copies the root static app, assets, `privacy.html`, and `support.html` into `www/`, which Capacitor then copies into the iOS project. The prepare step also applies the current Gillie Plus launch pricing to the app copy used by the native build.
