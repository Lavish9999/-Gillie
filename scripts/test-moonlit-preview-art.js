const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1/moonlit-preview-art.js"), "utf8");
let installer = null;
let clickHandler = null;
const tracked = [];

function makeNode(className, transform = false) {
  return {
    className,
    transform,
    removedClass: false,
    style: { removeProperty() {} },
    removeAttribute(name) {
      if (name === "class") {
        this.className = "";
        this.removedClass = true;
      }
    },
  };
}

const gills = Array.from({ length: 6 }, (_, index) => makeNode(`gill ${index < 3 ? `g${index + 1}` : `r g${index - 2}`}`, true));
const descendants = [
  makeNode("axo-tail"),
  makeNode("axo-core"),
  ...gills,
  makeNode("axo-leg"),
  makeNode("axo-eye"),
  makeNode("axo-mouth"),
];
const svg = { dataset: {} };
const overlay = { hidden: true };
const view = {
  addEventListener(type, handler) {
    if (type === "click") clickHandler = handler;
  },
};

const context = {
  console,
  queueMicrotask(callback) { callback(); },
  requestAnimationFrame(callback) { callback(); },
  window: {
    GillieV1: {
      register(name, callback) {
        if (name === "moonlit-preview-art") installer = callback;
      },
    },
  },
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, { filename: "moonlit-preview-art.js" });

if (typeof installer !== "function") throw new Error("Moonlit preview art module did not register.");

const hooks = [];
installer({
  qs(selector) {
    if (selector === "#view-reef") return view;
    if (selector === ".moonlit-preview-gillie-svg") return svg;
    if (selector === "#moonlit-reef-preview") return overlay;
    return null;
  },
  qsa(selector, rootNode) {
    if (rootNode !== svg) return [];
    if (selector === "g.gill[transform]") return gills;
    if (selector === "[class]") return descendants.filter((node) => node.className);
    return [];
  },
  afterRender(callback) { hooks.push(callback); },
  track(name, properties) { tracked.push({ name, properties }); },
});

if (svg.dataset.moonlitArtEngine !== "class-isolated-v3") {
  throw new Error("Moonlit preview did not install the class-isolated art engine.");
}
if (svg.dataset.moonlitGillCount !== "6") {
  throw new Error("Moonlit preview did not verify all six gills.");
}
if (descendants.some((node) => !node.removedClass || node.className)) {
  throw new Error("Moonlit preview left an inherited SVG animation class behind.");
}
if (!tracked.some((event) => event.name === "moonlit_preview_art_sanitized" && event.properties?.gills === 6)) {
  throw new Error("Moonlit preview did not report successful six-gill sanitization.");
}
if (typeof clickHandler !== "function") {
  throw new Error("Moonlit preview art module did not bind its preview-open safeguard.");
}

console.log("Moonlit preview art test passed: six authored gill transforms remain and every colliding SVG animation class is removed.");
