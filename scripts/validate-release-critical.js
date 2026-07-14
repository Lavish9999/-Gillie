const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const read = (relative) => {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new Error(`Release-critical file is missing: ${relative}`);
  return fs.readFileSync(file, "utf8");
};

function requireMarker(relative, marker, label = marker) {
  const source = read(relative);
  if (!source.includes(marker)) {
    throw new Error(`Release-critical validation failed: ${label}\nFile: ${relative}\nMissing: ${marker}`);
  }
}

function forbidMarker(relative, marker, label = marker) {
  const source = read(relative);
  if (source.includes(marker)) {
    throw new Error(`Release-critical validation failed: ${label}\nFile: ${relative}\nObsolete marker: ${marker}`);
  }
}

function syntaxCheck(relative) {
  const file = path.join(root, relative);
  execFileSync(process.execPath, ["--check", file], { cwd: root, stdio: "inherit" });
}

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit", env: process.env });
}

for (const relative of [
  "scripts/prepare-single-launch.js",
  "scripts/inject-phase3.js",
  "scripts/inject-support-recovery.js",
  "scripts/test-theme-access.js",
  "scripts/test-entitlement-sync.js",
  "v1/entitlement-sync.js",
  "v1/theme-access.js",
  "v1/launch-handoff.js",
]) syntaxCheck(relative);
requireMarker("scripts/inject-phase3.js", 'ENGINE = "store-pricing-v2-retryable"', "current retryable StoreKit pricing contract");
forbidMarker("scripts/inject-phase3.js", 'ENGINE = "store-pricing-v1"', "obsolete StoreKit pricing contract");
requireMarker("scripts/prepare-single-launch.js", "gillie-launch-bootstrap", "single web launch handoff");
requireMarker("v1/entitlement-sync.js", "entitlement-sync-v1-always-on", "always-on Plus entitlement sync");
requireMarker("v1/theme-access.js", "theme-access-v1-basic-free", "working core theme access");
requireMarker("v1/launch-handoff.js", "launch-handoff-v1-single-intro", "single animated intro handoff");

console.log("Running focused runtime checks for Plus restoration and tank-theme access…");
run(process.execPath, ["scripts/test-entitlement-sync.js"]);
run(process.execPath, ["scripts/test-theme-access.js"]);

console.log("Preparing the exact Capacitor web bundle that will be signed…");
run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "prepare:cap"]);

for (const relative of [
  "v1/purchase-flow.js",
  "v1/store-pricing.js",
  "v1/entitlement-sync.js",
  "v1/theme-access.js",
  "v1/theme-engine.js",
  "v1/theme-paint.js",
  "v1/launch-handoff.js",
  "scripts/write-build-provenance.js",
  "scripts/verify-final-web-assets.js",
  "www/v1/purchase-flow.js",
  "www/v1/store-pricing.js",
  "www/v1/entitlement-sync.js",
  "www/v1/theme-access.js",
  "www/v1/theme-engine.js",
  "www/v1/theme-paint.js",
  "www/v1/launch-handoff.js",
]) syntaxCheck(relative);

const contracts = [
  ["v1/purchase-flow.js", "purchase-flow-v3-production-branch", "production purchase engine"],
  ["v1/purchase-flow.js", "Apple returned zero Gillie Plus products", "zero-product diagnosis"],
  ["v1/purchase-flow.js", "Copy purchase details", "purchase diagnostics"],
  ["v1/purchase-flow.js", "native.purchase({ productId: plan.id })", "native checkout call"],
  ["v1/purchase-flow.js", "restorePurchases", "restore purchases path"],
  ["v1/purchase-flow.js", "entitlementChanged", "native entitlement listener"],
  ["v1/store-pricing.js", "store-pricing-v2-retryable", "retryable StoreKit pricing"],
  ["v1/store-pricing.js", "getProducts", "native product lookup"],
  ["v1/entitlement-sync.js", "app-boot", "Plus entitlement restored at app boot"],
  ["v1/entitlement-sync.js", "foreground", "Plus entitlement refreshed on foreground"],
  ["v1/entitlement-sync.js", "gillie:entitlement-updated", "entitlement update event"],
  ["v1/theme-access.js", "theme-access-v1-basic-free", "core themes work without Plus"],
  ["v1/theme-access.js", 'new Set(["clear", "sunset", "abyss", "sakura"])', "free core theme list"],
  ["v1/theme-access.js", "window.GillieThemeEngine = wrapper", "theme engine blanket fallback adapter"],
  ["v1/theme-engine.js", "theme-engine-v2-multitank-level-rewards", "Reef reward/theme engine"],
  ["v1/theme-engine.js", "reef_level_reward_granted", "one-time level rewards"],
  ["v1/theme-paint.js", "theme-paint-v1", "visible tank painter"],
  ["v1/theme-paint.js", "--gillie-theme-water-top", "direct water painting"],
  ["v1/launch-handoff.js", "launch-handoff-v1-single-intro", "animated intro handoff"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'private let productIDs = ["gillie.plus.monthly", "gillie.plus.yearly"]', "native StoreKit product IDs"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'CAPPluginMethod(name: "getProducts"', "native product bridge"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'CAPPluginMethod(name: "purchase"', "native purchase bridge"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'CAPPluginMethod(name: "restorePurchases"', "native restore bridge"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "Product.products(for: productIDs)", "StoreKit 2 product request"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "Transaction.currentEntitlements", "verified entitlement lookup"],
  ["www/index.html", 'class="gillie-boot-pending"', "first-paint launch veil"],
  ["www/index.html", "SINGLE LAUNCH HANDOFF", "legacy splash replacement"],
  ["www/index.html", 'data-gillie-v1-purchase-flow="true"', "generated purchase script injection"],
  ["www/index.html", 'data-gillie-v1-entitlement-sync="true"', "generated entitlement sync injection"],
  ["www/index.html", 'data-gillie-v1-theme-access="true"', "generated theme access injection"],
  ["www/index.html", 'data-gillie-v1-theme-engine="true"', "generated theme engine injection"],
  ["www/index.html", 'data-gillie-v1-theme-paint="true"', "generated theme painter injection"],
  ["www/index.html", 'data-gillie-v1-launch-handoff="true"', "generated launch handoff injection"],
  ["www/v1/build-source.json", '"sourceCommit"', "generated commit provenance"],
  ["www/v1/build-source.json", '"commerceEngine": "purchase-flow-v3-production-branch"', "generated commerce provenance"],
  ["www/v1/build-source.json", '"themePaintEngine": "theme-paint-v1"', "generated theme provenance"],
];

for (const [relative, marker, label] of contracts) requireMarker(relative, marker, label);
forbidMarker("www/index.html", "splash-orb", "legacy web splash artwork");
forbidMarker("www/index.html", "Grow clean", "legacy web splash subtitle");
forbidMarker("ios/App/App/Base.lproj/LaunchScreen.storyboard", 'image="Splash"', "legacy native image splash");

for (const relative of [
  "purchase-flow.js",
  "store-pricing.js",
  "entitlement-sync.js",
  "theme-access.js",
  "theme-engine.js",
  "theme-paint.js",
  "launch-handoff.js",
]) {
  const source = read(`v1/${relative}`);
  const generated = read(`www/v1/${relative}`);
  if (source !== generated) throw new Error(`Generated asset does not match source: v1/${relative}`);
}

run(process.execPath, ["scripts/verify-final-web-assets.js", "www"]);
console.log("Release-critical validation passed: one fluid intro, always-on Plus entitlement recovery, working core tank themes, StoreKit checkout, and Reef rewards are in the generated app.");
