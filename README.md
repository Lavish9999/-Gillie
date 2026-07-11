# Gillie

Gillie is a local-first quit-vaping wellness companion centered around a supportive aquatic buddy.

The root `index.html` is the canonical web source. Capacitor copies that same source into `www/`; the production build no longer applies hidden pricing or paywall patches during compilation.

## Web Preview

- App: `https://lavish9999.github.io/-Gillie/`
- Privacy: `https://lavish9999.github.io/-Gillie/privacy.html`
- Terms: `https://lavish9999.github.io/-Gillie/terms.html`
- Support: `https://lavish9999.github.io/-Gillie/support.html`

## Install and validate

```bash
npm install
npm run validate:phase1
npm run cap:sync:ios
```

Open the native project with:

```bash
npm run cap:open:ios
```

## Phase 1 production foundation

- Real local iOS reminders through `@capacitor/local-notifications`
- Evening check-in reminders, craving follow-ups, milestones, inactivity recovery, and Plus danger-window alerts
- Local-calendar-day check-ins rather than UTC-day boundaries
- StoreKit 2 transaction update listener and verified entitlement refresh
- Cached entitlement grace in the web runtime to avoid flashing paid users back to Free during a transient check
- StoreKit-localized subscription prices
- Apple subscription-management link and restore flow
- MetricKit crash/diagnostic capture stored on-device
- Privacy-first event diagnostics that exclude journal text, pet names, and free-text slip details
- Direct Privacy, Terms, Support, and diagnostic-export controls inside Gillie
- Canonical paywall source with no build-time patching

## Gillie Plus

Product IDs:

- `gillie.plus.monthly`
- `gillie.plus.yearly`

Prices shown in the app are loaded from StoreKit for the customer’s storefront. The current fallback copy is `$3.99 / month` and `$29.99 / year`.

The native plugin is `ios/App/App/GilliePurchasesPlugin.swift`. It exposes:

- `getProducts()`
- `getEntitlementStatus()`
- `purchase({ productId })`
- `restorePurchases()`
- `manageSubscriptions()`
- privacy-first diagnostic methods

## Codemagic

The `ios-capacitor-app-store` workflow:

1. Installs Node dependencies.
2. Validates the canonical Phase 1 source.
3. Syncs Capacitor and the Local Notifications plugin.
4. Applies App Store signing.
5. Builds and verifies build number `20`.
6. Uploads the IPA to TestFlight.

Keep App Store Connect keys, signing certificates, provisioning profiles, and team IDs in Codemagic—not in GitHub.

## Privacy and safety

Gillie is a general wellness companion, not medical treatment. Current quit data and diagnostic events are local-first. Gillie does not use advertising trackers or upload journal content to a Gillie server.

Use `PHASE1-QA.md` for the required device and TestFlight acceptance tests before release.
