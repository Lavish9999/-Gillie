const fs = require("fs");
const path = require("path");

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".webmanifest",
  ".svg",
  ".txt",
]);

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
      continue;
    }
    if (stat.isFile() && TEXT_EXTENSIONS.has(path.extname(current).toLowerCase())) files.push(current);
  }
  return files.sort();
}

function lineAndColumn(source, index) {
  const before = source.slice(0, index);
  const lines = before.split(/\r?\n/);
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function shortLine(source, index) {
  const start = source.lastIndexOf("\n", index - 1) + 1;
  const endIndex = source.indexOf("\n", index);
  const end = endIndex < 0 ? source.length : endIndex;
  return source.slice(start, end).trim().slice(0, 180);
}

function requireFinalContract(root) {
  const requiredFiles = [
    "v1/build-source.json",
    "v1/purchase-flow.js",
    "v1/store-pricing.js",
    "v1/theme-engine.js",
    "v1/theme-paint.js",
  ];
  for (const relative of requiredFiles) {
    const file = path.join(root, relative);
    if (!fs.existsSync(file)) throw new Error(`Final web bundle is missing required shipping file: ${relative}`);
  }

  const provenance = JSON.parse(fs.readFileSync(path.join(root, "v1", "build-source.json"), "utf8"));
  const allowedRefs = Array.isArray(provenance.allowedProductionRefs) ? provenance.allowedProductionRefs : [];
  for (const expected of EXPECTED_PRODUCTION_REFS) {
    if (!allowedRefs.includes(expected)) {
      throw new Error(`Final web bundle production refs are incomplete; missing ${expected}.`);
    }
  }
  if (!provenance.sourceBranch || !provenance.sourceCommit) {
    throw new Error("Final web bundle is missing source branch or commit provenance.");
  }
  if (!allowedRefs.includes(provenance.sourceBranch)) {
    throw new Error(`Final web bundle came from unapproved source ref: ${provenance.sourceBranch}.`);
  }
  if (process.env.CM_BRANCH && process.env.CM_BRANCH !== provenance.sourceBranch) {
    throw new Error(`Codemagic branch ${process.env.CM_BRANCH} does not match bundled provenance ${provenance.sourceBranch}.`);
  }

  const contracts = [
    ["v1/purchase-flow.js", "purchase-flow-v3-production-branch"],
    ["v1/purchase-flow.js", "Apple returned zero Gillie Plus products"],
    ["v1/purchase-flow.js", "Copy purchase details"],
    ["v1/store-pricing.js", "store-pricing-v2-retryable"],
    ["v1/theme-engine.js", "theme-engine-v2-multitank-level-rewards"],
    ["v1/theme-paint.js", "theme-paint-v1"],
  ];
  for (const [relative, marker] of contracts) {
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    if (!source.includes(marker)) throw new Error(`Final web bundle contract missing from ${relative}: ${marker}`);
  }

  new Function(fs.readFileSync(path.join(root, "v1", "purchase-flow.js"), "utf8"));
  new Function(fs.readFileSync(path.join(root, "v1", "store-pricing.js"), "utf8"));
  new Function(fs.readFileSync(path.join(root, "v1", "theme-engine.js"), "utf8"));
  new Function(fs.readFileSync(path.join(root, "v1", "theme-paint.js"), "utf8"));
  return provenance;
}

function scanFinalWebAssets(rootPath) {
  const root = path.resolve(rootPath);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Final web asset directory is missing: ${root}`);
  }

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
      findings.push({
        label: rule.label,
        file: path.relative(root, file) || path.basename(file),
        line: location.line,
        column: location.column,
        excerpt: shortLine(source, match.index),
      });
    }
  }

  if (findings.length) {
    const details = findings
      .map((finding) => `- ${finding.label}: ${finding.file}:${finding.line}:${finding.column}\n  ${finding.excerpt}`)
      .join("\n");
    throw new Error(`Final web bundle contains forbidden release content:\n${details}`);
  }

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

module.exports = {
  EXPECTED_PRODUCTION_REFS,
  FORBIDDEN_PATTERNS,
  TEXT_EXTENSIONS,
  requireFinalContract,
  scanFinalWebAssets,
  walkTextFiles,
};
