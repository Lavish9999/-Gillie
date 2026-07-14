const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const jsPath = path.join(root, "v1", "launch-experience.js");
const cssPath = path.join(root, "v1", "launch-experience.css");
const handoffPath = path.join(root, "v1", "launch-handoff.js");
const preparePath = path.join(root, "scripts", "prepare-single-launch.js");
const injectorPath = path.join(root, "scripts", "inject-support-recovery.js");
const nativePath = path.join(root, "ios", "App", "App", "GilliePurchasesPlugin.swift");
const launchScreenPath = path.join(root, "ios", "App", "App", "Base.lproj", "LaunchScreen.storyboard");

for (const file of [jsPath, cssPath, handoffPath, preparePath, injectorPath, nativePath, launchScreenPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing launch-experience dependency: ${path.relative(root, file)}`);
}

const source = fs.readFileSync(jsPath, "utf8");
const styles = fs.readFileSync(cssPath, "utf8");
const handoff = fs.readFileSync(handoffPath, "utf8");
const prepare = fs.readFileSync(preparePath, "utf8");
const injector = fs.readFileSync(injectorPath, "utf8");
const native = fs.readFileSync(nativePath, "utf8");
const launchScreen = fs.readFileSync(launchScreenPath, "utf8");

for (const marker of [
  'const ENGINE = "launch-experience-v1"',
  'className = "gillie-launch-intro"',
  "previousSplash.replaceWith(intro)",
  "Stay clean · Keep the water clear",
  'document.dispatchEvent(new CustomEvent("gillie:launch-intro-complete"',
  "function ratingEligibility()",
  'reason: "first_craving_win"',
  'reason: "three_checkins"',
  'reason: "three_clean_days"',
  "function installSlipCopyGuard()",
  '"I didn\'t vape"',
  "watchForMeaningfulEngagement()",
  "first_setup_rating_prompt_shown",
  "Rate Gillie",
  "Maybe later",
  "plugin?.requestReview",
  "safeWrite(LEGACY_REVIEW_KEY, String(Date.now()))",
  "window.GillieLaunchExperience",
]) {
  if (!source.includes(marker)) throw new Error(`Launch-experience source is missing marker: ${marker}`);
}

for (const marker of [
  ".gillie-launch-intro",
  ".gillie-launch-pet",
  "gillieLaunchSwimIn",
  ".gillie-rating-overlay",
  ".gillie-rating-card",
  ".phase2-reef-filters button",
  "#plus-overlay .gp-close",
  "min-height:44px!important",
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
  "watchForFirstSetup(",
]) {
  if (source.includes(forbidden)) throw new Error(`Launch rating flow contains forbidden or obsolete behavior: ${forbidden}`);
}

for (const marker of [
  "prepare-single-launch.js",
  "gillie-boot-pending",
  "gillie-launch-bootstrap",
  "SINGLE LAUNCH HANDOFF",
  "Original splash markup was not found exactly once",
  "Original splash CSS block was not found exactly once",
]) {
  const target = marker === "prepare-single-launch.js" ? fs.readFileSync(path.join(root, "package.json"), "utf8") : prepare;
  if (!target.includes(marker)) throw new Error(`Single-launch preparation is missing marker: ${marker}`);
}
for (const marker of [
  "launch-handoff-v1-single-intro",
  '#splash.gillie-launch-intro',
  'classList.remove("gillie-boot-pending")',
  "launch_handoff_released",
]) {
  if (!handoff.includes(marker)) throw new Error(`Launch handoff is missing marker: ${marker}`);
}
new Function(handoff);
new Function(source);

if (launchScreen.includes('image="Splash"')) throw new Error("Native launch screen still renders the original image before the animation.");
if (!launchScreen.includes('red="0.9176470588"') || !launchScreen.includes('green="0.9686274510"')) {
  throw new Error("Native launch screen does not match the first frame of the animated intro.");
}

for (const marker of [
  '"v1/launch-experience.css"',
  '"v1/launch-experience.js"',
  '"v1/launch-handoff.js"',
  'data-gillie-v1-launch-experience-styles="true"',
  'data-gillie-v1-launch-experience="true"',
  'data-gillie-v1-launch-handoff="true"',
  "launch-experience-v1",
  "launch-handoff-v1-single-intro",
]) {
  if (!injector.includes(marker)) throw new Error(`Launch-experience injector is missing marker: ${marker}`);
}

for (const marker of [
  'CAPPluginMethod(name: "requestReview"',
  "@objc func requestReview",
  "SKStoreReviewController.requestReview",
]) {
  if (!native.includes(marker)) throw new Error(`Native review bridge is missing marker: ${marker}`);
}
if (native.includes("setInterfaceStyle")) {
  throw new Error("Obsolete native interface-style bridge remains in the iOS plugin.");
}

const eligibility = source.indexOf("function ratingEligibility()");
const scheduler = source.indexOf("function tryScheduleRatingPrompt()", eligibility);
const watcher = source.indexOf("watchForMeaningfulEngagement()", scheduler);
if (eligibility < 0 || scheduler < eligibility || watcher < scheduler) {
  throw new Error("Rating request must be eligibility-gated before the engagement watcher schedules it.");
}

const rateHandler = source.indexOf('$(".gillie-rating-primary", overlay)?.addEventListener');
const stateWrite = source.indexOf('saveRatingState("requested"', rateHandler);
const nativeRequest = source.indexOf("setTimeout(requestNativeReview", rateHandler);
if (rateHandler < 0 || stateWrite < rateHandler || nativeRequest < stateWrite) {
  throw new Error("Rating invitation must persist its one-time state before requesting the native review sheet.");
}

console.log("Launch tests passed: Gillie uses one safe intro, waits for meaningful engagement before rating, repairs slip copy, preserves reduced motion, keeps 44pt compact actions, and removes the obsolete native interface bridge.");
