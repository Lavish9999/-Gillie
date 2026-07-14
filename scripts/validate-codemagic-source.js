const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (relative) => {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new Error(`Codemagic release file is missing: ${relative}`);
  return fs.readFileSync(file, "utf8");
};

function requireMarker(relative, marker, label = marker) {
  if (!read(relative).includes(marker)) {
    throw new Error(`Codemagic release contract failed: ${label}\nFile: ${relative}\nMissing: ${marker}`);
  }
}

function forbidMarker(relative, marker, label = marker) {
  if (read(relative).includes(marker)) {
    throw new Error(`Codemagic release contract failed: ${label}\nFile: ${relative}\nForbidden: ${marker}`);
  }
}

for (const relative of [
  "www/index.html",
  "www/v1/build-source.json",
  "www/v1/purchase-flow.js",
  "www/v1/purchase-director.js",
  "www/v1/store-pricing.js",
  "www/v1/paywall-runtime-fix.js",
  "www/v1/paywall-runtime-fix.css",
  "www/v1/theme-engine.js",
  "www/v1/theme-paint.js",
  "ios/App/App/GilliePurchasesPlugin.swift",
  "ios/App/App/GillieBridgeViewController.swift",
  "ios/App/App/PrivacyInfo.xcprivacy",
  "ios/App/App.xcodeproj/project.pbxproj",
]) read(relative);

const contracts = [
  ["www/index.html", 'data-gillie-v1-purchase-director="true"', "direct checkout injection"],
  ["www/index.html", 'data-gillie-v1-paywall-runtime-fix="true"', "paywall runtime injection"],
  ["www/index.html", 'data-gillie-v1-theme-engine="true"', "theme engine injection"],
  ["www/index.html", 'data-gillie-v1-theme-paint="true"', "theme paint injection"],
  ["www/v1/purchase-flow.js", "purchase-flow-v3-production-branch", "purchase diagnostics engine"],
  ["www/v1/purchase-flow.js", "Copy purchase details", "purchase diagnostics action"],
  ["www/v1/purchase-director.js", "purchase-director-v2-direct-native", "direct-native checkout owner"],
  ["www/v1/purchase-director.js", "selected-product-direct-to-storekit-v1", "selected-product checkout mode"],
  ["www/v1/purchase-director.js", "stopImmediatePropagation", "legacy handler isolation"],
  ["www/v1/purchase-director.js", "native.purchase({ productId: product.id })", "direct native purchase call"],
  ["www/v1/purchase-director.js", "GillieEntitlementSync.apply", "verified entitlement application"],
  ["www/v1/store-pricing.js", "store-pricing-v2-retryable", "localized Apple pricing"],
  ["www/v1/paywall-runtime-fix.js", "css-only-system-chrome-v2", "safe TestFlight/status-bar treatment"],
  ["www/v1/paywall-runtime-fix.js", "ensurePaywallSurface", "visible paywall guard"],
  ["www/v1/paywall-runtime-fix.css", "--gp-system-top", "safe top spacing"],
  ["www/v1/theme-engine.js", "theme-engine-v2-multitank-level-rewards", "Reef reward engine"],
  ["www/v1/theme-paint.js", "theme-paint-v1", "visible theme painter"],
  ["www/v1/build-source.json", '"sourceBranch"', "source branch provenance"],
  ["www/v1/build-source.json", '"sourceCommit"', "source commit provenance"],
  ["www/v1/build-source.json", '"checkoutEngine": "purchase-director-v2-direct-native"', "checkout provenance"],
  ["www/v1/build-source.json", '"checkoutMode": "selected-product-direct-to-storekit-v1"', "checkout mode provenance"],
  ["www/v1/build-source.json", '"pricingCheckoutPolicy": "display-only-never-gates-checkout-v2"', "pricing policy provenance"],
  ["www/v1/build-source.json", '"nativeStoreKitLoader": "selected-product-only-retry-v1"', "native loader provenance"],
  ["www/v1/build-source.json", '"nativeCheckoutMode": "selected-product-direct-v1"', "native checkout provenance"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'private let productIDs = ["gillie.plus.monthly", "gillie.plus.yearly"]', "native subscription IDs"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "purchase_selected_lookup_started_native", "selected-product native lookup"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "purchase_sheet_requested_native", "Apple-sheet request diagnostics"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "selected-product-direct-v1", "native direct checkout mode"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "SKPaymentQueue.canMakePayments()", "device payment restriction check"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "Product.products(for: [productID])", "selected-product StoreKit lookup"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "Transaction.currentEntitlements", "verified entitlement lookup"],
  ["ios/App/App/GillieBridgeViewController.swift", "GilliePurchases", "native bridge registration"],
  ["ios/App/App/PrivacyInfo.xcprivacy", "NSPrivacyAccessedAPICategoryUserDefaults", "privacy manifest"],
  ["ios/App/App.xcodeproj/project.pbxproj", "TARGETED_DEVICE_FAMILY = 1;", "iPhone-only target"],
];
contracts.forEach(([file, marker, label]) => requireMarker(file, marker, label));

forbidMarker("www/v1/purchase-director.js", "await availablePlan(", "JavaScript pricing preflight");
forbidMarker("www/v1/store-pricing.js", "purchase.disabled = loading", "pricing-owned checkout disablement");
forbidMarker("www/v1/paywall-runtime-fix.js", "bridge()?.setInterfaceStyle?.(", "native root-view mutation");

for (const relative of [
  "www/v1/purchase-flow.js",
  "www/v1/purchase-director.js",
  "www/v1/store-pricing.js",
  "www/v1/paywall-runtime-fix.js",
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

console.log(`Codemagic release contract passed for ${provenance.sourceBranch}@${provenance.sourceCommit}: direct selected-product StoreKit checkout, entitlement restore, visible paywall, Reef rewards, and themes are present.`);
