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
const reefDashboard = read("v1/reef-dashboard.js");
const reefDashboardStyles = read("v1/reef-dashboard.css");
const coach = read("v1/coach.js");
const backup = read("v1/backup.js");
const styles = read("v1/v1.css");

for (const asset of ["core", "onboarding", "sos", "progress", "reef", "reef-dashboard", "coach", "backup"]) {
  requireMarker(html, `data-gillie-v1-${asset}=\"true\"`, "Generated index.html");
}
requireMarker(html, 'data-gillie-v1-styles="true"', "Generated index.html");
requireMarker(html, 'data-gillie-v1-reef-dashboard-styles="true"', "Generated Reef dashboard stylesheet");
requireMarker(html, "gillie.plus.monthly", "StoreKit monthly product contract");
requireMarker(html, "gillie.plus.yearly", "StoreKit yearly product contract");

requireMarker(core, "Gillie V1 canonical coordinator", "V1 core");
requireMarker(core, "late-module safe", "V1 late-registration coordinator");
requireMarker(core, "if (booted) queueMicrotask(() => installEntry(entry))", "V1 post-boot module installation");
requireMarker(core, "gillieV1ModuleCount", "V1 runtime module count marker");
requireMarker(core, "installedModules", "V1 installed module registry");
requireMarker(core, "v1_canonical_booted", "V1 core analytics");
requireMarker(onboarding, "What nicotine are you quitting?", "Onboarding simplification");
requireMarker(onboarding, "v1-onboarding-details", "Deferred onboarding estimate");
requireMarker(sos, "you do not have to decide anything yet", "SOS relief-first copy");
requireMarker(sos, "I made it through this moment", "SOS completion action");
requireMarker(progress, "Always free", "Free Progress patterns");
requireMarker(progress, "Advanced predictions", "Premium Progress boundary");
requireMarker(reef, "Curated aquarium collection", "Reef curation");
requireMarker(reef, 'PREVIEW_ENGINE = "canonical-v3-swipe"', "Canonical Reef swipe preview engine");
requireMarker(reef, "handlePreviewCapture", "Reef capture-phase override");
requireMarker(reef, "stopImmediatePropagation", "Legacy preview suppression");
requireMarker(reef, 'document.addEventListener("click", handlePreviewCapture, true)', "Capture listener registration");
requireMarker(reef, "createPreviewTank", "Synchronous Reef preview tank creation");
requireMarker(reef, "v1-preview-axo-wrap", "Reef preview character repair");
requireMarker(reef, "axoSVG(current.skin", "Reef preview fresh Gillie renderer");
requireMarker(reef, "flattenPreviewPaint", "Reef preview solid SVG paint fallback");
requireMarker(reef, 'svg.querySelectorAll("[fill]")', "Reef preview paint replacement");
requireMarker(reef, 'svg.querySelector("defs")?.remove()', "Reef preview paint-server removal");
requireMarker(reef, "replaceWith(previewWrap)", "Reef preview character replacement");
requireMarker(reef, 'qs("#main .view:not([hidden])")', "Reef active scroll-container lock");
requireMarker(reef, 'app.setAttribute("inert", "")', "Reef background interaction lock");
requireMarker(reef, "handlePreviewTouchMove", "Reef iOS touch scroll containment");
requireMarker(reef, "handlePreviewTouchEnd", "Reef swipe gesture completion");
requireMarker(reef, "shouldDismissPreview", "Reef swipe threshold calculation");
requireMarker(reef, "PREVIEW_DISMISS_VELOCITY", "Reef swipe velocity threshold");
requireMarker(reef, "dismissPreviewWithGesture", "Reef swipe-down close animation");
requireMarker(reef, 'document.addEventListener("touchend", handlePreviewTouchEnd', "Reef touch-end registration");
requireMarker(reef, "unlockPreviewScroll", "Reef preview scroll restore");
requireMarker(reefDashboard, 'register("reef-dashboard"', "Reef dashboard module registration");
requireMarker(reefDashboard, 'DASHBOARD_ENGINE = "reef-progression-v1"', "Reef progression engine");
requireMarker(reefDashboard, "Daily Reef Care", "Reef daily care loop");
requireMarker(reefDashboard, "reefProgress", "Persisted Reef progression state");
requireMarker(reefDashboard, "claimTask", "Claimable Reef tasks");
requireMarker(reefDashboard, "claimDailyBonus", "Reef completion chest");
requireMarker(reefDashboard, "Gillie Plus collection vault", "Reef premium value surface");
requireMarker(reefDashboardStyles, "Gillie V1 Reef Dashboard", "Reef dashboard styles");
requireMarker(reefDashboardStyles, ".v1-reef-dashboard", "Reef dashboard card styles");
requireMarker(reefDashboardStyles, ".v1-reef-daily-bonus", "Reef completion chest styles");
requireMarker(reefDashboardStyles, ".v1-reef-vault", "Reef premium vault styles");
requireMarker(coach, "What do you need right now?", "Focused Coach flow");
requireMarker(backup, 'format: "gillie-backup"', "Backup export contract");
requireMarker(backup, "restore-pending-apple", "Entitlement-safe restore");
requireMarker(styles, "Gillie V1 canonical screen styles", "V1 styles");
requireMarker(styles, "#sos-overlay .phase2-sos-data", "SOS reflection deferral");
requireMarker(styles, "#phase2-tank-preview .v1-preview-axo-wrap", "Reef preview scale contract");
requireMarker(styles, ".v1-preview-axo-svg *", "Reef preview animation isolation");
requireMarker(styles, "body.v1-reef-preview-open #main .view", "Reef nested view scroll lock");
requireMarker(styles, "pointer-events:none!important", "Reef background pointer isolation");
requireMarker(styles, "#phase2-tank-preview .phase2-preview-sheet", "Reef contained sheet scrolling");

const canonicalJs = [core, onboarding, sos, progress, reef, reefDashboard, coach, backup].join("\n");
if (canonicalJs.includes("new MutationObserver")) {
  throw new Error("Canonical V1 modules must not add MutationObserver patch loops.");
}
if (canonicalJs.includes("setInterval(")) {
  throw new Error("Canonical V1 modules must not add recurring polling intervals.");
}
if (html.includes("data-gillie-phase5-hotfix")) {
  throw new Error("Legacy paywall hotfix returned to the generated bundle.");
}

console.log("Gillie V1 smoke checks passed: canonical Reef rendering, swipe dismissal, progression, daily care, and premium collection value are present.");
