const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const indexPath = path.join(out, "index.html");
const assets = ["v1/moonlit-reef.css", "v1/moonlit-reef.js"];

if (!fs.existsSync(indexPath)) {
  throw new Error("Moonlit Reef injection requires www/index.html. Run the canonical Reef injectors first.");
}

for (const asset of assets) {
  const source = path.join(root, asset);
  const target = path.join(out, asset);
  if (!fs.existsSync(source)) throw new Error(`Missing Moonlit Reef asset: ${asset}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

let html = fs.readFileSync(indexPath, "utf8");
const styleTag = '<link rel="stylesheet" href="./v1/moonlit-reef.css" data-gillie-v1-moonlit-reef-styles="true">';
const scriptTag = '<script src="./v1/moonlit-reef.js" defer data-gillie-v1-moonlit-reef="true"></script>';

if (!html.includes(styleTag)) {
  const layoutStyle = '<link rel="stylesheet" href="./v1/reef-layout-fixes.css" data-gillie-v1-reef-layout-fixes-styles="true">';
  if (!html.includes(layoutStyle)) throw new Error("Could not locate Reef layout stylesheet injection point for Moonlit Reef.");
  html = html.replace(layoutStyle, `${layoutStyle}\n${styleTag}`);
}

if (!html.includes(scriptTag)) {
  const layoutScript = '<script src="./v1/reef-layout-fixes.js" defer data-gillie-v1-reef-layout-fixes="true"></script>';
  if (!html.includes(layoutScript)) throw new Error("Could not locate Reef layout script injection point for Moonlit Reef.");
  html = html.replace(layoutScript, `${layoutScript}\n${scriptTag}`);
}

html = html
  .replace(/\n?<script src="\.\/v1\/moonlit-preview-art\.js"[^>]*><\/script>/g, "")
  .replace(/\n?<script src="\.\/v1\/moonlit-preview-art\.js" defer data-gillie-v1-moonlit-preview-art="true"><\/script>/g, "");

fs.writeFileSync(indexPath, html, "utf8");

const css = fs.readFileSync(path.join(out, "v1/moonlit-reef.css"), "utf8");
const js = fs.readFileSync(path.join(out, "v1/moonlit-reef.js"), "utf8");
for (const marker of [
  'register("moonlit-reef"',
  'COLLECTION_ENGINE = "moonlit-reef-v1"',
  'PREVIEW_ART_ENGINE = "standalone-svg-v4"',
  'name: "Moonlit Reef"',
  'name: "Moon Pearl"',
  "const STANDALONE_MOON_PEARL_SVG",
  'class="moonlit-preview-character-svg"',
  'data-preview-character="standalone-v4"',
  "A grounded lunar arch for the reef floor",
  "equipFullCollection",
  "moonlit_collection_equipped",
  "Preview is free",
]) {
  if (!js.includes(marker)) throw new Error(`Generated Moonlit Reef JavaScript is missing marker: ${marker}`);
}

const standaloneMatch = js.match(/const STANDALONE_MOON_PEARL_SVG = `([\s\S]*?)`;/);
if (!standaloneMatch) throw new Error("Generated Moonlit Reef is missing the standalone Moon Pearl SVG block.");
const standaloneSvg = standaloneMatch[1];
const gillTags = standaloneSvg.match(/<path data-moonlit-gill="[^"]+"[^>]*>/g) || [];
if (gillTags.length !== 6) throw new Error(`Generated standalone Moon Pearl art has ${gillTags.length} gills instead of 6.`);
if (gillTags.some((tag) => /\btransform=/.test(tag))) throw new Error("Generated Moon Pearl gills still depend on transform attributes.");
for (const forbidden of ['class="gill', 'class="axo-core', 'class="axo-tail', 'class="axo-leg', 'class="axo-eye']) {
  if (standaloneSvg.includes(forbidden)) throw new Error(`Standalone Moon Pearl SVG restored a global animation class: ${forbidden}`);
}
for (const forbidden of ["moonlit-preview-art.js", "data-gillie-v1-moonlit-preview-art"]) {
  if (html.includes(forbidden)) throw new Error(`Generated Moonlit preview restored obsolete asset: ${forbidden}`);
}
for (const marker of [
  ".moonlit-seasonal-card",
  "#tank.moonlit-reef-live",
  "#moonlit-reef-preview",
  ".moonlit-preview-items",
  ".moonlit-jelly-live",
  ".moonlit-preview-character-svg",
]) {
  if (!css.includes(marker)) throw new Error(`Generated Moonlit Reef CSS is missing marker: ${marker}`);
}

console.log("Injected the Moonlit Reef premium collection with standalone six-gill character art, grounded arch art, free preview, and live tank treatment.");
