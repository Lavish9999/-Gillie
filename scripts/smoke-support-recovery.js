const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const read = (relative) => {
  const file = path.join(out, relative);
  if (!fs.existsSync(file)) throw new Error(`Missing generated launch/support asset: ${relative}`);
  return fs.readFileSync(file, "utf8");
};

const html = read("index.html");
const sos = read("v1/sos-support.js");
const recovery = read("v1/welcome-recovery.js");
const purchaseFlow = read("v1/purchase-flow.js");
const entitlementSync = read("v1/entitlement-sync.js");
const themeAccess = read("v1/theme-access.js");
const themeEngine = read("v1/theme-engine.js");
const themePaint = read("v1/theme-paint.js");
const launchExperience = read("v1/launch-experience.js");
const launchHandoff = read("v1/launch-handoff.js");
const supportStyles = read("v1/support-recovery.css");
const launchStyles = read("v1/launch-experience.css");

for (const marker of [
  'class="gillie-boot-pending"',
  "SINGLE LAUNCH HANDOFF",
  'data-gillie-v1-support-recovery-styles="true"',
  'data-gillie-v1-launch-experience-styles="true"',
  'data-gillie-v1-sos-support="true"',
  'data-gillie-v1-welcome-recovery="true"',
  'data-gillie-v1-purchase-flow="true"',
  'data-gillie-v1-entitlement-sync="true"',
  'data-gillie-v1-theme-access="true"',
  'data-gillie-v1-theme-engine="true"',
  'data-gillie-v1-theme-paint="true"',
  'data-gillie-v1-launch-experience="true"',
  'data-gillie-v1-launch-handoff="true"',
]) {
  if (!html.includes(marker)) throw new Error(`Generated index is missing marker: ${marker}`);
}
for (const forbidden of ["splash-orb", "Grow clean", "splashRise", "splashFloat"]) {
  if (html.includes(forbidden)) throw new Error(`Generated app still contains the legacy first splash: ${forbidden}`);
}
for (const marker of ["1-800-QUIT-NOW", "QUITNOW to 333888", "sos_human_support_opened"]) {
  if (!sos.includes(marker)) throw new Error(`Generated SOS support is missing: ${marker}`);
}
for (const marker of ["welcome-recovery-v1", "recoverWelcomeBundle", "plus_welcome_bundle_recovered"]) {
  if (!recovery.includes(marker)) throw new Error(`Generated welcome recovery is missing: ${marker}`);
}
for (const marker of [
  "purchase-flow-v1",
  "purchase-flow-v3-production-branch",
  "STORE_PRODUCTS_EMPTY",
  "Apple returned zero Gillie Plus products",
  "Copy purchase details",
  "entitlementChanged",
  "Opening Apple…",
  "Confirming your Apple subscription",
  "Purchase pending with Apple",
]) {
  if (!purchaseFlow.includes(marker)) throw new Error(`Generated purchase flow is missing: ${marker}`);
}
new Function(purchaseFlow);
for (const marker of [
  "entitlement-sync-v1-always-on",
  "app-boot",
  "app-boot-settled",
  "foreground",
  "purchase-settled",
  "entitlementChanged",
  "gillie:entitlement-updated",
  "GillieEntitlementSync",
]) {
  if (!entitlementSync.includes(marker)) throw new Error(`Generated entitlement sync is missing: ${marker}`);
}
new Function(entitlementSync);
for (const marker of [
  "theme-access-v1-basic-free",
  '"clear", "sunset", "abyss", "sakura"',
  "theme.premium = false",
  "GillieThemeAccess",
]) {
  if (!themeAccess.includes(marker)) throw new Error(`Generated theme access is missing: ${marker}`);
}
new Function(themeAccess);
for (const marker of [
  "theme-engine-v1",
  "#theme-row [data-theme]",
  "current.theme = theme.id",
  "gillie:theme-applied",
  "GillieThemeEngine",
]) {
  if (!themeEngine.includes(marker)) throw new Error(`Generated theme engine is missing: ${marker}`);
}
for (const marker of [
  "theme-paint-v1",
  "placeLayerAboveMurk",
  "--gillie-theme-water-top",
  "background-color",
  "reef_theme_painted",
  "gillie:theme-painted",
  "GillieThemePaint",
]) {
  if (!themePaint.includes(marker)) throw new Error(`Generated theme paint is missing: ${marker}`);
}
new Function(themePaint);
for (const marker of [
  "launch-experience-v1",
  "Stay clean · Keep the water clear",
  "first_setup_rating_prompt_shown",
  "requestNativeReview",
  "Rate Gillie",
  "GillieLaunchExperience",
]) {
  if (!launchExperience.includes(marker)) throw new Error(`Generated launch experience is missing: ${marker}`);
}
for (const marker of ["launch-handoff-v1-single-intro", "gillie-boot-pending", "launch_handoff_released"]) {
  if (!launchHandoff.includes(marker)) throw new Error(`Generated launch handoff is missing: ${marker}`);
}
new Function(launchHandoff);
for (const marker of [".gillie-launch-intro", ".gillie-rating-overlay", "gillieLaunchSwimIn", "prefers-reduced-motion"]) {
  if (!launchStyles.includes(marker)) throw new Error(`Generated launch styles are missing: ${marker}`);
}
if (!supportStyles.includes(".v1-sos-support-sheet")) throw new Error("Generated support styles are missing.");

console.log("Generated app smoke checks passed: one intro, StoreKit checkout, boot-time Plus entitlement sync, free core themes, Reef rewards, and direct tank paint are present.");
