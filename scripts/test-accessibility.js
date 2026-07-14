const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1", "accessibility.js"), "utf8");
const context = {
  window: {},
  console,
  Object,
  Array,
  String,
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, { filename: "v1/accessibility.js" });

const accessibility = context.window.GillieAccessibility;
assert(accessibility, "Accessibility API was not exposed");
assert.strictEqual(accessibility.engine, "accessibility-v1");
assert(accessibility.focusableSelector.includes("button:not([disabled])"));

const normalized = accessibility.normalizeViewportContent(
  "width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no, maximum-scale=1",
);
assert(normalized.includes("width=device-width"));
assert(normalized.includes("initial-scale=1.0"));
assert(normalized.includes("viewport-fit=cover"));
assert(!normalized.includes("user-scalable=no"));
assert(!normalized.includes("maximum-scale=1"));

const minimal = accessibility.normalizeViewportContent("viewport-fit=cover");
assert(minimal.includes("width=device-width"));
assert(minimal.includes("initial-scale=1.0"));
assert(minimal.includes("viewport-fit=cover"));

const empty = accessibility.normalizeViewportContent("");
assert(empty.includes("width=device-width"));
assert(empty.includes("initial-scale=1.0"));

console.log("Accessibility test passed: viewport zoom restrictions are removed while required mobile viewport settings remain.");
