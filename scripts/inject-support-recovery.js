const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const indexPath = path.join(out, "index.html");
const assets = [
  "v1/support-recovery.css",
  "v1/sos-support.js",
  "v1/welcome-recovery.js",
];

if (!fs.existsSync(indexPath)) {
  throw new Error("SOS support and welcome recovery injection requires www/index.html.");
}

for (const asset of assets) {
  const source = path.join(root, asset);
  const target = path.join(out, asset);
  if (!fs.existsSync(source)) throw new Error(`Missing support/recovery asset: ${asset}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

let html = fs.readFileSync(indexPath, "utf8");
const marker = "<!-- Gillie SOS support and Plus welcome recovery -->";
const injection = `${marker}
<link rel="stylesheet" href="./v1/support-recovery.css" data-gillie-v1-support-recovery-styles="true">
<script src="./v1/sos-support.js" defer data-gillie-v1-sos-support="true"></script>
<script src="./v1/welcome-recovery.js" defer data-gillie-v1-welcome-recovery="true"></script>`;

if (!html.includes(marker)) {
  if (!html.includes("</body>")) throw new Error("Cannot inject support/recovery assets: missing </body>.");
  html = html.replace("</body>", `${injection}
</body>`);
}

for (const markerText of [
  'data-gillie-v1-support-recovery-styles="true"',
  'data-gillie-v1-sos-support="true"',
  'data-gillie-v1-welcome-recovery="true"',
]) {
  if (!html.includes(markerText)) throw new Error(`Generated index is missing support/recovery marker: ${markerText}`);
}

const sos = fs.readFileSync(path.join(out, "v1", "sos-support.js"), "utf8");
const recovery = fs.readFileSync(path.join(out, "v1", "welcome-recovery.js"), "utf8");
for (const required of ["1-800-QUIT-NOW", "QUITNOW to 333888", "smokefree.gov", "Message someone I trust"]) {
  if (!sos.includes(required)) throw new Error(`Generated SOS support module is missing marker: ${required}`);
}
for (const required of ["welcome-recovery-v1", "recoverWelcomeBundle", "plus_welcome_bundle_recovered", "This recovery can only happen once on this device"]) {
  if (!recovery.includes(required)) throw new Error(`Generated welcome recovery module is missing marker: ${required}`);
}

fs.writeFileSync(indexPath, html, "utf8");
console.log("Injected human SOS support and one-time Plus welcome reinstall recovery.");
