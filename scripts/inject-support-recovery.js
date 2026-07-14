const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const indexPath = path.join(out, "index.html");
const assets = [
  "v1/support-recovery.css",
  "v1/launch-experience.css",
  "v1/paywall-runtime-fix.css",
  "v1/sos-support.js",
  "v1/welcome-recovery.js",
  "v1/purchase-flow.js",
  "v1/entitlement-sync.js",
  "v1/theme-access.js",
  "v1/theme-engine.js",
  "v1/theme-paint.js",
  "v1/launch-experience.js",
  "v1/launch-handoff.js",
  "v1/paywall-runtime-fix.js",
  "v1/purchase-director.js",
];

if (!fs.existsSync(indexPath)) {
  throw new Error("Launch, SOS support, authoritative Plus checkout, entitlement sync, theme access, and theme paint injection requires www/index.html.");
}

for (const asset of assets) {
  const source = path.join(root, asset);
  const target = path.join(out, asset);
  if (!fs.existsSync(source)) throw new Error(`Missing launch/support asset: ${asset}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

let html = fs.readFileSync(indexPath, "utf8");
const marker = "<!-- Gillie launch, SOS support, Plus recovery, purchase flow, and theme engine -->";
const themeMarker = "<!-- Gillie SOS support, Plus recovery, purchase flow, and theme engine -->";
const purchaseMarker = "<!-- Gillie SOS support, Plus recovery, and purchase flow -->";
const legacyMarker = "<!-- Gillie SOS support and Plus welcome recovery -->";
const injection = `${marker}
<link rel="stylesheet" href="./v1/support-recovery.css" data-gillie-v1-support-recovery-styles="true">
<link rel="stylesheet" href="./v1/launch-experience.css" data-gillie-v1-launch-experience-styles="true">
<link rel="stylesheet" href="./v1/paywall-runtime-fix.css" data-gillie-v1-paywall-runtime-fix-styles="true">
<script src="./v1/sos-support.js" defer data-gillie-v1-sos-support="true"></script>
<script src="./v1/welcome-recovery.js" defer data-gillie-v1-welcome-recovery="true"></script>
<script src="./v1/purchase-flow.js" defer data-gillie-v1-purchase-flow="true"></script>
<script src="./v1/entitlement-sync.js" defer data-gillie-v1-entitlement-sync="true"></script>
<script src="./v1/theme-access.js" defer data-gillie-v1-theme-access="true"></script>
<script src="./v1/theme-engine.js" defer data-gillie-v1-theme-engine="true"></script>
<script src="./v1/theme-paint.js" defer data-gillie-v1-theme-paint="true"></script>
<script src="./v1/launch-experience.js" defer data-gillie-v1-launch-experience="true"></script>
<script src="./v1/launch-handoff.js" defer data-gillie-v1-launch-handoff="true"></script>
<script src="./v1/paywall-runtime-fix.js" defer data-gillie-v1-paywall-runtime-fix="true"></script>
<script src="./v1/purchase-director.js" defer data-gillie-v1-purchase-director="true"></script>`;

if (html.includes(themeMarker) && !html.includes(marker)) {
  const themePattern = /<!-- Gillie SOS support, Plus recovery, purchase flow, and theme engine -->[\s\S]*?<script src="\.\/v1\/theme-engine\.js" defer data-gillie-v1-theme-engine="true"><\/script>/;
  if (!themePattern.test(html)) throw new Error("Theme-engine injection marker changed.");
  html = html.replace(themePattern, injection);
} else if (html.includes(purchaseMarker) && !html.includes(marker)) {
  const purchasePattern = /<!-- Gillie SOS support, Plus recovery, and purchase flow -->[\s\S]*?<script src="\.\/v1\/purchase-flow\.js" defer data-gillie-v1-purchase-flow="true"><\/script>/;
  if (!purchasePattern.test(html)) throw new Error("Purchase-flow injection marker changed.");
  html = html.replace(purchasePattern, injection);
} else if (html.includes(legacyMarker) && !html.includes(marker)) {
  const legacyPattern = /<!-- Gillie SOS support and Plus welcome recovery -->[\s\S]*?<script src="\.\/v1\/welcome-recovery\.js" defer data-gillie-v1-welcome-recovery="true"><\/script>/;
  if (!legacyPattern.test(html)) throw new Error("Legacy support/recovery injection marker changed.");
  html = html.replace(legacyPattern, injection);
} else if (!html.includes(marker)) {
  if (!html.includes("</body>")) throw new Error("Cannot inject launch/support assets: missing </body>.");
  html = html.replace("</body>", `${injection}
</body>`);
} else {
  const blockPattern = /<!-- Gillie launch, SOS support, Plus recovery, purchase flow, and theme engine -->[\s\S]*?(?=\n<\/body>)/;
  if (!blockPattern.test(html)) throw new Error("Current launch/support injection block changed.");
  html = html.replace(blockPattern, injection);
}

for (const markerText of [
  'data-gillie-v1-support-recovery-styles="true"',
  'data-gillie-v1-launch-experience-styles="true"',
  'data-gillie-v1-paywall-runtime-fix-styles="true"',
  'data-gillie-v1-sos-support="true"',
  'data-gillie-v1-welcome-recovery="true"',
  'data-gillie-v1-purchase-flow="true"',
  'data-gillie-v1-entitlement-sync="true"',
  'data-gillie-v1-theme-access="true"',
  'data-gillie-v1-theme-engine="true"',
  'data-gillie-v1-theme-paint="true"',
  'data-gillie-v1-launch-experience="true"',
  'data-gillie-v1-launch-handoff="true"',
  'data-gillie-v1-paywall-runtime-fix="true"',
  'data-gillie-v1-purchase-director="true"',
]) {
  if (!html.includes(markerText)) throw new Error(`Generated index is missing launch/support marker: ${markerText}`);
}

const sos = fs.readFileSync(path.join(out, "v1", "sos-support.js"), "utf8");
const recovery = fs.readFileSync(path.join(out, "v1", "welcome-recovery.js"), "utf8");
const purchaseFlow = fs.readFileSync(path.join(out, "v1", "purchase-flow.js"), "utf8");
const purchaseDirector = fs.readFileSync(path.join(out, "v1", "purchase-director.js"), "utf8");
const entitlementSync = fs.readFileSync(path.join(out, "v1", "entitlement-sync.js"), "utf8");
const themeAccess = fs.readFileSync(path.join(out, "v1", "theme-access.js"), "utf8");
const themeEngine = fs.readFileSync(path.join(out, "v1", "theme-engine.js"), "utf8");
const themePaint = fs.readFileSync(path.join(out, "v1", "theme-paint.js"), "utf8");
const launchExperience = fs.readFileSync(path.join(out, "v1", "launch-experience.js"), "utf8");
const launchHandoff = fs.readFileSync(path.join(out, "v1", "launch-handoff.js"), "utf8");
const paywallRuntime = fs.readFileSync(path.join(out, "v1", "paywall-runtime-fix.js"), "utf8");
const launchStyles = fs.readFileSync(path.join(out, "v1", "launch-experience.css"), "utf8");
const paywallStyles = fs.readFileSync(path.join(out, "v1", "paywall-runtime-fix.css"), "utf8");
for (const required of ["1-800-QUIT-NOW", "QUITNOW to 333888", "smokefree.gov", "Message someone I trust"]) {
  if (!sos.includes(required)) throw new Error(`Generated SOS support module is missing marker: ${required}`);
}
for (const required of ["welcome-recovery-v1", "recoverWelcomeBundle", "plus_welcome_bundle_recovered", "This recovery can only happen once on this device"]) {
  if (!recovery.includes(required)) throw new Error(`Generated welcome recovery module is missing marker: ${required}`);
}
for (const required of [
  "purchase-flow-v1",
  "purchase-flow-v3-production-branch",
  "Apple returned zero Gillie Plus products",
  "STORE_PRODUCTS_EMPTY",
  "Copy purchase details",
  "entitlementChanged",
  "Confirming your Apple subscription",
  "Purchase pending with Apple",
  "gillie:purchase-flow-settled",
]) {
  if (!purchaseFlow.includes(required)) throw new Error(`Generated purchase-flow module is missing marker: ${required}`);
}
new Function(purchaseFlow);
for (const required of [
  "purchase-director-v1-authoritative",
  "stopImmediatePropagation",
  "PRODUCT_LOOKUP_TIMEOUT",
  "native.purchase({ productId: product.id })",
  "GilliePurchaseDirector",
]) {
  if (!purchaseDirector.includes(required)) throw new Error(`Generated purchase director is missing marker: ${required}`);
}
new Function(purchaseDirector);
for (const required of ["entitlement-sync-v1-always-on", "app-boot", "foreground", "entitlementChanged", "gillie:entitlement-updated", "GillieEntitlementSync"]) {
  if (!entitlementSync.includes(required)) throw new Error(`Generated entitlement-sync module is missing marker: ${required}`);
}
new Function(entitlementSync);
for (const required of ["theme-access-v1-basic-free", "sunset", "abyss", "sakura", "GillieThemeAccess"]) {
  if (!themeAccess.includes(required)) throw new Error(`Generated theme-access module is missing marker: ${required}`);
}
new Function(themeAccess);
for (const required of [
  "theme-engine-v1",
  "#theme-row [data-theme]",
  "current.theme = theme.id",
  "gillie:theme-applied",
  "GillieThemeEngine",
]) {
  if (!themeEngine.includes(required)) throw new Error(`Generated theme-engine module is missing marker: ${required}`);
}
for (const required of [
  "theme-paint-v1",
  "placeLayerAboveMurk",
  "--gillie-theme-water-top",
  "reef_theme_painted",
  "gillie:theme-painted",
  "GillieThemePaint",
]) {
  if (!themePaint.includes(required)) throw new Error(`Generated theme-paint module is missing marker: ${required}`);
}
new Function(themePaint);
for (const required of [
  "launch-experience-v1",
  "Stay clean · Keep the water clear",
  "first_setup_rating_prompt_shown",
  "requestReview",
  "Rate Gillie",
  "GillieLaunchExperience",
]) {
  if (!launchExperience.includes(required)) throw new Error(`Generated launch experience module is missing marker: ${required}`);
}
for (const required of ["launch-handoff-v1-single-intro", "gillie-boot-pending", "launch_handoff_released"]) {
  if (!launchHandoff.includes(required)) throw new Error(`Generated launch handoff is missing marker: ${required}`);
}
new Function(launchHandoff);
for (const required of ["paywall-runtime-fix-v1", "css-only-system-chrome-v2", "single-open-storekit-probe", "Apple billing connected", "Copy details", "ensurePaywallSurface", "GilliePaywallRuntimeFix"]) {
  if (!paywallRuntime.includes(required)) throw new Error(`Generated paywall runtime is missing marker: ${required}`);
}
if (paywallRuntime.includes("bridge()?.setInterfaceStyle?.(")) {
  throw new Error("Generated paywall runtime still calls the native interface-style bridge that covers the Capacitor WebView.");
}
new Function(paywallRuntime);
for (const required of [".gillie-launch-intro", ".gillie-rating-overlay", "gillieLaunchSwimIn", "prefers-reduced-motion"]) {
  if (!launchStyles.includes(required)) throw new Error(`Generated launch styles are missing marker: ${required}`);
}
for (const required of ["--gp-system-top", ".gp-store-health", "safe-area-inset-top", "orientation:landscape"]) {
  if (!paywallStyles.includes(required)) throw new Error(`Generated paywall runtime styles are missing marker: ${required}`);
}

fs.writeFileSync(indexPath, html, "utf8");
console.log("Injected one animated launch, one authoritative Plus checkout path, CSS-only safe chrome, entitlement sync, working themes, and Reef rewards.");
