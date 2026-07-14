const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packagePath = path.join(root, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const pipeline = String(packageJson.scripts?.["prepare:cap"] || "");

const requiredOrder = [
  "node scripts/prepare-capacitor-web.js",
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
  if (index <= previousIndex) {
    throw new Error(`prepare:cap command order is invalid near: ${command}`);
  }
  previousIndex = index;
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
  "theme-engine-v2-multitank-level-rewards",
  "theme-paint-v1",
  "allowedProductionRefs: ALLOWED_PRODUCTION_REFS",
]) {
  if (!provenance.includes(marker)) throw new Error(`Build provenance is missing: ${marker}`);
}
if (provenance.includes('branch !== "native-ios-launch"')) {
  throw new Error("Build provenance still rejects synchronized main builds.");
}

console.log("Build pipeline test passed: release injectors run in order and synchronized production refs require exact commerce/theme code.");
