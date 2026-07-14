const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1", "theme-access.js"), "utf8");
const injector = fs.readFileSync(path.join(root, "scripts", "inject-support-recovery.js"), "utf8");

for (const marker of [
  "theme-access-v1-basic-free",
  'new Set(["clear", "sunset", "abyss", "sakura"])',
  "theme.premium = false",
  "selectBasicTheme",
  "installEngineAdapter",
  "event.stopImmediatePropagation",
  "window.GillieThemeEngine = wrapper",
  "GillieThemeAccess",
]) {
  assert(source.includes(marker), `Theme access is missing: ${marker}`);
}
for (const marker of [
  '"v1/theme-access.js"',
  'data-gillie-v1-theme-access="true"',
]) {
  assert(injector.includes(marker), `Theme access injection is missing: ${marker}`);
}
assert(!source.includes("state.premium = true"), "Theme access must never forge Plus entitlement");
assert(!source.includes("current.premium = true"), "Theme access must never forge Plus entitlement");

const THEMES = [
  { id: "clear", name: "Clearwater", premium: false },
  { id: "sunset", name: "Sunset Lagoon", premium: true },
  { id: "abyss", name: "Abyss", premium: true },
  { id: "sakura", name: "Sakura", premium: true },
  { id: "moonlit", name: "Moonlit Reef", premium: true },
];
const state = { premium: false, theme: "clear", petName: "Gillie" };
let saves = 0;
let paints = 0;
let delegatedTheme = null;
const scheduled = [];

const originalEngine = {
  active: () => ({ id: "clear", name: "Clearwater", premium: false }),
  select: (themeId) => { delegatedTheme = themeId; return false; },
  apply: () => true,
  tanks: () => [],
};

const document = {
  readyState: "complete",
  documentElement: { dataset: {} },
  addEventListener() {},
  dispatchEvent() { return true; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
};
const context = {
  window: {
    GillieThemeEngine: originalEngine,
    GillieThemePaint: { apply: () => { paints += 1; return true; } },
    Capacitor: { Plugins: { GilliePurchases: { trackEvent: () => {} } } },
  },
  document,
  THEMES,
  state,
  save: () => { saves += 1; },
  renderThemes: () => {},
  toast: () => {},
  requestAnimationFrame: (callback) => callback(),
  setTimeout: (callback, delay) => { scheduled.push({ callback, delay }); return scheduled.length; },
  CustomEvent: class { constructor(name, options) { this.type = name; this.detail = options?.detail; } },
  console,
  Set,
  Array,
  Object,
  String,
  Boolean,
};
context.window.window = context.window;
context.window.document = document;

vm.createContext(context);
vm.runInContext(source, context, { filename: "v1/theme-access.js" });
for (const task of scheduled.splice(0)) task.callback();

assert(context.window.GillieThemeAccess, "Theme access API should install");
for (const id of ["clear", "sunset", "abyss", "sakura"]) {
  assert.strictEqual(THEMES.find((theme) => theme.id === id).premium, false, `${id} should be usable without Plus`);
}
assert.strictEqual(THEMES.find((theme) => theme.id === "moonlit").premium, true, "Moonlit Reef should remain a Plus theme");
assert.notStrictEqual(context.window.GillieThemeEngine, originalEngine, "Theme engine should be adapted instead of retaining the blanket Clearwater fallback");

assert.strictEqual(context.window.GillieThemeEngine.select("sunset", { announceSelection: false, reason: "test" }), true, "A free account should be able to select Sunset Lagoon");
assert.strictEqual(state.theme, "sunset", "Free theme selection should persist");
assert.strictEqual(context.window.GillieThemeEngine.active().id, "sunset", "Free accounts must not be forced back to Clearwater");
assert(saves >= 1, "Free theme selection must save state");
assert(paints >= 1, "Free theme selection must trigger a visible repaint");

assert.strictEqual(context.window.GillieThemeEngine.select("moonlit", { announceSelection: false }), false, "A Plus-only theme should remain gated");
assert.strictEqual(delegatedTheme, "moonlit", "Plus-only themes should be delegated to the verified entitlement engine");
assert.strictEqual(state.theme, "sunset", "A locked Plus theme must not replace the active free theme");
assert.strictEqual(state.premium, false, "Theme access must not alter entitlement state");

console.log("Theme access test passed: Clearwater, Sunset, Abyss, and Sakura work without Plus, Moonlit remains gated, selections persist, and non-Plus accounts are not forced back to Clearwater.");
