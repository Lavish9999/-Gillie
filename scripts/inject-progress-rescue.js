const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const indexPath = path.join(out, "index.html");
const sourcePath = path.join(root, "v1", "progress-rescue.js");
const targetPath = path.join(out, "v1", "progress-rescue.js");
const PLUS_VALUE_TAG = '<script src="./v1/plus-value.js" defer data-gillie-v1-plus-value="true"></script>';
const SCRIPT_TAG = '<script src="./v1/progress-rescue.js" defer data-gillie-v1-progress-rescue="true"></script>';
const ENGINE = "progress-rescue-v3-nav-safe";

if (!fs.existsSync(indexPath)) {
  throw new Error("Progress rescue injection requires www/index.html. Run the canonical web preparation first.");
}
if (!fs.existsSync(sourcePath)) {
  throw new Error("Progress rescue source is missing: v1/progress-rescue.js");
}

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.copyFileSync(sourcePath, targetPath);

let html = fs.readFileSync(indexPath, "utf8");
if (!html.includes(SCRIPT_TAG)) {
  if (html.includes(PLUS_VALUE_TAG)) html = html.replace(PLUS_VALUE_TAG, `${PLUS_VALUE_TAG}\n${SCRIPT_TAG}`);
  else if (html.includes("</body>")) html = html.replace("</body>", `${SCRIPT_TAG}\n</body>`);
  else throw new Error("Progress rescue injection could not locate a final script insertion point.");
}
fs.writeFileSync(indexPath, html, "utf8");

const source = fs.readFileSync(targetPath, "utf8");
for (const marker of [
  ENGINE,
  "__gillieProgressRescueInstalled",
  "progress-rescue-actions",
  "installProgressOnlyRouting",
  'view.addEventListener("click"',
  "openDialogSurface",
  "openCheckinDirect",
  "openSosDirect",
  "repairInteractionSurface",
  "CONTROLS V4",
]) {
  if (!source.includes(marker)) throw new Error(`Generated Progress rescue is missing marker: ${marker}`);
}
for (const forbidden of [
  "document.elementsFromPoint",
  'document.addEventListener("pointerup"',
  'document.addEventListener("click"',
  'document.addEventListener("touchend"',
  'overlay.style.setProperty("pointer-events", "none"',
  "view.hidden = false",
]) {
  if (source.includes(forbidden)) throw new Error(`Generated Progress rescue contains forbidden global routing or shell mutation: ${forbidden}`);
}
if (!html.includes('data-gillie-v1-progress-rescue="true"')) {
  throw new Error("Generated index is missing the final Progress rescue runtime tag.");
}
const plusIndex = html.indexOf(PLUS_VALUE_TAG);
const rescueIndex = html.indexOf(SCRIPT_TAG);
if (rescueIndex < 0 || (plusIndex >= 0 && rescueIndex <= plusIndex)) {
  throw new Error("Progress rescue is not the final Progress runtime after Plus value and legacy screen modules.");
}

new Function(source);
console.log("Injected and validated nav-safe Progress controls with no document-wide touch routing.");
