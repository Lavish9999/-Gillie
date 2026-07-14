const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1", "purchase-flow.js"), "utf8");
const injector = fs.readFileSync(path.join(root, "scripts", "inject-support-recovery.js"), "utf8");
const native = fs.readFileSync(path.join(root, "ios", "App", "App", "GilliePurchasesPlugin.swift"), "utf8");

for (const marker of [
  'const ENGINE = "purchase-flow-v1"',
  'purchase-flow-v3-production-branch',
  'Apple returned zero Gillie Plus products',
  'code: "STORE_PRODUCTS_EMPTY"',
  'purchase.onclick = handlePurchase',
  'restore.onclick = handleRestore',
  'native.addListener("entitlementChanged"',
  'document.addEventListener("visibilitychange"',
  'const RECHECK_DELAYS = Object.freeze([0, 250, 800, 1800, 3500])',
  'const PURCHASE_TIMEOUT_MS = 90000',
  'gillie:purchase-flow-settled',
  'Copy purchase details',
  'GilliePurchaseFlow',
]) {
  assert(source.includes(marker), `Purchase flow is missing: ${marker}`);
}

for (const marker of [
  '"v1/purchase-flow.js"',
  'data-gillie-v1-purchase-flow="true"',
  'purchase-flow-v1',
  'entitlementChanged',
]) {
  assert(injector.includes(marker), `Purchase-flow injector is missing: ${marker}`);
}

for (const marker of [
  'private let productIDs = ["gillie.plus.monthly", "gillie.plus.yearly"]',
  'CAPPluginMethod(name: "getProducts"',
  'CAPPluginMethod(name: "purchase"',
  'CAPPluginMethod(name: "restorePurchases"',
  'Product.products(for: productIDs)',
]) {
  assert(native.includes(marker), `Native StoreKit bridge is missing: ${marker}`);
}

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, force) {
    if (force) this.values.add(name); else this.values.delete(name);
  }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.textContent = "";
    this.className = "";
    this.classList = new FakeClassList();
    this.attributes = new Map();
    this.children = [];
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, fn) { this[`on${name}`] = fn; }
  appendChild(child) { this.children.push(child); return child; }
  insertAdjacentElement(_position, child) { return this.appendChild(child); }
  querySelector() { return null; }
}

const purchase = new FakeElement("plus-purchase");
const restore = new FakeElement("plus-restore");
const overlay = new FakeElement("plus-overlay");
const legal = new FakeElement("plus-legal");
const restoreRow = new FakeElement();
const yearly = new FakeElement(); yearly.dataset.plusPlan = "yearly"; yearly.classList.values.add("on");
const monthly = new FakeElement(); monthly.dataset.plusPlan = "monthly";
const planButtons = [yearly, monthly];

const selectors = new Map([
  ["#plus-purchase", purchase],
  ["#plus-restore", restore],
  ["#plus-overlay", overlay],
  ["#plus-legal", legal],
  [".plus-restore-row", restoreRow],
  ["#plus-plans [data-plus-plan].on", yearly],
]);

let productResponse = { products: [] };
const document = {
  readyState: "complete",
  hidden: false,
  body: new FakeElement("body"),
  querySelector(selector) { return selectors.get(selector) || null; },
  querySelectorAll(selector) {
    if (selector === "#plus-plans [data-plus-plan]") return planButtons;
    return [];
  },
  createElement() { return new FakeElement(); },
  addEventListener() {},
  dispatchEvent() { return true; },
};

const context = {
  window: {
    Capacitor: {
      Plugins: {
        GilliePurchases: {
          getProducts: async () => productResponse,
          purchase: async () => ({ active: false }),
          restorePurchases: async () => ({ active: false }),
          getEntitlementStatus: async () => ({ active: false }),
          addListener: async () => ({ remove() {} }),
          trackEvent: async () => ({}),
        },
      },
    },
  },
  document,
  CONFIG: {
    plus: {
      products: {
        monthly: { id: "gillie.plus.monthly", name: "Monthly" },
        yearly: { id: "gillie.plus.yearly", name: "Yearly" },
      },
    },
  },
  selectedPlusPlan: "yearly",
  MutationObserver: class { observe() {} },
  CustomEvent: class { constructor(name) { this.type = name; } },
  navigator: { clipboard: { writeText: async () => {} } },
  console,
  setTimeout: (fn) => { fn(); return 1; },
  clearTimeout() {},
  Promise,
  Object,
  Array,
  Number,
  String,
  Set,
  Map,
  WeakMap,
  Date,
};
context.window.window = context.window;
context.window.document = document;
vm.createContext(context);
vm.runInContext(source, context, { filename: "v1/purchase-flow.js" });

assert.strictEqual(typeof purchase.onclick, "function", "The visible Plus CTA must be owned by purchase-flow");
assert.strictEqual(typeof restore.onclick, "function", "Restore purchases must be owned by purchase-flow");
assert(context.window.GilliePurchaseFlow, "The purchase-flow diagnostics API must be exposed");

(async () => {
  productResponse = {
    products: [],
    requestedProductIds: ["gillie.plus.monthly", "gillie.plus.yearly"],
    returnedProductIds: [],
  };
  await assert.rejects(
    context.window.GilliePurchaseFlow.preflight(),
    (error) => error?.code === "STORE_PRODUCTS_EMPTY" && /zero Gillie Plus products/.test(error.message),
    "A zero-product StoreKit response must be identified exactly",
  );

  productResponse = {
    products: [{ id: "gillie.plus.monthly", displayPrice: "$4.99" }],
    requestedProductIds: ["gillie.plus.monthly", "gillie.plus.yearly"],
    returnedProductIds: ["gillie.plus.monthly"],
  };
  const result = await context.window.GilliePurchaseFlow.preflight();
  assert.strictEqual(result.plan.id, "gillie.plus.monthly", "Checkout must fall back to the Apple plan that is actually available");
  assert.strictEqual(context.selectedPlusPlan, "monthly", "The selected plan must follow the available StoreKit product");

  console.log("Purchase-flow tests passed: production CTA ownership, native preflight, exact zero-product diagnosis, plan fallback, restore, entitlement reconciliation, and diagnostics are present.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
