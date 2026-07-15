const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1", "followup-rescue.js"), "utf8");

for (const marker of [
  "followup-rescue-v1-ios-direct-routing",
  'window.addEventListener("pointerup"',
  'window.addEventListener("click"',
  "followup-made",
  "fallbackResolve",
  "GillieFollowupRescue",
]) assert(source.includes(marker), `Follow-up rescue is missing: ${marker}`);

class Style { setProperty() {} }
class ClassList { add() {} remove() {} }
class Element {
  constructor(id = "") {
    this.id = id;
    this.hidden = false;
    this.style = new Style();
    this.classList = new ClassList();
    this.children = [];
    this.parent = null;
    this.disabled = false;
  }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  querySelector(selector) {
    if (selector === ".sheet") return this.children.find((child) => child.id === "sheet") || null;
    if (selector.startsWith("#")) return findById(this, selector.slice(1));
    return null;
  }
  closest(selector) {
    const ids = selector.split(",").map((item) => item.trim().replace(/^#/, ""));
    let node = this;
    while (node) {
      if (ids.includes(node.id)) return node;
      node = node.parent;
    }
    return null;
  }
  contains(node) {
    while (node) {
      if (node === this) return true;
      node = node.parent;
    }
    return false;
  }
  removeAttribute() {}
  setAttribute() {}
}
function findById(rootNode, id) {
  if (rootNode.id === id) return rootNode;
  for (const child of rootNode.children) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

const body = new Element("body");
const head = new Element("head");
const overlay = body.appendChild(new Element("followup-overlay"));
const sheet = overlay.appendChild(new Element("sheet"));
const made = sheet.appendChild(new Element("followup-made"));
sheet.appendChild(new Element("followup-fighting"));
sheet.appendChild(new Element("followup-used"));
const listeners = {};
const document = {
  readyState: "complete",
  body,
  head,
  createElement: () => new Element(),
  querySelector: (selector) => selector.startsWith("#") ? findById(body, selector.slice(1)) || findById(head, selector.slice(1)) : null,
  addEventListener() {},
};
const state = {
  pendingFollowup: { cravingId: "c1", dueAt: Date.now() },
  cravings: [{ id: "c1", pending: true, resisted: false }],
};
let saves = 0;
let renders = 0;
const context = {
  window: {
    addEventListener: (name, callback) => { listeners[name] = callback; },
    GillieV1: { afterRender() {}, announce() {} },
    Capacitor: { Plugins: { GilliePurchases: { trackEvent() {} } } },
    PointerEvent: function PointerEvent() {},
  },
  document,
  state,
  save: () => { saves += 1; },
  renderAll: () => { renders += 1; },
  grantSosReward: () => ({ pearls: 5 }),
  toast() {},
  axoCelebrate() {},
  MutationObserver: class { observe() {} },
  Date,
  Object,
  Array,
  Number,
  Boolean,
  String,
  Math,
  console,
};
context.window.window = context.window;
context.window.document = document;
vm.createContext(context);
vm.runInContext(source, context, { filename: "v1/followup-rescue.js" });

assert(context.window.GillieFollowupRescue, "Follow-up rescue API must install");
assert.strictEqual(context.window.GillieFollowupRescue.resolve("made"), true);
assert.strictEqual(state.pendingFollowup, null);
assert.strictEqual(state.cravings[0].resisted, true);
assert.strictEqual(state.cravings[0].pending, false);
assert.strictEqual(overlay.hidden, true);
assert.strictEqual(saves, 1);
assert.strictEqual(renders, 1);

state.pendingFollowup = { cravingId: "c2", dueAt: Date.now() };
state.cravings.push({ id: "c2", pending: true, resisted: false });
overlay.hidden = false;
let prevented = false;
listeners.pointerup({
  target: made,
  preventDefault() { prevented = true; },
  stopPropagation() {},
  stopImmediatePropagation() {},
});
assert(prevented, "Pointer routing must consume the previously frozen button tap");
assert.strictEqual(state.pendingFollowup, null);
assert.strictEqual(state.cravings[1].resisted, true);
assert.strictEqual(overlay.hidden, true);

console.log("Follow-up rescue direct and pointer activation tests passed.");
