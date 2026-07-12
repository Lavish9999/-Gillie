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
requireMarker(js, 'const THEME_ID = "moonlit"', "Moonlit theme catalog entry");
requireMarker(js, 'const SKIN_ID = "moonpearl"', "Moon Pearl skin catalog entry");
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

if (js.includes("new MutationObserver") || js.includes("setInterval(")) {
  throw new Error("Moonlit Reef must not add observer patch loops or polling intervals.");
}

const layoutIndex = html.indexOf('data-gillie-v1-reef-layout-fixes="true"');
const moonlitIndex = html.indexOf('data-gillie-v1-moonlit-reef="true"');
if (layoutIndex < 0 || moonlitIndex < layoutIndex) {
  throw new Error("Moonlit Reef must load after the stable Reef layout fixes.");
}

console.log("Moonlit Reef smoke checks passed: free preview, equip-time Plus gate, six-piece collection, and live effects are present.");
