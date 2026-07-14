const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www", "v1");

function gitValue(args, fallback = "unknown") {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || fallback;
  } catch (_) {
    return fallback;
  }
}

function requireMarker(relative, marker) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes(marker)) throw new Error(`Production build marker missing from ${relative}: ${marker}`);
}

const branch = String(process.env.CM_BRANCH || gitValue(["branch", "--show-current"])).trim();
const commit = String(process.env.CM_COMMIT || gitValue(["rev-parse", "HEAD"])).trim();
const isCodemagic = Boolean(process.env.CM_BRANCH || process.env.CM_BUILD_ID);

if (isCodemagic && branch !== "native-ios-launch") {
  throw new Error(`Refusing to ship Gillie from ${branch}. Production TestFlight builds must use native-ios-launch.`);
}

requireMarker("v1/purchase-flow.js", "purchase-flow-v3-production-branch");
requireMarker("v1/purchase-flow.js", "Apple returned zero Gillie Plus products");
requireMarker("v1/purchase-flow.js", "Copy purchase details");
requireMarker("v1/store-pricing.js", "store-pricing-v2-retryable");
requireMarker("v1/theme-paint.js", "theme-paint-v1");
requireMarker("v1/theme-engine.js", "theme-engine-v2-multitank-level-rewards");

fs.mkdirSync(out, { recursive: true });
const payload = {
  schemaVersion: 1,
  productionBranch: "native-ios-launch",
  sourceBranch: branch,
  sourceCommit: commit,
  generatedAt: new Date().toISOString(),
  commerceEngine: "purchase-flow-v3-production-branch",
  pricingEngine: "store-pricing-v2-retryable",
  productIds: ["gillie.plus.monthly", "gillie.plus.yearly"],
  themeEngine: "theme-paint-v1",
};
fs.writeFileSync(path.join(out, "build-source.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Gillie build provenance written: ${branch}@${commit}`);
