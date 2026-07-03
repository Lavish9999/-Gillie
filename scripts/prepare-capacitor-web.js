const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const entries = ["index.html", "manifest.webmanifest", "privacy.html", "support.html", "assets"];

const pricingReplacements = [
  ["monthlyLabel: \"$4.99 / month\"", "monthlyLabel: \"$3.99 / month\""],
  ["yearlyLabel: \"$39.99 / year — best value\"", "yearlyLabel: \"$29.99 / year — best value\""],
  ["$4.99 / month", "$3.99 / month"],
  ["$39.99 / year", "$29.99 / year"],
  ["$4.99/mo", "$3.99/mo"],
  ["$39.99/yr", "$29.99/yr"],
];

const appBehaviorReplacements = [
  [
    "  enterMain();\n  toast(\"🐣\", `${state.petName} hatched. Your quit is officially live.`);\n};",
    "  enterMain();\n};",
  ],
  [
    "  document.body.classList.toggle(\"sheet-open\", anyOpen);\n}",
    "  document.body.classList.toggle(\"sheet-open\", anyOpen);\n  if (anyOpen) dismissToast();\n}",
  ],
  [
    "let toastHandle = null;\nfunction toast(em, msg) {",
    "let toastHandle = null;\nfunction dismissToast() {\n  clearTimeout(toastHandle);\n  $(\"#toast\").classList.remove(\"show\");\n}\nfunction toast(em, msg) {",
  ],
  [
    "function toast(em, msg) {\n  $(\"#toast .em\").textContent = em;",
    "function toast(em, msg) {\n  if (!state.onboarded || document.body.classList.contains(\"sheet-open\")) return;\n  $(\"#toast .em\").textContent = em;",
  ],
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

function applyBuildPatches(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  let changed = false;

  for (const [from, to] of [...pricingReplacements, ...appBehaviorReplacements]) {
    if (html.includes(from)) {
      html = html.split(from).join(to);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, html, "utf8");
    console.log(`Applied Gillie build patches to ${path.relative(root, filePath) || "index.html"}`);
  }
}

// Keep the source preview and native copy aligned when this prep step runs.
applyBuildPatches(path.join(root, "index.html"));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const entry of entries) {
  const src = path.join(root, entry);
  if (fs.existsSync(src)) copyRecursive(src, path.join(out, entry));
}

applyBuildPatches(path.join(out, "index.html"));

console.log("Prepared Capacitor web assets in www/");
