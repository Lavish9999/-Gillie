const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const indexPath = path.join(out, "index.html");
const sourcePath = path.join(root, "v1", "reef-economy.js");
const targetPath = path.join(out, "v1", "reef-economy.js");

if (!fs.existsSync(indexPath)) throw new Error("Reef economy injection requires www/index.html.");
if (!fs.existsSync(sourcePath)) throw new Error("Missing v1/reef-economy.js.");

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.copyFileSync(sourcePath, targetPath);

let html = fs.readFileSync(indexPath, "utf8");
const marker = "<!-- Gillie paced Reef economy and expanded collection -->";
const injection = `${marker}\n<script src="./v1/reef-economy.js" defer data-gillie-v1-reef-economy="true"></script>`;
const existing = /<!-- Gillie paced Reef economy and expanded collection -->[\s\S]*?<script src="\.\/v1\/reef-economy\.js" defer data-gillie-v1-reef-economy="true"><\/script>/;

if (existing.test(html)) html = html.replace(existing, injection);
else if (html.includes("</body>")) html = html.replace("</body>", `${injection}\n</body>`);
else throw new Error("Cannot inject Reef economy: missing </body>.");

const source = fs.readFileSync(targetPath, "utf8");
for (const required of [
  "reef-economy-v1-paced-clarity-guaranteed-gifts",
  "Slow build · crystal clear at 1 year",
  "reef_clean_gift_granted",
  "Sea Glass Stack",
  "Year One Beacon",
  "GillieReefEconomy",
]) {
  if (!source.includes(required)) throw new Error(`Generated Reef economy is missing marker: ${required}`);
}
new Function(source);
if (!html.includes('data-gillie-v1-reef-economy="true"')) throw new Error("Generated index is missing the Reef economy asset tag.");

fs.writeFileSync(indexPath, html, "utf8");
console.log("Injected paced water clarity, guaranteed clean-time gifts, and the expanded Reef collection.");
