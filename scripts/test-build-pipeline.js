const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packagePath = path.join(root, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const pipeline = String(packageJson.scripts?.["prepare:cap"] || "");

const requiredOrder = [
  "node scripts/prepare-capacitor-web.js",
  "node scripts/inject-phase3.js",
  "node scripts/apply-release-safety.js",
  "node scripts/inject-reef-layout-fixes.js",
  "node scripts/inject-moonlit-reef.js",
  "node scripts/inject-visual-integrity.js",
  "node scripts/prepare-ios-release.js",
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

console.log("Build pipeline test passed: Phase 5 is generated before release safety and all later injectors run afterward.");
