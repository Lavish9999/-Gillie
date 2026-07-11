const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const entries = [
  "index.html",
  "phase1-runtime.js",
  "phase1-commerce.js",
  "phase2-polish.js",
  "phase2-polish.css",
  "manifest.webmanifest",
  "privacy.html",
  "terms.html",
  "support.html",
  "assets",
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

const indexPath = path.join(root, "index.html");
if (!fs.existsSync(indexPath)) throw new Error("Missing root index.html");
const source = fs.readFileSync(indexPath, "utf8");
const commerceSource = fs.readFileSync(path.join(root, "phase1-commerce.js"), "utf8");
const requiredMarkers = [
  "plus-tank-hero",
  '<script src="./phase1-runtime.js"></script>',
  '<script src="./phase1-commerce.js"></script>',
  "gillie.plus.monthly",
  "gillie.plus.yearly",
];
for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Canonical index.html is missing required production marker: ${marker}`);
  }
}
for (const marker of ["phase2-polish.css", "phase2-polish.js"]) {
  if (!commerceSource.includes(marker)) {
    throw new Error(`Commerce loader is missing Phase 2 asset: ${marker}`);
  }
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const entry of entries) {
  const src = path.join(root, entry);
  if (!fs.existsSync(src)) throw new Error(`Missing required Capacitor asset: ${entry}`);
  copyRecursive(src, path.join(out, entry));
}

console.log("Prepared canonical Gillie web assets in www/ with Phase 2 premium polish.");
