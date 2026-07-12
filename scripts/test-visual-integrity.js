const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1/visual-integrity.js"), "utf8");
let installer = null;
let documentClickHandler = null;
let manageCalls = 0;

function element({ text = "", fontSize = 12, letterSpacing = 0, height = 30, borderLeft = 0, borderRight = 0, classes = [], offsetParent = {}, id = "" } = {}) {
  const classSet = new Set(classes);
  const attributes = new Map();
  const node = {
    id,
    textContent: text,
    className: classes.join(" "),
    dataset: {},
    hidden: false,
    offsetParent,
    removed: false,
    children: new Map(),
    childNodes: [],
    parentNode: null,
    classList: {
      contains(name) { return classSet.has(name); },
      add(name) { classSet.add(name); },
      remove(name) { classSet.delete(name); },
    },
    closest(selector) {
      if (selector === "#plus-purchase" && this.id === "plus-purchase") return this;
      if (selector === "svg" || selector === "[aria-live]" || selector === "button") return null;
      return null;
    },
    matches(selector) {
      if (selector === "button,.btn") return false;
      if (selector.includes(".tank") && classSet.has("tank")) return true;
      return false;
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name); },
    appendChild(child) {
      child.parentNode = this;
      this.childNodes.push(child);
      if (child.id) this.children.set(`#${child.id}`, child);
      return child;
    },
    insertBefore(child, before) {
      child.parentNode = this;
      const index = this.childNodes.indexOf(before);
      if (index >= 0) this.childNodes.splice(index, 0, child);
      else this.childNodes.push(child);
      if (child.id) this.children.set(`#${child.id}`, child);
      return child;
    },
    remove() {
      this.removed = true;
      if (this.parentNode) {
        this.parentNode.childNodes = this.parentNode.childNodes.filter((child) => child !== this);
        if (this.id) this.parentNode.children.delete(`#${this.id}`);
      }
    },
    getBoundingClientRect() { return { height }; },
    styleSnapshot: { fontSize: `${fontSize}px`, letterSpacing: `${letterSpacing}px`, borderLeftWidth: `${borderLeft}px`, borderRightWidth: `${borderRight}px` },
  };
  return node;
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

const overlay = element({ id: "plus-overlay" });
const footer = element({ classes: ["gp-footer"] });
const caption = element({ text: "Secure Apple billing · Cancel anytime", classes: ["gp-cta-caption"] });
const yearlyBadge = element({ text: "Save 37%", classes: ["badge"] });
const purchasePanel = element({ classes: ["gp-purchase-panel"] });
const purchaseDock = element({ id: "gp-purchase-dock" });
const purchaseButton = element({ id: "plus-purchase", text: "Start Gillie Plus" });
const versionLabel = element({ id: "phase1-version", text: "phase1-2026.07.10" });
purchasePanel.appendChild(purchaseDock);
overlay.children.set(".gp-footer", footer);
overlay.children.set(".gp-cta-caption", caption);
overlay.children.set("#gp-purchase-dock", purchaseDock);
overlay.children.set("#plus-purchase", purchaseButton);

function qs(selector, rootNode) {
  if (!rootNode) {
    if (selector === "#main") return main;
    if (selector === "#plan-preview") return plan;
    if (selector === "#coach-card") return coach;
    if (selector === "#plus-overlay") return overlay;
    if (selector === "#phase1-version") return versionLabel;
    return null;
  }
  return rootNode.children?.get(selector) || null;
}

function qsa(selector, rootNode) {
  if (rootNode === overlay && selector === '[data-plus-plan="yearly"] .badge') return yearlyBadge.removed ? [] : [yearlyBadge];
  if (selector === ".locked-teaser") return [locked];
  if (selector === ".tag,.badge,[class*='status'],[class*='pill']") return [freeTag, plusTag, lockedTag, liveTag, oversizedStatus].filter((item) => !item.removed);
  if (selector === "#main *") return [planEyebrow, coachEyebrow, lockedTitle, liveTag, largeTrackedHeading, stripedCard, emptyCard, oversizedStatus];
  if (selector === "[class*='card'],[class*='banner'],[class*='hero']") return [plan, coach, locked, stripedCard, emptyCard];
  return [];
}

