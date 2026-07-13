const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const indexPath = path.join(out, "index.html");
const assets = ["v1/visual-integrity.css", "v1/home-gillie.css", "v1/home-gillie.js", "v1/visual-integrity.js"];

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

html = html
  .replace('<div class="row"><div class="t">Today\'s risk read</div><span class="tag">LIVE</span></div>', '<div class="row"><div class="t">Today\'s risk read</div></div>')
  .replace('<div class="eyebrow">Today preview</div>\n    <div class="row"><div class="t">Your free next step</div><span class="tag free">FREE</span></div>', '<div class="eyebrow">Today preview · Free</div>\n    <div class="row"><div class="t">Your free next step</div></div>')
  .replaceAll('<div class="eyebrow">Gillie Coach</div>\n      <div class="row"><div class="t">Personal quit plan</div><span class="tag">PLUS</span></div>', '<div class="eyebrow">Gillie Coach · Plus</div>\n      <div class="row"><div class="t">Personal quit plan</div></div>')
  .replaceAll('<div class="eyebrow">Gillie Coach</div>\n    <div class="row"><div class="t">Open Coach Room</div><span class="tag">PLUS</span></div>', '<div class="eyebrow">Gillie Coach · Plus</div>\n    <div class="row"><div class="t">Open Coach Room</div></div>')
  .replace('<div class="eyebrow">Gillie Coach</div>\n      <div class="row"><div class="t">Personal quit plan</div><span class="tag">PLUS</span></div>', '<div class="eyebrow">Gillie Coach · Plus</div>\n      <div class="row"><div class="t">Personal quit plan</div></div>')
  .replace(/<span class="tag">\s*LIVE\s*<\/span>/g, "")
  .replace(/<span class="tag free">\s*FREE\s*<\/span>/g, "");

const styleTag = '<link rel="stylesheet" href="./v1/visual-integrity.css" data-gillie-v1-visual-integrity-styles="true">';
const homeGillieStyleTag = '<link rel="stylesheet" href="./v1/home-gillie.css" data-gillie-v1-home-gillie-styles="true">';
const homeGillieScriptTag = '<script src="./v1/home-gillie.js" defer data-gillie-v1-home-gillie="true"></script>';
const scriptTag = '<script src="./v1/visual-integrity.js" defer data-gillie-v1-visual-integrity="true"></script>';

if (!html.includes(styleTag)) {
  const moonlitStyle = '<link rel="stylesheet" href="./v1/moonlit-reef.css" data-gillie-v1-moonlit-reef-styles="true">';
  const fallbackStyle = '<link rel="stylesheet" href="./v1/reef-layout-fixes.css" data-gillie-v1-reef-layout-fixes-styles="true">';
  const anchor = html.includes(moonlitStyle) ? moonlitStyle : fallbackStyle;
  if (!html.includes(anchor)) throw new Error("Could not locate the final V1 stylesheet injection point.");
  html = html.replace(anchor, `${anchor}\n${styleTag}`);
}

if (!html.includes(homeGillieStyleTag)) {
  if (!html.includes(styleTag)) throw new Error("Could not locate visual integrity stylesheet for Home Gillie injection.");
  html = html.replace(styleTag, `${styleTag}\n${homeGillieStyleTag}`);
}

if (!html.includes(homeGillieScriptTag)) {
  const moonlitScript = '<script src="./v1/moonlit-reef.js" defer data-gillie-v1-moonlit-reef="true"></script>';
  const fallbackScript = '<script src="./v1/reef-layout-fixes.js" defer data-gillie-v1-reef-layout-fixes="true"></script>';
  const anchor = html.includes(moonlitScript) ? moonlitScript : fallbackScript;
  if (!html.includes(anchor)) throw new Error("Could not locate the Home Gillie script injection point.");
  html = html.replace(anchor, `${anchor}\n${homeGillieScriptTag}`);
}

if (!html.includes(scriptTag)) {
  if (!html.includes(homeGillieScriptTag)) throw new Error("Could not locate Home Gillie script for visual integrity injection.");
  html = html.replace(homeGillieScriptTag, `${homeGillieScriptTag}\n${scriptTag}`);
}

