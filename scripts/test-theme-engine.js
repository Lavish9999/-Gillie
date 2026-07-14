const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1/theme-engine.js"), "utf8");
const injector = fs.readFileSync(path.join(root, "scripts/inject-support-recovery.js"), "utf8");

for (const marker of [
  "theme-engine-v1",
  "theme-engine-v2-multitank-level-rewards",
  "#theme-row [data-theme]",
  "event.stopImmediatePropagation",
  "current.theme = theme.id",
  "document.documentElement?.style?.setProperty(\"--sand\"",
  "data-gillie-theme-layer",
  "themeTanks",
  "current.ownedItems.push(rewardMarker",
  "reef_level_reward_granted",
  "gillie:theme-applied",
  "GillieThemeEngine",
]) {
  assert(source.includes(marker), `Theme/reward engine is missing: ${marker}`);
}

assert(source.includes("theme.premium && !current.premium"), "Premium themes must stay entitlement-gated");
assert(!source.includes("state.premium = true"), "Theme engine must never forge Plus entitlement");
assert(!source.includes("current.premium = true"), "Theme engine must never forge Plus entitlement");
assert(source.includes('style.setProperty("z-index", "3", "important")'), "Theme tint must be visible but remain below Gillie");
assert(source.includes('style.setProperty("pointer-events", "none", "important")'), "Theme tint must never block tank interaction");
assert(source.includes("requestAnimationFrame(() => applyThemeImmediately"), "Theme must be re-applied after canonical rerenders");
assert(source.includes("new MutationObserver"), "Theme engine must repair DOM rerenders");

for (const marker of [
  '"v1/theme-engine.js"',
  'data-gillie-v1-theme-engine="true"',
  "theme-engine-v1",
  "GillieThemeEngine",
]) {
  assert(injector.includes(marker), `Theme engine injection is missing: ${marker}`);
}

class FakeStyle {
  constructor() { this.values = new Map(); }
  setProperty(name, value) { this.values.set(name, String(value)); }
  getPropertyValue(name) { return this.values.get(name) || ""; }
  removeProperty(name) { this.values.delete(name); }
}

