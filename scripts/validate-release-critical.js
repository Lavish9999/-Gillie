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
    throw new Error(`Release-critical validation failed: ${label}\nFile: ${relative}\nForbidden: ${marker}`);
  }
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
  "scripts/test-launch-experience.js",
  "scripts/write-build-provenance.js",
  "scripts/verify-final-web-assets.js",
  "v1/sos-support.js",
  "v1/store-pricing.js",
  "v1/purchase-director.js",
  "v1/entitlement-sync.js",
  "v1/theme-access.js",
  "v1/launch-experience.js",
  "v1/launch-handoff.js",
  "v1/paywall-runtime-fix.js",
]) syntaxCheck(relative);

requireMarker("scripts/inject-phase3.js", 'ENGINE = "store-pricing-v2-retryable"', "current retryable StoreKit pricing contract");
forbidMarker("scripts/inject-phase3.js", 'ENGINE = "store-pricing-v1"', "obsolete StoreKit pricing contract");
requireMarker("scripts/prepare-single-launch.js", "gillie-launch-bootstrap", "single web launch handoff");
requireMarker("v1/sos-support.js", "reliability-guard-v1", "first-launch, reset, and navigation reliability guard");
requireMarker("v1/sos-support.js", "first_launch_auto_dismiss_blocked", "first launch waits for user continuation");
requireMarker("v1/sos-support.js", "hard_reset_started", "synchronous two-stage destructive reset");
requireMarker("v1/sos-support.js", "bottom_nav_fallback_used", "bottom navigation recovery fallback");
requireMarker("v1/purchase-director.js", "purchase-director-v2-direct-native", "direct native checkout director");
requireMarker("v1/purchase-director.js", "selected-product-direct-to-storekit-v1", "selected-product checkout mode");
requireMarker("v1/purchase-director.js", "stopImmediatePropagation", "legacy checkout handler isolation");
requireMarker("v1/purchase-director.js", "native.purchase({ productId: product.id })", "direct native purchase call");
requireMarker("v1/purchase-director.js", "Checkout intentionally does not call native.getProducts()", "pricing cannot gate checkout");
forbidMarker("v1/purchase-director.js", "await availablePlan(", "obsolete JavaScript product preflight");
requireMarker("scripts/prepare-ios-release.js", "purchase_selected_lookup_started_native", "selected-product native lookup generation");
requireMarker("scripts/prepare-ios-release.js", "purchase_sheet_requested_native", "Apple-sheet request diagnostics");
requireMarker("scripts/prepare-ios-release.js", "SKPaymentQueue.canMakePayments()", "device purchase restriction diagnostics");
requireMarker("scripts/prepare-ios-release.js", "Product.products(for: [productID])", "selected-product StoreKit lookup");
requireMarker("v1/store-pricing.js", "store-pricing-v2-retryable", "localized Apple pricing");
forbidMarker("v1/store-pricing.js", "purchase.disabled = loading", "pricing must never disable checkout");
requireMarker("v1/entitlement-sync.js", "entitlement-sync-v1-always-on", "always-on Plus entitlement sync");
requireMarker("v1/theme-access.js", "theme-access-v1-basic-free", "working core theme access");
requireMarker("v1/launch-experience.js", "function ratingEligibility()", "meaningful-engagement rating gate");
requireMarker("v1/launch-experience.js", 'reason: "first_craving_win"', "rating after a resisted craving");
requireMarker("v1/launch-experience.js", 'reason: "three_checkins"', "rating after three check-ins");
requireMarker("v1/launch-experience.js", 'reason: "three_clean_days"', "rating after three clean days");
requireMarker("v1/launch-experience.js", "function installSlipCopyGuard()", "slip-copy grammar guard");
requireMarker("v1/launch-experience.css", "min-height:44px!important", "44-point compact action targets");
requireMarker("v1/launch-handoff.js", "launch-handoff-v1-single-intro", "single animated intro handoff");
requireMarker("v1/paywall-runtime-fix.js", "css-only-system-chrome-v2", "CSS-only TestFlight/status-bar treatment");
requireMarker("v1/paywall-runtime-fix.js", "ensurePaywallSurface", "visible paywall surface recovery");
forbidMarker("v1/paywall-runtime-fix.js", "bridge()?.setInterfaceStyle?.(", "native root-view mutation");
forbidMarker("ios/App/App/GilliePurchasesPlugin.swift", "setInterfaceStyle", "obsolete native interface-style bridge");

console.log("Running focused runtime checks for direct-native checkout, Plus restoration, tank themes, audit regressions, and shell reliability…");
run(process.execPath, ["scripts/test-purchase-director.js"]);
run(process.execPath, ["scripts/test-entitlement-sync.js"]);
run(process.execPath, ["scripts/test-theme-access.js"]);
run(process.execPath, ["scripts/test-launch-experience.js"]);

console.log("Preparing the exact Capacitor and iOS bundle that will be signed…");
run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "prepare:cap"]);

for (const relative of [
  "www/v1/sos-support.js",
  "www/v1/purchase-flow.js",
  "www/v1/purchase-director.js",
  "www/v1/store-pricing.js",
  "www/v1/entitlement-sync.js",
  "www/v1/theme-access.js",
  "www/v1/theme-engine.js",
  "www/v1/theme-paint.js",
  "www/v1/launch-experience.js",
  "www/v1/launch-handoff.js",
  "www/v1/paywall-runtime-fix.js",
]) syntaxCheck(relative);

