const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const indexPath = path.join(out, "index.html");
const sourcePath = path.join(root, "v1", "followup-rescue.js");
const targetPath = path.join(out, "v1", "followup-rescue.js");
const PROGRESS_TAG = '<script src="./v1/progress-rescue.js" defer data-gillie-v1-progress-rescue="true"></script>';
const SCRIPT_TAG = '<script src="./v1/followup-rescue.js" defer data-gillie-v1-followup-rescue="true"></script>';

if (!fs.existsSync(indexPath)) throw new Error("Follow-up rescue injection requires www/index.html.");
if (!fs.existsSync(sourcePath)) throw new Error("Missing v1/followup-rescue.js.");

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.copyFileSync(sourcePath, targetPath);

let html = fs.readFileSync(indexPath, "utf8");
if (!html.includes(SCRIPT_TAG)) {
  if (html.includes(PROGRESS_TAG)) html = html.replace(PROGRESS_TAG, `${PROGRESS_TAG}\n${SCRIPT_TAG}`);
  else if (html.includes("</body>")) html = html.replace("</body>", `${SCRIPT_TAG}\n</body>`);
  else throw new Error("Cannot inject Follow-up rescue: missing final script insertion point.");
}

const source = fs.readFileSync(targetPath, "utf8");
for (const required of [
  "followup-rescue-v1-ios-direct-routing",
  "followup-made",
  "followup-fighting",
  "followup-used",
  "fallbackResolve",
  "GillieFollowupRescue",
]) {
  if (!source.includes(required)) throw new Error(`Generated Follow-up rescue is missing marker: ${required}`);
}
new Function(source);
if (!html.includes('data-gillie-v1-followup-rescue="true"')) throw new Error("Generated index is missing Follow-up rescue asset tag.");
if (html.indexOf(SCRIPT_TAG) <= html.indexOf(PROGRESS_TAG)) throw new Error("Follow-up rescue must load after the interaction director.");

fs.writeFileSync(indexPath, html, "utf8");
console.log("Injected direct iOS activation for craving follow-up actions.");
