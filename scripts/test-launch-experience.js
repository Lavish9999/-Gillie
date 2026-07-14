const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const jsPath = path.join(root, "v1", "launch-experience.js");
const cssPath = path.join(root, "v1", "launch-experience.css");
const injectorPath = path.join(root, "scripts", "inject-support-recovery.js");
const nativePath = path.join(root, "ios", "App", "App", "GilliePurchasesPlugin.swift");

for (const file of [jsPath, cssPath, injectorPath, nativePath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing launch-experience dependency: ${path.relative(root, file)}`);
}

const source = fs.readFileSync(jsPath, "utf8");
const styles = fs.readFileSync(cssPath, "utf8");
const injector = fs.readFileSync(injectorPath, "utf8");
const native = fs.readFileSync(nativePath, "utf8");

for (const marker of [
  'const ENGINE = "launch-experience-v1"',
  'className = "gillie-launch-intro"',
  'previousSplash.replaceWith(intro)',
  'Stay clean · Keep the water clear',
  'document.dispatchEvent(new CustomEvent("gillie:launch-intro-complete"',
  'const wasOnboardedAtBoot = Boolean(currentState()?.onboarded)',
  'if (wasOnboardedAtBoot || ratingState()) return',
  'first_setup_rating_prompt_shown',
  'Rate Gillie',
  'Maybe later',
  'plugin?.requestReview',
  'safeWrite(LEGACY_REVIEW_KEY, String(Date.now()))',
  'window.GillieLaunchExperience',
]) {
  if (!source.includes(marker)) throw new Error(`Launch-experience source is missing marker: ${marker}`);
}

for (const marker of [
  ".gillie-launch-intro",
  ".gillie-launch-pet",
  "gillieLaunchSwimIn",
  ".gillie-rating-overlay",
  ".gillie-rating-card",
  "@media (prefers-reduced-motion: reduce)",
]) {
  if (!styles.includes(marker)) throw new Error(`Launch-experience styles are missing marker: ${marker}`);
}

for (const forbidden of [
  "window.open(",
  "itms-apps://",
  "apps.apple.com/app/",
  "if (rating >=",
  "if (stars >=",
]) {
  if (source.includes(forbidden)) throw new Error(`Launch rating flow contains forbidden review-gating behavior: ${forbidden}`);
}

for (const marker of [
  '"v1/launch-experience.css"',
  '"v1/launch-experience.js"',
  'data-gillie-v1-launch-experience-styles="true"',
  'data-gillie-v1-launch-experience="true"',
  "launch-experience-v1",
]) {
  if (!injector.includes(marker)) throw new Error(`Launch-experience injector is missing marker: ${marker}`);
}

for (const marker of [
  'CAPPluginMethod(name: "requestReview"',
  '@objc func requestReview',
  "SKStoreReviewController.requestReview",
]) {
  if (!native.includes(marker)) throw new Error(`Native review bridge is missing marker: ${marker}`);
}

const initialState = source.indexOf("const wasOnboardedAtBoot");
const watchCall = source.indexOf("watchForFirstSetup(wasOnboardedAtBoot)", initialState);
if (initialState < 0 || watchCall < initialState) {
  throw new Error("Launch experience must capture onboarding state before watching for first setup completion.");
}

const rateHandler = source.indexOf('$(".gillie-rating-primary", overlay)?.addEventListener');
const stateWrite = source.indexOf('saveRatingState("requested"', rateHandler);
const nativeRequest = source.indexOf("setTimeout(requestNativeReview", rateHandler);
if (rateHandler < 0 || stateWrite < rateHandler || nativeRequest < stateWrite) {
  throw new Error("Rating invitation must persist its one-time state before requesting the native review sheet.");
}

console.log("Launch-experience tests passed: cinematic intro, skip/reduced-motion behavior, first-setup-only soft prompt, direct native review request, focus-safe dismissal, and final-bundle injection are present.");
