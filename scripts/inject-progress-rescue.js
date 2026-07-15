const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const indexPath = path.join(out, "index.html");
const sourcePath = path.join(root, "v1", "progress-rescue.js");
const targetPath = path.join(out, "v1", "progress-rescue.js");
const SCRIPT_TAG = '<script src="./v1/progress-rescue.js" defer data-gillie-v1-progress-rescue="true"></script>';
const ENGINE = 'progress-rescue-v1';

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
  const plusValueTag = '<script src="./v1/plus-value.js" defer data-gillie-v1-plus-value="true"></script>';
  if (html.includes(plusValueTag)) html = html.replace(plusValueTag, `${plusValueTag}\n${SCRIPT_TAG}`);
  else if (html.includes("</body>")) html = html.replace("</body>", `${SCRIPT_TAG}\n</body>`);
  else throw new Error("Progress rescue injection could not locate a final script insertion point.");
}
fs.writeFileSync(indexPath, html, "utf8");

const source = fs.readFileSync(targetPath, "utf8");
for (const marker of [
  ENGINE,
  "__gillieProgressRescueInstalled",
  "progress-rescue-actions",
  "document.elementsFromPoint",
  "data-plus-weekly-unlock",
  "openOverlayFromTrigger",
  "repairInteractionSurface",
]) {
  if (!source.includes(marker)) throw new Error(`Generated Progress rescue is missing marker: ${marker}`);
}
if (!html.includes('data-gillie-v1-progress-rescue="true"')) {
  throw new Error("Generated index is missing the final Progress rescue runtime tag.");
}

new Function(source);
console.log("Injected Progress rescue as the final Gillie web interaction runtime.");
