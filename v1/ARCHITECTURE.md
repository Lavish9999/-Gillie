# Gillie V1 canonical architecture

Gillie's original Phase 1–5 assets remain as compatibility layers for the shipped state model, StoreKit bridge, aquarium rendering, and existing user migrations. New launch work must not add Phase 6 files or one-off hotfix stylesheets.

Canonical V1 ownership is now split by screen:

- `core.js` — one boot coordinator and render-hook chain
- `onboarding.js` — nicotine-focused setup and deferred estimate fields
- `sos.js` — relief-first SOS presentation
- `progress.js` — free basic patterns and premium prediction boundary
- `reef.js` — curated collection rules
- `coach.js` — focused intervention-first Coach flow
- `backup.js` — portable recovery backup and entitlement-safe import
- `v1.css` — screen-specific styles built on `gillie-foundation.css`

## Runtime rules

1. V1 modules may not create `MutationObserver` loops.
2. V1 modules may not add recurring `setInterval` polling.
3. Every installer must be idempotent.
4. StoreKit product IDs and entitlement verification remain owned by the native purchase bridge.
5. Imported backups never activate Gillie Plus; Apple re-verifies entitlement.
6. New screen work belongs in the matching canonical module, not another patch layer.

`scripts/smoke-v1.js` enforces the core asset, architecture, backup, and StoreKit contracts during `npm run validate:ship`.
