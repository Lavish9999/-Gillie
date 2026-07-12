# Gillie V1 canonical architecture

Gillie's original Phase 1–5 assets remain as compatibility layers for the shipped state model, StoreKit bridge, aquarium rendering, and existing user migrations. New launch work must not add Phase 6 files or one-off hotfix stylesheets.

Canonical V1 ownership is now split by screen:

- `core.js` — one boot coordinator, render-hook chain, and authoritative tab isolation
- `onboarding.js` — nicotine-focused setup and deferred estimate fields
- `sos.js` — relief-first SOS presentation
- `progress.js` — free basic patterns and premium prediction boundary
- `reef.js` — curated collection rules
- `reef-dashboard.js` — Reef progression, daily care, and collection value
- `coach.js` — focused intervention-first Coach flow
- `backup.js` — portable recovery backup and entitlement-safe import
- `v1.css` — screen-specific styles and the one-view/one-scroll-container layout contract

## Runtime rules

1. V1 modules may not create `MutationObserver` loops.
2. V1 modules may not add recurring `setInterval` polling.
3. Every installer must be idempotent.
4. `core.js` is the only authority for active tabs. Exactly one of Home, Progress, Reef, or You may participate in layout or receive interaction at a time.
5. Inactive views must remain `hidden`, `aria-hidden`, and `inert`, with `data-v1-active="false"` as a second layout boundary.
6. StoreKit product IDs and entitlement verification remain owned by the native purchase bridge.
7. Imported backups never activate Gillie Plus; Apple re-verifies entitlement.
8. New screen work belongs in the matching canonical module, not another patch layer.

`scripts/smoke-v1.js` and `scripts/test-v1-coordinator.js` enforce the core asset, architecture, tab-isolation, backup, and StoreKit contracts during `npm run validate:ship`.
