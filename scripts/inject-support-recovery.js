const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const indexPath = path.join(out, "index.html");
const assets = [
  "v1/support-recovery.css",
  "v1/sos-support.js",
  "v1/welcome-recovery.js",
  "v1/purchase-flow.js",
];

if (!fs.existsSync(indexPath)) {
  throw new Error("SOS support, welcome recovery, and purchase-flow injection requires www/index.html.");
}

for (const asset of assets) {
  const source = path.join(root, asset);
  const target = path.join(out, asset);
  if (!fs.existsSync(source)) throw new Error(`Missing support/recovery asset: ${asset}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

let html = fs.readFileSync(indexPath, "utf8");
const marker = "<!-- Gillie SOS support, Plus recovery, and purchase flow -->";
const legacyMarker = "<!-- Gillie SOS support and Plus welcome recovery -->";
const injection = `${marker}
<link rel="stylesheet" href="./v1/support-recovery.css" data-gillie-v1-support-recovery-styles="true">
<script src="./v1/sos-support.js" defer data-gillie-v1-sos-support="true"></script>
<script src="./v1/welcome-recovery.js" defer data-gillie-v1-welcome-recovery="true"></script>
<script src="./v1/purchase-flow.js" defer data-gillie-v1-purchase-flow="true"></script>`;

if (html.includes(legacyMarker) && !html.includes(marker)) {
  const legacyPattern = /<!-- Gillie SOS support and Plus welcome recovery -->[\s\S]*?<script src="\.\/v1\/welcome-recovery\.js" defer data-gillie-v1-welcome-recovery="true"><\/script>/;
  if (!legacyPattern.test(html)) throw new Error("Legacy support/recovery injection marker changed.");
  html = html.replace(legacyPattern, injection);
} else if (!html.includes(marker)) {
  if (!html.includes("</body>")) throw new Error("Cannot inject support/recovery assets: missing </body>.");
  html = html.replace("</body>", `${injection}
</body>`);
}

for (const markerText of [
  'data-gillie-v1-support-recovery-styles="true"',
  'data-gillie-v1-sos-support="true"',
  'data-gillie-v1-welcome-recovery="true"',
  'data-gillie-v1-purchase-flow="true"',
]) {
  if (!html.includes(markerText)) throw new Error(`Generated index is missing support/recovery marker: ${markerText}`);
}

const sos = fs.readFileSync(path.join(out, "v1", "sos-support.js"), "utf8");
const recovery = fs.readFileSync(path.join(out, "v1", "welcome-recovery.js"), "utf8");
const purchaseFlow = fs.readFileSync(path.join(out, "v1", "purchase-flow.js"), "utf8");
for (const required of ["1-800-QUIT-NOW", "QUITNOW to 333888", "smokefree.gov", "Message someone I trust"]) {
  if (!sos.includes(required)) throw new Error(`Generated SOS support module is missing marker: ${required}`);
}
for (const required of ["welcome-recovery-v1", "recoverWelcomeBundle", "plus_welcome_bundle_recovered", "This recovery can only happen once on this device"]) {
  if (!recovery.includes(required)) throw new Error(`Generated welcome recovery module is missing marker: ${required}`);
}
for (const required of [
  "purchase-flow-v1",
  "entitlementChanged",
  "Confirming your Apple subscription",
  "Purchase pending with Apple",
  "gillie:purchase-flow-settled",
]) {
  if (!purchaseFlow.includes(required)) throw new Error(`Generated purchase-flow module is missing marker: ${required}`);
}

fs.writeFileSync(indexPath, html, "utf8");
console.log("Injected human SOS support, one-time Plus welcome recovery, and resilient Apple purchase handling.");
