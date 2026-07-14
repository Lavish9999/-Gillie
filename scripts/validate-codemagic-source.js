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

function forbidMarker(relative, marker, label = marker) {
  const source = read(relative);
  if (source.includes(marker)) {
    throw new Error(`Codemagic release contract failed: ${label}\nFile: ${relative}\nForbidden: ${marker}`);
  }
}

const requiredFiles = [
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
];
requiredFiles.forEach(read);

const contracts = [
  ["www/index.html", 'data-gillie-v1-purchase-flow="true"', "purchase diagnostics injection"],
  ["www/index.html", 'data-gillie-v1-purchase-director="true"', "authoritative purchase director injection"],
  ["www/index.html", 'data-gillie-v1-paywall-runtime-fix="true"', "paywall runtime injection"],
  ["www/index.html", 'data-gillie-v1-paywall-runtime-fix-styles="true"', "paywall safe-area CSS injection"],
  ["www/index.html", 'data-gillie-v1-theme-engine="true"', "theme-engine injection"],
  ["www/index.html", 'data-gillie-v1-theme-paint="true"', "theme-paint injection"],
  ["www/v1/purchase-flow.js", "purchase-flow-v3-production-branch", "production purchase diagnostics engine"],
  ["www/v1/purchase-flow.js", "Apple returned zero Gillie Plus products", "zero-product diagnosis"],
  ["www/v1/purchase-flow.js", "Copy purchase details", "purchase diagnostics"],
  ["www/v1/purchase-director.js", "purchase-director-v1-authoritative", "single checkout owner"],
  ["www/v1/purchase-director.js", "stopImmediatePropagation", "legacy handler isolation"],
  ["www/v1/purchase-director.js", "PRODUCT_LOOKUP_TIMEOUT", "bounded product lookup"],
  ["www/v1/purchase-director.js", "native.purchase({ productId: product.id })", "native purchase call"],
  ["www/v1/purchase-director.js", "GillieEntitlementSync.apply", "verified entitlement application"],
  ["www/v1/store-pricing.js", "store-pricing-v2-retryable", "retryable Apple pricing"],
  ["www/v1/store-pricing.js", "purchase-director-v1-authoritative", "display-only pricing policy"],
  ["www/v1/store-pricing.js", "Never start a second product request", "no duplicate checkout lookup"],
  ["www/v1/paywall-runtime-fix.js", "paywall-runtime-fix-v1", "safe Plus runtime"],
  ["www/v1/paywall-runtime-fix.js", "css-only-system-chrome-v2", "CSS-only TestFlight/status-bar treatment"],
  ["www/v1/paywall-runtime-fix.js", "single-open-storekit-probe", "single passive product probe"],
  ["www/v1/paywall-runtime-fix.js", "ensurePaywallSurface", "visible paywall surface guard"],
  ["www/v1/paywall-runtime-fix.js", "Apple billing connected", "visible StoreKit readiness"],
  ["www/v1/paywall-runtime-fix.css", "--gp-system-top", "TestFlight/status-bar safe area"],
  ["www/v1/paywall-runtime-fix.css", ".gp-store-health", "StoreKit readiness status styling"],
  ["www/v1/theme-engine.js", "theme-engine-v2-multitank-level-rewards", "Reef reward engine"],
  ["www/v1/theme-engine.js", "reef_level_reward_granted", "level reward grant"],
  ["www/v1/theme-paint.js", "theme-paint-v1", "visible tank painter"],
  ["www/v1/theme-paint.js", "--gillie-theme-water-top", "direct tank water paint"],
  ["www/v1/build-source.json", '"sourceBranch"', "source branch provenance"],
  ["www/v1/build-source.json", '"sourceCommit"', "source commit provenance"],
  ["www/v1/build-source.json", '"commerceEngine": "purchase-flow-v3-production-branch"', "commerce diagnostics provenance"],
  ["www/v1/build-source.json", '"checkoutEngine": "purchase-director-v1-authoritative"', "checkout engine provenance"],
  ["www/v1/build-source.json", '"checkoutOwnership": "capture-phase-single-owner-v1"', "checkout ownership provenance"],
  ["www/v1/build-source.json", '"pricingCheckoutPolicy": "display-only-never-disable-v1"', "pricing policy provenance"],
  ["www/v1/build-source.json", '"nativeStoreKitLoader": "combined-plus-per-product-retry-v1"', "native StoreKit loader provenance"],
  ["www/v1/build-source.json", '"paywallRuntimeEngine": "paywall-runtime-fix-v1"', "paywall runtime provenance"],
  ["www/v1/build-source.json", '"paywallProbeMode": "single-open-storekit-probe"', "paywall probe provenance"],
  ["www/v1/build-source.json", '"paywallChromeMode": "css-only-system-chrome-v2"', "CSS-only paywall chrome provenance"],
  ["www/v1/build-source.json", '"paywallSurfaceGuard": "ensurePaywallSurface-v1"', "paywall surface guard provenance"],
  ["www/v1/build-source.json", '"themePaintEngine": "theme-paint-v1"', "theme provenance"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'private let productIDs = ["gillie.plus.monthly", "gillie.plus.yearly"]', "native subscription IDs"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'CAPPluginMethod(name: "getProducts"', "native products method"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'CAPPluginMethod(name: "purchase"', "native purchase method"],
  ["ios/App/App/GilliePurchasesPlugin.swift", 'CAPPluginMethod(name: "restorePurchases"', "native restore method"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "loadAvailableProducts", "retried StoreKit loader"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "Product.products(for: productIDs)", "StoreKit batch product lookup"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "Product.products(for: [productID])", "StoreKit per-product fallback"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "Transaction.currentEntitlements", "StoreKit entitlement verification"],
  ["ios/App/App/GillieBridgeViewController.swift", "GilliePurchases", "native bridge registration"],
  ["ios/App/App/PrivacyInfo.xcprivacy", "NSPrivacyAccessedAPICategoryUserDefaults", "privacy manifest"],
  ["ios/App/App.xcodeproj/project.pbxproj", "TARGETED_DEVICE_FAMILY = 1;", "iPhone-only target"],
];
contracts.forEach(([file, marker, label]) => requireMarker(file, marker, label));
forbidMarker("www/v1/store-pricing.js", "purchase.disabled = loading", "pricing cannot disable the checkout CTA");
forbidMarker("www/v1/paywall-runtime-fix.js", "bridge()?.setInterfaceStyle?.(", "native root-view mutation that covers the WebView");

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

console.log(`Codemagic release contract passed for ${provenance.sourceBranch}@${provenance.sourceCommit}: one authoritative Plus checkout, visible paywall, StoreKit diagnostics, entitlement restore, Reef rewards, and tank themes are present.`);
