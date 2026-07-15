const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1/core.js"), "utf8");

function makeClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(name) { values.add(name); },
    remove(name) { values.delete(name); },
    contains(name) { return values.has(name); },
    toggle(name, force) {
      if (force === true) values.add(name);
      else if (force === false) values.delete(name);
      else if (values.has(name)) values.delete(name);
      else values.add(name);
      return values.has(name);
    },
  };
}

function makeElement({ dataset = {}, classes = [], hidden = false } = {}) {
  const attributes = new Map();
  return {
    dataset,
    hidden,
    inert: false,
    disabled: false,
    scrollTop: 0,
    classList: makeClassList(classes),
    setAttribute(name, value = "") { attributes.set(name, String(value)); },
    removeAttribute(name) { attributes.delete(name); },
    getAttribute(name) { return attributes.get(name); },
    scrollTo({ top = 0 } = {}) { this.scrollTop = top; },
  };
}

const dataset = {};
const app = {};
const main = makeElement();
main.inert = true;
main.setAttribute("inert", "");
const names = ["home", "progress", "reef", "you"];
const views = Object.fromEntries(names.map((name) => [name, makeElement({ hidden: false })]));
const tabButtons = Object.fromEntries(names.map((name) => {
  const tab = makeElement({ dataset: { view: name }, classes: name === "home" ? ["on"] : [] });
  tab.closest = (selector) => selector === "button[data-view]" ? tab : null;
  return [name, tab];
}));
let tabsClickHandler = null;
let tabsPointerHandler = null;
const tabs = makeElement({ dataset: {} });
tabs.addEventListener = (type, handler) => {
  if (type === "click") tabsClickHandler = handler;
  if (type === "pointerdown") tabsPointerHandler = handler;
};
let renderCalls = 0;

function querySelector(selector) {
  if (selector === "#app") return app;
  if (selector === "#main") return main;
  if (selector === "#tabs") return tabs;
  if (selector === "#phase2-live") return null;
  if (selector === "#tabs button.on[data-view]") return names.map((name) => tabButtons[name]).find((tab) => tab.classList.contains("on")) || null;
  const viewMatch = selector.match(/^#view-(home|progress|reef|you)$/);
  if (viewMatch) return views[viewMatch[1]];
  const tabMatch = selector.match(/^#tabs button\[data-view="(home|progress|reef|you)"\]$/);
  if (tabMatch) return tabButtons[tabMatch[1]];
  return null;
}

const context = {
  window: {
    addEventListener() {},
  },
  document: {
    readyState: "interactive",
    hidden: false,
    documentElement: {
      dataset,
      classList: makeClassList(),
    },
    querySelector,
    querySelectorAll() { return []; },
    addEventListener() {},
  },
  state: { onboarded: true },
  renderAll() { renderCalls += 1; },
  queueMicrotask(callback) { callback(); },
  requestAnimationFrame(callback) { callback(); },
  setTimeout(callback) { callback(); return 1; },
  clearTimeout() {},
  console,
};

vm.createContext(context);
vm.runInContext(source, context, { filename: "v1/core.js" });

const api = context.window.GillieV1;
assert(api, "GillieV1 coordinator was not created");
assert.strictEqual(api.isBooted, true, "Coordinator did not boot before late-module test");
assert.deepStrictEqual(Array.from(api.installedModules), [], "Coordinator unexpectedly installed modules before registration");
assert.strictEqual(api.activeView, "home", "Home was not selected as the initial canonical view");
assert.strictEqual(main.inert, false, "A stale inert property remained on the main shell after boot");
assert.strictEqual(main.getAttribute("inert"), undefined, "A stale inert attribute remained on the main shell after boot");
assert.strictEqual(views.home.hidden, false, "Home was hidden during initial isolation");
for (const name of ["progress", "reef", "you"]) {
  assert.strictEqual(views[name].hidden, true, `${name} remained visible under Home`);
  assert.strictEqual(views[name].dataset.v1Active, "false", `${name} did not receive an inactive view marker`);
  assert.strictEqual(views[name].inert, true, `${name} remained interactive while inactive`);
}
assert.strictEqual(dataset.gillieV1ActiveView, "home", "Active-view runtime marker was not initialized");

let installs = 0;
let hookRuns = 0;
api.register("late-module", (coordinator) => {
  installs += 1;
  coordinator.afterRender(() => { hookRuns += 1; });
});

assert.strictEqual(installs, 1, "A module registered after boot was not installed immediately");
assert.deepStrictEqual(Array.from(api.installedModules), ["late-module"], "Installed-module registry is incorrect");
assert.strictEqual(dataset.gillieV1ModuleCount, "1", "Runtime module-count marker was not updated");
assert.strictEqual(dataset.gillieV1Modules, "late-module", "Runtime module-name marker was not updated");

api.register("late-module", () => { installs += 100; });
assert.strictEqual(installs, 1, "Duplicate module registration installed twice");

api.activateView("reef");
assert.strictEqual(api.activeView, "reef", "Programmatic Reef activation failed");
assert.strictEqual(views.reef.hidden, false, "Reef stayed hidden after activation");
for (const name of ["home", "progress", "you"]) assert.strictEqual(views[name].hidden, true, `${name} remained visible beside Reef`);

// Simulate a later render layer accidentally exposing every screen. The core
// render contract must restore one-view-only layout immediately.
for (const name of names) {
  views[name].hidden = false;
  views[name].dataset.v1Active = "true";
  views[name].inert = false;
}
api.runRenderHooks();
assert.strictEqual(hookRuns, 1, "Late module render hook was not retained");
assert.strictEqual(views.reef.hidden, false, "Reef lost active state after render reconciliation");
for (const name of ["home", "progress", "you"]) assert.strictEqual(views[name].hidden, true, `${name} leaked into the Reef scroll after rendering`);

assert.strictEqual(typeof tabsPointerHandler, "function", "Immediate pointer navigation was not installed");
assert.strictEqual(typeof tabsClickHandler, "function", "Canonical tab click isolation was not installed");
tabsPointerHandler({ target: tabButtons.progress });
assert.strictEqual(api.activeView, "progress", "Progress did not activate immediately on pointerdown");
assert.strictEqual(views.progress.hidden, false, "Progress stayed hidden after pointerdown");

main.inert = true;
main.setAttribute("inert", "");
tabsClickHandler({ target: tabButtons.home, preventDefault() {} });
assert.strictEqual(api.activeView, "home", "Home tab click did not update canonical active view");
assert.strictEqual(views.home.hidden, false, "Home stayed hidden after its tab click");
assert.strictEqual(main.inert, false, "Tab activation did not release the stale main-shell inert property");
assert.strictEqual(main.getAttribute("inert"), undefined, "Tab activation did not remove the stale main-shell inert attribute");
for (const name of ["progress", "reef", "you"]) assert.strictEqual(views[name].hidden, true, `${name} remained visible beside Home`);
assert.strictEqual(tabButtons.home.getAttribute("aria-selected"), "true", "Home tab accessibility state was not updated");
assert.strictEqual(views.reef.getAttribute("aria-hidden"), "true", "Inactive Reef accessibility state was not updated");
assert.strictEqual(renderCalls, 0, "Coordinator test unexpectedly invoked renderAll");

console.log("Gillie V1 coordinator test passed: immediate tab switching clears stale shell locks and preserves strict one-view isolation.");