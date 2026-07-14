const assert = require("assert");
const {
  hardenEraseEverything,
  hardenStartupRecovery,
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

assert.throws(() => hardenEraseEverything("no reset here"), /exactly one matching handler/);
assert.throws(() => hardenStartupRecovery("no recovery here"), /exactly one matching handler/);
assert.throws(() => hardenUserTextRendering("missing user text markers"), /exactly one source marker/);

console.log("Release safety transform test passed: reset hardening and user-text escaping reject unsafe or missing handlers.");
