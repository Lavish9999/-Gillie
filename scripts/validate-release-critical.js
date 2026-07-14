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
  if (!source.includes(marker)) throw new Error(`Release-critical validation failed: ${label}\nFile: ${relative}\nMissing: ${marker}`);
}

function forbidMarker(relative, marker, label = marker) {
  const source = read(relative);
  if (source.includes(marker)) throw new Error(`Release-critical validation failed: ${label}\nFile: ${relative}\nForbidden: ${marker}`);
}

function syntaxCheck(relative) {
  execFileSync(process.execPath, ["--check", path.join(root, relative)], { cwd: root, stdio: "inherit" });
}

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit", env: process.env });
}

for (const relative of [
  "scripts/prepare-single-launch.js",
  "scripts/inject-phase3.js",
  "scripts/inject-support-recovery.js",
  "scripts/prepare-ios-release.js",
  "scripts/test-theme-access.js",
  "scripts/test-entitlement-sync.js",
  "scripts/test-purchase-director.js",
  "v1/store-pricing.js",
  "v1/purchase-director.js",
  "v1/entitlement-sync.js",
  "v1/theme-access.js",
  "v1/launch-handoff.js",
  "v1/paywall-runtime-fix.js",
]) syntaxCheck(relative);

requireMarker("v1/purchase-director.js", "purchase-director-v2-direct-native", "direct native checkout director");
requireMarker("v1/purchase-director.js", "selected-product-direct-to-storekit-v1", "selected product checkout mode");
requireMarker("v1/purchase-director.js", "native.purchase({ productId })", "direct native purchase call");
requireMarker("v1/purchase-director.js", "pricing/product-list lookup is display-only", "pricing cannot gate checkout");
requireMarker("v1/purchase-director.js", "stopImmediatePropagation", "legacy checkout isolation");
forbidMarker("v1/purchase-director.js", "native.getProducts()", "purchase director product-list preflight");
forbidMarker("v1/purchase-director.js", "await availablePlan(", "purchase director availability gate");
requireMarker("v1/store-pricing.js", "store-pricing-v2-retryable", "localized StoreKit pricing");
forbidMarker("v1/store-pricing.js", "purchase.disabled = loading", "pricing must never disable checkout");
requireMarker("scripts/prepare-ios-release.js", "purchase_selected_lookup_started_native", "native selected-product lookup generation");
requireMarker("scripts/prepare-ios-release.js", "purchase_sheet_requested_native", "native Apple sheet request diagnostics");
requireMarker("scripts/prepare-ios-release.js", "SKPaymentQueue.canMakePayments()", "device purchase restriction check");
requireMarker("scripts/prepare-ios-release.js", "Product.products(for: [productID])", "selected-product-only StoreKit request");
requireMarker("v1/entitlement-sync.js", "entitlement-sync-v1-always-on", "always-on entitlement sync");
requireMarker("v1/paywall-runtime-fix.js", "css-only-system-chrome-v2", "safe paywall chrome");
forbidMarker("v1/paywall-runtime-fix.js", "bridge()?.setInterfaceStyle?.(", "native root-view mutation");

console.log("Running direct-checkout, entitlement, and theme tests…");
run(process.execPath, ["scripts/test-purchase-director.js"]);
run(process.execPath, ["scripts/test-entitlement-sync.js"]);
run(process.execPath, ["scripts/test-theme-access.js"]);

console.log("Preparing the exact Capacitor and native iOS sources that will be signed…");
run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "prepare:cap"]);

for (const relative of [
  "v1/purchase-director.js",
  "www/v1/purchase-director.js",
  "www/v1/store-pricing.js",
  "www/v1/entitlement-sync.js",
  "scripts/write-build-provenance.js",
  "scripts/verify-final-web-assets.js",
]) syntaxCheck(relative);

const contracts = [
  ["v1/purchase-director.js", "purchase-director-v2-direct-native", "source direct checkout"],
  ["v1/purchase-director.js", "native.purchase({ productId })", "source native purchase call"],
  ["www/v1/purchase-director.js", "purchase-director-v2-direct-native", "generated direct checkout"],
  ["www/v1/purchase-director.js", "selected-product-direct-to-storekit-v1", "generated selected-product mode"],
  ["www/index.html", 'data-gillie-v1-purchase-director="true"', "generated checkout injection"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "purchase_selected_lookup_started_native", "prepared native selected lookup"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "purchase_sheet_requested_native", "prepared native sheet request"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "selected-product-direct-v1", "prepared native checkout mode"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "SKPaymentQueue.canMakePayments()", "prepared payment restriction check"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "Product.products(for: [productID])", "prepared selected product request"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "Transaction.currentEntitlements", "verified entitlement lookup"],
  ["www/v1/build-source.json", '"checkoutEngine": "purchase-director-v2-direct-native"', "checkout provenance"],
  ["www/v1/build-source.json", '"nativeCheckoutMode": "selected-product-direct-v1"', "native checkout provenance"],
  ["www/v1/build-source.json", '"pricingCheckoutPolicy": "display-only-never-gates-purchase-v2"', "pricing policy provenance"],
  ["v1/entitlement-sync.js", "entitlement-sync-v1-always-on", "entitlement recovery"],
  ["v1/theme-engine.js", "theme-engine-v2-multitank-level-rewards", "theme engine"],
  ["v1/paywall-runtime-fix.js", "ensurePaywallSurface", "paywall surface guard"],
];
for (const [relative, marker, label] of contracts) requireMarker(relative, marker, label);

forbidMarker("www/v1/purchase-director.js", "native.getProducts()", "generated pricing gate");
forbidMarker("www/v1/store-pricing.js", "purchase.disabled = loading", "generated pricing button disable");
forbidMarker("www/v1/paywall-runtime-fix.js", "bridge()?.setInterfaceStyle?.(", "generated native view mutation");
forbidMarker("ios/App/App/GilliePurchasesPlugin.swift", "let products = try await loadAvailableProducts()\n                guard let product", "legacy full-catalog purchase lookup");
forbidMarker("www/index.html", "splash-orb", "legacy splash artwork");
forbidMarker("ios/App/App/Base.lproj/LaunchScreen.storyboard", 'image="Splash"', "legacy native splash image");

for (const relative of [
  "purchase-director.js",
  "store-pricing.js",
  "entitlement-sync.js",
  "theme-access.js",
  "theme-engine.js",
  "theme-paint.js",
  "launch-handoff.js",
  "paywall-runtime-fix.js",
  "paywall-runtime-fix.css",
]) {
  if (read(`v1/${relative}`) !== read(`www/v1/${relative}`)) {
    throw new Error(`Generated asset does not match source: v1/${relative}`);
  }
}

run(process.execPath, ["scripts/verify-final-web-assets.js", "www"]);
console.log("Release-critical validation passed: pricing cannot gate checkout, one selected product reaches native StoreKit, the native sheet request is instrumented, and entitlement recovery remains active.");
