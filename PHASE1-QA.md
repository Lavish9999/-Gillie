# Gillie Phase 1 release QA

Run every blocking item on a physical iPhone through the newest TestFlight build.

## Build blockers

- [ ] `npm install` succeeds.
- [ ] `npm run validate:phase1` succeeds.
- [ ] `npx cap sync ios` installs LocalNotifications.
- [ ] Xcode/Codemagic compiles `GilliePurchasesPlugin.swift` and `AppDelegate.swift` without warnings promoted to errors.
- [ ] IPA reports build number 20.

## Date correctness

- [ ] Check in between 8 PM and midnight Eastern time; Gillie records the current local date.
- [ ] Move the simulator/device timezone across a UTC date boundary and confirm one check-in per local day.
- [ ] Coach, Today Plan, and the home check-in card agree on whether today is complete.

## Notifications

- [ ] First contextual permission prompt appears after a successful check-in, not at cold launch.
- [ ] Daily check-in reminder schedules for 8:30 PM local time.
- [ ] Turning the setting off cancels the pending notification.
- [ ] Craving follow-up appears when Gillie is backgrounded/closed.
- [ ] Tapping a craving follow-up opens the due follow-up.
- [ ] Upcoming milestone notification opens Progress.
- [ ] Inactivity reminder uses non-shaming copy.
- [ ] Plus danger-window reminder schedules 30 minutes before the highest-risk block.
- [ ] Notification behavior survives device restart and timezone change.

## StoreKit

- [ ] Monthly and yearly prices match the TestFlight storefront.
- [ ] Purchase success unlocks Plus immediately.
- [ ] User-cancelled purchase leaves the paywall usable and shows correct status.
- [ ] Pending Ask to Buy does not falsely unlock Plus.
- [ ] Restore succeeds on the purchasing Apple ID.
- [ ] Manage subscription opens Apple subscription settings.
- [ ] Transaction updates unlock/relock without force-quitting.
- [ ] Launch in airplane mode after a recently verified purchase does not flash Plus back to Free.
- [ ] Launch with no entitlement remains Free.

## Paywall and legal

- [ ] The final paywall is present directly in root `index.html`.
- [ ] `scripts/gillie-plus-paywall.patch` no longer exists.
- [ ] Terms and Privacy links open from the paywall.
- [ ] Privacy, Terms, Support, and Manage Subscription open from You.
- [ ] Subscription renewal copy is readable before purchase.

## Diagnostics and privacy

- [ ] Export diagnostics opens the iOS share sheet.
- [ ] Export contains app/build, event names, and MetricKit payloads when available.
- [ ] Export does not contain pet name, journal note, slip place, slip plan, or other free text.
- [ ] Erase Everything removes quit state.
- [ ] No third-party advertising or tracking SDK appears in the binary.

## Regression

- [ ] Onboarding completes for vape and cigarette profiles.
- [ ] SOS breathing, trigger logging, delayed confirmation, and slip recovery all work.
- [ ] Reef buy/equip/unequip works, including Starfish.
- [ ] Gillie Plus themes, skins, buddies, Coach, savings goal, and insights remain locked/unlocked correctly.
- [ ] Every sheet closes by close button, backdrop where allowed, and drag dismissal.
- [ ] Reduced Motion does not break navigation or overlays.
- [ ] Portrait layout is correct on small and large iPhones.
