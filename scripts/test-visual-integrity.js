const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1/visual-integrity.js"), "utf8");
let installer = null;

function element({ text = "", fontSize = 12, letterSpacing = 0, height = 30, borderLeft = 0, borderRight = 0, classes = [], offsetParent = {} } = {}) {
  const classSet = new Set(classes);
  return {
    textContent: text,
    dataset: {},
    hidden: false,
    offsetParent,
    removed: false,
    children: new Map(),
    classList: { contains(name) { return classSet.has(name); } },
    closest(selector) {
      if (selector === "svg" || selector === "[aria-live]" || selector === "button") return null;
      return null;
    },
    matches(selector) {
      if (selector === "button,.btn") return false;
      if (selector.includes(".tank") && classSet.has("tank")) return true;
      return false;
    },
    remove() { this.removed = true; },
    getBoundingClientRect() { return { height }; },
    styleSnapshot: { fontSize: `${fontSize}px`, letterSpacing: `${letterSpacing}px`, borderLeftWidth: `${borderLeft}px`, borderRightWidth: `${borderRight}px` },
  };
}

const main = element({ classes: ["main"] });
const plan = element({ classes: ["plan-preview"] });
const planEyebrow = element({ text: "Today preview" });
const freeTag = element({ text: "FREE", classes: ["tag"] });
plan.children.set(".eyebrow", planEyebrow);
plan.children.set(".tag", freeTag);

const coach = element({ classes: ["coach-card"] });
const coachEyebrow = element({ text: "Gillie Coach" });
const plusTag = element({ text: "PLUS", classes: ["tag"] });
coach.children.set(".eyebrow", coachEyebrow);
coach.children.set(".tag", plusTag);

const locked = element({ classes: ["locked-teaser"] });
const lockedTitle = element({ text: "Premium insights", classes: ["t"] });
const lockedTag = element({ text: "PLUS", classes: ["tag"] });
locked.children.set(".t", lockedTitle);
locked.children.set(".tag", lockedTag);

const liveTag = element({ text: "LIVE", classes: ["status-pill"] });
const largeTrackedHeading = element({ text: "A real heading", fontSize: 24, letterSpacing: 4 });
const stripedCard = element({ text: "Useful card", borderLeft: 8, classes: ["result-card"] });
const emptyCard = element({ text: "", height: 280, classes: ["empty-card"] });
const oversizedStatus = element({ text: "Ready", fontSize: 20, height: 58, classes: ["status-pill"] });

function qs(selector, rootNode) {
  if (!rootNode) {
    if (selector === "#main") return main;
    if (selector === "#plan-preview") return plan;
    if (selector === "#coach-card") return coach;
    return null;
  }
  return rootNode.children?.get(selector) || null;
}

function qsa(selector) {
  if (selector === ".locked-teaser") return [locked];
  if (selector === ".tag,.badge,[class*='status'],[class*='pill']") return [freeTag, plusTag, lockedTag, liveTag, oversizedStatus].filter((item) => !item.removed);
  if (selector === "#main *") return [planEyebrow, coachEyebrow, lockedTitle, liveTag, largeTrackedHeading, stripedCard, emptyCard, oversizedStatus];
  if (selector === "[class*='card'],[class*='banner'],[class*='hero']") return [plan, coach, locked, stripedCard, emptyCard];
  return [];
}

const documentElement = { dataset: {} };
const context = {
  console,
  document: { documentElement },
  window: {
    GillieV1: {
      register(name, callback) {
        if (name === "visual-integrity") installer = callback;
      },
    },
  },
  requestAnimationFrame() {},
  setTimeout() {},
  getComputedStyle(node) { return node.styleSnapshot || { fontSize: "12px", letterSpacing: "0px", borderLeftWidth: "0px", borderRightWidth: "0px" }; },
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, { filename: "visual-integrity.js" });

if (typeof installer !== "function") throw new Error("Visual integrity did not register with the V1 coordinator.");
installer({ qs, qsa, afterRender() {}, track() {} });

if (!freeTag.removed || planEyebrow.textContent !== "Today preview · Free") throw new Error("Free badge was not integrated into normal copy.");
if (!liveTag.removed) throw new Error("Fake LIVE badge was not removed.");
if (!plusTag.removed || coachEyebrow.textContent !== "Gillie Coach · Plus") throw new Error("Coach Plus badge was not integrated into normal copy.");
if (!lockedTag.removed || lockedTitle.textContent !== "Premium insights · Plus") throw new Error("Locked teaser Plus badge was not integrated into normal copy.");
if (largeTrackedHeading.dataset.visualNormalTracking !== "true") throw new Error("Display-size letter spacing was not normalized.");
if (stripedCard.dataset.visualHeavyAccent !== "true") throw new Error("Decorative side stripe was not neutralized.");
if (emptyCard.dataset.visualEmptySurface !== "true") throw new Error("Oversized empty surface was not collapsed.");
if (oversizedStatus.dataset.visualCompactStatus !== "true") throw new Error("Oversized status pill was not compacted.");
if (documentElement.dataset.visualIntegrity !== "visual-integrity-v1") throw new Error("Visual integrity runtime marker was not installed.");

console.log("Visual integrity runtime test passed: fake badges, wide tracking, accent stripes, status pills, and empty surfaces are controlled.");
