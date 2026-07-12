const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const projectPath = path.join(root, "ios", "App", "App.xcodeproj", "project.pbxproj");
const privacyPath = path.join(root, "ios", "App", "App", "PrivacyInfo.xcprivacy");
const purchasesPath = path.join(root, "ios", "App", "App", "GilliePurchasesPlugin.swift");

const PRIVACY_FILE_REF = "8A1B30002C00000300AA0001";
const PRIVACY_BUILD_FILE = "8A1B30012C00000300AA0001";

function requireFile(file, label) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${label}: ${path.relative(root, file)}`);
}

function replaceOnce(source, needle, replacement, label) {
  const matches = source.split(needle).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected exactly one marker, found ${matches}.`);
  return source.replace(needle, replacement);
}

requireFile(projectPath, "Xcode project");
requireFile(privacyPath, "app privacy manifest");
requireFile(purchasesPath, "Gillie purchases plugin");

const privacy = fs.readFileSync(privacyPath, "utf8");
for (const marker of [
  "NSPrivacyAccessedAPICategoryUserDefaults",
  "CA92.1",
  "NSPrivacyCollectedDataTypes",
  "NSPrivacyTracking",
]) {
  if (!privacy.includes(marker)) throw new Error(`PrivacyInfo.xcprivacy is missing required marker: ${marker}`);
}

let project = fs.readFileSync(projectPath, "utf8");

if (!project.includes(`${PRIVACY_BUILD_FILE} /* PrivacyInfo.xcprivacy in Resources */`)) {
  project = replaceOnce(
    project,
    "/* Begin PBXBuildFile section */\n",
    `/* Begin PBXBuildFile section */\n\t\t${PRIVACY_BUILD_FILE} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${PRIVACY_FILE_REF} /* PrivacyInfo.xcprivacy */; };\n`,
    "Privacy manifest build-file insertion",
  );
}

if (!project.includes(`${PRIVACY_FILE_REF} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference;`)) {
  project = replaceOnce(
    project,
    "/* Begin PBXFileReference section */\n",
    `/* Begin PBXFileReference section */\n\t\t${PRIVACY_FILE_REF} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = \"<group>\"; };\n`,
    "Privacy manifest file-reference insertion",
  );
}

if (!project.includes(`\t\t\t\t${PRIVACY_FILE_REF} /* PrivacyInfo.xcprivacy */,`)) {
  project = replaceOnce(
    project,
    "\t\t\t\t504EC3131FED79650016851F /* Info.plist */,\n",
    `\t\t\t\t504EC3131FED79650016851F /* Info.plist */,\n\t\t\t\t${PRIVACY_FILE_REF} /* PrivacyInfo.xcprivacy */,\n`,
    "Privacy manifest App-group insertion",
  );
}

if (!project.includes(`\t\t\t\t${PRIVACY_BUILD_FILE} /* PrivacyInfo.xcprivacy in Resources */,`)) {
  project = replaceOnce(
    project,
    "\t\t\t\t504EC30D1FED79650016851F /* Main.storyboard in Resources */,\n",
    `\t\t\t\t504EC30D1FED79650016851F /* Main.storyboard in Resources */,\n\t\t\t\t${PRIVACY_BUILD_FILE} /* PrivacyInfo.xcprivacy in Resources */,\n`,
    "Privacy manifest Resources-phase insertion",
  );
}

const universalTarget = 'TARGETED_DEVICE_FAMILY = "1,2";';
const universalCount = project.split(universalTarget).length - 1;
if (universalCount > 0) project = project.split(universalTarget).join("TARGETED_DEVICE_FAMILY = 1;");

for (const marker of [
  `${PRIVACY_BUILD_FILE} /* PrivacyInfo.xcprivacy in Resources */`,
  `${PRIVACY_FILE_REF} /* PrivacyInfo.xcprivacy */`,
  "TARGETED_DEVICE_FAMILY = 1;",
]) {
  if (!project.includes(marker)) throw new Error(`Prepared Xcode project is missing release marker: ${marker}`);
}
if (project.includes(universalTarget)) throw new Error("Xcode target still declares universal iPhone/iPad support.");
fs.writeFileSync(projectPath, project, "utf8");

let purchases = fs.readFileSync(purchasesPath, "utf8");
const clearBefore = `    @objc func clearDiagnostics(_ call: CAPPluginCall) {
        defaults.removeObject(forKey: eventLogKey)
        defaults.removeObject(forKey: metricLogKey)
        call.resolve(["cleared": true])
    }`;
const clearAfter = `    @objc func clearDiagnostics(_ call: CAPPluginCall) {
        defaults.removeObject(forKey: eventLogKey)
        defaults.removeObject(forKey: metricLogKey)
        defaults.removeObject(forKey: installIDKey)
        call.resolve(["cleared": true])
    }`;
if (purchases.includes(clearBefore)) purchases = purchases.replace(clearBefore, clearAfter);
if (!purchases.includes("defaults.removeObject(forKey: installIDKey)")) {
  throw new Error("Gillie native diagnostics clear action does not remove the local install identifier.");
}
fs.writeFileSync(purchasesPath, purchases, "utf8");

console.log("Prepared iOS release project: privacy manifest embedded, V1 scoped to iPhone, and local diagnostics fully erasable.");
