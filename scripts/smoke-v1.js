const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");

function read(relative) {
  const file = path.join(out, relative);
  if (!fs.existsSync(file)) throw new Error(`Missing generated V1 asset: ${relative}`);
  return fs.readFileSync(file, "utf8");
}

function requireMarker(source, marker, label) {
  if (!source.includes(marker)) throw new Error(`${label} is missing marker: ${marker}`);
}

const html = read("index.html");
const core = read("v1/core.js");
const onboarding = read("v1/onboarding.js");
const sos = read("v1/sos.js");
const progress = read("v1/progress.js");
const reef = read("v1/reef.js");
const coach = read("v1/coach.js");
const backup = read("v1/backup.js");
const styles = read("v1/v1.css");

for (const asset of ["core", "onboarding", "sos", "progress", "reef", "coach", "backup"]) {
  requireMarker(html, `data-gillie-v1-${asset}=\"true\"`, "Generated index.html");
}
requireMarker(html, 'data-gillie-v1-styles="true"', "Generated index.html");
requireMarker(html, "gillie.plus.monthly", "StoreKit monthly product contract");
requireMarker(html, "gillie.plus.yearly", "StoreKit yearly product contract");

requireMarker(core, "Gillie V1 canonical coordinator", "V1 core");
requireMarker(core, "v1_canonical_booted", "V1 core analytics");
requireMarker(onboarding, "What nicotine are you quitting?", "Onboarding simplification");
requireMarker(onboarding, "v1-onboarding-details", "Deferred onboarding estimate");
requireMarker(sos, "you do not have to decide anything yet", "SOS relief-first copy");
requireMarker(sos, "I made it through this moment", "SOS completion action");
requireMarker(progress, "Always free", "Free Progress patterns");
requireMarker(progress, "Advanced predictions", "Premium Progress boundary");
requireMarker(reef, "Curated aquarium collection", "Reef curation");
requireMarker(reef, "v1-preview-axo-wrap", "Reef preview character repair");
requireMarker(coach, "What do you need right now?", "Focused Coach flow");
requireMarker(backup, 'format: "gillie-backup"', "Backup export contract");
requireMarker(backup, "restore-pending-apple", "Entitlement-safe restore");
requireMarker(styles, "Gillie V1 canonical screen styles", "V1 styles");
requireMarker(styles, "#sos-overlay .phase2-sos-data", "SOS reflection deferral");
requireMarker(styles, "#phase2-tank-preview .v1-preview-axo-wrap", "Reef preview scale contract");

const canonicalJs = [core, onboarding, sos, progress, reef, coach, backup].join("\n");
if (canonicalJs.includes("new MutationObserver")) {
  throw new Error("Canonical V1 modules must not add MutationObserver patch loops.");
}
if (canonicalJs.includes("setInterval(")) {
  throw new Error("Canonical V1 modules must not add recurring polling intervals.");
}
if (html.includes("data-gillie-phase5-hotfix")) {
  throw new Error("Legacy paywall hotfix returned to the generated bundle.");
}

console.log("Gillie V1 smoke checks passed: onboarding, SOS, Progress, Reef, Coach, backup, architecture, StoreKit, and Reef preview contracts are present.");