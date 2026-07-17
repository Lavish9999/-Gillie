const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packagePath = path.join(root, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const pipeline = String(packageJson.scripts?.["prepare:cap"] || "");

const requiredOrder = [
  "node scripts/prepare-capacitor-web.js",
  "node scripts/prepare-single-launch.js",
  "node scripts/inject-phase3.js",
  "node scripts/harden-phase3-pricing.js",
  "node scripts/inject-support-recovery.js",
  "node scripts/apply-release-safety.js",
  "node scripts/inject-reef-layout-fixes.js",
  "node scripts/inject-moonlit-reef.js",
  "node scripts/inject-visual-integrity.js",
  "node scripts/prepare-ios-release.js",
  "node scripts/write-build-provenance.js",
];

let previousIndex = -1;
for (const command of requiredOrder) {
  const index = pipeline.indexOf(command);
  if (index < 0) throw new Error(`prepare:cap is missing required command: ${command}`);
  if (index <= previousIndex) throw new Error(`prepare:cap command order is invalid near: ${command}`);
  previousIndex = index;
}

const launchPrep = fs.readFileSync(path.join(root, "scripts/prepare-single-launch.js"), "utf8");
for (const marker of ["gillie-boot-pending", "gillie-launch-bootstrap", "SINGLE LAUNCH HANDOFF", "Grow clean"]) {
  if (!launchPrep.includes(marker)) throw new Error(`Single-launch preparation is missing: ${marker}`);
}

const phase3Injector = fs.readFileSync(path.join(root, "scripts/inject-phase3.js"), "utf8");
if (!phase3Injector.includes('ENGINE = "store-pricing-v2-retryable"')) {
  throw new Error("Phase 3 injector does not accept the current retryable StoreKit pricing engine.");
}
if (phase3Injector.includes('ENGINE = "store-pricing-v1"')) {
  throw new Error("Phase 3 injector still rejects the current StoreKit pricing engine using the obsolete v1 marker.");
}

const supportInjector = fs.readFileSync(path.join(root, "scripts/inject-support-recovery.js"), "utf8");
for (const marker of [
  '"v1/entitlement-sync.js"',
  '"v1/theme-access.js"',
  '"v1/launch-handoff.js"',
  'data-gillie-v1-entitlement-sync="true"',
  'data-gillie-v1-theme-access="true"',
  'data-gillie-v1-launch-handoff="true"',
]) {
  if (!supportInjector.includes(marker)) throw new Error(`Launch/Plus/theme injector is missing: ${marker}`);
}

const safetySource = fs.readFileSync(path.join(root, "scripts/apply-release-safety.js"), "utf8");
if (!safetySource.includes('path.join(root, "www", "phase5-paywall.js")')) {
  throw new Error("Release safety no longer validates the generated Phase 5 paywall.");
}

const pricingHardener = fs.readFileSync(path.join(root, "scripts/harden-phase3-pricing.js"), "utf8");
for (const marker of ["hardenPhase3Pricing", "Annual billing", "Monthly billing"]) {
  if (!pricingHardener.includes(marker)) throw new Error(`Phase 3 pricing hardener is missing: ${marker}`);
}

const provenance = fs.readFileSync(path.join(root, "scripts/write-build-provenance.js"), "utf8");
for (const marker of [
  'const ALLOWED_PRODUCTION_REFS = ["main", "native-ios-launch"]',
  "purchase-flow-v3-production-branch",
  "store-pricing-v2-retryable",
  "entitlement-sync-v1-always-on",
  "theme-access-v1-basic-free",
  "theme-engine-v2-multitank-level-rewards",
  "theme-paint-v1",
  "launch-handoff-v1-single-intro",
  "entitlementSyncEngine",
  "themeAccessEngine",
  "launchHandoffEngine",
  "allowedProductionRefs: ALLOWED_PRODUCTION_REFS",
]) {
  if (!provenance.includes(marker)) throw new Error(`Build provenance is missing: ${marker}`);
}
if (provenance.includes('branch !== "native-ios-launch"')) {
  throw new Error("Build provenance still rejects synchronized main builds.");
}

const launchScreen = fs.readFileSync(path.join(root, "ios/App/App/Base.lproj/LaunchScreen.storyboard"), "utf8");
if (launchScreen.includes('image="Splash"')) throw new Error("Native launch screen still displays the legacy image splash.");
if (!launchScreen.includes('red="0.9176470588"')) throw new Error("Native launch screen does not match the animated intro background.");

const releaseValidator = fs.readFileSync(path.join(root, "scripts/validate-release-critical.js"), "utf8");
for (const marker of [
  'run(process.execPath, ["scripts/test-entitlement-sync.js"])',
  'run(process.execPath, ["scripts/test-theme-access.js"])',
  'run(process.execPath, ["scripts/test-paywall-presenter.js"])',
  'run(process.execPath, ["scripts/test-launch-experience.js"])',
  "StoreKit-verified trial gating",
]) {
  if (!releaseValidator.includes(marker)) throw new Error(`Focused release validation is missing: ${marker}`);
}

const codemagic = fs.readFileSync(path.join(root, "codemagic.yaml"), "utf8");
for (const marker of [
  "Codemagic source ref:",
  "purchase-flow-v3-production-branch",
  "store-pricing-v2-retryable",
  "theme-engine-v2-multitank-level-rewards",
  "theme-paint-v1",
  "build-source.json",
  "Verify final App Store IPA",
  'node scripts/verify-final-web-assets.js "$app_path/public"',
]) {
  if (!codemagic.includes(marker)) throw new Error(`Codemagic signed-IPA verification is missing: ${marker}`);
}

const interactionInjector = fs.readFileSync(path.join(root, "scripts/inject-progress-rescue.js"), "utf8");
for (const marker of [
  "v1/followup-rescue.js",
  'data-gillie-v1-followup-rescue="true"',
  "Follow-up rescue must load after the interaction director",
]) {
  if (!interactionInjector.includes(marker)) throw new Error(`Follow-up interaction build contract is missing: ${marker}`);
}

require("./test-followup-rescue");
console.log("Build pipeline test passed: one seamless launch, synchronized production refs, boot-time Plus restoration, working core themes, direct craving follow-up controls, and exact signed-IPA verification are required.");
