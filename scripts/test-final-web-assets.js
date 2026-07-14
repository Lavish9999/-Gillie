const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { scanFinalWebAssets } = require("./verify-final-web-assets");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "gillie-final-web-assets-"));

function writeProductionContract(target) {
  fs.mkdirSync(path.join(target, "v1"), { recursive: true });
  fs.writeFileSync(path.join(target, "v1", "build-source.json"), JSON.stringify({
    productionBranch: "native-ios-launch",
    sourceBranch: "native-ios-launch",
    sourceCommit: "abc123",
  }));
  fs.writeFileSync(path.join(target, "v1", "purchase-flow.js"), 'const a = "purchase-flow-v3-production-branch Apple returned zero Gillie Plus products Copy purchase details";');
  fs.writeFileSync(path.join(target, "v1", "store-pricing.js"), 'const a = "store-pricing-v2-retryable Loading Apple price…";');
  fs.writeFileSync(path.join(target, "v1", "theme-engine.js"), 'const a = "theme-engine-v2-multitank-level-rewards";');
  fs.writeFileSync(path.join(target, "v1", "theme-paint.js"), 'const a = "theme-paint-v1";');
}

try {
  const safe = path.join(root, "safe");
  writeProductionContract(safe);
  fs.writeFileSync(
    path.join(safe, "index.html"),
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"><main>Gillie</main>',
  );
  fs.writeFileSync(path.join(safe, "image.png"), Buffer.from("binary metadata $3.99 is ignored because this is not executable text"));

  const safeResult = scanFinalWebAssets(safe);
  assert.strictEqual(safeResult.filesChecked, 6, "Only supported text assets and shipping provenance should be scanned");
  assert.strictEqual(safeResult.provenance.sourceBranch, "native-ios-launch");

  const zoom = path.join(root, "zoom");
  writeProductionContract(zoom);
  fs.writeFileSync(path.join(zoom, "index.html"), '<meta name="viewport" content="width=device-width,user-scalable=no">');
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
  writeProductionContract(wrongBranch);
  fs.writeFileSync(path.join(wrongBranch, "v1", "build-source.json"), JSON.stringify({
    productionBranch: "main",
    sourceBranch: "main",
    sourceCommit: "wrong",
  }));
  assert.throws(
    () => scanFinalWebAssets(wrongBranch),
    /does not identify native-ios-launch as the production branch/,
    "A final bundle from the wrong production branch must be rejected",
  );

  console.log("Final web asset verifier test passed: production provenance, commerce/theme engines, text violations, and binary exclusions are enforced.");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