const contracts = [
  ["www/v1/sos-support.js", "reliability-guard-v1", "generated shell reliability guard"],
  ["www/v1/sos-support.js", "first_launch_auto_dismiss_blocked", "generated first-launch consent gate"],
  ["www/v1/sos-support.js", "hard_reset_started", "generated hard reset"],
  ["www/v1/sos-support.js", "bottom_nav_fallback_used", "generated bottom-nav recovery"],
  ["www/v1/purchase-flow.js", "purchase-flow-v3-production-branch", "purchase diagnostics engine"],
  ["www/v1/purchase-flow.js", "Copy purchase details", "purchase diagnostics action"],
  ["www/v1/purchase-director.js", "purchase-director-v2-direct-native", "generated direct checkout engine"],
  ["www/v1/purchase-director.js", "selected-product-direct-to-storekit-v1", "generated checkout mode"],
  ["www/v1/purchase-director.js", "native.purchase({ productId: product.id })", "generated native purchase call"],
  ["www/v1/purchase-director.js", "GillieEntitlementSync.apply", "verified entitlement application"],
  ["www/v1/store-pricing.js", "store-pricing-v2-retryable", "generated localized pricing"],
  ["www/v1/entitlement-sync.js", "app-boot", "Plus restored at app boot"],
  ["www/v1/entitlement-sync.js", "foreground", "Plus refreshed on foreground"],
  ["www/v1/theme-access.js", "theme-access-v1-basic-free", "core theme access"],
  ["www/v1/theme-engine.js", "theme-engine-v2-multitank-level-rewards", "Reef rewards and themes"],
  ["www/v1/theme-paint.js", "theme-paint-v1", "visible tank painter"],
  ["www/v1/launch-experience.js", "function ratingEligibility()", "generated meaningful-engagement rating gate"],
  ["www/v1/launch-experience.js", "function installSlipCopyGuard()", "generated slip-copy grammar guard"],
  ["www/v1/launch-experience.css", "min-height:44px!important", "generated 44-point touch targets"],
  ["www/v1/launch-handoff.js", "launch-handoff-v1-single-intro", "single intro handoff"],
  ["www/v1/paywall-runtime-fix.js", "css-only-system-chrome-v2", "safe paywall chrome"],
  ["www/v1/paywall-runtime-fix.js", "ensurePaywallSurface", "visible paywall guard"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "purchase_selected_lookup_started_native", "selected-product native lookup"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "purchase_sheet_requested_native", "Apple-sheet request event"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "selected-product-direct-v1", "native direct checkout mode"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "SKPaymentQueue.canMakePayments()", "purchase restriction check"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "Product.products(for: [productID])", "selected product StoreKit request"],
  ["ios/App/App/GilliePurchasesPlugin.swift", "Transaction.currentEntitlements", "verified entitlement lookup"],
  ["www/index.html", 'data-gillie-v1-purchase-director="true"', "checkout director injection"],
  ["www/index.html", 'data-gillie-v1-theme-paint="true"', "theme painter injection"],
  ["www/v1/build-source.json", '"checkoutEngine": "purchase-director-v2-direct-native"', "checkout provenance"],
  ["www/v1/build-source.json", '"checkoutMode": "selected-product-direct-to-storekit-v1"', "checkout-mode provenance"],
  ["www/v1/build-source.json", '"nativeStoreKitLoader": "selected-product-only-retry-v1"', "native loader provenance"],
  ["www/v1/build-source.json", '"nativeCheckoutMode": "selected-product-direct-v1"', "native checkout provenance"],
];
for (const [relative, marker, label] of contracts) requireMarker(relative, marker, label);

forbidMarker("www/v1/purchase-director.js", "await availablePlan(", "generated JavaScript product preflight");
forbidMarker("www/v1/store-pricing.js", "purchase.disabled = loading", "generated pricing cannot disable checkout");
forbidMarker("www/v1/paywall-runtime-fix.js", "bridge()?.setInterfaceStyle?.(", "generated native root-view mutation");
forbidMarker("ios/App/App/GilliePurchasesPlugin.swift", "setInterfaceStyle", "generated obsolete native interface bridge");
forbidMarker("www/index.html", "splash-orb", "legacy web splash artwork");
forbidMarker("www/index.html", "Grow clean", "legacy web splash subtitle");
forbidMarker("ios/App/App/Base.lproj/LaunchScreen.storyboard", 'image="Splash"', "legacy native image splash");

for (const relative of [
  "sos-support.js",
  "purchase-flow.js",
  "purchase-director.js",
  "store-pricing.js",
  "entitlement-sync.js",
  "theme-access.js",
  "theme-engine.js",
  "theme-paint.js",
  "launch-experience.js",
  "launch-experience.css",
  "launch-handoff.js",
  "paywall-runtime-fix.js",
  "paywall-runtime-fix.css",
]) {
  if (read(`v1/${relative}`) !== read(`www/v1/${relative}`)) {
    throw new Error(`Generated asset does not match source: v1/${relative}`);
  }
}

run(process.execPath, ["scripts/verify-final-web-assets.js", "www"]);
console.log("Release-critical validation passed: first launch waits for a user tap, destructive reset clears locally in two stages, bottom navigation self-recovers, checkout bypasses pricing, and signed assets match source.");