# Gillie

Gillie is a local-first quit-vaping wellness companion centered around a supportive aquatic buddy.

The root `index.html` is the canonical web source. Capacitor copies that source into `www/`, where the release pipeline removes remote font requests, applies safer wellness copy, injects the canonical V1 modules, and validates the final native bundle.

## Web Preview

- App: `https://lavish9999.github.io/-Gillie/`
- Privacy: `https://lavish9999.github.io/-Gillie/privacy.html`
- Terms: `https://lavish9999.github.io/-Gillie/terms.html`
- Support: `https://lavish9999.github.io/-Gillie/support.html`

## Install and validate

```bash
npm ci
npm run validate:ship
npm run cap:sync:ios
```

Open the native project with:

```bash
npm run cap:open:ios
```

## Production foundation

- Real local iOS reminders through `@capacitor/local-notifications`
- Evening check-in reminders, craving follow-ups, milestones, inactivity recovery, and Plus danger-window alerts
- Local-calendar-day check-ins rather than UTC-day boundaries
- StoreKit 2 transaction update listener and verified entitlement refresh
- Cached entitlement grace to avoid flashing paid users back to Free during a transient check
- StoreKit-localized subscription prices
- Apple subscription-management link and restore flow
- MetricKit crash/diagnostic capture stored on-device
- Privacy-first event diagnostics that exclude journal text, pet names, and free-text slip details
- Complete local erase covering recovery state, preferences, diagnostics, and the local diagnostic identifier
- App privacy manifest with the approved UserDefaults reason used by Gillie’s native local storage
- Direct Privacy, Terms, Support, backup, diagnostic-export, and erase controls inside Gillie
- Strict one-view tab isolation and contained sheet/preview scrolling

## Gillie Plus

Product IDs:

- `gillie.plus.monthly`
- `gillie.plus.yearly`

Prices shown in the app are loaded from StoreKit for the customer’s storefront. The fallback copy is `$3.99 / month` and `$29.99 / year`.

The native plugin is `ios/App/App/GilliePurchasesPlugin.swift`. It exposes:

- `getProducts()`
- `getEntitlementStatus()`
- `purchase({ productId })`
- `restorePurchases()`
- `manageSubscriptions()`
- privacy-first diagnostic methods

## Codemagic

The `ios-capacitor-app-store` workflow:

1. Installs the exact lockfile dependencies with `npm ci` on Node 22.
2. Runs source, runtime-harness, generated-bundle, visual-integrity, tab-isolation, Moonlit, and release checks.
3. Embeds and verifies the app privacy manifest.
4. Scopes V1 to the tested iPhone target.
5. Syncs Capacitor and Local Notifications.
6. Removes and verifies App Store icon alpha.
7. Applies a unique automatic build number.
8. Applies App Store signing and builds the IPA.
9. Opens the final IPA and verifies bundle ID, build number, privacy manifest, iPhone device family, and absence of remote Google Fonts.
10. Uploads the verified IPA to TestFlight; App Store submission remains a deliberate App Store Connect action.

Keep App Store Connect keys, signing certificates, provisioning profiles, and team IDs in Codemagic—not in GitHub.

## Privacy and safety

Gillie is a general wellness companion, not medical treatment. Current quit data and diagnostic events are local-first. Gillie does not use advertising trackers or upload journal content to a Gillie server.

Use `PHASE1-QA.md` for the required physical-device, TestFlight, privacy, StoreKit, backup, accessibility, and App Store Connect acceptance tests before release.
