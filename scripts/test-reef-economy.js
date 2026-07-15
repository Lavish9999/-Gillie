const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1", "reef-economy.js"), "utf8");
for (const marker of [
  "reef-economy-v1-paced-clarity-guaranteed-gifts",
  "CLEAN_GIFTS",
  "reconcileCleanGifts",
  "Slow build · crystal clear at 1 year",
  "reef_clean_gift_granted",
  "GillieReefEconomy",
]) assert(source.includes(marker), `Missing Reef economy marker: ${marker}`);

class FakeStyle { setProperty() {} }
class FakeElement {
  constructor() {
    this.children = [];
    this.style = new FakeStyle();
    this.dataset = {};
    this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
    this.textContent = "";
  }
  appendChild(node) { this.children.push(node); return node; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  setAttribute() {}
  removeAttribute() {}
}

let domReady = null;
const document = {
  readyState: "loading",
  hidden: false,
  head: new FakeElement(),
  body: new FakeElement(),
  documentElement: new FakeElement(),
  createElement: () => new FakeElement(),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener(name, callback) { if (name === "DOMContentLoaded") domReady = callback; },
};

const DAY_MS = 86400000;
const state = {
  onboarded: true,
  quitAt: Date.now() - 90 * DAY_MS,
  bankedCleanMs: 0,
  ownedItems: [],
  reefProgress: {},
  pearls: 0,
};
const SHOP_ITEMS = [
  { id: "sprout", name: "Sprout Hat", type: "hat", price: 45, bondDays: 1, premium: false },
  { id: "kelp", name: "Kelp Sprout", type: "decor", price: 50, bondDays: 1, premium: false },
  { id: "leaf", name: "Leaf Hat", type: "hat", price: 60, bondDays: 3, premium: false },
  { id: "coral", name: "Glow Coral", type: "decor", price: 90, bondDays: 3, premium: false },
  { id: "clam", name: "Pearl Clam", type: "decor", price: 120, bondDays: 7, premium: false },
];
const DECOR_SVGS = {};
const DECOR_POS = {};
const STAGES = [
  { days: 0, murk: 0.55 },
  { days: 1, murk: 0.4 },
  { days: 90, murk: 0 },
  { days: 365, murk: 0 },
];
const notices = [];
let saves = 0;
let levelReconciles = 0;
const afterRenderHooks = [];

const context = {
  window: {
    GillieV1: { afterRender: (callback) => afterRenderHooks.push(callback), announce: (message) => notices.push(message) },
    GillieThemeEngine: { reconcileRewards: () => { levelReconciles += 1; } },
  },
  document,
  state,
  SHOP_ITEMS,
  DECOR_SVGS,
  DECOR_POS,
  STAGES,
  save: () => { saves += 1; },
  renderAll: () => {},
  toast: (_icon, message) => notices.push(message),
  requestAnimationFrame: (callback) => callback(),
  setTimeout: (callback) => { callback(); return 1; },
  clearTimeout: () => {},
  Date,
  Math,
  Number,
  String,
  Boolean,
  Object,
  Array,
  Map,
  Set,
  console,
};
context.window.window = context.window;
context.window.document = document;
context.window.Capacitor = { Plugins: { GilliePurchases: { trackEvent: () => {} } } };

vm.createContext(context);
vm.runInContext(source, context, { filename: "v1/reef-economy.js" });
assert(domReady, "Reef economy should wait for DOMContentLoaded when needed");
domReady();

const api = context.window.GillieReefEconomy;
assert(api, "Reef economy should expose a testable API");
assert.strictEqual(api.clarity(0), 25, "Day zero clarity should start low");
assert.strictEqual(api.clarity(30), 56, "Thirty-day clarity should still leave meaningful progress");
assert.strictEqual(api.clarity(90), 75, "Ninety days should not fully clear the water");
assert.strictEqual(api.clarity(365), 100, "One year should reach full clarity");

for (const id of ["sprout", "kelp", "leaf", "coral", "clam", "seaglass", "crystalcave"]) {
  assert(state.ownedItems.includes(id), `${id} should be granted by 90 lifetime clean days`);
}
assert(!state.ownedItems.includes("lunararch"), "The 180-day gift must remain locked at 90 days");
assert.strictEqual(new Set(state.ownedItems).size, state.ownedItems.length, "Gift reconciliation must not duplicate ownership");
const ownedAfterInstall = [...state.ownedItems];
assert.deepStrictEqual(Array.from(api.reconcile("repeat")), [], "Repeated reconciliation should be idempotent");
assert.deepStrictEqual(state.ownedItems, ownedAfterInstall, "Repeated reconciliation must not alter owned items");

for (const id of ["driftwood", "anemone", "moonshell", "coralarch", "seaglass", "crystalcave", "lunararch", "reefbeacon"]) {
  assert(SHOP_ITEMS.some((item) => item.id === id), `${id} should be added to the Reef catalog`);
  assert(DECOR_SVGS[id], `${id} should have renderable aquarium art`);
}
assert.strictEqual(SHOP_ITEMS.find((item) => item.id === "clam").bondDays, 30, "Pearl Clam should be a real 30-day gift");
assert(STAGES.some((stage) => stage.days === 180), "A 180-day clarity stage should be added");
assert.strictEqual(STAGES.find((stage) => stage.days === 90).murk, 0.25, "The actual tank should remain partially murky at 90 days");
assert(saves >= 1, "Granted gifts should persist");
assert(levelReconciles >= 1, "Existing one-time Reef level rewards should still reconcile");
assert(notices.some((message) => /gifts|gift/i.test(message)), "Recovered gifts should be visibly announced");

console.log("Reef economy contracts passed: paced clarity, idempotent gifts, expanded collection, and level reward reconciliation.");
