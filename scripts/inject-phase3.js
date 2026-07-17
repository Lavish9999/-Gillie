const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const indexPath = path.join(out, "index.html");
const assets = [
  "phase3-ship.css",
  "phase3-ship.js",
  "phase4-launch.css",
  "phase4-launch.js",
  "phase5-paywall.css",
  "gillie-foundation.css",
  "phase5-paywall.js",
  "v1/v1.css",
  "v1/reef-dashboard.css",
  "v1/core.js",
  "v1/onboarding.js",
  "v1/sos.js",
  "v1/progress.js",
  "v1/reef.js",
  "v1/reef-dashboard.js",
  "v1/coach.js",
  "v1/backup.js",
  "v1/store-pricing.js",
  "v1/accessibility.js",
];

if (!fs.existsSync(indexPath)) {
  throw new Error("Launch polish injection requires www/index.html. Run prepare-capacitor-web first.");
}

for (const asset of assets) {
  const source = path.join(root, asset);
  const target = path.join(out, asset);
  if (!fs.existsSync(source)) throw new Error(`Missing launch asset: ${asset}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

let html = fs.readFileSync(indexPath, "utf8");
const marker = "<!-- Gillie Phase 3 ship polish -->";
const injection = `${marker}
<link rel="stylesheet" href="./phase3-ship.css" data-gillie-phase3="true">
<script src="./phase3-ship.js" defer data-gillie-phase3="true"></script>
<!-- Gillie Phase 4 launch hardening -->
<link rel="stylesheet" href="./phase4-launch.css" data-gillie-phase4="true">
<script src="./phase4-launch.js" defer data-gillie-phase4="true"></script>
<!-- Gillie Phase 5 production paywall -->
<link rel="stylesheet" href="./phase5-paywall.css" data-gillie-phase5="true">
<link rel="stylesheet" href="./gillie-foundation.css" data-gillie-foundation="true">
<script src="./phase5-paywall.js" defer data-gillie-phase5="true"></script>
<!-- Gillie V1 canonical screen modules -->
<link rel="stylesheet" href="./v1/v1.css" data-gillie-v1-styles="true">
<link rel="stylesheet" href="./v1/reef-dashboard.css" data-gillie-v1-reef-dashboard-styles="true">
<script src="./v1/core.js" defer data-gillie-v1-core="true"></script>
<script src="./v1/onboarding.js" defer data-gillie-v1-onboarding="true"></script>
<script src="./v1/sos.js" defer data-gillie-v1-sos="true"></script>
<script src="./v1/progress.js" defer data-gillie-v1-progress="true"></script>
<script src="./v1/reef.js" defer data-gillie-v1-reef="true"></script>
<script src="./v1/reef-dashboard.js" defer data-gillie-v1-reef-dashboard="true"></script>
<script src="./v1/coach.js" defer data-gillie-v1-coach="true"></script>
<script src="./v1/backup.js" defer data-gillie-v1-backup="true"></script>
<script src="./v1/store-pricing.js" defer data-gillie-v1-store-pricing="true"></script>
<script src="./v1/accessibility.js" defer data-gillie-v1-accessibility="true"></script>`;

if (!html.includes(marker)) {
  if (!html.includes("</body>")) throw new Error("Cannot inject launch assets: missing </body>.");
  html = html.replace("</body>", `${injection}\n</body>`);
}

html = html
  .replace('kicker: "Paywall is the tank"', 'kicker: "Your personal quit plan"')
  .replace('cta: "Unlock Gillie Plus"', 'cta: "Start Gillie Plus"');
fs.writeFileSync(indexPath, html, "utf8");

const phase3Path = path.join(out, "phase3-ship.js");
let phase3 = fs.readFileSync(phase3Path, "utf8");

const openPlusNeedle = `    try {
      if (typeof window.openPlus === "function") window.openPlus();
      else if (typeof openPlus === "function") openPlus();
      else document.getElementById("plus-open")?.click();
    } catch (_) {
      showOverlay("plus-overlay");
    }`;
const openPlusReplacement = `    try {
      if (typeof window.openPlus === "function") window.openPlus();
      else document.getElementById("plus-open")?.click();
    } catch (_) {
      showOverlay("plus-overlay");
    }`;
if (!phase3.includes(openPlusNeedle)) throw new Error("Phase 3 paywall fallback marker changed.");
phase3 = phase3.replace(openPlusNeedle, openPlusReplacement);

const paywallOwnerNeedle = `  function tunePaywall() {
    const overlay = $("#plus-overlay");
    const current = appState();
    if (!overlay || overlay.hidden || !current) return;`;
const paywallOwnerReplacement = `  function tunePaywall() {
    const overlay = $("#plus-overlay");
    const current = appState();
    if (!overlay || overlay.hidden || !current) return;
    if (window.__gilliePaywallRebuildInstalled || overlay.classList.contains("gp-paywall-overlay")) return;`;
if (!phase3.includes(paywallOwnerNeedle)) throw new Error("Phase 3 paywall ownership marker changed.");
phase3 = phase3.replace(paywallOwnerNeedle, paywallOwnerReplacement);

const refreshNeedle = `  function refresh() {
    installStatusScrim();
    updateActiveView();
    buildHome();
    buildProgressActivation();
    tuneReef();
    tunePaywall();
    tuneCopy();
  }`;
const refreshReplacement = `  function refresh() {
    const main = $("#main");
    if (observer) observer.disconnect();
    grantStarterPearls();
    installStatusScrim();
    updateActiveView();
    buildHome();
    buildProgressActivation();
    tuneReef();
    tunePaywall();
    tuneCopy();
    if (observer && main) observer.observe(main, { childList: true, subtree: true });
  }`;
if (!phase3.includes(refreshNeedle)) throw new Error("Phase 3 refresh marker changed.");
phase3 = phase3.replace(refreshNeedle, refreshReplacement);

const insightsNeedle = 'hideSection(view, "Your insights", "#insights-box", true);';
const insightMatches = phase3.split(insightsNeedle).length - 1;
if (insightMatches !== 2) throw new Error(`Expected two Phase 3 insight visibility markers, found ${insightMatches}.`);
phase3 = phase3.split(insightsNeedle).join('hideSection(view, "Your insights", "#insights-box", !(current.premium && ready));');

const badgeRemovalNeedle = `    $$("#shop-grid .phase2-card-badge", view).forEach((badge) => badge.remove());
    buildReefStarterMessage();`;
const badgeRemovalReplacement = `    buildReefStarterMessage();`;
if (!phase3.includes(badgeRemovalNeedle)) throw new Error("Phase 3 Reef badge marker changed.");
phase3 = phase3.replace(badgeRemovalNeedle, badgeRemovalReplacement);

phase3 = `/* Phase 3 observer, starter grant, insights, Reef, and paywall ownership guards applied. */\n${phase3}`;
fs.writeFileSync(phase3Path, phase3, "utf8");

const phase3Css = fs.readFileSync(path.join(out, "phase3-ship.css"), "utf8");
const phase4 = fs.readFileSync(path.join(out, "phase4-launch.js"), "utf8");
const phase4Css = fs.readFileSync(path.join(out, "phase4-launch.css"), "utf8");
const phase5 = fs.readFileSync(path.join(out, "phase5-paywall.js"), "utf8");
const phase5Css = fs.readFileSync(path.join(out, "phase5-paywall.css"), "utf8");
const foundationCss = fs.readFileSync(path.join(out, "gillie-foundation.css"), "utf8");
const v1Css = fs.readFileSync(path.join(out, "v1/v1.css"), "utf8");
const v1ReefDashboardCss = fs.readFileSync(path.join(out, "v1/reef-dashboard.css"), "utf8");
const v1Core = fs.readFileSync(path.join(out, "v1/core.js"), "utf8");
const v1Onboarding = fs.readFileSync(path.join(out, "v1/onboarding.js"), "utf8");
const v1Sos = fs.readFileSync(path.join(out, "v1/sos.js"), "utf8");
const v1Progress = fs.readFileSync(path.join(out, "v1/progress.js"), "utf8");
const v1Reef = fs.readFileSync(path.join(out, "v1/reef.js"), "utf8");
const v1ReefDashboard = fs.readFileSync(path.join(out, "v1/reef-dashboard.js"), "utf8");
const v1Coach = fs.readFileSync(path.join(out, "v1/coach.js"), "utf8");
const v1Backup = fs.readFileSync(path.join(out, "v1/backup.js"), "utf8");
const v1StorePricing = fs.readFileSync(path.join(out, "v1/store-pricing.js"), "utf8");
const v1Accessibility = fs.readFileSync(path.join(out, "v1/accessibility.js"), "utf8");

for (const required of [
  "gillieShipPolishInstalled",
  "starter_pearls_granted",
  "ship-progress-activation",
  "YOUR PERSONAL QUIT PLAN",
  "Phase 3 observer, starter grant, insights, Reef, and paywall ownership guards applied",
  "grantStarterPearls();",
  "current.premium && ready",
  "window.__gilliePaywallRebuildInstalled",
  'overlay.classList.contains("gp-paywall-overlay")',
]) {
  if (!phase3.includes(required)) throw new Error(`Generated Phase 3 JavaScript is missing marker: ${required}`);
}
for (const required of ["#ship-status-scrim", ".ship-home-flow", ".ship-paywall", "#sos-fab"]) {
  if (!phase3Css.includes(required)) throw new Error(`Generated Phase 3 CSS is missing marker: ${required}`);
}
for (const required of ["gillieLaunchHardeningInstalled", "store_prices_localized", "launch_data_patched", "sunset", "reef_purchase_completed"]) {
  if (!phase4.includes(required)) throw new Error(`Generated Phase 4 JavaScript is missing marker: ${required}`);
}
for (const required of ["ship-reef-plus-strip", "padding-bottom:calc", "#plus-purchase::before"]) {
  if (!phase4Css.includes(required)) throw new Error(`Generated Phase 4 CSS is missing marker: ${required}`);
}
for (const required of ["gilliePaywallRebuildInstalled", "gp-paywall-sheet", "gp-paywall-scroll", "gp-purchase-dock", "gp-status-banner", "gp-benefit-svg", "gp-trial-timeline", "deriveTrialState", "A quit plan that adapts to your cravings", "Nothing charged. You can try again anytime.", "paywall_cta_tapped"]) {
  if (!phase5.includes(required)) throw new Error(`Generated Phase 5 JavaScript is missing marker: ${required}`);
}
for (const required of ["#plus-overlay.gp-paywall-overlay", ".gp-hero-card", ".gp-benefit-list", ".gp-benefit-svg", ".gp-paywall-scroll", ".gp-purchase-dock", ".gp-status-banner", ".gp-primary-cta", ".gp-trial-timeline", ".gp-topbar", "prefers-reduced-motion"]) {
  if (!phase5Css.includes(required)) throw new Error(`Generated Phase 5 CSS is missing marker: ${required}`);
}
for (const required of ["Gillie V1 visual foundation", "--g-icon-size", ".gp-benefit-icon", ".gp-status-banner.info"]) {
  if (!foundationCss.includes(required)) throw new Error(`Generated Gillie foundation CSS is missing marker: ${required}`);
}
for (const [source, marker] of [
  [v1Css, "Gillie V1 canonical screen styles"],
  [v1ReefDashboardCss, "Gillie V1 Reef Dashboard"],
  [v1ReefDashboardCss, ".v1-reef-daily-bonus"],
  [v1Core, "Gillie V1 canonical coordinator"],
  [v1Core, "late-module safe"],
  [v1Core, "gillieV1ModuleCount"],
  [v1Onboarding, "What nicotine are you quitting?"],
  [v1Sos, "I made it through this moment"],
  [v1Progress, "Always free"],
  [v1Reef, "Curated aquarium collection"],
  [v1Reef, 'PREVIEW_ENGINE = "canonical-v3-swipe"'],
  [v1Reef, 'document.addEventListener("click", handlePreviewCapture, true)'],
  [v1Reef, 'document.addEventListener("touchend", handlePreviewTouchEnd'],
  [v1Reef, "dismissPreviewWithGesture"],
  [v1ReefDashboard, 'register("reef-dashboard"'],
  [v1ReefDashboard, 'DASHBOARD_ENGINE = "reef-progression-v1"'],
  [v1ReefDashboard, "Daily Reef Care"],
  [v1ReefDashboard, "reefProgress"],
  [v1ReefDashboard, "claimDailyBonus"],
  [v1Coach, "What do you need right now?"],
  [v1Backup, 'format: "gillie-backup"'],
  [v1StorePricing, 'ENGINE = "store-pricing-v2-retryable"'],
  [v1StorePricing, "Loading Apple price"],
  [v1Accessibility, 'ENGINE = "accessibility-v1"'],
  [v1Accessibility, "normalizeViewportContent"],
]) {
  if (!source.includes(marker)) throw new Error(`Generated Gillie V1 module is missing marker: ${marker}`);
}
for (const forbidden of [".gp-cta-wrap", "position:sticky", "◔", "↺"]) {
  if (phase5.includes(forbidden) || phase5Css.includes(forbidden) || foundationCss.includes(forbidden)) {
    throw new Error(`Generated Phase 5 paywall still contains forbidden legacy marker: ${forbidden}`);
  }
}
for (const tag of ["phase3", "phase4", "phase5", "foundation", "v1-styles", "v1-reef-dashboard-styles", "v1-core", "v1-onboarding", "v1-sos", "v1-progress", "v1-reef", "v1-reef-dashboard", "v1-coach", "v1-backup", "v1-store-pricing", "v1-accessibility"]) {
  if (!html.includes(`data-gillie-${tag}=\"true\"`)) throw new Error(`Generated index is missing Gillie asset tag: ${tag}`);
}
if (html.includes('data-gillie-phase5-hotfix="true"')) throw new Error("Legacy Phase 5 hotfix stylesheet is still injected.");
if (html.includes('kicker: "Paywall is the tank"')) throw new Error("Internal paywall copy leaked into the generated app.");
if (phase3.includes('phase2-card-badge", view).forEach((badge) => badge.remove())')) throw new Error("Generated Phase 3 bundle still removes observed Reef badges.");

console.log("Injected compatibility layers plus late-safe V1 coordinator, StoreKit pricing, accessibility, Reef progression, and canonical Gillie modules.");
