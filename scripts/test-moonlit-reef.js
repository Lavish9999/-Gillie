const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1/moonlit-reef.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "v1/moonlit-reef.css"), "utf8");
let installer = null;
let renderCount = 0;
let saveCount = 0;

if (!source.includes('PREVIEW_ART_ENGINE = "standalone-svg-v4"')) {
  throw new Error("Moonlit preview is missing the standalone SVG art engine.");
}
if (!source.includes("const STANDALONE_MOON_PEARL_SVG")) {
  throw new Error("Moonlit preview is missing its self-contained Moon Pearl artwork.");
}
if (!source.includes('class="moonlit-preview-character-svg"')) {
  throw new Error("Moonlit preview is missing its standalone character SVG.");
}
for (const forbidden of [
  'if (typeof axoSVG === "function")',
  "return axoSVG(",
  "svg.innerHTML = axoSVG(",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`Moonlit preview restored executable use of the globally animated Gillie renderer: ${forbidden}`);
  }
}
for (const forbidden of ['class="gill', 'class="axo-core', 'class="axo-tail', 'class="axo-leg', 'class="axo-eye']) {
  if (source.includes(forbidden)) throw new Error(`Standalone Moon Pearl art restored a global animation class: ${forbidden}`);
}
const gillTags = source.match(/<path data-moonlit-gill="[^"]+"[^>]*>/g) || [];
if (gillTags.length !== 6) {
  throw new Error(`Standalone Moon Pearl art must contain exactly six final-position gills; found ${gillTags.length}.`);
}
if (gillTags.some((tag) => /\btransform=/.test(tag))) {
  throw new Error("Standalone Moon Pearl gills must be authored in final coordinates without transform attributes.");
}
if (!styles.includes(".moonlit-preview-character-svg{display:block")) {
  throw new Error("Moonlit preview is missing standalone character sizing styles.");
}
if (styles.includes("moonlit-preview-gillie-svg")) {
  throw new Error("Moonlit preview restored the obsolete live-render SVG wrapper.");
}
if (!source.includes("A grounded lunar arch for the reef floor")) {
  throw new Error("Moonlit preview restored the old ungrounded Crescent Arch treatment.");
}

const classList = { add() {}, remove() {}, toggle() {} };
const context = {
  console,
  Date,
  Math,
  setTimeout,
  clearTimeout,
  requestAnimationFrame(callback) { callback(); },
  document: {
    body: { classList, appendChild() {} },
    createElement() { return { classList, dataset: {}, style: {}, appendChild() {}, addEventListener() {}, setAttribute() {}, remove() {} }; },
  },
  window: {
    GillieV1: {
      register(name, callback) {
        if (name === "moonlit-reef") installer = callback;
      },
    },
  },
  save() { saveCount += 1; },
  renderAxo() {},
  renderAll() { renderCount += 1; },
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(`
  const THEMES = [{ id: "clear", name: "Clearwater", premium: false }];
  const SKINS = [{ id: "pink", name: "Pink", premium: false }];
  const CONFIG = { plus: { valueCards: ["Coach", "Rare themes"] } };
`, context);
vm.runInContext(source, context, { filename: "moonlit-reef.js" });

if (typeof installer !== "function") throw new Error("Moonlit Reef did not register with the V1 coordinator.");

function makeHarness(state) {
  let clickHandler = null;
  let plusClicks = 0;
  const view = {
    addEventListener(type, handler) {
      if (type === "click") clickHandler = handler;
    },
  };
  const plusButton = { click() { plusClicks += 1; } };
  const qs = (selector) => {
    if (selector === "#view-reef") return view;
    if (selector === "#plus-open") return plusButton;
    return null;
  };
  const hooks = [];
  installer({
    qs,
    afterRender(callback) { hooks.push(callback); },
    notify() {},
    track() {},
    getState() { return state; },
  });
  if (typeof clickHandler !== "function") throw new Error("Moonlit Reef did not install its Reef action handler.");
  return {
    triggerEquip() {
      clickHandler({ target: { closest(selector) { return selector === "[data-moonlit-equip]" ? {} : null; } } });
    },
    get plusClicks() { return plusClicks; },
    hooks,
  };
}

const freeState = { onboarded: true, premium: false, theme: "clear", skin: "pink" };
const freeHarness = makeHarness(freeState);
freeHarness.triggerEquip();
if (freeHarness.plusClicks !== 1) throw new Error("Free equip did not open Gillie Plus exactly once.");
if (freeState.theme !== "clear" || freeState.skin !== "pink") throw new Error("Free preview path changed the equipped collection.");

const premiumState = { onboarded: true, premium: true, theme: "clear", skin: "pink" };
const premiumHarness = makeHarness(premiumState);
premiumHarness.triggerEquip();
if (premiumHarness.plusClicks !== 0) throw new Error("Active Plus incorrectly reopened the paywall.");
if (premiumState.theme !== "moonlit" || premiumState.skin !== "moonpearl") throw new Error("Full collection equip did not apply the Moonlit theme and Moon Pearl skin.");
for (const key of ["ambienceEquipped", "jellyEquipped", "crescentEquipped", "starCoralEquipped"]) {
  if (!premiumState.moonlitReef?.[key]) throw new Error(`Full collection equip did not persist ${key}.`);
}

const catalogCheck = vm.runInContext(`({
  themes: THEMES.filter((item) => item.id === "moonlit").length,
  skins: SKINS.filter((item) => item.id === "moonpearl").length,
  value: CONFIG.plus.valueCards.some((item) => /Moonlit Reef/.test(item)),
})`, context);
if (catalogCheck.themes !== 1 || catalogCheck.skins !== 1 || !catalogCheck.value) {
  throw new Error("Moonlit catalog integration was not installed exactly once.");
}
if (renderCount < 1 || saveCount < 1) throw new Error("Moonlit equip did not use the app render and persistence paths.");

console.log("Moonlit Reef runtime test passed: standalone six-gill preview art, grounded arch, free preview gating, Plus equip, persistence, and catalog integration work.");
