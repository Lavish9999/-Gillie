# Gillie Phase 2 — Premium Polish QA

## Build gate

- `npm install`
- `npm run validate:phase2`
- `npx cap sync ios`
- Build and archive with the App Store distribution profile.
- Confirm IPA build number is `21`.

## Onboarding and hatch

- Complete onboarding with each supported habit type.
- Confirm the final hatch sequence runs once, shows the selected Gillie color/name, has working Skip, and enters the app without losing onboarding data.
- Enable Reduce Motion and confirm the hatch skips heavy animation.
- Test on iPhone SE-sized and Pro Max-sized screens.

## Living tank

- Tap Gillie and confirm the reaction, speech change, haptic, and optional sound.
- Move a finger across the tank and confirm Gillie follows without leaving the tank bounds.
- Confirm random living animations do not block buttons or tank decorations.
- Earn pearls and confirm the counter animates without changing the actual balance twice.
- Preview and randomize the tank from The Reef.

## Home hierarchy

- Verify the primary action changes for morning, evening check-in, active follow-up, danger window, and normal fallback.
- Swipe the home carousel and confirm all existing cards remain functional.
- Confirm hidden savings goals remain hidden.

## Craving SOS

- Open SOS and complete a full 60-second reset.
- Change intensity and trigger; confirm values persist into the most recent craving record when possible.
- Confirm breathing phase haptics, countdown, progress bar, personalized reasons, passed, used, and close paths.
- Confirm the 10-minute follow-up notification is still scheduled/cancelled correctly.
- Confirm Reduce Motion, Sound Off, and Haptics Off settings are respected.

## Progress

- Test 7-day, 30-day, and All ranges.
- Verify hourly cravings, clean calendar, first-week comparison, and empty states with zero, partial, and full data.
- Tap recent check-ins and calendar days to open details.
- Test Share with and without the iOS share sheet.
- Confirm no private note is placed into share text.

## Reef

- Verify All, Owned, and Plus filters.
- Confirm badges accurately update after equipping or purchasing.
- Preview tank and close the preview with both close controls.
- Randomize as Free and Plus users; confirm locked content is not applied to Free users.

## Gillie Plus

- Confirm personalized danger-window/trigger copy updates when opening the paywall.
- Confirm yearly/monthly localized StoreKit prices still render.
- Purchase, cancel, pending, fail, and restore paths must all remove loading states.
- Successful purchase should close the paywall, retain entitlement, and trigger the tank celebration.
- Manage subscription, terms, privacy, and support links must remain functional.

## Accessibility and resilience

- VoiceOver: tabs, tank, dialogs, SOS controls, calendar cells, and settings have useful labels.
- Dynamic text: Compact, Default, Large, and Extra Large do not clip primary actions or sheets.
- Keyboard: all text fields remain visible when editing.
- Offline: banner appears and local tracking/check-ins continue.
- Reduced Motion: no looping tank, hatch, celebration, or SOS background animations.
- Verify all interactive controls have at least a 44-point target.
- Trigger a growth milestone at 3+ days and confirm the native review request is attempted only after the celebration closes and respects cooldown.
