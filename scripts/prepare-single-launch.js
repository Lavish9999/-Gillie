const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const indexPath = path.join(root, "www", "index.html");

if (!fs.existsSync(indexPath)) {
  throw new Error("Single-launch preparation requires www/index.html. Run prepare-capacitor-web first.");
}

let html = fs.readFileSync(indexPath, "utf8");
const htmlTag = '<html lang="en">';
const bootHtmlTag = '<html lang="en" class="gillie-boot-pending">';
if (html.includes(htmlTag)) html = html.replace(htmlTag, bootHtmlTag);
else if (!html.includes('class="gillie-boot-pending"')) throw new Error("Single-launch preparation could not mark the root element.");

const oldCssPattern = /\/\* launch splash \*\/[\s\S]*?\/\* growth celebration \*\//;
const bootCss = `/* single seamless native-to-web launch handoff */
html.gillie-boot-pending,
html.gillie-boot-pending body { overflow:hidden !important; background:#EAF7F3 !important; }
#splash.gillie-launch-bootstrap {
  position:fixed;inset:0;z-index:10000;display:grid;place-items:center;overflow:hidden;
  background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.78),transparent 27%),linear-gradient(180deg,#EAF7F3 0%,#C7E8DE 46%,#8FCDBD 100%);
  opacity:1;visibility:visible;pointer-events:none;
}
#splash.gillie-launch-bootstrap::before {
  content:"";width:150px;height:150px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,255,255,.58),rgba(255,255,255,.12) 58%,transparent 72%);
  opacity:.46;transform:scale(.82);
}
.gillie-launch-intro {
  background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.78),transparent 27%),linear-gradient(180deg,#EAF7F3 0%,#C7E8DE 46%,#8FCDBD 100%) !important;
}
/* growth celebration */`;
if (!oldCssPattern.test(html)) throw new Error("Original splash CSS block was not found exactly once.");
html = html.replace(oldCssPattern, bootCss);

const oldMarkupPattern = /<!-- ================= LAUNCH SPLASH ================= -->[\s\S]*?<!-- ================= ONBOARDING ================= -->/;
const bootMarkup = `<!-- ================= SINGLE LAUNCH HANDOFF ================= -->
<div id="splash" class="gillie-launch-bootstrap" aria-hidden="true"></div>
<!-- ================= ONBOARDING ================= -->`;
if (!oldMarkupPattern.test(html)) throw new Error("Original splash markup was not found exactly once.");
html = html.replace(oldMarkupPattern, bootMarkup);

for (const forbidden of ["splash-orb", "Grow clean", "splashRise", "splashFloat"]) {
  if (html.includes(forbidden)) throw new Error(`Legacy first splash still exists after launch handoff: ${forbidden}`);
}
for (const required of ["gillie-boot-pending", "gillie-launch-bootstrap", "SINGLE LAUNCH HANDOFF", "#EAF7F3"]) {
  if (!html.includes(required)) throw new Error(`Single launch handoff is missing: ${required}`);
}

fs.writeFileSync(indexPath, html, "utf8");
console.log("Prepared one seamless launch: native background hands directly to the animated Gillie intro with no legacy splash.");
