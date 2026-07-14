const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { scanFinalWebAssets } = require("./verify-final-web-assets");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "gillie-final-web-assets-"));

const safeIndex = `<!doctype html><html class="gillie-boot-pending"><head><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"></head><body><!-- SINGLE LAUNCH HANDOFF --><script data-gillie-v1-entitlement-sync="true"></script><script data-gillie-v1-theme-access="true"></script><script data-gillie-v1-launch-handoff="true"></script><main>Gillie</main></body></html>`;

function writeProductionContract(target, sourceBranch = "main") {
  fs.mkdirSync(path.join(target, "v1"), { recursive: true });
  fs.writeFileSync(path.join(target, "index.html"), safeIndex);
  fs.writeFileSync(path.join(target, "v1", "build-source.json"), JSON.stringify({
    schemaVersion: 2,
    allowedProductionRefs: ["main", "native-ios-launch"],
    sourceBranch,
    sourceCommit: "abc123",
  }));
  fs.writeFileSync(path.join(target, "v1", "purchase-flow.js"), 'const a = "purchase-flow-v3-production-branch Apple returned zero Gillie Plus products Copy purchase details";');
  fs.writeFileSync(path.join(target, "v1", "store-pricing.js"), 'const a = "store-pricing-v2-retryable Loading Apple price…";');
  fs.writeFileSync(path.join(target, "v1", "entitlement-sync.js"), 'const a = "entitlement-sync-v1-always-on app-boot gillie:entitlement-updated";');
  fs.writeFileSync(path.join(target, "v1", "theme-access.js"), 'const a = "theme-access-v1-basic-free";');
  fs.writeFileSync(path.join(target, "v1", "theme-engine.js"), 'const a = "theme-engine-v2-multitank-level-rewards";');
  fs.writeFileSync(path.join(target, "v1", "theme-paint.js"), 'const a = "theme-paint-v1";');
  fs.writeFileSync(path.join(target, "v1", "launch-experience.js"), 'const a = "launch-experience-v1";');
  fs.writeFileSync(path.join(target, "v1", "launch-handoff.js"), 'const a = "launch-handoff-v1-single-intro";');
}

try {
  const safe = path.join(root, "safe");
  writeProductionContract(safe, "main");
  fs.writeFileSync(path.join(safe, "image.png"), Buffer.from("binary metadata $3.99 is ignored because this is not executable text"));

  const safeResult = scanFinalWebAssets(safe);
  assert.strictEqual(safeResult.filesChecked, 10, "Only supported text assets and complete shipping contracts should be scanned");
  assert.strictEqual(safeResult.provenance.sourceBranch, "main");

  const nativeReleaseRef = path.join(root, "native-ref");
  writeProductionContract(nativeReleaseRef, "native-ios-launch");
  assert.strictEqual(scanFinalWebAssets(nativeReleaseRef).provenance.sourceBranch, "native-ios-launch");

  const zoom = path.join(root, "zoom");
  writeProductionContract(zoom);
  fs.writeFileSync(path.join(zoom, "index.html"), safeIndex.replace("viewport-fit=cover", "viewport-fit=cover,user-scalable=no"));
  assert.throws(
    () => scanFinalWebAssets(zoom),
    /viewport zoom restriction: index\.html:1:/,
    "Zoom restrictions must fail with an exact file location",
  );

  const price = path.join(root, "price");
  writeProductionContract(price);
  fs.writeFileSync(path.join(price, "paywall.js"), 'button.textContent = "$29.99";');
  assert.throws(
    () => scanFinalWebAssets(price),
    /hardcoded yearly subscription price: paywall\.js:1:/,
    "Hardcoded prices must fail with an exact file location",
  );

  const savings = path.join(root, "savings");
  writeProductionContract(savings);
  fs.writeFileSync(path.join(savings, "paywall.html"), "<span>Save 37%</span>");
  assert.throws(
    () => scanFinalWebAssets(savings),
    /hardcoded subscription savings claim: paywall\.html:1:/,
    "Hardcoded savings claims must fail with an exact file location",
  );

  const wrongBranch = path.join(root, "wrong-branch");
  writeProductionContract(wrongBranch, "feature/random");
  assert.throws(
    () => scanFinalWebAssets(wrongBranch),
    /unapproved source ref: feature\/random/,
    "A final bundle from an unapproved branch must be rejected",
  );

  const incompleteRefs = path.join(root, "incomplete-refs");
  writeProductionContract(incompleteRefs);
  fs.writeFileSync(path.join(incompleteRefs, "v1", "build-source.json"), JSON.stringify({
    schemaVersion: 2,
    allowedProductionRefs: ["main"],
    sourceBranch: "main",
    sourceCommit: "abc123",
  }));
  assert.throws(
    () => scanFinalWebAssets(incompleteRefs),
    /production refs are incomplete; missing native-ios-launch/,
    "The synchronized production ref contract must remain explicit",
  );

  const legacySplash = path.join(root, "legacy-splash");
  writeProductionContract(legacySplash);
  fs.writeFileSync(path.join(legacySplash, "index.html"), safeIndex.replace("<main>", '<div class="splash-orb">Grow clean</div><main>'));
  assert.throws(
    () => scanFinalWebAssets(legacySplash),
    /legacy first splash/,
    "The signed web bundle must never contain the original splash before the animated intro",
  );

  console.log("Final web asset verifier test passed: Plus entitlement sync, working core themes, one launch, synchronized production refs, and release-content rules are enforced.");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
