const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1", "purchase-director.js"), "utf8");

for (const marker of [
  "purchase-director-v2-direct-native",
  "selected-product-direct-to-storekit-v1",
  "stopImmediatePropagation",
  "native.purchase({ productId })",
  "pricing/product-list lookup is display-only",
  "GillieEntitlementSync.apply",
  "GilliePurchaseDirector",
]) {
  assert(source.includes(marker), `Purchase director is missing: ${marker}`);
}
assert(!source.includes("await availablePlan("), "Checkout must not wait for pricing preflight");
assert(!source.includes("native.getProducts()"), "Checkout director must not perform a product-list lookup");
new Function(source);

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, force) { if (force) this.values.add(name); else this.values.delete(name); }
  add(name) { this.values.add(name); }
  remove(name) { this.values.delete(name); }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.hidden = false;
    this.disabled = false;
    this.dataset = {};
    this.classList = new FakeClassList();
    this.attributes = new Map();
    this.textContent = "";
    this.children = [];
    this.parentElement = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) || null; }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  insertBefore(child) { return this.appendChild(child); }
  replaceChildren(...children) { this.children = []; children.forEach((child) => this.appendChild(child)); }
  closest(selector) {
    return selector.split(",").some((part) => part.trim() === `#${this.id}`) ? this : null;
  }
}

const overlay = new FakeElement("plus-overlay");
const purchase = new FakeElement("plus-purchase");
const restore = new FakeElement("plus-restore");
const health = new FakeElement("gp-store-health");
const plans = new FakeElement("plus-plans");
const yearly = new FakeElement();
yearly.dataset.plusPlan = "yearly";
yearly.classList.add("on");
const monthly = new FakeElement();
monthly.dataset.plusPlan = "monthly";
plans.appendChild(yearly);
plans.appendChild(monthly);

const selectorMap = new Map([
  ["#plus-overlay", overlay],
  ["#plus-purchase", purchase],
  ["#plus-restore", restore],
  ["#gp-store-health", health],
  ["#plus-plans", plans],
  ["#plus-plans [data-plus-plan].on", yearly],
]);

const listeners = new Map();
let purchaseCalls = 0;
let applied = 0;
let purchasedProduct = "";

const document = {
  readyState: "complete",
  hidden: false,
  body: new FakeElement("body"),
  documentElement: { dataset: {} },
  querySelector(selector) { return selectorMap.get(selector) || null; },
  querySelectorAll(selector) {
    if (selector === "#plus-plans [data-plus-plan]") return [yearly, monthly];
    return [];
  },
  createElement() { return new FakeElement(); },
  createTextNode(value) { const node = new FakeElement(); node.textContent = String(value); return node; },
  addEventListener(name, handler, capture) { listeners.set(`${name}:${Boolean(capture)}`, handler); },
};

const native = {
  purchase: async ({ productId }) => {
    purchaseCalls += 1;
    purchasedProduct = productId;
    return { active: true, verified: true, productId, source: "storekit2" };
  },
  restorePurchases: async () => ({ active: false, verified: true }),
  getEntitlementStatus: async () => ({ active: false, verified: true }),
  trackEvent: async () => ({}),
};

const context = {
  window: {
    Capacitor: { Plugins: { GilliePurchases: native } },
    GillieEntitlementSync: {
      apply(status) { applied += 1; return Boolean(status.active); },
    },
  },
  document,
  selectedPlusPlan: "yearly",
  MutationObserver: class { observe() {} disconnect() {} },
  console,
  setTimeout,
  clearTimeout,
  Promise,
  Object,
  Array,
  String,
  Boolean,
  Set,
  Map,
  Error,
};
context.window.window = context.window;
context.window.document = document;
vm.createContext(context);
vm.runInContext(source, context, { filename: "v1/purchase-director.js" });

assert(context.window.GilliePurchaseDirector, "Purchase director API must be installed");
assert.strictEqual(purchase.disabled, false, "Purchase CTA must remain tappable");
assert.strictEqual(purchase.dataset.purchaseDirector, "purchase-director-v2-direct-native");
assert(listeners.has("click:true"), "Purchase director must own checkout in capture phase");

(async () => {
  await context.window.GilliePurchaseDirector.purchase();
  assert.strictEqual(purchaseCalls, 1, "One tap must perform exactly one native Apple purchase call");
  assert.strictEqual(purchasedProduct, "gillie.plus.yearly", "Selected yearly product must reach StoreKit directly");
  assert.strictEqual(applied, 1, "Verified entitlement must be applied exactly once");
  assert.strictEqual(overlay.hidden, true, "Paywall must close after verified entitlement");
  assert.strictEqual(purchase.disabled, false, "CTA must be restored after checkout");
  console.log("Purchase director test passed: pricing was bypassed, one selected product reached native StoreKit, and one verified entitlement was applied.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