fs.writeFileSync(indexPath, html, "utf8");

const css = fs.readFileSync(path.join(out, "v1/visual-integrity.css"), "utf8");
const homeGillieCss = fs.readFileSync(path.join(out, "v1/home-gillie.css"), "utf8");
const homeGillieJs = fs.readFileSync(path.join(out, "v1/home-gillie.js"), "utf8");
const js = fs.readFileSync(path.join(out, "v1/visual-integrity.js"), "utf8");
for (const marker of [
  'register("visual-integrity"',
  'ENGINE = "visual-integrity-v1.1"',
  "removeTemplateBadges",
  "normalizeDisplayTracking",
  "removeDecorativeAccentStripes",
  "collapseEmptyOversizedSurfaces",
  "ensurePaywallDisclosure",
  "v1-renewal-disclosure",
  "v1ManageSubscription",
  'overlay.classList.add("v1-plus-active")',
]) {
  if (!js.includes(marker)) throw new Error(`Generated visual integrity JavaScript is missing marker: ${marker}`);
}
for (const marker of [
  '[data-visual-normal-tracking="true"]',
  '[data-visual-heavy-accent="true"]',
  '[data-visual-empty-surface="true"]',
  "#view-reef .v1-reef-vault",
  ".plan-preview",
  ".v1-renewal-disclosure",
  ".v1-active-subscription",
  '#plus-overlay.v1-plus-active .gp-pricing-section',
  '#plus-purchase[data-v1-manage-subscription="true"]',
]) {
  if (!css.includes(marker)) throw new Error(`Generated visual integrity CSS is missing marker: ${marker}`);
}
for (const marker of [
  "Gillie V1 character anatomy",
  "#view-home #axo-svg [data-home-gill]",
  "#phase2-tank-preview .v1-preview-axo-svg [data-home-gill]",
  "#phase2-tank-preview .v1-preview-axo-svg .axo-gill-vein",
  "animation:none!important",
  "direct-coordinate six-frond gills",
]) {
  if (!homeGillieCss.includes(marker)) throw new Error(`Generated Gillie anatomy CSS is missing marker: ${marker}`);
}
for (const marker of [
  'ENGINE = "home-gillie-direct-gills-v3"',
  "directGillMarkup",
  "replaceHomeGills",
  'ns.startsWith("reefpreview-")',
  'data-home-gill="left-upper"',
  'data-home-gill="right-lower"',
  "matches.length !== 6",
  "window.axoSVG = hardenedAxoSVG",
  'document.documentElement.dataset.homeGillieEngine = ENGINE',
  'typeof renderAxo === "function"',
]) {
  if (!homeGillieJs.includes(marker)) throw new Error(`Generated Gillie anatomy JavaScript is missing marker: ${marker}`);
}
if (!html.includes('data-gillie-v1-home-gillie="true"')) throw new Error("Generated index is missing the Gillie anatomy runtime tag.");
if (!html.includes('data-gillie-v1-home-gillie-styles="true"')) throw new Error("Generated index is missing the Gillie anatomy stylesheet tag.");

const directGillTags = homeGillieJs.match(/<path class="axo-gill-frond" data-home-gill="[^"]+"[^>]*>/g) || [];
if (directGillTags.length !== 6) throw new Error(`Generated Gillie anatomy source has ${directGillTags.length} direct fronds instead of 6.`);
if (directGillTags.some((tag) => /\btransform=/.test(tag))) throw new Error("Generated Gillie direct fronds must not use transform attributes.");
const sharedGillRule = homeGillieCss.match(/#view-home #axo-svg \[data-home-gill\],[\s\S]*?\{([\s\S]*?)\}/)?.[1] || "";
if (!sharedGillRule) throw new Error("Generated shared direct-gill rule is missing.");
if (/\btransform\s*:/.test(sharedGillRule)) throw new Error("Shared direct-gill rule must not add transform positioning.");

console.log("Injected Gillie's visual integrity and six direct-coordinate fronds for Home and the full-size Reef preview.");
