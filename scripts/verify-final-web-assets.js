const fs = require("fs");
const path = require("path");

const TEXT_EXTENSIONS = new Set([".html", ".htm", ".js", ".mjs", ".css", ".json", ".webmanifest", ".svg", ".txt"]);
const FORBIDDEN_PATTERNS = [
  { label: "viewport zoom restriction", pattern: /user-scalable\s*=\s*no/i },
  { label: "hardcoded monthly subscription price", pattern: /\$3\.99/ },
  { label: "hardcoded yearly subscription price", pattern: /\$29\.99/ },
  { label: "hardcoded subscription savings claim", pattern: /Save 37%/i },
];
const EXPECTED_PRODUCTION_REFS = ["main", "native-ios-launch"];

function walkTextFiles(root) {
  const files = [];
  const queue = [root];
  while (queue.length) {
    const current = queue.pop();
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) queue.push(path.join(current, entry));
    } else if (stat.isFile() && TEXT_EXTENSIONS.has(path.extname(current).toLowerCase())) {
      files.push(current);
    }
  }
  return files.sort();
}

function requireFile(root, relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new Error(`Final web bundle is missing required shipping file: ${relative}`);
  return fs.readFileSync(file, "utf8");
}

function requireMarker(root, relative, marker) {
  const source = requireFile(root, relative);
  if (!source.includes(marker)) throw new Error(`Final web bundle contract missing from ${relative}: ${marker}`);
}

function forbidMarker(root, relative, marker, label = marker) {
  const source = requireFile(root, relative);
  if (source.includes(marker)) throw new Error(`Final web bundle contains forbidden ${label} in ${relative}: ${marker}`);
}

