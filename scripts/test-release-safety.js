const assert = require("assert");
const {
  hardenEraseEverything,
  hardenStartupRecovery,
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

assert.throws(() => hardenEraseEverything("no reset here"), /exactly one matching handler/);
assert.throws(() => hardenStartupRecovery("no recovery here"), /exactly one matching handler/);

console.log("Release safety transform test passed: reset hardening survives formatting changes and still rejects missing handlers.");
