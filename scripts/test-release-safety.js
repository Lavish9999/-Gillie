const assert = require("assert");
const {
  hardenAccessibilityMarkup,
  hardenEraseEverything,
  hardenStartupRecovery,
  hardenStorePricing,
  hardenUserTextRendering,
} = require("./apply-release-safety");

const eraseFixtures = [
  `onConfirm: () => {\n    localStorage.removeItem(CONFIG.storageKey);\n    location.reload();\n  }`,
  `onConfirm :()=>{ localStorage.removeItem( CONFIG.storageKey ) ; location.reload() ; }`,
];
for (const fixture of eraseFixtures) {
  const result = hardenEraseEverything(fixture);
  assert(result.includes("onConfirm: async () =>"));
  assert(result.includes("GilliePurchases?.clearDiagnostics"));
  assert(result.includes("localStorage.clear()"));
  assert(!result.includes("localStorage.removeItem(CONFIG.storageKey)"));
}

const recoveryFixtures = [
  `panel.querySelector("#gillie-reset-startup").onclick = () => {\n    if (!confirm("Start fresh? This permanently deletes Gillie progress stored on this device.")) return;\n    try { localStorage.removeItem("gillie_v1"); } catch (_) {}\n    location.reload();\n  };`,
  `panel.querySelector( '#gillie-reset-startup' ).onclick=()=>{ if (!confirm("Start fresh? This permanently deletes Gillie progress stored on this device.")) return; try{localStorage.removeItem('gillie_v1');}catch(_){} location.reload(); };`,
];
for (const fixture of recoveryFixtures) {
  const result = hardenStartupRecovery(fixture);
  assert(result.includes("onclick = async () =>"));
  assert(result.includes("local diagnostics stored on this device"));
  assert(result.includes("GilliePurchases?.clearDiagnostics"));
  assert(result.includes("localStorage.clear()"));
  assert(!result.includes('localStorage.removeItem("gillie_v1")'));
}

const unsafeUserTextFixture = `
<div class="t">\${b.name}</div><div class="s">\${skinOf(b.skin).name}</div>
<div class="row"><div class="gn">\${state.goal.name}</div>
\${state.reasons.join(" · ")}
`;
const safeUserText = hardenUserTextRendering(unsafeUserTextFixture);
assert(safeUserText.includes("escapeHTML(b.name)"));
assert(safeUserText.includes("escapeHTML(skinOf(b.skin).name)"));
assert(safeUserText.includes("escapeHTML(state.goal.name)"));
assert(safeUserText.includes('state.reasons.map(escapeHTML).join(" · ")'));
assert(!safeUserText.includes('<div class="t">${b.name}</div>'));
assert(!safeUserText.includes('<div class="row"><div class="gn">${state.goal.name}</div>'));
assert(!safeUserText.includes('${state.reasons.join(" · ")}'));

const inaccessibleFixture = `
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">
<div id="toast"><span class="em">🌊</span><span id="toast-msg"></span></div>
`;
const accessible = hardenAccessibilityMarkup(inaccessibleFixture);
assert(!accessible.includes("user-scalable=no"));
assert(accessible.includes("viewport-fit=cover"));
assert(accessible.includes('id="toast" role="status" aria-live="polite" aria-atomic="true"'));
assert(accessible.includes('class="em" aria-hidden="true"'));

const pricingFixture = `
yearly: { id: "gillie.plus.yearly", name: "Yearly", price: "$29.99", cadence: "/ year", note: "Best value for staying locked in.", badge: "Save 37%" }
monthly: { id: "gillie.plus.monthly", name: "Monthly", price: "$3.99", cadence: "/ month", note: "Full Plus access. Cancel anytime." }
`;
const paywallFixture = `
const badge = state.savings !== null ? ' <span class="badge" data-gp-computed="true">…</span>' : "";
const percent = savingsPercent(monthly?.price, yearly?.price);
`;
const pricingResult = hardenStorePricing(pricingFixture, paywallFixture);
assert(!pricingResult.html.includes("$29.99"));
assert(!pricingResult.html.includes("$3.99"));
assert(!pricingResult.html.includes("Save 37%"));
assert(pricingResult.html.includes("Loading Apple price…"));
assert(pricingResult.html.includes("Best value"));
assert(pricingResult.html.includes("Cancel anytime"));
assert(pricingResult.paywall.includes('data-gp-computed="true"'));
assert.throws(
  () => hardenStorePricing(pricingFixture, `${paywallFixture}\nconst hardcoded = "Save 37%";`),
  /hardcoded price claim/,
);
assert.throws(
  () => hardenStorePricing(pricingFixture, "no computed savings marker"),
  /exactly one source marker|StoreKit-derived pricing marker/,
);

assert.throws(() => hardenEraseEverything("no reset here"), /exactly one matching handler/);
assert.throws(() => hardenStartupRecovery("no recovery here"), /exactly one matching handler/);
assert.throws(() => hardenUserTextRendering("missing user text markers"), /exactly one source marker/);
assert.throws(() => hardenAccessibilityMarkup("missing accessibility markers"), /exactly one source marker/);
assert.throws(() => hardenStorePricing("missing pricing markers", "missing paywall markers"), /exactly one source marker/);

console.log("Release safety transform test passed: reset, user text, scalable viewport, accessible toast, and Apple-price enforcement reject unsafe or missing handlers.");
