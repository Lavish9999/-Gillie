const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { scanFinalWebAssets } = require("./verify-final-web-assets");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "gillie-final-web-assets-"));

try {
  const safe = path.join(root, "safe");
  fs.mkdirSync(path.join(safe, "v1"), { recursive: true });
  fs.writeFileSync(
    path.join(safe, "index.html"),
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"><main>Gillie</main>',
  );
  fs.writeFileSync(path.join(safe, "v1", "store-pricing.js"), 'const price = "Loading Apple price…";');
  fs.writeFileSync(path.join(safe, "image.png"), Buffer.from("binary metadata $3.99 is ignored because this is not executable text"));

  const safeResult = scanFinalWebAssets(safe);
  assert.strictEqual(safeResult.filesChecked, 2, "Only supported text assets should be scanned");

  const zoom = path.join(root, "zoom");
  fs.mkdirSync(zoom, { recursive: true });
  fs.writeFileSync(path.join(zoom, "index.html"), '<meta name="viewport" content="width=device-width,user-scalable=no">');
  assert.throws(
    () => scanFinalWebAssets(zoom),
    /viewport zoom restriction: index\.html:1:/,
    "Zoom restrictions must fail with an exact file location",
  );

  const price = path.join(root, "price");
  fs.mkdirSync(price, { recursive: true });
  fs.writeFileSync(path.join(price, "paywall.js"), 'button.textContent = "$29.99";');
  assert.throws(
    () => scanFinalWebAssets(price),
    /hardcoded yearly subscription price: paywall\.js:1:/,
    "Hardcoded prices must fail with an exact file location",
  );

  const savings = path.join(root, "savings");
  fs.mkdirSync(savings, { recursive: true });
  fs.writeFileSync(path.join(savings, "paywall.html"), "<span>Save 37%</span>");
  assert.throws(
    () => scanFinalWebAssets(savings),
    /hardcoded subscription savings claim: paywall\.html:1:/,
    "Hardcoded savings claims must fail with an exact file location",
  );

  console.log("Final web asset verifier test passed: text violations are located and binary false positives are ignored.");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
