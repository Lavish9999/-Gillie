const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const projectPath = path.join(root, "ios", "App", "App.xcodeproj", "project.pbxproj");
const privacyPath = path.join(root, "ios", "App", "App", "PrivacyInfo.xcprivacy");
const purchasesPath = path.join(root, "ios", "App", "App", "GilliePurchasesPlugin.swift");
const bridgePath = path.join(root, "ios", "App", "App", "GillieBridgeViewController.swift");

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
requireFile(bridgePath, "Gillie bridge view controller");

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
    `/* Begin PBXFileReference section */\n\t\t${PRIVACY_FILE_REF} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };\n`,
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

const legacyPurchase = `    @objc func purchase(_ call: CAPPluginCall) {
        guard let productID = call.getString("productId"), productIDs.contains(productID) else {
            call.reject("Unknown Gillie Plus product ID.")
            return
        }

        Task {
            do {
                let products = try await loadAvailableProducts()
                guard let product = products.first(where: { $0.id == productID }) else {
                    let returnedIDs = products.map(\\.id).joined(separator: ",")
                    recordEvent(name: "purchase_product_missing", properties: [
                        "productId": productID,
                        "returned": products.count,
                        "returnedIds": returnedIDs
                    ])
                    call.reject("Apple did not return the selected Gillie Plus plan for this storefront. Requested \\(productID); returned \\(returnedIDs.isEmpty ? "none" : returnedIDs).")
                    return
                }

                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    let transaction = try checkVerified(verification)
                    await transaction.finish()
                    var status = await currentEntitlementStatus()
                    status["productId"] = transaction.productID
                    recordEvent(name: "purchase_completed_native", properties: ["productId": transaction.productID])
                    call.resolve(status)
                case .userCancelled:
                    recordEvent(name: "purchase_cancelled_native", properties: ["productId": productID])
                    call.resolve(["active": false, "verified": true, "source": "storekit2", "cancelled": true])
                case .pending:
                    recordEvent(name: "purchase_pending_native", properties: ["productId": productID])
                    call.resolve(["active": false, "verified": true, "source": "storekit2", "pending": true])
                @unknown default:
                    call.reject("Unknown purchase result.")
                }
            } catch {
                recordEvent(name: "purchase_failed_native", properties: ["productId": productID, "error": error.localizedDescription])
                call.reject("Purchase failed: \\(error.localizedDescription)")
            }
        }
    }`;

const directPurchase = `    @objc func purchase(_ call: CAPPluginCall) {
        guard let productID = call.getString("productId"), productIDs.contains(productID) else {
            call.reject("Unknown Gillie Plus product ID.")
            return
        }

        guard SKPaymentQueue.canMakePayments() else {
            recordEvent(name: "purchase_blocked_native", properties: [
                "productId": productID,
                "reason": "payments-disabled"
            ])
            call.reject("Apple purchases are disabled on this device. Check Screen Time purchase restrictions and the Apple ID signed into Media & Purchases.")
            return
        }

        Task {
            do {
                recordEvent(name: "purchase_selected_lookup_started_native", properties: ["productId": productID])
                var selectedProduct: Product?
                var lastLookupError: Error?

                for attempt in 1...3 {
                    do {
                        selectedProduct = try await Product.products(for: [productID]).first(where: { $0.id == productID })
                        recordEvent(name: "purchase_selected_lookup_attempt_native", properties: [
                            "productId": productID,
                            "attempt": attempt,
                            "found": selectedProduct != nil
                        ])
                        if selectedProduct != nil { break }
                    } catch {
                        lastLookupError = error
                        recordEvent(name: "purchase_selected_lookup_failed_native", properties: [
                            "productId": productID,
                            "attempt": attempt,
                            "error": error.localizedDescription
                        ])
                    }
                    if attempt < 3 {
                        try? await Task<Never, Never>.sleep(nanoseconds: UInt64(attempt) * 300_000_000)
                    }
                }

                guard let product = selectedProduct else {
                    let suffix = lastLookupError.map { " Last Apple error: \\($0.localizedDescription)" } ?? ""
                    recordEvent(name: "purchase_selected_product_missing_native", properties: [
                        "productId": productID,
                        "bundleId": Bundle.main.bundleIdentifier ?? "unknown"
                    ])
                    call.reject("Apple could not find \\(productID) for \\(Bundle.main.bundleIdentifier ?? "this app"). The product ID, subscription availability, Paid Apps agreement, tax, banking, and TestFlight build association must all be active.\\(suffix)")
                    return
                }

                recordEvent(name: "purchase_sheet_requested_native", properties: [
                    "productId": product.id,
                    "displayPrice": product.displayPrice
                ])
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    let transaction = try checkVerified(verification)
                    await transaction.finish()
                    var status = await currentEntitlementStatus()
                    status["productId"] = transaction.productID
                    status["checkoutMode"] = "selected-product-direct-v1"
                    recordEvent(name: "purchase_completed_native", properties: ["productId": transaction.productID])
                    call.resolve(status)
                case .userCancelled:
                    recordEvent(name: "purchase_cancelled_native", properties: ["productId": productID])
                    call.resolve(["active": false, "verified": true, "source": "storekit2", "cancelled": true, "checkoutMode": "selected-product-direct-v1"])
                case .pending:
                    recordEvent(name: "purchase_pending_native", properties: ["productId": productID])
                    call.resolve(["active": false, "verified": true, "source": "storekit2", "pending": true, "checkoutMode": "selected-product-direct-v1"])
                @unknown default:
                    call.reject("Apple returned an unknown purchase result.")
                }
            } catch {
                recordEvent(name: "purchase_failed_native", properties: [
                    "productId": productID,
                    "stage": "selected-product-direct-v1",
                    "error": error.localizedDescription
                ])
                call.reject("Apple checkout failed for \\(productID): \\(error.localizedDescription)")
            }
        }
    }`;

if (purchases.includes(legacyPurchase)) {
  purchases = purchases.replace(legacyPurchase, directPurchase);
}
for (const marker of [
  "purchase_selected_lookup_started_native",
  "purchase_sheet_requested_native",
  "selected-product-direct-v1",
  "SKPaymentQueue.canMakePayments()",
  "Product.products(for: [productID])",
]) {
  if (!purchases.includes(marker)) throw new Error(`Gillie native direct checkout is missing marker: ${marker}`);
}
fs.writeFileSync(purchasesPath, purchases, "utf8");

const bridge = fs.readFileSync(bridgePath, "utf8");
for (const marker of [
  "GilliePurchases?.clearDiagnostics",
  "localStorage.clear()",
  "progress, preferences, and local diagnostics",
  "GillieWelcomeRecoveryPlugin",
  'jsName = "GillieWelcomeRecovery"',
  'CAPPluginMethod(name: "recoverWelcomeBundle"',
  "gillie.plus.welcome.installID",
  "recoveryUsed",
]) {
  if (!bridge.includes(marker)) throw new Error(`Native release bridge is missing marker: ${marker}`);
}
if (bridge.includes("localStorage.removeItem('gillie_v1')")) {
  throw new Error("Native startup recovery still performs a partial Gillie reset.");
}

console.log("Prepared iOS release project: privacy manifest embedded, V1 scoped to iPhone, selected-product StoreKit checkout generated, resets complete, and welcome recovery registered.");
