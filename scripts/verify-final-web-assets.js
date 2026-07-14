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

function scanFinalWebAssets(rootPath) {
  const root = path.resolve(rootPath);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Final web asset directory is missing: ${root}`);
  }

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

  return { root, filesChecked: files.length };
}

if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: node scripts/verify-final-web-assets.js <public-directory>");
    process.exit(2);
  }
  try {
    const result = scanFinalWebAssets(target);
    console.log(`Final web asset verification passed: ${result.filesChecked} text assets checked in ${result.root}.`);
  } catch (error) {
    console.error(error?.message || String(error));
    process.exit(1);
  }
}

module.exports = {
  FORBIDDEN_PATTERNS,
  TEXT_EXTENSIONS,
  scanFinalWebAssets,
  walkTextFiles,
};
