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

const packageJson = JSON.parse(read("package.json"));
const preparePipeline = String(packageJson.scripts?.["prepare:cap"] || "");
const pipelineOrder = [
  "node scripts/prepare-capacitor-web.js",
  "node scripts/inject-phase3.js",
  "node scripts/apply-release-safety.js",
  "node scripts/inject-reef-layout-fixes.js",
  "node scripts/inject-moonlit-reef.js",
  "node scripts/inject-visual-integrity.js",
  "node scripts/prepare-ios-release.js",
];
let previousPipelineIndex = -1;
for (const command of pipelineOrder) {
  const index = preparePipeline.indexOf(command);
  if (index < 0 || index <= previousPipelineIndex) {
    throw new Error(`Codemagic contract failed: prepare:cap build order is invalid near ${command}.`);
  }
  previousPipelineIndex = index;
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
  ["www/phase5-paywall.js", "Spot the times cravings may be more likely", "Probability-based paywall subtitle"],
  ["www/phase5-paywall.js", "See when cravings may be more likely", "Probability-based paywall benefit"],
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
  ["www/index.html", "data-gillie-v1-home-gillie=\"true\"", "Gillie anatomy runtime injection"],
  ["www/index.html", "data-gillie-v1-home-gillie-styles=\"true\"", "Gillie anatomy stylesheet injection"],
  ["www/v1/core.js", "late-module safe", "Late-safe V1 coordinator"],
  ["www/v1/core.js", "strict tab isolation", "Strict tab-isolation owner"],
  ["www/v1/core.js", "enforceViewIsolation", "Canonical tab enforcement"],
  ["www/v1/v1.css", "#main > .view[data-v1-active=\"true\"]:not([hidden])", "Single active tab display rule"],
  ["www/v1/v1.css", "#main > .view[data-v1-active=\"false\"]", "Inactive tab flex exclusion"],
  ["www/v1/progress.js", "Advanced patterns and planning", "Safer premium Progress boundary"],
  ["www/v1/home-gillie.js", "home-gillie-direct-gills-v3", "Gillie direct-coordinate engine"],
  ["www/v1/home-gillie.js", "directGillMarkup", "Gillie direct frond source"],
  ["www/v1/home-gillie.js", "replaceHomeGills", "Gillie legacy replacement"],
  ["www/v1/home-gillie.js", "ns.startsWith(\"reefpreview-\")", "Full-size Reef preview namespace coverage"],
  ["www/v1/home-gillie.js", "data-home-gill=\"left-upper\"", "Gillie left upper frond"],
  ["www/v1/home-gillie.js", "data-home-gill=\"right-lower\"", "Gillie right lower frond"],
  ["www/v1/home-gillie.js", "matches.length !== 6", "Gillie six-group atomic guard"],
  ["www/v1/home-gillie.js", "window.axoSVG = hardenedAxoSVG", "Gillie renderer replacement"],
  ["www/v1/home-gillie.js", "typeof renderAxo === \"function\"", "Home Gillie immediate repaint"],
  ["www/v1/home-gillie.css", "direct-coordinate six-frond gills", "Gillie direct anatomy styles"],
  ["www/v1/home-gillie.css", "#view-home #axo-svg [data-home-gill]", "Home direct-gill selector"],
  ["www/v1/home-gillie.css", "#phase2-tank-preview .v1-preview-axo-svg [data-home-gill]", "Reef preview direct-gill selector"],
  ["www/v1/home-gillie.css", "#phase2-tank-preview .v1-preview-axo-svg .axo-gill-vein", "Reef preview vein selector"],
  ["www/v1/reef.js", "PREVIEW_ENGINE = \"canonical-v3-swipe\"", "Canonical Reef preview engine"],
  ["www/v1/reef.js", "document.addEventListener(\"click\", handlePreviewCapture, true)", "Reef capture listener"],
  ["www/v1/reef.js", "document.addEventListener(\"touchend\", handlePreviewTouchEnd", "Reef swipe completion listener"],
  ["www/v1/reef.js", "dismissPreviewWithGesture", "Reef swipe dismissal"],
  ["www/v1/reef-dashboard.js", "DASHBOARD_ENGINE = \"reef-progression-v1\"", "Reef progression engine"],
  ["www/v1/reef-dashboard.js", "Daily Reef Care", "Reef daily care loop"],
  ["www/v1/reef-dashboard.js", "claimDailyBonus", "Reef completion reward"],
  ["www/v1/reef-dashboard.css", "Gillie V1 Reef Dashboard", "Reef dashboard styles"],
  ["www/v1/reef-dashboard.css", ".v1-reef-vault", "Reef vault styles"],
  ["www/v1/moonlit-reef.js", "PREVIEW_ART_ENGINE = \"standalone-svg-v4\"", "Standalone Moonlit preview engine"],
  ["www/v1/moonlit-reef.js", "const STANDALONE_MOON_PEARL_SVG", "Self-contained Moon Pearl artwork"],
  ["www/v1/moonlit-reef.js", "data-preview-character=\"standalone-v4\"", "Standalone Moon Pearl identity"],
  ["www/v1/moonlit-reef.css", ".moonlit-preview-character-svg", "Standalone Moon Pearl sizing"],
  ["www/v1/backup.js", "\"reefProgress\", \"moonlitReef\"", "Reef state backup coverage"],
  ["www/v1/visual-integrity.js", "normalizeHealthClaimCopy", "Paywall wellness-claim normalizer"],
  ["www/v1/visual-integrity.js", "Spot the times cravings may be more likely", "Runtime probability-based paywall copy"],
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

const gillCss = read("www/v1/home-gillie.css");
const sharedGillRule = gillCss.match(/#view-home #axo-svg \[data-home-gill\],[\s\S]*?\{([\s\S]*?)\}/)?.[1] || "";
if (!sharedGillRule) throw new Error("Codemagic contract failed: shared direct-gill rule is missing.");
if (/\btransform\s*:/.test(sharedGillRule)) {
  throw new Error("Codemagic contract failed: direct-gill CSS cannot add transform positioning.");
}

const gillJs = read("www/v1/home-gillie.js");
const directGillTags = gillJs.match(/<path class="axo-gill-frond" data-home-gill="[^"]+"[^>]*>/g) || [];
if (directGillTags.length !== 6) {
  throw new Error(`Codemagic contract failed: Gillie anatomy source must contain 6 direct fronds; found ${directGillTags.length}.`);
}
if (directGillTags.some((tag) => /\btransform=/.test(tag))) {
  throw new Error("Codemagic contract failed: Gillie direct fronds cannot use transform attributes.");
}
if (!gillJs.includes("if (matches.length !== 6)")) {
  throw new Error("Codemagic contract failed: Gillie can partially replace the legacy six-gill anatomy.");
}
if (!gillJs.includes('ns === "main" || ns.startsWith("reefpreview-")')) {
  throw new Error("Codemagic contract failed: full-size Reef preview is not covered by the direct-gill renderer.");
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

forbidMarker("www/v1/progress.js", "Advanced predictions", "Overly predictive Progress label must remain removed");
forbidMarker("www/phase5-paywall.js", "Know the hard moment before it arrives", "Overly certain paywall subtitle must remain removed");
forbidMarker("www/phase5-paywall.js", "Know when cravings are most likely to hit", "Overly certain paywall benefit must remain removed");
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

console.log(`Codemagic source contracts passed: ${required.length} named requirements verified with generated-before-safety ordering, safer wellness copy, and direct-coordinate Home, Reef-preview, and Moonlit anatomy.`);
