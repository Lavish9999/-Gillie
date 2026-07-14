const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (relative) => {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new Error(`Codemagic release file is missing: ${relative}`);
  return fs.readFileSync(file, "utf8");
};

function requireMarker(relative, marker, label = marker) {
  const source = read(relative);
  if (!source.includes(marker)) {
    throw new Error(`Codemagic release contract failed: ${label}\nFile: ${relative}\nMissing: ${marker}`);
  }
}

const requiredFiles = [
  "www/index.html",
  "www/v1/build-source.json",
  "www/v1/purchase-flow.js",
  "www/v1/store-pricing.js",
  "www/v1/theme-engine.js",
  "www/v1/theme-paint.js",
  "ios/App/App/GilliePurchasesPlugin.swift",
  "ios/App/App/GillieBridgeViewController.swift",
  "ios/App/App/PrivacyInfo.xcprivacy",
  "ios/App/App.xcodeproj/project.pbxproj",
];
requiredFiles.forEach(read);

const contracts = [
  ["www/index.html", 'data-gillie-v1-purchase-flow="true"', "purchase-flow injection"],
  ["www/index.html", 'data-gillie-v1-theme-engine="true"', "theme-engine injection"],
  ["www/index.html", 'data-gillie-v1-theme-paint="true"', "theme-paint injection"],
  ["www/v1/purchase-flow.js", "purchase-flow-v3-production-branch", "production purchase engine"],
  ["www/v1/purchase-flow.js", "Apple returned zero Gillie Plus products", "zero-product diagnosis"],
  ["www/v1/purchase-flow.js", "Copy purchase details", "purchase diagnostics"],
  ["www/v1/purchase-flow.js", "restorePurchases", "restore purchases"],
  ["www/v1/purchase-flow.js", "entitlementChanged", "entitlement listener"],
  ["www/v1/store-pricing.js", "store-pricing-v2-retryable", "retryable Apple pricing"],
  ["www/v1/theme-engine.js", "theme-engine-v2-multitank-level-rewards", "Reef reward engine"],
  ["www/v1/theme-engine.js", "reef_level_reward_granted", "level reward grant"],
  ["www/v1/theme-paint.js", "theme-paint-v1", "visible tank painter"],
  ["www/v1/theme-paint.js", "--gillie-theme-water-top", "direct tank water paint"],
  ["www/v1/build-source.json", '"sourceBranch"', "source branch provenance"],
  ["www/v1/build-source.json", '"sourceCommit"', "source commit provenance"],
  ["www/v1/build-source.json", '"commerceEngine": "purchase-flow-v3-production-branch"', "commerce provenance"],
  ["www/v1/build-source.json", '"themePaintEngine": "theme-paint-v1"', "theme provenance"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'private let productIDs = ["gillie.plus.monthly", "gillie.plus.yearly"]', "native subscription IDs"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'CAPPluginMethod(name: "getProducts"', "native products method"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'CAPPluginMethod(name: "purchase"', "native purchase method"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'CAPPluginMethod(name: "restorePurchases"', "native restore method"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "Product.products(for: productIDs)", "StoreKit product lookup"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "Transaction.currentEntitlements", "StoreKit entitlement verification"],
  ["ios/App/App/GillieBridgeViewController.swift", "GilliePurchases", "native bridge registration"],
  ["ios/App/App/PrivacyInfo.xcprivacy", "NSPrivacyAccessedAPICategoryUserDefaults", "privacy manifest"],
  ["ios/App/App.xcodeproj/project.pbxproj", "TARGETED_DEVICE_FAMILY = 1;", "iPhone-only target"],
];
contracts.forEach(([file, marker, label]) => requireMarker(file, marker, label));

for (const relative of [
  "www/v1/purchase-flow.js",
  "www/v1/store-pricing.js",
  "www/v1/theme-engine.js",
  "www/v1/theme-paint.js",
]) new Function(read(relative));

const provenance = JSON.parse(read("www/v1/build-source.json"));
if (!Array.isArray(provenance.allowedProductionRefs) || !provenance.allowedProductionRefs.includes(provenance.sourceBranch)) {
  throw new Error(`Codemagic source branch is not approved by its own provenance: ${provenance.sourceBranch || "unknown"}`);
}
if (!/^[0-9a-f]{7,40}$/i.test(String(provenance.sourceCommit || ""))) {
  throw new Error("Codemagic source provenance does not contain a valid commit SHA.");
}

console.log(`Codemagic release contract passed for ${provenance.sourceBranch}@${provenance.sourceCommit}: native Plus, StoreKit products, entitlement restore, Reef rewards, and tank themes are present.`);