const documentElement = { dataset: {} };
const location = { href: "" };
const context = {
  console,
  document: {
    documentElement,
    createElement(tag) { return element({ classes: [tag] }); },
    addEventListener(type, handler) { if (type === "click") documentClickHandler = handler; },
  },
  window: {
    location,
    Capacitor: {
      Plugins: {
        GilliePurchases: {
          getDiagnostics() { return Promise.resolve({ app: { version: "1.0", build: "1234" } }); },
          manageSubscriptions() { manageCalls += 1; return Promise.resolve({ opened: true }); },
        },
      },
    },
    GillieV1: {
      register(name, callback) {
        if (name === "visual-integrity") installer = callback;
      },
    },
  },
  requestAnimationFrame(callback) { callback(); },
  setTimeout(callback) { callback(); return 1; },
  getComputedStyle(node) { return node.styleSnapshot || { fontSize: "12px", letterSpacing: "0px", borderLeftWidth: "0px", borderRightWidth: "0px" }; },
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, { filename: "visual-integrity.js" });

(async () => {
  if (typeof installer !== "function") throw new Error("Visual integrity did not register with the V1 coordinator.");
  installer({ qs, qsa, afterRender() {}, track() {}, getState() { return { premium: true }; } });
  await Promise.resolve();
  await Promise.resolve();

  if (!freeTag.removed || planEyebrow.textContent !== "Today preview · Free") throw new Error("Free badge was not integrated into normal copy.");
  if (!liveTag.removed) throw new Error("Fake LIVE badge was not removed.");
  if (!plusTag.removed || coachEyebrow.textContent !== "Gillie Coach · Plus") throw new Error("Coach Plus badge was not integrated into normal copy.");
  if (!lockedTag.removed || lockedTitle.textContent !== "Premium insights · Plus") throw new Error("Locked teaser Plus badge was not integrated into normal copy.");
  if (largeTrackedHeading.dataset.visualNormalTracking !== "true") throw new Error("Display-size letter spacing was not normalized.");
  if (stripedCard.dataset.visualHeavyAccent !== "true") throw new Error("Decorative side stripe was not neutralized.");
  if (emptyCard.dataset.visualEmptySurface !== "true") throw new Error("Oversized empty surface was not collapsed.");
  if (oversizedStatus.dataset.visualCompactStatus !== "true") throw new Error("Oversized status pill was not compacted.");

  const disclosure = footer.children.get("#v1-renewal-disclosure");
  if (!disclosure || !/renews automatically/i.test(disclosure.textContent)) throw new Error("Visible auto-renewal disclosure was not installed.");
  if (!yearlyBadge.removed) throw new Error("Hard-coded subscription savings claim was not removed.");
  if (caption.textContent !== "Apple billing · Manage or cancel in Settings") throw new Error("Paywall billing caption was not clarified.");
  if (!purchasePanel.children.get("#v1-active-subscription")) throw new Error("Active subscriber status was not added.");
  if (purchaseButton.textContent !== "Manage subscription" || purchaseButton.dataset.v1ManageSubscription !== "true") throw new Error("Active subscriber CTA was not converted to management.");
  if (versionLabel.textContent !== "1.0 (1234)") throw new Error("User-facing app version did not resolve from the native build.");

  if (typeof documentClickHandler !== "function") throw new Error("Paywall capture handler was not installed.");
  let prevented = false;
  let stopped = false;
  documentClickHandler({
    target: purchaseButton,
    preventDefault() { prevented = true; },
    stopImmediatePropagation() { stopped = true; },
  });
  await Promise.resolve();
  if (!prevented || !stopped || manageCalls !== 1) throw new Error("Active subscriber CTA did not open Apple subscription management safely.");

  if (documentElement.dataset.visualIntegrity !== "visual-integrity-v1.1") throw new Error("Visual integrity runtime marker was not installed.");
  if (documentElement.dataset.v1PaywallIntegrity !== "true") throw new Error("Paywall integrity capture marker was not installed.");

  console.log("Visual integrity runtime test passed: template UI is controlled, renewal terms are visible, and active subscribers manage through Apple.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