function requireFinalContract(root) {
  for (const relative of [
    "index.html",
    "v1/build-source.json",
    "v1/purchase-flow.js",
    "v1/purchase-director.js",
    "v1/store-pricing.js",
    "v1/entitlement-sync.js",
    "v1/theme-access.js",
    "v1/theme-engine.js",
    "v1/theme-paint.js",
    "v1/launch-experience.js",
    "v1/launch-handoff.js",
    "v1/paywall-runtime-fix.js",
    "v1/paywall-runtime-fix.css",
  ]) requireFile(root, relative);

  const provenance = JSON.parse(requireFile(root, "v1/build-source.json"));
  const allowedRefs = Array.isArray(provenance.allowedProductionRefs) ? provenance.allowedProductionRefs : [];
  for (const expected of EXPECTED_PRODUCTION_REFS) {
    if (!allowedRefs.includes(expected)) throw new Error(`Final web bundle production refs are incomplete; missing ${expected}.`);
  }
  if (!provenance.sourceBranch || !provenance.sourceCommit) throw new Error("Final web bundle is missing source branch or commit provenance.");
  if (!allowedRefs.includes(provenance.sourceBranch)) throw new Error(`Final web bundle came from unapproved source ref: ${provenance.sourceBranch}.`);
  if (process.env.CM_BRANCH && process.env.CM_BRANCH !== provenance.sourceBranch) {
    throw new Error(`Codemagic branch ${process.env.CM_BRANCH} does not match bundled provenance ${provenance.sourceBranch}.`);
  }

  const contracts = [
    ["index.html", 'class="gillie-boot-pending"'],
    ["index.html", "SINGLE LAUNCH HANDOFF"],
    ["index.html", 'data-gillie-v1-purchase-director="true"'],
    ["index.html", 'data-gillie-v1-entitlement-sync="true"'],
    ["index.html", 'data-gillie-v1-theme-access="true"'],
    ["index.html", 'data-gillie-v1-launch-handoff="true"'],
    ["index.html", 'data-gillie-v1-paywall-runtime-fix="true"'],
    ["v1/purchase-flow.js", "purchase-flow-v3-production-branch"],
    ["v1/purchase-flow.js", "Copy purchase details"],
    ["v1/purchase-director.js", "purchase-director-v2-direct-native"],
    ["v1/purchase-director.js", "selected-product-direct-to-storekit-v1"],
    ["v1/purchase-director.js", "stopImmediatePropagation"],
    ["v1/purchase-director.js", "native.purchase({ productId: product.id })"],
    ["v1/purchase-director.js", "GillieEntitlementSync.apply"],
    ["v1/store-pricing.js", "store-pricing-v2-retryable"],
    ["v1/entitlement-sync.js", "entitlement-sync-v1-always-on"],
    ["v1/entitlement-sync.js", "app-boot"],
    ["v1/theme-access.js", "theme-access-v1-basic-free"],
    ["v1/theme-engine.js", "theme-engine-v2-multitank-level-rewards"],
    ["v1/theme-paint.js", "theme-paint-v1"],
    ["v1/launch-experience.js", "launch-experience-v1"],
    ["v1/launch-handoff.js", "launch-handoff-v1-single-intro"],
    ["v1/paywall-runtime-fix.js", "css-only-system-chrome-v2"],
    ["v1/paywall-runtime-fix.js", "ensurePaywallSurface"],
    ["v1/paywall-runtime-fix.css", "--gp-system-top"],
    ["v1/build-source.json", '"checkoutEngine": "purchase-director-v2-direct-native"'],
    ["v1/build-source.json", '"checkoutMode": "selected-product-direct-to-storekit-v1"'],
    ["v1/build-source.json", '"pricingCheckoutPolicy": "display-only-never-gates-checkout-v2"'],
    ["v1/build-source.json", '"nativeStoreKitLoader": "selected-product-only-retry-v1"'],
    ["v1/build-source.json", '"nativeCheckoutMode": "selected-product-direct-v1"'],
    ["v1/build-source.json", '"themePaintEngine": "theme-paint-v1"'],
  ];
  for (const [relative, marker] of contracts) requireMarker(root, relative, marker);

  forbidMarker(root, "v1/purchase-director.js", "await availablePlan(", "JavaScript pricing preflight");
  forbidMarker(root, "v1/store-pricing.js", "purchase.disabled = loading", "pricing-owned checkout disablement");
  forbidMarker(root, "v1/paywall-runtime-fix.js", "bridge()?.setInterfaceStyle?.(", "native root-view mutation");
  for (const forbidden of ["splash-orb", "Grow clean", "splashRise", "splashFloat"]) {
    forbidMarker(root, "index.html", forbidden, "legacy first splash");
  }

  for (const relative of [
    "purchase-flow.js",
    "purchase-director.js",
    "store-pricing.js",
    "entitlement-sync.js",
    "theme-access.js",
    "theme-engine.js",
    "theme-paint.js",
    "launch-experience.js",
    "launch-handoff.js",
    "paywall-runtime-fix.js",
  ]) new Function(requireFile(root, `v1/${relative}`));

  return provenance;
}

function lineAndColumn(source, index) {
  const before = source.slice(0, index).split(/\r?\n/);
  return { line: before.length, column: before[before.length - 1].length + 1 };
}

function scanFinalWebAssets(rootPath) {
  const root = path.resolve(rootPath);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Final web asset directory is missing: ${root}`);
  const provenance = requireFinalContract(root);
  const files = walkTextFiles(root);
  if (!files.length) throw new Error(`No text web assets were found in: ${root}`);

  const findings = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const rule of FORBIDDEN_PATTERNS) {
      const match = rule.pattern.exec(source);
      rule.pattern.lastIndex = 0;
      if (!match) continue;
      const location = lineAndColumn(source, match.index);
      findings.push(`${rule.label}: ${path.relative(root, file)}:${location.line}:${location.column}`);
    }
  }
  if (findings.length) throw new Error(`Final web bundle contains forbidden release content:\n- ${findings.join("\n- ")}`);
  return { root, filesChecked: files.length, provenance };
}

if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: node scripts/verify-final-web-assets.js <public-directory>");
    process.exit(2);
  }
  try {
    const result = scanFinalWebAssets(target);
    console.log(`Final web asset verification passed: ${result.filesChecked} text assets checked in ${result.root} from ${result.provenance.sourceBranch}@${result.provenance.sourceCommit}.`);
  } catch (error) {
    console.error(error?.message || String(error));
    process.exit(1);
  }
}

module.exports = { EXPECTED_PRODUCTION_REFS, FORBIDDEN_PATTERNS, TEXT_EXTENSIONS, requireFinalContract, scanFinalWebAssets, walkTextFiles };
