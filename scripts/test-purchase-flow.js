const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "v1", "purchase-flow.js");
const injectorPath = path.join(root, "scripts", "inject-support-recovery.js");

if (!fs.existsSync(sourcePath)) throw new Error("Missing v1/purchase-flow.js");
if (!fs.existsSync(injectorPath)) throw new Error("Missing support/recovery injector");

const source = fs.readFileSync(sourcePath, "utf8");
const injector = fs.readFileSync(injectorPath, "utf8");

for (const marker of [
  'const ENGINE = "purchase-flow-v1"',
  'let busy = false',
  'if (busy) return',
  'purchase.onclick = handlePurchase',
  'restore.onclick = handleRestore',
  'plugin.addListener("entitlementChanged"',
  'document.addEventListener("visibilitychange"',
  'Confirming your Apple subscription',
  'Purchase pending with Apple',
  'Purchase cancelled. Nothing was charged.',
  'Apple is still processing this purchase',
  'const RECHECK_DELAYS = Object.freeze([0, 250, 800, 1800, 3500])',
  'const PURCHASE_TIMEOUT_MS = 90000',
  'setAttribute("aria-busy", "true")',
  'gillie:purchase-flow-settled',
]) {
  if (!source.includes(marker)) throw new Error(`Purchase-flow source is missing marker: ${marker}`);
}

for (const forbidden of [
  'toast("👑", "Purchase was not completed.")',
  'requestSelectedPlusPurchase',
]) {
  if (source.includes(forbidden)) throw new Error(`Purchase-flow source restored a legacy silent behavior: ${forbidden}`);
}

for (const marker of [
  '"v1/purchase-flow.js"',
  'data-gillie-v1-purchase-flow="true"',
  'purchase-flow-v1',
  'entitlementChanged',
]) {
  if (!injector.includes(marker)) throw new Error(`Purchase-flow injector is missing marker: ${marker}`);
}

const purchaseStart = source.indexOf("async function handlePurchase");
const immediateBusy = source.indexOf('setBusy(true, "purchase", "Opening Apple…")', purchaseStart);
const nativeCall = source.indexOf("await plugin.purchase", purchaseStart);
if (purchaseStart < 0 || immediateBusy < purchaseStart || nativeCall < immediateBusy) {
  throw new Error("Purchase flow must render immediate busy feedback before calling StoreKit.");
}

const listenerStart = source.indexOf("function installEntitlementListener");
const activeApply = source.indexOf("applyActiveEntitlement(status, \"native_listener\")", listenerStart);
if (listenerStart < 0 || activeApply < listenerStart) {
  throw new Error("Native entitlement updates must immediately unlock Gillie Plus.");
}

console.log("Purchase-flow tests passed: immediate feedback, duplicate-tap protection, foreground reconciliation, native entitlement listening, pending/cancel/error states, and final-bundle injection are present.");
