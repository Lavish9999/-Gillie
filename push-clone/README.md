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

## Gillie Plus Purchase Architecture

Gillie Plus is not unlocked by URL params, console commands, or localStorage-only state.

The web app calls a native Capacitor plugin:

- `GilliePurchases.purchase({ productId })`
- `GilliePurchases.restorePurchases()`
- `GilliePurchases.getEntitlementStatus()`

Product IDs:

- Monthly: `gillie.plus.monthly`
- Yearly: `gillie.plus.yearly`

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
   - `$4.99 / month`
   - `$39.99 / year`
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

This copies the root static app, assets, `privacy.html`, and `support.html` into `www/`, which Capacitor then copies into the iOS project.
