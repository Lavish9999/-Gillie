const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "phase5-paywall.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "phase5-paywall.css"), "utf8");

/* ---------- static contracts ---------- */

for (const marker of [
  "gilliePaywallRebuildInstalled",
  "gp-paywall-sheet",
  "gp-paywall-scroll",
  "gp-purchase-dock",
  "gp-status-banner",
  "gp-benefit-svg",
  "gp-trial-timeline",
  "gp-topbar",
  "deriveTrialState",
  "savingsPercent",
  'data-gp-computed="true"',
  "No payment due today",
  "Cancel anytime in your Apple subscription settings.",
  "Your selected Gillie Plus plan renews unless canceled.",
  "Purchase canceled. Nothing was charged.",
  "Nothing charged. You can try again anytime.",
  "paywall_cta_tapped",
  "GilliePaywallPresenter",
  "GilliePaywallLogic",
]) {
  assert(source.includes(marker), `Paywall presenter is missing: ${marker}`);
}

// One authoritative checkout owner: the presenter must never start purchases,
// bind checkout handlers, or load products itself.
assert(!/native\.purchase\s*\(/.test(source), "Presenter must not call native purchase");
assert(!/purchase\.onclick|restore\.onclick/.test(source), "Presenter must not bind checkout handlers");
assert(!/getProducts\s*\(/.test(source), "Presenter must not run its own product lookup");
// The only propagation stop allowed is the legacy drag guard on pointer events;
// checkout clicks must always reach the purchase director.
const clickHandlerBlock = source.slice(source.indexOf('document.addEventListener("click"'));
assert(!clickHandlerBlock.includes("stopImmediatePropagation"), "Presenter must not swallow checkout clicks");

// No hardcoded store pricing or savings claims.
for (const forbidden of ["$3.99", "$29.99", "Save 37%", "7-day free trial", "position:sticky"]) {
  assert(!source.includes(forbidden) && !styles.includes(forbidden), `Hardcoded claim returned: ${forbidden}`);
}

// The paywall never promises a trial-ending reminder (no reminder system backs it).
assert(!/remind/i.test(source), "Paywall copy must not promise trial reminders");

for (const marker of [
  "#plus-overlay.gp-paywall-overlay",
  ".gp-hero-card",
  ".gp-topbar",
  ".gp-trial-timeline",
  ".gp-plan-check",
  ".gp-purchase-dock",
  ".gp-primary-cta",
  "prefers-reduced-motion",
  "safe-area-inset-bottom",
  "min-height:44px",
  "min-height:56px",
]) {
  assert(styles.includes(marker), `Paywall styles are missing: ${marker}`);
}

/* ---------- pure logic ---------- */

const context = {
  console,
  setTimeout() { return 0; },
  clearTimeout() {},
  navigator: { language: "en-US" },
  Intl,
  document: {
    readyState: "complete",
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    documentElement: { dataset: {} },
  },
  window: { Capacitor: { Plugins: {} } },
};
context.window.window = context.window;
context.window.document = context.document;
vm.createContext(context);
vm.runInContext(source, context, { filename: "phase5-paywall.js" });

const logic = context.window.GilliePaywallLogic;
assert(logic, "Paywall logic API was not exposed");
assert.strictEqual(logic.productIds.yearly, "gillie.plus.yearly");
assert.strictEqual(logic.productIds.monthly, "gillie.plus.monthly");

const yearlyId = logic.productIds.yearly;
const withTrial = new Map([[yearlyId, {
  id: yearlyId,
  displayPrice: "US$28.49",
  price: 28.49,
  currencyCode: "USD",
  introOffer: { paymentMode: "freeTrial", periodValue: 7, periodUnit: "day", periodCount: 1, displayPrice: "$0.00" },
  introEligible: true,
}]]);

const trial = logic.deriveTrialState(withTrial, "yearly");
assert.strictEqual(trial.eligible, true, "Verified free trial must present as eligible");
assert.strictEqual(trial.days, 7, "Trial duration must derive from StoreKit period data");

const weekTrial = logic.deriveTrialState(new Map([[yearlyId, {
  ...withTrial.get(yearlyId),
  introOffer: { paymentMode: "freeTrial", periodValue: 1, periodUnit: "week", periodCount: 1, displayPrice: "$0.00" },
}]]), "yearly");
assert.strictEqual(weekTrial.days, 7, "A one-week trial must derive to seven days");

// Every one of these must present WITHOUT trial copy.
const ineligibleCases = [
  ["user not eligible", { ...withTrial.get(yearlyId), introEligible: false }],
  ["paid intro offer", { ...withTrial.get(yearlyId), introOffer: { paymentMode: "payUpFront", periodValue: 1, periodUnit: "month" } }],
  ["no intro offer", { ...withTrial.get(yearlyId), introOffer: null }],
];
for (const [label, product] of ineligibleCases) {
  const state = logic.deriveTrialState(new Map([[yearlyId, product]]), "yearly");
  assert.strictEqual(state.eligible, false, `Trial copy must not appear when ${label}`);
}
assert.strictEqual(logic.deriveTrialState(new Map(), "yearly").eligible, false, "Missing pricing must never show trial copy");
assert.strictEqual(logic.deriveTrialState(null, "yearly").eligible, false, "Absent pricing map must never show trial copy");

// Savings come only from live prices and stay in a sane band.
assert.strictEqual(logic.savingsPercent(3.99, 29.99), 37);
assert.strictEqual(logic.savingsPercent(0, 29.99), null);
assert.strictEqual(logic.savingsPercent(null, 29.99), null);
assert.strictEqual(logic.savingsPercent(3.99, undefined), null);
assert.strictEqual(logic.savingsPercent(3.99, 47), null, "Negative or negligible savings must not render a badge");

assert.strictEqual(logic.formatCurrency(2.37, "USD"), "$2.37");
assert.strictEqual(logic.formatCurrency(2.37, ""), "", "Missing currency must not render an equivalent price");

console.log("Paywall presenter test passed: StoreKit-verified trial gating, derived trial duration, live-price savings, single-owner checkout, and honest billing copy are enforced.");
