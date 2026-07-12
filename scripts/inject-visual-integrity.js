const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const indexPath = path.join(out, "index.html");
const assets = ["v1/visual-integrity.css", "v1/visual-integrity.js"];

if (!fs.existsSync(indexPath)) {
  throw new Error("Visual integrity injection requires www/index.html. Run the canonical injectors first.");
}

for (const asset of assets) {
  const source = path.join(root, asset);
  const target = path.join(out, asset);
  if (!fs.existsSync(source)) throw new Error(`Missing visual integrity asset: ${asset}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

let html = fs.readFileSync(indexPath, "utf8");

// Remove decorative access/status badges from the generated app source itself.
html = html
  .replace('<div class="row"><div class="t">Today\'s risk read</div><span class="tag">LIVE</span></div>', '<div class="row"><div class="t">Today\'s risk read</div></div>')
  .replace('<div class="eyebrow">Today preview</div>\n    <div class="row"><div class="t">Your free next step</div><span class="tag free">FREE</span></div>', '<div class="eyebrow">Today preview · Free</div>\n    <div class="row"><div class="t">Your free next step</div></div>')
  .replaceAll('<div class="eyebrow">Gillie Coach</div>\n      <div class="row"><div class="t">Personal quit plan</div><span class="tag">PLUS</span></div>', '<div class="eyebrow">Gillie Coach · Plus</div>\n      <div class="row"><div class="t">Personal quit plan</div></div>')
  .replaceAll('<div class="eyebrow">Gillie Coach</div>\n    <div class="row"><div class="t">Open Coach Room</div><span class="tag">PLUS</span></div>', '<div class="eyebrow">Gillie Coach · Plus</div>\n    <div class="row"><div class="t">Open Coach Room</div></div>')
  .replace('<div class="eyebrow">Gillie Coach</div>\n      <div class="row"><div class="t">Personal quit plan</div><span class="tag">PLUS</span></div>', '<div class="eyebrow">Gillie Coach · Plus</div>\n      <div class="row"><div class="t">Personal quit plan</div></div>');

const styleTag = '<link rel="stylesheet" href="./v1/visual-integrity.css" data-gillie-v1-visual-integrity-styles="true">';
const scriptTag = '<script src="./v1/visual-integrity.js" defer data-gillie-v1-visual-integrity="true"></script>';

if (!html.includes(styleTag)) {
  const moonlitStyle = '<link rel="stylesheet" href="./v1/moonlit-reef.css" data-gillie-v1-moonlit-reef-styles="true">';
  const fallbackStyle = '<link rel="stylesheet" href="./v1/reef-layout-fixes.css" data-gillie-v1-reef-layout-fixes-styles="true">';
  const anchor = html.includes(moonlitStyle) ? moonlitStyle : fallbackStyle;
  if (!html.includes(anchor)) throw new Error("Could not locate the final V1 stylesheet injection point.");
  html = html.replace(anchor, `${anchor}\n${styleTag}`);
}

if (!html.includes(scriptTag)) {
  const moonlitScript = '<script src="./v1/moonlit-reef.js" defer data-gillie-v1-moonlit-reef="true"></script>';
  const fallbackScript = '<script src="./v1/reef-layout-fixes.js" defer data-gillie-v1-reef-layout-fixes="true"></script>';
  const anchor = html.includes(moonlitScript) ? moonlitScript : fallbackScript;
  if (!html.includes(anchor)) throw new Error("Could not locate the final V1 script injection point.");
  html = html.replace(anchor, `${anchor}\n${scriptTag}`);
}

fs.writeFileSync(indexPath, html, "utf8");

const css = fs.readFileSync(path.join(out, "v1/visual-integrity.css"), "utf8");
const js = fs.readFileSync(path.join(out, "v1/visual-integrity.js"), "utf8");
for (const marker of [
  'register("visual-integrity"',
  'ENGINE = "visual-integrity-v1"',
  "removeTemplateBadges",
  "normalizeDisplayTracking",
  "removeDecorativeAccentStripes",
  "collapseEmptyOversizedSurfaces",
]) {
  if (!js.includes(marker)) throw new Error(`Generated visual integrity JavaScript is missing marker: ${marker}`);
}
for (const marker of [
  '[data-visual-normal-tracking="true"]',
  '[data-visual-heavy-accent="true"]',
  '[data-visual-empty-surface="true"]',
  "#view-reef .v1-reef-vault",
  ".plan-preview",
]) {
  if (!css.includes(marker)) throw new Error(`Generated visual integrity CSS is missing marker: ${marker}`);
}

console.log("Injected Gillie's anti-template visual integrity layer and removed decorative status badges.");
