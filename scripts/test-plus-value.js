const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1/plus-value.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "v1/plus-value.css"), "utf8");
const swift = fs.readFileSync(path.join(root, "ios/App/App/GilliePurchasesPlugin.swift"), "utf8");
let installer = null;

const requiredJs = [
  'register("plus-value"',
  'ENGINE = "plus-value-v1"',
  "WEEKLY_REPORT_DAYS = 7",
  "DAILY_TARGET = 3",
  "PERFECT_TARGET = 5",
  "WELCOME_PEARLS = 250",
  "WELCOME_BUDDY_CREDITS = 1",
  "weeklyReportData",
  "Your Weekly Pattern Report",
  "claimPlusDailyChest",
  "claimPerfectCare",
  "plus_perfect_care_claimed",
  "claimPlusWelcomeBundle",
  "First tank mate included",
  "adoptIncludedBuddy",
  "A quit plan that remembers what works.",
  "Your premium living reef",
];
for (const marker of requiredJs) {
  if (!source.includes(marker)) throw new Error(`Plus value source is missing: ${marker}`);
}

for (const marker of [
  "Gillie V1 Plus Value",
  "#plus-overlay .pv-paywall-showcase",
  "#view-progress .v1-weekly-report",
  "#view-reef .pv-perfect-care",
  "#pv-plus-welcome",
]) {
  if (!styles.includes(marker)) throw new Error(`Plus value styles are missing: ${marker}`);
}

for (const marker of [
  "import Security",
  'CAPPluginMethod(name: "claimPlusWelcomeBundle"',
  "hasClaimedPlusWelcomeBundle",
  "markPlusWelcomeBundleClaimed",
  "kSecClassGenericPassword",
  '"bonusPearls": 250',
  '"buddyCredits": 1',
]) {
  if (!swift.includes(marker)) throw new Error(`Native Plus welcome contract is missing: ${marker}`);
}
if (swift.includes("clearDiagnostics(_ call") && !swift.includes("welcomeClaimService")) {
  throw new Error("Native welcome marker is not independent from diagnostics.");
}

const context = {
  console,
  setTimeout() { return 0; },
  clearTimeout() {},
  requestAnimationFrame() {},
  queueMicrotask() {},
  MutationObserver: class { observe() {} },
  document: { addEventListener() {}, documentElement: { dataset: {} }, body: { appendChild() {}, classList: { add() {}, remove() {} } } },
  window: {
    GillieV1: {
      register(name, callback) {
        if (name === "plus-value") installer = callback;
      },
    },
    Capacitor: { Plugins: {} },
  },
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, { filename: "plus-value.js" });
if (typeof installer !== "function") throw new Error("Plus value module did not register with the V1 coordinator.");

const dailyTargetMatch = source.match(/const DAILY_TARGET = (\d+);/);
const perfectTargetMatch = source.match(/const PERFECT_TARGET = (\d+);/);
if (Number(dailyTargetMatch?.[1]) !== 3) throw new Error("Plus Daily Reef Care must require exactly three actions.");
if (Number(perfectTargetMatch?.[1]) !== 5) throw new Error("Perfect care must require all five actions.");
if (!source.includes("current.pearls = Math.max(0, Number(current.pearls || 0)) + pearls")) {
  throw new Error("Welcome pearls are not persisted into app state.");
}
if (!source.includes("welcome.buddyCredits -= 1")) {
  throw new Error("Included buddy adoption does not consume its one-time credit.");
}

console.log("Gillie Plus value test passed: full paywall positioning, seven-day report, three-action Reef chest, perfect-care bonus, Keychain-backed welcome bundle, and included buddy adoption are present.");
