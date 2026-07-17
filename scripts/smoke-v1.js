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
const storePricing = read("v1/store-pricing.js");
const accessibility = read("v1/accessibility.js");
const visualIntegrity = read("v1/visual-integrity.js");
const paywall = read("phase5-paywall.js");
const styles = read("v1/v1.css");

for (const asset of ["core", "onboarding", "sos", "progress", "reef", "reef-dashboard", "coach", "backup", "store-pricing", "accessibility"]) {
  requireMarker(html, `data-gillie-v1-${asset}=\"true\"`, "Generated index.html");
}
requireMarker(html, 'data-gillie-v1-styles="true"', "Generated index.html");
requireMarker(html, 'data-gillie-v1-reef-dashboard-styles="true"', "Generated Reef dashboard stylesheet");
requireMarker(html, "gillie.plus.monthly", "StoreKit monthly product contract");
requireMarker(html, "gillie.plus.yearly", "StoreKit yearly product contract");

requireMarker(core, "Gillie V1 canonical coordinator", "V1 core");
requireMarker(core, "late-module safe", "V1 late-registration coordinator");
requireMarker(core, "strict tab isolation", "V1 tab isolation ownership");
requireMarker(core, 'const VIEW_NAMES = ["home", "progress", "reef", "you"]', "V1 canonical view registry");
requireMarker(core, "enforceViewIsolation", "V1 one-view reconciliation");
requireMarker(core, 'view.dataset.v1Active = active ? "true" : "false"', "V1 active-view markers");
requireMarker(core, 'view.setAttribute?.("aria-hidden"', "V1 inactive accessibility boundary");
requireMarker(core, 'element.setAttribute?.("inert", "")', "V1 inactive interaction boundary");
requireMarker(core, "if (booted) queueMicrotask(() => installEntry(entry))", "V1 post-boot module installation");
requireMarker(core, "gillieV1ModuleCount", "V1 runtime module count marker");
requireMarker(core, "installedModules", "V1 installed module registry");
requireMarker(core, "v1_canonical_booted", "V1 core analytics");
requireMarker(onboarding, "What nicotine are you quitting?", "Onboarding simplification");
requireMarker(onboarding, "v1-onboarding-details", "Deferred onboarding estimate");
requireMarker(sos, "you do not have to decide anything yet", "SOS relief-first copy");
requireMarker(sos, "I made it through this moment", "SOS completion action");
requireMarker(progress, "Always free", "Free Progress patterns");
requireMarker(progress, "Advanced patterns and planning", "Premium Progress boundary");
requireMarker(visualIntegrity, "data-gp-computed", "StoreKit-only savings-claim guard");
requireMarker(paywall, "Get practical help when an urge hits", "Probability-safe paywall benefit");
requireMarker(paywall, "deriveTrialState", "StoreKit-verified trial gating");
requireMarker(paywall, "Your selected Gillie Plus plan renews unless canceled.", "Honest trial-timeline billing step");
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
requireMarker(storePricing, 'ENGINE = "store-pricing-v2-retryable"', "StoreKit pricing authority");
requireMarker(storePricing, "normalizeProducts", "StoreKit product normalization");
requireMarker(storePricing, "Apple unavailable", "StoreKit failure state");
requireMarker(storePricing, "restore.disabled = false", "Restore remains available");
requireMarker(storePricing, "introEligible", "StoreKit introductory-offer eligibility");
requireMarker(accessibility, 'ENGINE = "accessibility-v1"', "Accessibility module");
requireMarker(accessibility, "normalizeViewportContent", "Scalable viewport contract");
requireMarker(accessibility, 'toast.setAttribute("aria-live", "polite")', "Toast announcement contract");
requireMarker(accessibility, 'overlay.setAttribute("aria-modal", "true")', "Dialog accessibility contract");
requireMarker(accessibility, "focusInitial", "Dialog focus management");
requireMarker(styles, "Gillie V1 canonical screen styles", "V1 styles");
requireMarker(styles, "Canonical tab isolation", "V1 tab isolation styles");
requireMarker(styles, '#main > .view[data-v1-active="true"]:not([hidden])', "V1 active view layout");
requireMarker(styles, '#main > .view[data-v1-active="false"]', "V1 inactive view layout");
requireMarker(styles, "display:none!important", "V1 inactive display exclusion");
requireMarker(styles, "position:absolute!important", "V1 inactive flex-layout exclusion");
requireMarker(styles, "flex:0 0 0!important", "V1 inactive flex-size exclusion");
requireMarker(styles, "contain:strict!important", "V1 inactive containment boundary");
requireMarker(styles, "height:100dvh!important", "V1 single scroll-shell height");
requireMarker(styles, "#sos-overlay .phase2-sos-data", "SOS reflection deferral");
requireMarker(styles, "#phase2-tank-preview .v1-preview-axo-wrap", "Reef preview scale contract");
requireMarker(styles, ".v1-preview-axo-svg *", "Reef preview animation isolation");
requireMarker(styles, "body.v1-reef-preview-open #main .view", "Reef nested view scroll lock");
requireMarker(styles, "pointer-events:none!important", "Reef background pointer isolation");
requireMarker(styles, "#phase2-tank-preview .phase2-preview-sheet", "Reef contained sheet scrolling");

// Canonical screen modules stay observer-free. Runtime service modules
// (accessibility's inert repair) are allowed their single scoped observer.
const canonicalJs = [core, onboarding, sos, progress, reef, reefDashboard, coach, backup, storePricing].join("\n");
if (canonicalJs.includes("new MutationObserver")) {
  throw new Error("Canonical V1 modules must not add MutationObserver patch loops.");
}
if (canonicalJs.includes("setInterval(") || accessibility.includes("setInterval(")) {
  throw new Error("Canonical V1 modules must not add recurring polling intervals.");
}
for (const forbidden of ["Advanced predictions", "Know the hard moment before it arrives", "Know when cravings are most likely to hit"]) {
  if (progress.includes(forbidden) || visualIntegrity.includes(forbidden) || paywall.includes(forbidden)) {
    throw new Error(`Overly certain launch copy returned: ${forbidden}`);
  }
}
for (const forbidden of ["user-scalable=no", "$3.99", "$29.99", "Save 37%"] ) {
  if (html.includes(forbidden) || paywall.includes(forbidden)) {
    throw new Error(`Generated bundle still contains forbidden accessibility or hardcoded pricing marker: ${forbidden}`);
  }
}
requireMarker(html, 'id="toast" role="status" aria-live="polite" aria-atomic="true"', "Generated toast announcement");
if (html.includes("data-gillie-phase5-hotfix")) {
  throw new Error("Legacy paywall hotfix returned to the generated bundle.");
}

console.log("Gillie V1 smoke checks passed: strict tab isolation, StoreKit-authoritative pricing, accessible dialogs, safer wellness copy, canonical Reef rendering, swipe dismissal, progression, daily care, and premium collection value are present.");
