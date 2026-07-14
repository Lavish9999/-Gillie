const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1", "entitlement-sync.js"), "utf8");
const injector = fs.readFileSync(path.join(root, "scripts", "inject-support-recovery.js"), "utf8");

for (const marker of [
  "entitlement-sync-v1-always-on",
  'sync("app-boot")',
  'sync("app-boot-settled")',
  'sync("foreground")',
  'sync("purchase-settled")',
  'native.addListener("entitlementChanged"',
  "getEntitlementStatus",
  "applyEntitlementStatus",
  "gillie:entitlement-updated",
  "GillieEntitlementSync",
]) {
  assert(source.includes(marker), `Entitlement sync is missing: ${marker}`);
}
for (const marker of [
  '"v1/entitlement-sync.js"',
  'data-gillie-v1-entitlement-sync="true"',
]) {
  assert(injector.includes(marker), `Entitlement sync injection is missing: ${marker}`);
}
assert(!source.includes("state.premium = true"), "Entitlement sync must use verified StoreKit status rather than forging Plus");

let nativeStatus = {
  active: true,
  verified: true,
  source: "storekit2",
  productId: "gillie.plus.yearly",
};
let entitlementListener = null;
let appliedStatus = null;
let themeRefreshes = 0;
let engineApplies = 0;
let paintApplies = 0;
const events = [];
const scheduled = [];

const native = {
  getEntitlementStatus: async () => nativeStatus,
  addListener: async (name, callback) => {
    assert.strictEqual(name, "entitlementChanged");
    entitlementListener = callback;
    return { remove() {} };
  },
  trackEvent: async () => ({}),
};
const document = {
  readyState: "complete",
  hidden: false,
  documentElement: { dataset: {} },
  addEventListener() {},
  dispatchEvent(event) { events.push(event); return true; },
};
const context = {
  window: {
    Capacitor: { Plugins: { GilliePurchases: native } },
    GillieThemeAccess: { refresh: () => { themeRefreshes += 1; } },
    GillieThemeEngine: { apply: () => { engineApplies += 1; } },
    GillieThemePaint: { apply: () => { paintApplies += 1; } },
  },
  document,
  applyEntitlementStatus: (status) => {
    appliedStatus = status;
    return Boolean(status.active);
  },
  requestAnimationFrame: (callback) => callback(),
  setTimeout: (callback, delay) => { scheduled.push({ callback, delay }); return scheduled.length; },
  clearTimeout() {},
  CustomEvent: class { constructor(name, options) { this.type = name; this.detail = options?.detail; } },
  console,
  Promise,
  Object,
  Array,
  String,
  Boolean,
  Date,
};
context.window.window = context.window;
context.window.document = document;

vm.createContext(context);
vm.runInContext(source, context, { filename: "v1/entitlement-sync.js" });
assert(context.window.GillieEntitlementSync, "Entitlement sync API should install");
assert(scheduled.some((entry) => entry.delay === 0), "Entitlement should be checked immediately at app boot");
assert(scheduled.some((entry) => entry.delay === 900), "Entitlement should be checked again after the app settles");
assert.strictEqual(typeof entitlementListener, "function", "Native StoreKit entitlement updates should be observed");

(async () => {
  const active = await context.window.GillieEntitlementSync.sync("runtime-test");
  assert.strictEqual(active, true, "A verified StoreKit entitlement should restore Plus");
  assert.strictEqual(appliedStatus.productId, "gillie.plus.yearly");
  assert.strictEqual(appliedStatus.active, true);
  assert(events.some((event) => event.type === "gillie:entitlement-updated" && event.detail.active === true), "Entitlement restoration should publish an app-wide update");
  assert(themeRefreshes >= 1 && engineApplies >= 1 && paintApplies >= 1, "Restoring Plus should immediately refresh theme access and repaint the tank");

  nativeStatus = { active: false, verified: true, source: "storekit2" };
  entitlementListener(nativeStatus);
  assert.strictEqual(appliedStatus.active, false, "Native expiration or revocation updates should remove Plus state");
  assert(events.some((event) => event.type === "gillie:entitlement-updated" && event.detail.active === false), "Inactive entitlement changes should also reach the app");

  console.log("Entitlement sync test passed: verified Plus is restored at boot, refreshed on foreground/purchase paths, native changes are observed, and themes repaint immediately.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
