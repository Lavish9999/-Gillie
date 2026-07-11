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

/*
 * Production startup fix.
 *
 * The original Reef MutationObserver watched child-list and all attribute
 * mutations. Its callback then rewrote observed data attributes, ARIA text,
 * and badge text every time it ran. That created a self-sustaining microtask
 * loop which starved splash-removal timers and WKWebView recovery work.
 *
 * Make the generated iOS asset idempotent and only observe class changes,
 * which are the actual ownership/equipped-state signal.
 */
const phase2OutputPath = path.join(out, "phase2-polish.js");
let phase2Output = fs.readFileSync(phase2OutputPath, "utf8");

const observerNeedle = '    const observer = new MutationObserver(decorateReefCards);\n    [$("#theme-row"), $("#buddy-grid"), $("#shop-grid")].filter(Boolean).forEach((node) => observer.observe(node, { childList: true, subtree: true, attributes: true }));';
const observerReplacement = '    let reefDecorateQueued = false;\n    const observer = new MutationObserver(() => {\n      if (reefDecorateQueued) return;\n      reefDecorateQueued = true;\n      requestAnimationFrame(() => {\n        reefDecorateQueued = false;\n        decorateReefCards();\n      });\n    });\n    [$("#theme-row"), $("#buddy-grid"), $("#shop-grid")].filter(Boolean).forEach((node) => observer.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] }));';

if (!phase2Output.includes(observerNeedle)) {
  throw new Error("Phase 2 Reef observer marker changed; refusing to build without the startup-loop fix.");
}
phase2Output = phase2Output.replace(observerNeedle, observerReplacement);

const functionStart = phase2Output.indexOf("  function decorateReefCards() {");
const functionEnd = phase2Output.indexOf("\n\n  function filterReef", functionStart);
if (functionStart < 0 || functionEnd < 0) {
  throw new Error("Could not locate decorateReefCards for the startup-loop fix.");
}

const fixedDecorator = `  function decorateReefCards() {
    $$("#view-reef .theme-card, #view-reef .shop-card, #view-reef .buddy-card").forEach((card) => {
      const text = card.textContent.toLowerCase();
      const owned = card.classList.contains("owned") || card.classList.contains("equipped") || /owned|equipped|wearing|active/.test(text);
      const plus = /plus|locked/.test(text) || card.classList.contains("locked");
      const ownedValue = owned ? "true" : "false";
      const plusValue = plus ? "true" : "false";
      const badgeText = owned ? (card.classList.contains("equipped") ? "Equipped" : "Owned") : plus ? "Plus" : "Pearls";
      const description = plus && !appState()?.premium
        ? "Gillie Plus item. Tap to see how to unlock it."
        : owned
          ? "Owned item."
          : "Available Reef item.";

      if (card.dataset.phase2Owned !== ownedValue) card.dataset.phase2Owned = ownedValue;
      if (card.dataset.phase2Plus !== plusValue) card.dataset.phase2Plus = plusValue;

      let badge = $(".phase2-card-badge", card);
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "phase2-card-badge";
        badge.textContent = badgeText;
        card.appendChild(badge);
      } else if (badge.textContent !== badgeText) {
        badge.textContent = badgeText;
      }

      if (card.getAttribute("aria-description") !== description) {
        card.setAttribute("aria-description", description);
      }
    });
  }`;

phase2Output = `${phase2Output.slice(0, functionStart)}${fixedDecorator}${phase2Output.slice(functionEnd)}`;
phase2Output = `/* Gillie Reef mutation-loop startup fix applied. */\n${phase2Output}`;
fs.writeFileSync(phase2OutputPath, phase2Output, "utf8");

if (!phase2Output.includes("Gillie Reef mutation-loop startup fix applied")) {
  throw new Error("Generated Phase 2 startup fix marker is missing.");
}

console.log("Prepared Gillie web assets with the Reef mutation-loop startup fix.");
