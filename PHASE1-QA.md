# Gillie V1 final release QA

Run every blocking item on a physical iPhone using the newest TestFlight build produced from `main`. Do not submit an older TestFlight build after this checklist changes.

## 1. Build and binary blockers

- [ ] Codemagic uses `npm ci` and `npm run validate:ship` succeeds.
- [ ] `npx cap sync ios` installs Local Notifications and preserves the app privacy manifest.
- [ ] Xcode/Codemagic compiles `GilliePurchasesPlugin.swift` and `AppDelegate.swift` without errors.
- [ ] The final IPA bundle ID is `com.lavish9999.gillie` and its build number matches Codemagic’s automatic build number.
- [ ] The final IPA contains `PrivacyInfo.xcprivacy` with the UserDefaults reason `CA92.1`.
- [ ] The final IPA targets iPhone only for V1; no untested native iPad target is included.
- [ ] The final IPA contains no Google Fonts request or other unexpected remote web dependency.
- [ ] The 1024×1024 App Store icon is opaque and renders correctly in TestFlight.

## 2. Cold launch and navigation

- [ ] Fresh install reaches onboarding without a blank screen or stuck splash.
- [ ] Existing-user upgrade preserves the streak, check-ins, cravings, pearls, owned items, and entitlement.
- [ ] Home scrolls only through Home content; Reef never appears below it.
- [ ] Progress scrolls only through Progress content; Reef never appears below it.
- [ ] Reef and You each remain isolated from every other tab.
- [ ] Rapidly switch Home → Progress → Reef → You at least ten times with no stacked screens, frozen scrolling, or tab mismatch.
- [ ] Force-close from each tab and reopen; the app launches normally.

## 3. Onboarding and core recovery

- [ ] Complete onboarding once with Vapes and once with Cigarettes on a clean install/reset.
- [ ] Optional cost/usage details expand and save correctly.
- [ ] The timer begins immediately after hatching and survives force-close/reopen.
- [ ] Daily check-in saves mood, clean/slip state, craving intensity, and optional note.
- [ ] Check in between 8 PM and midnight Eastern time; Gillie records the current local date.
- [ ] Coach, Today Plan, Home, and Progress agree on whether today’s check-in is complete.
- [ ] SOS breathing, trigger logging, delayed follow-up, craving-win confirmation, and slip recovery work end to end.
- [ ] A slip restarts the visible streak without deleting banked clean time, pearls, or previously rewarded milestones.

## 4. Notifications

- [ ] The contextual permission prompt appears after useful engagement, not at cold launch.
- [ ] Daily check-in reminder schedules for 8:30 PM local time.
- [ ] Turning a reminder off cancels the pending notification.
- [ ] Craving follow-up appears while Gillie is backgrounded/closed and opens the due follow-up when tapped.
- [ ] Upcoming milestone notification opens Progress.
- [ ] Inactivity reminder uses non-shaming copy.
- [ ] Plus danger-window reminder schedules only for an active Plus user.
- [ ] Notification behavior survives device restart and timezone change.

## 5. StoreKit and Gillie Plus

- [ ] Monthly and yearly products both load with localized TestFlight storefront prices.
- [ ] Monthly purchase success unlocks Plus immediately.
- [ ] Yearly purchase success unlocks Plus immediately.
- [ ] User-cancelled purchase leaves the paywall usable and shows that nothing was charged.
- [ ] Pending Ask to Buy does not falsely unlock Plus.
- [ ] Restore succeeds on the purchasing Apple ID and does not unlock on an Apple ID with no entitlement.
- [ ] Manage Subscription opens Apple subscription settings.
- [ ] Transaction updates unlock/relock without force-quitting.
- [ ] Airplane-mode launch after a recently verified purchase does not visibly flash Plus back to Free.
- [ ] Launch with no entitlement remains Free.
- [ ] Free users can preview Moonlit Reef but cannot equip it.
- [ ] Active Plus equips all Moonlit pieces and preserves them after force-close/reopen.
- [ ] Plus themes, skins, buddies, Coach, savings goal, insights, 2× pearls, and Reef rewards lock/unlock correctly.

## 6. Reef, progression, and backup

- [ ] Reef buy/equip/unequip works for free and Plus items, including Starfish.
- [ ] Reef XP, care-task claims, completion chest, level, and next unlock update once without duplicate rewards.
- [ ] Full Reef preview opens, blocks background interaction, scrolls only inside itself, and closes by X, action button, and downward swipe.
- [ ] Export Gillie backup opens the iOS share sheet and produces valid JSON.
- [ ] Restore the backup after changing data; streak history, check-ins, cravings, pearls, Reef progression, Moonlit state, items, and preferences return.
- [ ] Import never copies Gillie Plus entitlement; Apple re-verifies it.
- [ ] An older schema-v1 backup still imports without crashing.

## 7. Sheets, keyboard, and interaction

- [ ] Every non-SOS sheet closes by close button, backdrop where allowed, and downward drag.
- [ ] No sheet allows the background page to scroll.
- [ ] Long sheets scroll internally without trapping the close button.
- [ ] Text fields remain visible above the keyboard and save/cancel correctly.
- [ ] Rapid opening/closing does not leave `sheet-open`, `inert`, or a dim backdrop stuck.
- [ ] Reduced Motion does not break navigation, splash removal, overlays, Reef preview, or Gillie interaction.

## 8. Privacy, legal, and offline behavior

- [ ] Privacy, Terms, Support, and Manage Subscription open from You.
- [ ] Terms and Privacy links open from the paywall.
- [ ] Subscription renewal/cancellation copy is readable before purchase.
- [ ] Export Diagnostics opens the iOS share sheet and excludes pet name, notes, slip place, slip plan, and other free text.
- [ ] Erase Everything removes recovery state, preferences, diagnostics, and the local diagnostic install identifier while leaving Apple subscription ownership intact.
- [ ] After erasing, Gillie returns to onboarding and Apple can re-verify an existing subscription.
- [ ] Launch and all free core functions work in Airplane Mode.
- [ ] App privacy answers in App Store Connect match the binary: no advertising tracking and no Gillie-server data collection.
- [ ] Public Privacy Policy and Support URLs open outside the app.

## 9. Device presentation and accessibility

- [ ] Portrait layout is correct on a small iPhone and a current large iPhone.
- [ ] No clipped text at the largest practical Dynamic Type setting used by the app.
- [ ] VoiceOver can identify tabs, purchase/restore controls, close buttons, task actions, and form labels.
- [ ] Selected tabs expose the correct selected state and inactive views are not reachable by VoiceOver.
- [ ] Contrast is readable in Free, Plus, Moonlit, and reduced-transparency/reduced-motion conditions.

## 10. App Store Connect signoff

- [ ] App name, subtitle, description, keywords, category, copyright, support URL, and privacy URL are complete.
- [ ] Updated 2026 age-rating questions are answered accurately for nicotine-cessation content.
- [ ] Monthly and yearly subscriptions are in the intended subscription group and are Ready to Submit with localization and review screenshots.
- [ ] App screenshots match this exact build and do not show obsolete UI.
- [ ] App Review notes explain local-first storage, no login, StoreKit subscriptions, restore, notifications, SOS, Moonlit preview/equip boundary, and how to reach premium features.
- [ ] Export-compliance questions are answered accurately.
- [ ] Select the newest verified TestFlight build, save all metadata, then submit for review.
