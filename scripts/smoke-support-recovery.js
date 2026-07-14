const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const read = (relative) => {
  const file = path.join(out, relative);
  if (!fs.existsSync(file)) throw new Error(`Missing generated support/recovery asset: ${relative}`);
  return fs.readFileSync(file, "utf8");
};

const html = read("index.html");
const sos = read("v1/sos-support.js");
const recovery = read("v1/welcome-recovery.js");
const styles = read("v1/support-recovery.css");

for (const marker of [
  'data-gillie-v1-support-recovery-styles="true"',
  'data-gillie-v1-sos-support="true"',
  'data-gillie-v1-welcome-recovery="true"',
]) {
  if (!html.includes(marker)) throw new Error(`Generated index is missing marker: ${marker}`);
}
for (const marker of ["1-800-QUIT-NOW", "QUITNOW to 333888", "sos_human_support_opened"]) {
  if (!sos.includes(marker)) throw new Error(`Generated SOS support is missing: ${marker}`);
}
for (const marker of ["welcome-recovery-v1", "recoverWelcomeBundle", "plus_welcome_bundle_recovered"]) {
  if (!recovery.includes(marker)) throw new Error(`Generated welcome recovery is missing: ${marker}`);
}
if (!styles.includes(".v1-sos-support-sheet")) throw new Error("Generated support styles are missing.");

console.log("Generated SOS support and welcome recovery smoke checks passed.");
