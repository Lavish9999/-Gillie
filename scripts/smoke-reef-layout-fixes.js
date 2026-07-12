const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");

function read(relative) {
  const file = path.join(out, relative);
  if (!fs.existsSync(file)) throw new Error(`Missing generated Reef layout asset: ${relative}`);
  return fs.readFileSync(file, "utf8");
}

function requireMarker(source, marker, label) {
  if (!source.includes(marker)) throw new Error(`${label} is missing marker: ${marker}`);
}

const html = read("index.html");
const js = read("v1/reef-layout-fixes.js");
const css = read("v1/reef-layout-fixes.css");

requireMarker(html, 'data-gillie-v1-reef-layout-fixes="true"', "Generated index");
requireMarker(html, 'data-gillie-v1-reef-layout-fixes-styles="true"', "Generated index");
requireMarker(js, 'register("reef-layout-fixes"', "Reef layout module");
requireMarker(js, 'FIX_ENGINE = "reef-layout-fixes-v1"', "Reef layout engine");
requireMarker(js, "LEVEL_TARGETS", "Remaining XP calculation");
requireMarker(js, "target - currentXp", "Remaining XP subtraction");
requireMarker(js, "v1-reef-inline-sos", "In-flow Reef SOS action");
requireMarker(js, 'reefHierarchy = "seasonal-before-vault"', "Seasonal-first hierarchy marker");
requireMarker(css, 'body[data-ship-view="reef"] #sos-fab', "Floating Reef SOS suppression");
requireMarker(css, ".v1-reef-inline-sos", "In-flow Reef SOS styles");
requireMarker(css, "display:contents", "Stable Reef content reordering");
requireMarker(css, "-webkit-line-clamp:2", "Compact Plus vault copy");

if (js.includes("new MutationObserver") || js.includes("setInterval(")) {
  throw new Error("Reef layout fixes must not add observers or polling loops.");
}

console.log("Reef layout smoke checks passed: remaining XP, in-flow SOS, seasonal-first order, and compact vault are present.");
