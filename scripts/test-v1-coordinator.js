const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1/core.js"), "utf8");

const dataset = {};
const app = {};
const tabs = { addEventListener() {} };
let renderCalls = 0;

const context = {
  window: {},
  document: {
    readyState: "interactive",
    documentElement: {
      dataset,
      classList: { add() {} },
    },
    querySelector(selector) {
      if (selector === "#app") return app;
      if (selector === "#tabs") return tabs;
      return null;
    },
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

api.runRenderHooks();
assert.strictEqual(hookRuns, 1, "Late module render hook was not retained");
assert.strictEqual(renderCalls, 0, "Coordinator test unexpectedly invoked renderAll");

console.log("Gillie V1 coordinator late-registration test passed.");
