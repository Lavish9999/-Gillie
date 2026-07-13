const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");

function read(relative) {
  const file = path.join(out, relative);
  if (!fs.existsSync(file)) throw new Error(`Missing generated Moonlit Reef asset: ${relative}`);
  return fs.readFileSync(file, "utf8");
}

function requireMarker(source, marker, label) {
  if (!source.includes(marker)) throw new Error(`${label} is missing marker: ${marker}`);
}

const html = read("index.html");
const js = read("v1/moonlit-reef.js");
const css = read("v1/moonlit-reef.css");

requireMarker(html, 'data-gillie-v1-moonlit-reef="true"', "Generated index.html");
requireMarker(html, 'data-gillie-v1-moonlit-reef-styles="true"', "Generated index.html");
requireMarker(js, 'register("moonlit-reef"', "Moonlit Reef module");
requireMarker(js, 'COLLECTION_ENGINE = "moonlit-reef-v1"', "Moonlit Reef engine");
requireMarker(js, 'PREVIEW_ART_ENGINE = "standalone-svg-v4"', "Standalone Moonlit preview engine");
requireMarker(js, 'const THEME_ID = "moonlit"', "Moonlit theme catalog entry");
requireMarker(js, 'const SKIN_ID = "moonpearl"', "Moon Pearl skin catalog entry");
requireMarker(js, "const STANDALONE_MOON_PEARL_SVG", "Standalone Moon Pearl artwork");
requireMarker(js, 'class="moonlit-preview-character-svg"', "Standalone Moon Pearl SVG wrapper");
requireMarker(js, 'data-preview-character="standalone-v4"', "Standalone preview identity");
requireMarker(js, "A grounded lunar arch for the reef floor", "Grounded Crescent Arch copy");
requireMarker(js, "equipFullCollection", "One-tap full collection equip");
requireMarker(js, "if (!current.premium)", "Equip-time Plus boundary");
requireMarker(js, "moonlit_collection_previewed", "Free preview analytics");
requireMarker(js, "moonlit_collection_equipped", "Collection equip analytics");
requireMarker(js, "Preview is free", "Free preview promise");
requireMarker(js, "ambienceEquipped", "Animated environment state");
requireMarker(js, "jellyEquipped", "Moon-jelly state");
requireMarker(js, "crescentEquipped", "Crescent Arch state");
requireMarker(js, "starCoralEquipped", "Star Coral state");
requireMarker(css, ".moonlit-seasonal-card", "Moonlit seasonal card styles");
requireMarker(css, "#tank.moonlit-reef-live", "Live Moonlit tank styles");
requireMarker(css, "#moonlit-light-layer", "Animated moonlight layer");
requireMarker(css, ".moonlit-jelly-live", "Moon-jelly tank mate styles");
requireMarker(css, "#moonlit-reef-preview", "Full-screen preview styles");
requireMarker(css, ".moonlit-preview-items", "Collection item list styles");
requireMarker(css, ".moonlit-preview-character-svg", "Standalone character sizing styles");

const gillTags = js.match(/<path data-moonlit-gill="[^"]+"[^>]*>/g) || [];
if (gillTags.length !== 6) {
  throw new Error(`Generated Moonlit preview must ship exactly six final-position gills; found ${gillTags.length}.`);
}
if (gillTags.some((tag) => /\btransform=/.test(tag))) {
  throw new Error("Generated Moonlit preview gills must not depend on transform attributes.");
}
for (const forbidden of ["axoSVG(", 'class="gill', 'class="axo-core', 'class="axo-tail', "moonlit-preview-art.js", "data-gillie-v1-moonlit-preview-art"]) {
  if (js.includes(forbidden) || html.includes(forbidden)) {
    throw new Error(`Generated Moonlit preview restored a removed live-render dependency: ${forbidden}`);
  }
}
if (js.includes("new MutationObserver") || js.includes("setInterval(")) {
  throw new Error("Moonlit Reef must not add observer patch loops or polling intervals.");
}

const layoutIndex = html.indexOf('data-gillie-v1-reef-layout-fixes="true"');
const moonlitIndex = html.indexOf('data-gillie-v1-moonlit-reef="true"');
if (layoutIndex < 0 || moonlitIndex < layoutIndex) {
  throw new Error("Moonlit Reef must load after the stable Reef layout module.");
}

console.log("Moonlit Reef smoke checks passed: standalone six-gill artwork, grounded arch, free preview, equip-time Plus gate, collection state, and live effects are present.");
