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
  getComputedStyle(node) {
    return node.computedStyle || {
      display: "flex",
      visibility: "visible",
      pointerEvents: "auto",
      opacity: "1",
    };
  },
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, { filename: "v1/accessibility.js" });

const accessibility = context.window.GillieAccessibility;
assert(accessibility, "Accessibility API was not exposed");
assert.strictEqual(accessibility.engine, "accessibility-v1");
assert(accessibility.focusableSelector.includes("button:not([disabled])"));
assert.strictEqual(typeof accessibility.isDialogVisiblyOpen, "function");

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

function dialog({ hidden = false, style = {}, width = 390, height = 700 } = {}) {
  return {
    hidden,
    computedStyle: {
      display: "flex",
      visibility: "visible",
      pointerEvents: "auto",
      opacity: "1",
      ...style,
    },
    getBoundingClientRect() { return { width, height }; },
  };
}

assert.strictEqual(accessibility.isDialogVisiblyOpen(dialog()), true, "A visible dialog was ignored");
assert.strictEqual(accessibility.isDialogVisiblyOpen(dialog({ hidden: true })), false, "A hidden dialog was treated as open");
assert.strictEqual(accessibility.isDialogVisiblyOpen(dialog({ style: { display: "none" } })), false, "display:none dialog was treated as open");
assert.strictEqual(accessibility.isDialogVisiblyOpen(dialog({ style: { visibility: "hidden" } })), false, "Invisible dialog was treated as open");
assert.strictEqual(accessibility.isDialogVisiblyOpen(dialog({ style: { pointerEvents: "none" } })), false, "Noninteractive dialog was treated as blocking");
assert.strictEqual(accessibility.isDialogVisiblyOpen(dialog({ style: { opacity: "0" } })), false, "Transparent dialog was treated as blocking");
assert.strictEqual(accessibility.isDialogVisiblyOpen(dialog({ width: 0, height: 0 })), false, "Collapsed dialog was treated as blocking");

console.log("Accessibility test passed: viewport zoom remains available and visually closed dialogs cannot leave Gillie's main navigation inert.");