class FakeClassList {
  constructor(initial = []) { this.values = new Set(initial); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  toggle(name, force) {
    if (force === true) { this.values.add(name); return true; }
    if (force === false) { this.values.delete(name); return false; }
    if (this.values.has(name)) { this.values.delete(name); return false; }
    this.values.add(name); return true;
  }
  contains(name) { return this.values.has(name); }
}

function dataKey(name) {
  return name.replace(/^data-/, "").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

class FakeElement {
  constructor(tagName = "div", { id = "", classes = [] } = {}) {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.dataset = {};
    this.style = new FakeStyle();
    this.classList = new FakeClassList(classes);
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.isConnected = true;
    this.textContent = "";
    this.innerHTML = "";
  }
  appendChild(child) { child.parentElement = this; child.isConnected = true; this.children.push(child); return child; }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === "id") this.id = "";
    if (name.startsWith("data-")) delete this.dataset[dataKey(name)];
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "id") this.id = String(value);
    if (name.startsWith("data-")) this.dataset[dataKey(name)] = String(value);
  }
  getAttribute(name) {
    if (name === "id") return this.id || null;
    if (name.startsWith("data-")) return this.dataset[dataKey(name)] ?? null;
    return this.attributes.get(name) ?? null;
  }
  matches(selector) {
    return selector.split(",").some((part) => {
      const value = part.trim();
      if (!value) return false;
      if (value.startsWith("#")) return this.id === value.slice(1);
      if (value.startsWith(".")) return this.classList.contains(value.slice(1));
      if (value === "[data-theme]") return Boolean(this.dataset.theme);
      if (value === "[data-gillie-theme-layer='true']") return this.dataset.gillieThemeLayer === "true";
      return false;
    });
  }
  closest(selector) {
    let node = this;
    while (node) {
      if (selector === "#theme-row [data-theme]") {
        if (node.dataset.theme && node.parentElement?.id === "theme-row") return node;
      } else if (selector === "#theme-row, .tank") {
        if (node.id === "theme-row" || node.classList.contains("tank")) return node;
      } else if (node.matches(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const result = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.matches(selector)) result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }
  insertAdjacentElement(_position, element) { return this.appendChild(element); }
  click() { this.clicked = true; }
}

const primaryTank = new FakeElement("div", { id: "tank", classes: ["tank"] });
const previewTank = new FakeElement("div", { classes: ["tank", "v1-tank-preview", "phase2-tank-clone"] });
const themeRow = new FakeElement("div", { id: "theme-row" });
const clearButton = new FakeElement("button"); clearButton.dataset.theme = "clear";
const sunsetButton = new FakeElement("button"); sunsetButton.dataset.theme = "sunset";
themeRow.appendChild(clearButton);
themeRow.appendChild(sunsetButton);
const body = new FakeElement("body");
body.appendChild(primaryTank);
body.appendChild(previewTank);
body.appendChild(themeRow);
const rootElement = new FakeElement("html");
const listeners = new Map();

const document = {
  readyState: "complete",
  hidden: false,
  body,
  documentElement: rootElement,
  createElement: (tag) => new FakeElement(tag),
  addEventListener: (name, callback) => listeners.set(name, callback),
  dispatchEvent: () => true,
  querySelector(selector) {
    if (selector === "#tank") return primaryTank;
    if (selector === "#theme-row") return themeRow;
    if (selector === "#v1-reef-dashboard") return null;
    if (selector === "#pearl-balance") return null;
    if (selector === "#plus-open" || selector === "#set-plus" || selector === "[data-act='plus']") return null;
    return body.querySelector(selector);
  },
  querySelectorAll(selector) {
    if (selector === ".tank, .v1-tank-preview, .phase2-tank-clone") return [primaryTank, previewTank];
    if (selector === "#theme-row [data-theme]") return [clearButton, sunsetButton];
    if (selector === ".pearl-balance2") return [];
    return body.querySelectorAll(selector);
  },
};

const savedSnapshots = [];
const toastMessages = [];
const state = {
  onboarded: true,
  petName: "Gillie",
  premium: true,
  theme: "clear",
  pearls: 78,
  ownedItems: [],
  bankedCleanMs: 0,
  quitAt: null,
  checkins: [],
  cravings: [],
  milestonesSeen: [],
  milestonesRewarded: [],
  reefProgress: { bonusXp: 141, claims: {}, dailyBonusClaims: {}, lastSeenLevel: 2 },
};
const THEMES = [
  { id: "clear", name: "Clearwater", tint: "transparent", blend: "normal", sand: "#EDDDBC", premium: false },
  { id: "sunset", name: "Sunset Lagoon", tint: "linear-gradient(red, pink)", blend: "soft-light", sand: "#F2D2A8", premium: true },
];

const afterRenderHooks = [];
const context = {
  window: {
    GillieV1: {
      afterRender: (callback) => afterRenderHooks.push(callback),
      announce: () => {},
    },
  },
  document,
  state,
  THEMES,
  save: () => savedSnapshots.push(JSON.parse(JSON.stringify(state))),
  toast: (icon, message) => toastMessages.push({ icon, message }),
  renderThemes: () => {},
  sparkleBurst: () => {},
  requestAnimationFrame: (callback) => callback(),
  setTimeout: (callback) => { callback(); return 1; },
  clearTimeout: () => {},
  queueMicrotask: (callback) => callback(),
  MutationObserver: class { observe() {} disconnect() {} },
  CustomEvent: class { constructor(name, options) { this.type = name; this.detail = options?.detail; } },
  console,
  Map,
  Set,
  Array,
  Object,
  Number,
  String,
  Boolean,
  Math,
  Date,
};
context.window.window = context.window;
context.window.document = document;
context.window.Capacitor = { Plugins: { GilliePurchases: { trackEvent: () => {} } } };

vm.createContext(context);
vm.runInContext(source, context, { filename: "v1/theme-engine.js" });

assert(context.window.GillieThemeEngine, "Theme engine should install a public testable API");
assert.strictEqual(state.pearls, 103, "Level 2 should retroactively grant exactly 25 pearls");
assert(state.ownedItems.includes("reef_level_reward_2"), "Level 2 reward claim marker should persist in ownedItems");
assert(toastMessages.some((entry) => entry.message.includes("Level 2 reward") && entry.message.includes("+25 pearls")), "Level reward should be visibly announced");

const savesAfterFirstGrant = savedSnapshots.length;
assert.strictEqual(context.window.GillieThemeEngine.reconcileRewards("repeat-test"), 0, "Reward reconciliation must be idempotent");
assert.strictEqual(state.pearls, 103, "Repeated reconciliation must not duplicate pearls");
assert.strictEqual(savedSnapshots.length, savesAfterFirstGrant, "No duplicate reward should trigger another save");

assert.strictEqual(context.window.GillieThemeEngine.select("sunset", { announceSelection: false, reason: "runtime-test" }), true, "Entitled users should be able to select a premium theme");
assert.strictEqual(state.theme, "sunset", "Selected theme should persist in state");
assert.strictEqual(primaryTank.dataset.gillieTheme, "sunset", "Home tank should receive selected theme");
assert.strictEqual(previewTank.dataset.gillieTheme, "sunset", "Full Reef preview tank should receive selected theme");

const primaryLayer = primaryTank.querySelector("[data-gillie-theme-layer='true']");
const previewLayer = previewTank.querySelector("[data-gillie-theme-layer='true']");
assert(primaryLayer && previewLayer, "Every tank must receive a dedicated visible theme layer");
assert.notStrictEqual(primaryLayer, previewLayer, "Theme layers must not be moved between tanks");
assert.strictEqual(primaryLayer.id, "theme-tint", "Primary tank keeps the canonical theme-tint id");
assert.strictEqual(previewLayer.id, "", "Preview clone must not retain a duplicate theme-tint id");
assert.strictEqual(primaryLayer.style.getPropertyValue("background"), "linear-gradient(red, pink)", "Primary tank should visibly use the selected theme paint");
assert.strictEqual(previewLayer.style.getPropertyValue("background"), "linear-gradient(red, pink)", "Preview tank should visibly use the selected theme paint");

state.premium = false;
state.theme = "clear";
assert.strictEqual(context.window.GillieThemeEngine.select("sunset", { announceSelection: false, reason: "locked-test" }), false, "Locked premium themes must remain gated");
assert.strictEqual(state.theme, "clear", "A locked tap must not change saved theme state");

console.log("Reef level reward idempotency and multi-tank theme runtime contracts passed.");
