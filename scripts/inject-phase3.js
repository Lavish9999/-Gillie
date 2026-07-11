const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const indexPath = path.join(out, "index.html");
const assets = ["phase3-ship.css", "phase3-ship.js"];

if (!fs.existsSync(indexPath)) {
  throw new Error("Phase 3 injection requires www/index.html. Run prepare-capacitor-web first.");
}

for (const asset of assets) {
  const source = path.join(root, asset);
  const target = path.join(out, asset);
  if (!fs.existsSync(source)) throw new Error(`Missing Phase 3 asset: ${asset}`);
  fs.copyFileSync(source, target);
}

let html = fs.readFileSync(indexPath, "utf8");
const marker = "<!-- Gillie Phase 3 ship polish -->";
const injection = `${marker}\n<link rel="stylesheet" href="./phase3-ship.css" data-gillie-phase3="true">\n<script src="./phase3-ship.js" defer data-gillie-phase3="true"></script>`;

if (!html.includes(marker)) {
  if (!html.includes("</body>")) throw new Error("Cannot inject Phase 3 assets: missing </body>.");
  html = html.replace("</body>", `${injection}\n</body>`);
  fs.writeFileSync(indexPath, html, "utf8");
}

const js = fs.readFileSync(path.join(out, "phase3-ship.js"), "utf8");
const css = fs.readFileSync(path.join(out, "phase3-ship.css"), "utf8");
for (const required of [
  "gillieShipPolishInstalled",
  "starter_pearls_granted",
  "ship-progress-activation",
  "YOUR PERSONAL QUIT PLAN",
]) {
  if (!js.includes(required)) throw new Error(`Generated Phase 3 JavaScript is missing marker: ${required}`);
}
for (const required of ["#ship-status-scrim", ".ship-home-flow", ".ship-paywall", "#sos-fab"]) {
  if (!css.includes(required)) throw new Error(`Generated Phase 3 CSS is missing marker: ${required}`);
}
if (!html.includes('data-gillie-phase3="true"')) throw new Error("Phase 3 tags were not injected into www/index.html.");

console.log("Injected Gillie Phase 3 ship-quality assets into www/.");
