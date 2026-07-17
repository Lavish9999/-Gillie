# Gillie App Store submission sheet

Use this only with the newest TestFlight build created from the current `main` branch after Codemagic’s final IPA verification passes.

## Recommended listing

**App name**  
Gillie — Quit Vaping

**Subtitle**  
Quit nicotine with Gillie

**Primary category**  
Health & Fitness

**Secondary category**  
Lifestyle

**Promotional text**  
Protect the next clean moment with a supportive aquatic companion, Craving SOS, daily check-ins, recovery progress, and a reef that grows with you.

**Keywords draft**  
quit vaping,nicotine,smoke free,craving tracker,quit smoking,streak,habit,wellness

**Description draft**

Gillie is a private, local-first nicotine-quitting companion built around one small aquatic friend.

Every clean moment clears Gillie’s water and helps the reef grow. Gillie keeps the focus practical: protect the next decision, learn what triggers cravings, and recover without shame when a day does not go as planned.

Core tools include:

- A live clean-time streak and recovery milestones
- Craving SOS with a calm breathing step and follow-up
- Daily check-ins for mood, cravings, and clean status
- Personal patterns from your own check-ins and craving logs
- A growing reef, collectible items, pearls, and care actions
- Slip recovery that protects banked progress and lessons learned
- Local iPhone reminders
- Private backup, restore, diagnostics export, and data erase controls

Gillie Plus adds deeper planning and customization, including Coach missions, advanced insights, danger-window planning, premium reef themes and colors, tank mates, the Moonlit Reef collection, and doubled pearl rewards.

Gillie does not require an account. Current recovery information stays on the device unless the user deliberately exports and shares a backup or diagnostic report.

Gillie supports general wellness and behavior change. It is not medical treatment and does not replace professional medical advice or cessation care.

**Support URL**  
https://lavish9999.github.io/-Gillie/support.html

**Privacy Policy URL**  
https://lavish9999.github.io/-Gillie/privacy.html

**Terms URL**  
https://lavish9999.github.io/-Gillie/terms.html

## Subscription configuration

Subscription group: **Gillie Plus**

- Monthly product ID: `gillie.plus.monthly`
- Yearly product ID: `gillie.plus.yearly`

Before submission, confirm both products:

- Are in the same subscription group
- Are Cleared for Sale / Ready to Submit
- Have display name, description, price, and localization
- Have an App Review screenshot
- Are attached to this app version when required by App Store Connect
- Match the prices shown in the newest TestFlight storefront

### Optional free trial (introductory offer)

The paywall is trial-aware but never invents a trial. It reads the
introductory offer and per-user eligibility directly from StoreKit:

- No introductory offer configured → the paywall shows the standard
  "Meet Gillie Plus" presentation with no trial language.
- A **Free** introductory offer configured on a product (for example
  7 days on `gillie.plus.yearly`) → eligible users see "Try Gillie Plus
  free", the trial badge, the trial timeline, "No payment due today",
  and a CTA derived from the real trial length. Ineligible users
  (previous subscribers) automatically see the standard presentation.

To enable the 7-day trial, add an Introductory Offer of type **Free**
with duration **1 week** to the chosen product in App Store Connect →
Subscriptions. No app change or resubmission is needed to turn it on or off.

## App Review notes — ready to paste

Gillie is a local-first nicotine-quitting wellness companion. The app does not require an account or sign-in. Recovery information is stored on the device unless the user deliberately exports and shares a backup or diagnostic report.

### Core review path
1. Complete the short onboarding and hatch Gillie.
2. The Home tab shows the live clean-time tank and the next recommended action.
3. Tap the coral droplet button to open Craving SOS.
4. Use Progress to review free recovery patterns and milestones.
5. Use Reef to view progression, daily care actions, customization, and premium collection previews.
6. Use You for reminders, backup/export, diagnostics, privacy, terms, support, subscription management, and data erase.

### Gillie Plus / in-app purchases
Gillie Plus uses Apple StoreKit 2 auto-renewable subscriptions:
- `gillie.plus.monthly`
- `gillie.plus.yearly`

The paywall can be opened from **You → Gillie Plus**, from a locked Plus feature, or from the Plus collection area in Reef. Prices are loaded from StoreKit for the current storefront.

To review Moonlit Reef:
1. Open **Reef**.
2. Open the **Moonlit Reef** seasonal collection.
3. Previewing the collection is free.
4. Selecting **Equip with Plus** opens the Apple subscription paywall for a free user.
5. With an active entitlement, the full Moonlit theme, Moon Pearl color, animated ambience, moon-jelly, Crescent Arch, and Star Coral equip together.

To restore an existing purchase, open the Gillie Plus paywall and select **Restore purchases**. **You → Manage subscription** opens Apple’s subscription settings.

A cancelled or pending purchase does not unlock paid features. Entitlement is verified through StoreKit and is never imported from a Gillie backup.

### Notifications
Gillie uses local notifications only. The contextual notification permission request is shown after useful engagement rather than at cold launch. Reminders can be disabled in the You tab or iPhone Settings.

### Wellness scope
Gillie provides general wellness, habit-change, tracking, reflection, and motivational tools. It is not medical treatment and does not diagnose, treat, cure, or prevent disease.

### Reviewer access
No demo account, external hardware, or special server configuration is required. An internet connection is required only for Apple StoreKit operations and external policy/support pages; core tracking works offline.

## App privacy answers — verify before saving

The current binary is designed around these facts:

- No account or sign-in
- No advertising SDK
- No cross-app or cross-site tracking
- No Gillie analytics server
- Recovery data stays on device
- Technical diagnostics stay on device unless the user deliberately exports and shares them
- Purchases are handled by Apple
- Local notifications do not use a Gillie push server

App Store Connect privacy answers must match those facts. Do not select tracking. Review any support workflow honestly: a user may voluntarily email Gillie Support and may choose to attach exported diagnostics, but the app does not automatically transmit that report.

## Age rating and content declarations

Complete the current App Store Connect age-rating questionnaire manually. Gillie discusses nicotine and vaping only in the context of quitting and recovery. It does not sell, facilitate, glamorize, or encourage tobacco/nicotine use. Gillie has no user-generated content, chat, gambling, violence, sexual content, or unrestricted in-app web browser.

## Export compliance

The iOS bundle declares `ITSAppUsesNonExemptEncryption = false`. Answer App Store Connect consistently: Gillie does not implement proprietary or non-exempt encryption.

## Screenshots

Use screenshots from this exact release candidate. At minimum show:

1. Home tank and live clean-time state
2. Craving SOS
3. Progress / personal patterns
4. Reef progression and daily care
5. Reef customization or Moonlit preview
6. Gillie Plus value/paywall

Do not reuse screenshots showing the old stacked tabs, broken Reef preview, obsolete large gradient vault, fake LIVE/FREE badges, or any UI no longer present in this build.

## Final submit sequence

1. Run Codemagic from current `main`.
2. Confirm every validation and final IPA verification step is green.
3. Install that exact new TestFlight build.
4. Complete every blocking item in `PHASE1-QA.md` on a physical iPhone.
5. Verify both subscription products, purchase cancellation, purchase success, restore, and Manage Subscription.
6. Open the public Support and Privacy URLs in Safari.
7. Complete metadata, privacy answers, age rating, screenshots, subscription review information, agreements, tax, and banking.
8. Add the App Review notes above.
9. Select the newest verified build and submit for review.
