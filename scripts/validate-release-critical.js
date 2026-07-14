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

function syntaxCheck(relative) {
  const file = path.join(root, relative);
  execFileSync(process.execPath, ["--check", file], { cwd: root, stdio: "inherit" });
}

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit", env: process.env });
}

console.log("Preparing the exact Capacitor web bundle that will be signed…");
run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "prepare:cap"]);

for (const relative of [
  "v1/purchase-flow.js",
  "v1/store-pricing.js",
  "v1/theme-engine.js",
  "v1/theme-paint.js",
  "scripts/write-build-provenance.js",
  "scripts/verify-final-web-assets.js",
  "www/v1/purchase-flow.js",
  "www/v1/store-pricing.js",
  "www/v1/theme-engine.js",
  "www/v1/theme-paint.js",
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
  ["v1/theme-engine.js", "theme-engine-v2-multitank-level-rewards", "Reef reward/theme engine"],
  ["v1/theme-engine.js", "reef_level_reward_granted", "one-time level rewards"],
  ["v1/theme-paint.js", "theme-paint-v1", "visible tank painter"],
  ["v1/theme-paint.js", "--gillie-theme-water-top", "direct water painting"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'private let productIDs = ["gillie.plus.monthly", "gillie.plus.yearly"]', "native StoreKit product IDs"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'CAPPluginMethod(name: "getProducts"', "native product bridge"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'CAPPluginMethod(name: "purchase"', "native purchase bridge"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'CAPPluginMethod(name: "restorePurchases"', "native restore bridge"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "Product.products(for: productIDs)", "StoreKit 2 product request"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "Transaction.currentEntitlements", "verified entitlement lookup"],
  ["www/index.html", 'data-gillie-v1-purchase-flow="true"', "generated purchase script injection"],
  ["www/index.html", 'data-gillie-v1-theme-engine="true"', "generated theme engine injection"],
  ["www/index.html", 'data-gillie-v1-theme-paint="true"', "generated theme painter injection"],
  ["www/v1/build-source.json", '"sourceCommit"', "generated commit provenance"],
  ["www/v1/build-source.json", '"commerceEngine": "purchase-flow-v3-production-branch"', "generated commerce provenance"],
  ["www/v1/build-source.json", '"themePaintEngine": "theme-paint-v1"', "generated theme provenance"],
];

for (const [relative, marker, label] of contracts) requireMarker(relative, marker, label);

for (const relative of ["purchase-flow.js", "store-pricing.js", "theme-engine.js", "theme-paint.js"]) {
  const source = read(`v1/${relative}`);
  const generated = read(`www/v1/${relative}`);
  if (source !== generated) throw new Error(`Generated asset does not match source: v1/${relative}`);
}

run(process.execPath, ["scripts/verify-final-web-assets.js", "www"]);
console.log("Release-critical validation passed: the generated app contains the native Plus flow, StoreKit products, entitlement recovery, Reef rewards, and visible tank themes.");
