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
  "phase5-paywall.js",
];

if (!fs.existsSync(indexPath)) {
  throw new Error("Launch polish injection requires www/index.html. Run prepare-capacitor-web first.");
}

for (const asset of assets) {
  const source = path.join(root, asset);
  const target = path.join(out, asset);
  if (!fs.existsSync(source)) throw new Error(`Missing launch asset: ${asset}`);
  fs.copyFileSync(source, target);
}

let html = fs.readFileSync(indexPath, "utf8");
const marker = "<!-- Gillie Phase 3 ship polish -->";
const injection = `${marker}\n<link rel="stylesheet" href="./phase3-ship.css" data-gillie-phase3="true">\n<script src="./phase3-ship.js" defer data-gillie-phase3="true"></script>\n<!-- Gillie Phase 4 launch hardening -->\n<link rel="stylesheet" href="./phase4-launch.css" data-gillie-phase4="true">\n<script src="./phase4-launch.js" defer data-gillie-phase4="true"></script>\n<!-- Gillie Phase 5 production paywall -->\n<link rel="stylesheet" href="./phase5-paywall.css" data-gillie-phase5="true">\n<script src="./phase5-paywall.js" defer data-gillie-phase5="true"></script>`;

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

/* Remove the local-function recursion fallback in the generated paywall opener. */
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

/*
 * Phase 5 owns the rebuilt paywall. Without this guard, the Phase 3 observer
 * rewrites the hero and benefit markup after Phase 5 renders it, causing the
 * narrow, vertically wrapped cards seen in TestFlight.
 */
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

/*
 * Disconnect the observer during reconciliation. Retry the starter grant on
 * every safe refresh so a person who finishes onboarding in this app session
 * immediately receives enough pearls for a first Reef purchase.
 */
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

/* Preserve useful premium insights after the activation threshold is reached. */
const insightsNeedle = 'hideSection(view, "Your insights", "#insights-box", true);';
const insightMatches = phase3.split(insightsNeedle).length - 1;
if (insightMatches !== 2) throw new Error(`Expected two Phase 3 insight visibility markers, found ${insightMatches}.`);
phase3 = phase3.split(insightsNeedle).join('hideSection(view, "Your insights", "#insights-box", !(current.premium && ready));');

/* Removing badges inside an observed shop caused a previous self-sustaining loop. */
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
for (const required of [
  "gillieLaunchHardeningInstalled",
  "store_prices_localized",
  "launch_data_patched",
  "sunset",
  "reef_purchase_completed",
]) {
  if (!phase4.includes(required)) throw new Error(`Generated Phase 4 JavaScript is missing marker: ${required}`);
}
for (const required of ["ship-reef-plus-strip", "padding-bottom:calc", "#plus-purchase::before"]) {
  if (!phase4Css.includes(required)) throw new Error(`Generated Phase 4 CSS is missing marker: ${required}`);
}
for (const required of [
  "gilliePaywallRebuildInstalled",
  "gp-paywall-sheet",
  "gp-paywall-scroll",
  "gp-purchase-dock",
  "gp-status-banner",
  "gp-benefit-svg",
  "A quit plan that adapts to you",
  "Purchase cancelled — nothing was charged.",
  "paywall_cta_tapped",
]) {
  if (!phase5.includes(required)) throw new Error(`Generated Phase 5 JavaScript is missing marker: ${required}`);
}
for (const required of [
  "#plus-overlay.gp-paywall-overlay",
  ".gp-hero-card",
  ".gp-benefit-list",
  ".gp-benefit-svg",
  ".gp-paywall-scroll",
  ".gp-purchase-dock",
  ".gp-status-banner",
  ".gp-primary-cta",
]) {
  if (!phase5Css.includes(required)) throw new Error(`Generated Phase 5 CSS is missing marker: ${required}`);
}
for (const forbidden of [".gp-cta-wrap", "position:sticky", "◔", "↺"]) {
  if (phase5.includes(forbidden) || phase5Css.includes(forbidden)) {
    throw new Error(`Generated Phase 5 paywall still contains forbidden legacy marker: ${forbidden}`);
  }
}
if (!html.includes('data-gillie-phase3="true"') || !html.includes('data-gillie-phase4="true"') || !html.includes('data-gillie-phase5="true"')) {
  throw new Error("Phase 3/4/5 tags were not injected into www/index.html.");
}
if (html.includes('kicker: "Paywall is the tank"')) throw new Error("Internal paywall copy leaked into the generated app.");
if (phase3.includes('phase2-card-badge", view).forEach((badge) => badge.remove())')) {
  throw new Error("Generated Phase 3 bundle still removes observed Reef badges.");
}

console.log("Injected Gillie Phase 3, Phase 4, and rebuilt Phase 5 paywall assets.");
