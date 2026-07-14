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
const themeEngine = read("v1/theme-engine.js");
const launchExperience = read("v1/launch-experience.js");
const supportStyles = read("v1/support-recovery.css");
const launchStyles = read("v1/launch-experience.css");

for (const marker of [
  'data-gillie-v1-support-recovery-styles="true"',
  'data-gillie-v1-launch-experience-styles="true"',
  'data-gillie-v1-sos-support="true"',
  'data-gillie-v1-welcome-recovery="true"',
  'data-gillie-v1-purchase-flow="true"',
  'data-gillie-v1-theme-engine="true"',
  'data-gillie-v1-launch-experience="true"',
]) {
  if (!html.includes(marker)) throw new Error(`Generated index is missing marker: ${marker}`);
}
for (const marker of ["1-800-QUIT-NOW", "QUITNOW to 333888", "sos_human_support_opened"]) {
  if (!sos.includes(marker)) throw new Error(`Generated SOS support is missing: ${marker}`);
}
for (const marker of ["welcome-recovery-v1", "recoverWelcomeBundle", "plus_welcome_bundle_recovered"]) {
  if (!recovery.includes(marker)) throw new Error(`Generated welcome recovery is missing: ${marker}`);
}
for (const marker of [
  "purchase-flow-v1",
  "entitlementChanged",
  "Opening Apple…",
  "Confirming your Apple subscription",
  "Purchase pending with Apple",
]) {
  if (!purchaseFlow.includes(marker)) throw new Error(`Generated purchase flow is missing: ${marker}`);
}
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
  "launch-experience-v1",
  "Stay clean · Keep the water clear",
  "first_setup_rating_prompt_shown",
  "requestNativeReview",
  "Rate Gillie",
  "GillieLaunchExperience",
]) {
  if (!launchExperience.includes(marker)) throw new Error(`Generated launch experience is missing: ${marker}`);
}
for (const marker of [".gillie-launch-intro", ".gillie-rating-overlay", "gillieLaunchSwimIn", "prefers-reduced-motion"]) {
  if (!launchStyles.includes(marker)) throw new Error(`Generated launch styles are missing: ${marker}`);
}
if (!supportStyles.includes(".v1-sos-support-sheet")) throw new Error("Generated support styles are missing.");

console.log("Generated cinematic launch, first-setup rating prompt, SOS support, welcome recovery, purchase flow, and Reef theme-engine smoke checks passed.");
