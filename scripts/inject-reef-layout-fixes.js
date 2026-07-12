const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const indexPath = path.join(out, "index.html");
const assets = ["v1/reef-layout-fixes.css", "v1/reef-layout-fixes.js"];

if (!fs.existsSync(indexPath)) {
  throw new Error("Reef layout fix injection requires www/index.html. Run the canonical injectors first.");
}

for (const asset of assets) {
  const source = path.join(root, asset);
  const target = path.join(out, asset);
  if (!fs.existsSync(source)) throw new Error(`Missing Reef layout fix asset: ${asset}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

let html = fs.readFileSync(indexPath, "utf8");
const styleTag = '<link rel="stylesheet" href="./v1/reef-layout-fixes.css" data-gillie-v1-reef-layout-fixes-styles="true">';
const scriptTag = '<script src="./v1/reef-layout-fixes.js" defer data-gillie-v1-reef-layout-fixes="true"></script>';

if (!html.includes(styleTag)) {
  const dashboardStyle = '<link rel="stylesheet" href="./v1/reef-dashboard.css" data-gillie-v1-reef-dashboard-styles="true">';
  if (!html.includes(dashboardStyle)) throw new Error("Could not locate Reef dashboard stylesheet injection point.");
  html = html.replace(dashboardStyle, `${dashboardStyle}\n${styleTag}`);
}

if (!html.includes(scriptTag)) {
  const dashboardScript = '<script src="./v1/reef-dashboard.js" defer data-gillie-v1-reef-dashboard="true"></script>';
  if (!html.includes(dashboardScript)) throw new Error("Could not locate Reef dashboard script injection point.");
  html = html.replace(dashboardScript, `${dashboardScript}\n${scriptTag}`);
}

fs.writeFileSync(indexPath, html, "utf8");

const css = fs.readFileSync(path.join(out, "v1/reef-layout-fixes.css"), "utf8");
const js = fs.readFileSync(path.join(out, "v1/reef-layout-fixes.js"), "utf8");
for (const marker of ["seasonal-before-vault", "reef-layout-fixes-v1", "reefRemainingXp", "v1-reef-inline-sos"]) {
  if (!js.includes(marker)) throw new Error(`Generated Reef layout JavaScript is missing marker: ${marker}`);
}
for (const marker of ['body[data-ship-view="reef"] #sos-fab', "display:contents", ".v1-reef-inline-sos", "-webkit-line-clamp:2"]) {
  if (!css.includes(marker)) throw new Error(`Generated Reef layout CSS is missing marker: ${marker}`);
}

console.log("Injected Reef XP, in-flow SOS, seasonal hierarchy, and compact vault fixes.");
