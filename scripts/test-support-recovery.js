const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const sos = read("v1/sos-support.js");
const recovery = read("v1/welcome-recovery.js");
const purchaseFlow = read("v1/purchase-flow.js");
const styles = read("v1/support-recovery.css");
const bridge = read("ios/App/App/GillieBridgeViewController.swift");
const injector = read("scripts/inject-support-recovery.js");

for (const marker of [
  "sos-support-v1",
  "1-800-QUIT-NOW",
  'QUITLINE_PHONE = "+18007848669"',
  'href="tel:${QUITLINE_PHONE}"',
  'QUITLINE_TEXT = "333888"',
  'href="sms:${QUITLINE_TEXT}"',
  "QUITNOW to 333888",
  "smokefree.gov/tools-tips/get-extra-help/speak-to-an-expert",
  "Message someone I trust",
  "Gillie is not emergency or medical care",
  "local emergency services",
]) {
  assert(sos.includes(marker), `SOS support is missing: ${marker}`);
}
assert(!sos.includes("tel:911"), "SOS support must not hardcode a global emergency number");
assert(sos.includes("navigator.share"), "Trusted-person support must use the native share surface when available");
assert(styles.includes(".v1-sos-support-actions"), "SOS support styles are missing");

for (const marker of [
  "welcome-recovery-v1",
  "recoverWelcomeBundle",
  "localBonusPearlsGranted",
  "plus_welcome_bundle_recovered",
  "This recovery can only happen once on this device",
  "current.plusWelcome.buddyCredits",
  "data-dialog-close",
]) {
  assert(recovery.includes(marker), `Welcome recovery is missing: ${marker}`);
}

for (const marker of [
  "purchase-flow-v1",
  "entitlementChanged",
  "Confirming your Apple subscription",
  "Purchase pending with Apple",
  "Apple is still processing this purchase",
  "purchase.onclick = handlePurchase",
  "restore.onclick = handleRestore",
]) {
  assert(purchaseFlow.includes(marker), `Purchase flow is missing: ${marker}`);
}

for (const marker of [
  "GillieWelcomeRecoveryPlugin",
  'jsName = "GillieWelcomeRecovery"',
  'CAPPluginMethod(name: "recoverWelcomeBundle"',
  "originalInstallId",
  "recoveryUsed",
  "recoveryInstallId",
  "gillie.plus.welcome.installID",
  "com.gillie.plus.welcome",
  "localBonusPearlsGranted",
]) {
  assert(bridge.includes(marker), `Native welcome recovery is missing: ${marker}`);
}

assert(injector.includes("v1/sos-support.js"), "SOS support is not copied into the native bundle");
assert(injector.includes("v1/welcome-recovery.js"), "Welcome recovery is not copied into the native bundle");
assert(injector.includes("v1/purchase-flow.js"), "Purchase flow is not copied into the native bundle");
assert(injector.includes('data-gillie-v1-sos-support="true"'), "SOS support asset tag is missing");
assert(injector.includes('data-gillie-v1-welcome-recovery="true"'), "Welcome recovery asset tag is missing");
assert(injector.includes('data-gillie-v1-purchase-flow="true"'), "Purchase-flow asset tag is missing");

console.log("SOS support, Plus welcome recovery, and resilient purchase-flow source contracts passed.");
