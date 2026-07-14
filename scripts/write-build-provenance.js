const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www", "v1");
const ALLOWED_PRODUCTION_REFS = ["main", "native-ios-launch"];

function gitValue(args, fallback = "unknown") {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || fallback;
  } catch (_) {
    return fallback;
  }
}

function requireMarker(relative, marker) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes(marker)) throw new Error(`Production build marker missing from ${relative}: ${marker}`);
}

function forbidMarker(relative, marker) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(marker)) throw new Error(`Production build contains forbidden marker in ${relative}: ${marker}`);
}

const branch = String(process.env.CM_BRANCH || gitValue(["branch", "--show-current"])).trim();
const commit = String(process.env.CM_COMMIT || gitValue(["rev-parse", "HEAD"])).trim();
const isCodemagic = Boolean(process.env.CM_BRANCH || process.env.CM_BUILD_ID);

if (isCodemagic && !ALLOWED_PRODUCTION_REFS.includes(branch)) {
  throw new Error(`Refusing to ship Gillie from ${branch}. Allowed production refs: ${ALLOWED_PRODUCTION_REFS.join(", ")}.`);
}

requireMarker("v1/purchase-flow.js", "purchase-flow-v3-production-branch");
requireMarker("v1/purchase-flow.js", "Apple returned zero Gillie Plus products");
requireMarker("v1/purchase-flow.js", "Copy purchase details");
requireMarker("v1/store-pricing.js", "store-pricing-v2-retryable");
requireMarker("v1/entitlement-sync.js", "entitlement-sync-v1-always-on");
requireMarker("v1/theme-access.js", "theme-access-v1-basic-free");
requireMarker("v1/theme-paint.js", "theme-paint-v1");
requireMarker("v1/theme-engine.js", "theme-engine-v2-multitank-level-rewards");
requireMarker("v1/launch-handoff.js", "launch-handoff-v1-single-intro");
requireMarker("v1/paywall-runtime-fix.js", "paywall-runtime-fix-v1");
requireMarker("v1/paywall-runtime-fix.js", "css-only-system-chrome-v2");
requireMarker("v1/paywall-runtime-fix.js", "ensurePaywallSurface");
forbidMarker("v1/paywall-runtime-fix.js", "bridge()?.setInterfaceStyle?.(");
requireMarker("v1/paywall-runtime-fix.css", "--gp-system-top");
requireMarker("ios/App/App/GilliePurchasesPlugin.swift", "loadAvailableProducts");

fs.mkdirSync(out, { recursive: true });
const payload = {
  schemaVersion: 5,
  allowedProductionRefs: ALLOWED_PRODUCTION_REFS,
  sourceBranch: branch,
  sourceCommit: commit,
  generatedAt: new Date().toISOString(),
  commerceEngine: "purchase-flow-v3-production-branch",
  pricingEngine: "store-pricing-v2-retryable",
  nativeStoreKitLoader: "combined-plus-per-product-retry-v1",
  entitlementSyncEngine: "entitlement-sync-v1-always-on",
  productIds: ["gillie.plus.monthly", "gillie.plus.yearly"],
  paywallRuntimeEngine: "paywall-runtime-fix-v1",
  paywallChromeMode: "css-only-system-chrome-v2",
  paywallSurfaceGuard: "ensurePaywallSurface-v1",
  themeAccessEngine: "theme-access-v1-basic-free",
  themeEngine: "theme-engine-v2-multitank-level-rewards",
  themePaintEngine: "theme-paint-v1",
  launchHandoffEngine: "launch-handoff-v1-single-intro",
};
fs.writeFileSync(path.join(out, "build-source.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Gillie build provenance written: ${branch}@${commit}`);
