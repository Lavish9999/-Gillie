const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
const source = fs.readFileSync(path.join(out, "v1", "reef-economy.js"), "utf8");

if (!html.includes('data-gillie-v1-reef-economy="true"')) throw new Error("Generated app is missing Reef economy injection.");
for (const marker of [
  "reef-economy-v1-paced-clarity-guaranteed-gifts",
  "Slow build · crystal clear at 1 year",
  "reef_clean_gift_granted",
  "Year One Beacon",
]) {
  if (!source.includes(marker)) throw new Error(`Generated Reef economy is missing: ${marker}`);
}
new Function(source);
console.log("Generated Reef economy smoke test passed.");
