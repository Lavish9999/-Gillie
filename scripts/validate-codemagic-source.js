const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Codemagic contract file is missing: ${relativePath}`);
  }
  return fs.readFileSync(fullPath, "utf8");
}

function requireMarker(relativePath, marker, label = marker) {
  const source = read(relativePath);
  if (!source.includes(marker)) {
    throw new Error(`Codemagic contract failed: ${label}\nMissing marker: ${marker}\nFile: ${relativePath}`);
  }
}

function forbidMarker(relativePath, marker, label = marker) {
  const source = read(relativePath);
  if (source.includes(marker)) {
    throw new Error(`Codemagic contract failed: ${label}\nForbidden marker: ${marker}\nFile: ${relativePath}`);
  }
}

function forbidPattern(relativePath, pattern, label) {
  const source = read(relativePath);
  if (pattern.test(source)) {
    throw new Error(`Codemagic contract failed: ${label}\nFile: ${relativePath}`);
  }
}

const required = [
  ["www/phase2-polish.js", "Gillie startup, motion, and compact Home fixes applied", "Phase 2 startup polish"],
  ["www/phase2-polish.css", "phase2SpeechSafe", "Phase 2 speech safety"],
  ["www/phase3-ship.js", "gillieShipPolishInstalled", "Phase 3 install guard"],
  ["www/phase3-ship.js", "grantStarterPearls();", "Starter pearl grant"],
  ["www/phase4-launch.js", "gillieLaunchHardeningInstalled", "Phase 4 launch guard"],
  ["www/phase4-launch.js", "store_prices_localized", "Localized StoreKit prices"],
  ["www/phase5-paywall.js", "gilliePaywallRebuildInstalled", "Phase 5 paywall guard"],
  ["www/phase5-paywall.js", "A quit plan that adapts to you", "Current paywall promise"],
  ["www/phase5-paywall.js", "gp-paywall-sheet", "Paywall sheet structure"],
  ["www/phase5-paywall.css", "gp-primary-cta", "Paywall primary CTA styling"],
  ["www/gillie-foundation.css", "Gillie V1 visual foundation", "Visual foundation"],
  ["www/gillie-foundation.css", "--g-icon-size", "Icon sizing token"],
  ["www/gillie-foundation.css", "gp-status-banner.info", "Paywall status treatment"],
  ["www/phase4-launch.css", "ship-reef-plus-strip", "Reef Plus strip"],
  ["www/phase3-ship.css", "ship-status-scrim", "Status scrim"],
  ["www/index.html", "data-gillie-phase3=\"true\"", "Phase 3 asset injection"],
  ["www/index.html", "data-gillie-phase4=\"true\"", "Phase 4 asset injection"],
  ["www/index.html", "data-gillie-phase5=\"true\"", "Phase 5 asset injection"],
  ["www/index.html", "data-gillie-foundation=\"true\"", "Foundation asset injection"],
  ["www/index.html", "data-gillie-v1-reef-dashboard=\"true\"", "Reef dashboard script injection"],
  ["www/index.html", "data-gillie-v1-reef-dashboard-styles=\"true\"", "Reef dashboard style injection"],
  ["www/index.html", "data-gillie-v1-home-gillie-styles=\"true\"", "Home Gillie gill-position stylesheet injection"],
  ["www/v1/core.js", "late-module safe", "Late-safe V1 coordinator"],
  ["www/v1/core.js", "strict tab isolation", "Strict tab-isolation owner"],
  ["www/v1/core.js", "enforceViewIsolation", "Canonical tab enforcement"],
  ["www/v1/v1.css", "#main > .view[data-v1-active=\"true\"]:not([hidden])", "Single active tab display rule"],
  ["www/v1/v1.css", "#main > .view[data-v1-active=\"false\"]", "Inactive tab flex exclusion"],
  ["www/v1/home-gillie.css", "Gillie V1 Home character", "Home Gillie authored-gill contract"],
  ["www/v1/home-gillie.css", "#view-home #axo-svg g.gill[transform]", "Home Gillie scoped gill selector"],
  ["www/v1/home-gillie.css", "animation:none!important", "Home Gillie gill animation isolation"],
  ["www/v1/reef.js", "PREVIEW_ENGINE = \"canonical-v3-swipe\"", "Canonical Reef preview engine"],
  ["www/v1/reef.js", "document.addEventListener(\"click\", handlePreviewCapture, true)", "Reef capture listener"],
  ["www/v1/reef.js", "document.addEventListener(\"touchend\", handlePreviewTouchEnd", "Reef swipe completion listener"],
  ["www/v1/reef.js", "dismissPreviewWithGesture", "Reef swipe dismissal"],
  ["www/v1/reef-dashboard.js", "DASHBOARD_ENGINE = \"reef-progression-v1\"", "Reef progression engine"],
  ["www/v1/reef-dashboard.js", "Daily Reef Care", "Daily Reef Care loop"],
  ["www/v1/reef-dashboard.js", "claimDailyBonus", "Daily Reef completion reward"],
  ["www/v1/reef-dashboard.css", "Gillie V1 Reef Dashboard", "Reef dashboard styles"],
  ["www/v1/reef-dashboard.css", ".v1-reef-vault", "Reef vault styles"],
  ["www/v1/moonlit-reef.js", "PREVIEW_ART_ENGINE = \"standalone-svg-v4\"", "Standalone Moonlit preview engine"],
  ["www/v1/moonlit-reef.js", "const STANDALONE_MOON_PEARL_SVG", "Self-contained Moon Pearl artwork"],
  ["www/v1/moonlit-reef.js", "data-preview-character=\"standalone-v4\"", "Standalone Moon Pearl identity"],
  ["www/v1/moonlit-reef.css", ".moonlit-preview-character-svg", "Standalone Moon Pearl sizing"],
  ["www/v1/backup.js", "\"reefProgress\", \"moonlitReef\"", "Reef state backup coverage"],
  ["www/v1/visual-integrity.js", "v1-renewal-disclosure", "Renewal disclosure"],
  ["www/v1/visual-integrity.js", "renews automatically unless cancelled at least 24 hours", "Subscription renewal terms"],
  ["www/v1/visual-integrity.js", "v1ManageSubscription", "Active subscription management"],
  ["www/v1/visual-integrity.css", ".v1-renewal-disclosure", "Renewal disclosure styling"],
  ["www/index.html", "clearDiagnostics", "Local diagnostics reset"],
  ["www/index.html", "localStorage.clear()", "Local app reset"],
  ["ios/App/App/GillieBridgeViewController.swift", "GilliePurchases?.clearDiagnostics", "Native diagnostics reset"],
  ["ios/App/App/GillieBridgeViewController.swift", "localStorage.clear()", "Native local-storage reset"],
  ["ios/App/App/PrivacyInfo.xcprivacy", "NSPrivacyAccessedAPICategoryUserDefaults", "Privacy manifest UserDefaults declaration"],
  ["ios/App/App/PrivacyInfo.xcprivacy", "CA92.1", "Privacy manifest reason code"],
  ["ios/App/App.xcodeproj/project.pbxproj", "PrivacyInfo.xcprivacy in Resources", "Privacy manifest bundle resource"],
  ["ios/App/App.xcodeproj/project.pbxproj", "TARGETED_DEVICE_FAMILY = 1;", "iPhone-only target"],
];

for (const [file, marker, label] of required) requireMarker(file, marker, label);

const homeGillieCss = read("www/v1/home-gillie.css");
const homeGillieRule = homeGillieCss.match(/#view-home #axo-svg g\.gill\[transform\]\s*\{([\s\S]*?)\}/)?.[1] || "";
if (!homeGillieRule) throw new Error("Codemagic contract failed: Home Gillie gill rule is missing.");
if (/\btransform\s*:/.test(homeGillieRule)) {
  throw new Error("Codemagic contract failed: Home Gillie CSS must not replace authored SVG gill transforms.");
}

const moonlitSource = read("www/v1/moonlit-reef.js");
const standaloneMatch = moonlitSource.match(/const STANDALONE_MOON_PEARL_SVG = `([\s\S]*?)`;/);
if (!standaloneMatch) {
  throw new Error("Codemagic contract failed: standalone Moon Pearl SVG block is missing.");
}
const standaloneSvg = standaloneMatch[1];
const moonlitGills = standaloneSvg.match(/<path data-moonlit-gill="[^"]+"[^>]*>/g) || [];
if (moonlitGills.length !== 6) {
  throw new Error(`Codemagic contract failed: standalone Moon Pearl must contain 6 gills; found ${moonlitGills.length}.`);
}
if (moonlitGills.some((tag) => /\btransform=/.test(tag))) {
  throw new Error("Codemagic contract failed: standalone Moon Pearl gills cannot depend on transform attributes.");
}
for (const forbidden of ['class="gill', 'class="axo-core', 'class="axo-tail', 'class="axo-leg', 'class="axo-eye']) {
  if (standaloneSvg.includes(forbidden)) {
    throw new Error(`Codemagic contract failed: standalone Moon Pearl restored a global animation class: ${forbidden}`);
  }
}
forbidMarker("www/index.html", "moonlit-preview-art.js", "Obsolete Moonlit sanitizer asset must remain removed");
forbidMarker("www/index.html", "data-gillie-v1-moonlit-preview-art", "Obsolete Moonlit sanitizer tag must remain removed");
forbidMarker(
  "ios/App/App.xcodeproj/project.pbxproj",
  'TARGETED_DEVICE_FAMILY = "1,2";',
  "Gillie must not silently regain untested iPad support",
);
forbidPattern(
  "www/index.html",
  /fonts\.googleapis\.com|fonts\.gstatic\.com/,
  "Native bundle must not request third-party Google Fonts",
);
forbidMarker(
  "www/index.html",
  'data-gillie-phase5-hotfix="true"',
  "Legacy paywall hotfix must remain removed",
);

console.log(`Codemagic source contracts passed: ${required.length} named requirements verified with no stale silent greps.`);
