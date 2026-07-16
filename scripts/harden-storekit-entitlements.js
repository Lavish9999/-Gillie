const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const purchasesPath = path.join(root, "ios", "App", "App", "GilliePurchasesPlugin.swift");

if (!fs.existsSync(purchasesPath)) {
  throw new Error(`Missing Gillie purchases plugin: ${purchasesPath}`);
}

let source = fs.readFileSync(purchasesPath, "utf8");

function replaceExactlyOnce(input, needle, replacement, label) {
  if (input.includes(replacement)) return input;
  const count = input.split(needle).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one original block, found ${count}.`);
  }
  return input.replace(needle, replacement);
}

const cacheKeyLine = '    private let entitlementCacheKey = "gillie.storekit.entitlement"';
const cacheKeyWithGrace = `${cacheKeyLine}\n    private let entitlementGracePeriod: TimeInterval = 5 * 60`;
if (!source.includes("private let entitlementGracePeriod")) {
  source = replaceExactlyOnce(
    source,
    cacheKeyLine,
    cacheKeyWithGrace,
    "StoreKit entitlement grace-period insertion",
  );
}

const laggyPurchaseSuccess = `                case .success(let verification):
                    let transaction = try checkVerified(verification)
                    await transaction.finish()
                    var status = await currentEntitlementStatus()
                    status["productId"] = transaction.productID
                    status["checkoutMode"] = "selected-product-direct-v1"
                    recordEvent(name: "purchase_completed_native", properties: ["productId": transaction.productID])
                    call.resolve(status)`;

const authoritativePurchaseSuccess = `                case .success(let verification):
                    let transaction = try checkVerified(verification)
                    guard transaction.revocationDate == nil else {
                        recordEvent(name: "purchase_rejected_native", properties: [
                            "productId": transaction.productID,
                            "reason": "revoked-transaction"
                        ])
                        call.reject("Apple returned a revoked subscription transaction.")
                        return
                    }
                    if let expiration = transaction.expirationDate, expiration <= Date() {
                        recordEvent(name: "purchase_rejected_native", properties: [
                            "productId": transaction.productID,
                            "reason": "expired-transaction"
                        ])
                        call.reject("Apple returned an expired subscription transaction.")
                        return
                    }

                    var status: [String: Any] = [
                        "active": true,
                        "verified": true,
                        "source": "storekit2-purchase",
                        "productId": transaction.productID,
                        "transactionId": String(transaction.id),
                        "checkoutMode": "verified-purchase-authoritative-v2",
                        "checkedAt": Date().timeIntervalSince1970 * 1000
                    ]
                    if let expiration = transaction.expirationDate {
                        status["expiresAt"] = expiration.timeIntervalSince1970 * 1000
                    }
                    cacheEntitlement(status)
                    await transaction.finish()
                    recordEvent(name: "purchase_completed_native", properties: [
                        "productId": transaction.productID,
                        "checkoutMode": "verified-purchase-authoritative-v2"
                    ])
                    await MainActor.run {
                        self.notifyListeners("entitlementChanged", data: status)
                    }
                    call.resolve(status)`;

source = replaceExactlyOnce(
  source,
  laggyPurchaseSuccess,
  authoritativePurchaseSuccess,
  "Verified StoreKit purchase handling",
);

const brittleRestore = `    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                let status = await currentEntitlementStatus()
                recordEvent(name: "restore_completed_native", properties: ["active": status["active"] as? Bool ?? false])
                call.resolve(status)
            } catch {
                recordEvent(name: "restore_failed_native", properties: ["error": error.localizedDescription])
                call.reject("Restore failed: \\(error.localizedDescription)")
            }
        }
    }`;

const resilientRestore = `    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            var localStatus = await currentEntitlementStatus()
            if localStatus["active"] as? Bool == true {
                localStatus["restoreMode"] = "current-entitlement-before-sync-v2"
                recordEvent(name: "restore_completed_native", properties: [
                    "active": true,
                    "mode": "current-entitlement-before-sync-v2"
                ])
                call.resolve(localStatus)
                return
            }

            do {
                try await AppStore.sync()
                var status = await currentEntitlementStatus()
                status["restoreMode"] = "restore-sync-fallback-v2"
                recordEvent(name: "restore_completed_native", properties: [
                    "active": status["active"] as? Bool ?? false,
                    "mode": "restore-sync-fallback-v2"
                ])
                call.resolve(status)
            } catch {
                var fallbackStatus = await currentEntitlementStatus()
                if fallbackStatus["active"] as? Bool == true {
                    fallbackStatus["restoreMode"] = "entitlement-recovered-after-sync-error-v2"
                    fallbackStatus["syncWarning"] = error.localizedDescription
                    recordEvent(name: "restore_recovered_native", properties: [
                        "active": true,
                        "mode": "entitlement-recovered-after-sync-error-v2"
                    ])
                    call.resolve(fallbackStatus)
                    return
                }
                recordEvent(name: "restore_failed_native", properties: ["error": error.localizedDescription])
                call.reject("Restore failed: \\(error.localizedDescription)")
            }
        }
    }`;

source = replaceExactlyOnce(
  source,
  brittleRestore,
  resilientRestore,
  "Resilient StoreKit restore handling",
);

const immediateOnlyEntitlement = `    private func currentEntitlementStatus() async -> [String: Any] {
        for await result in Transaction.currentEntitlements {
            guard let transaction = try? checkVerified(result) else { continue }
            guard productIDs.contains(transaction.productID), transaction.revocationDate == nil else { continue }
            if let expiration = transaction.expirationDate, expiration <= Date() { continue }

            var status: [String: Any] = [
                "active": true,
                "verified": true,
                "source": "storekit2",
                "productId": transaction.productID,
                "checkedAt": Date().timeIntervalSince1970 * 1000
            ]
            if let expiration = transaction.expirationDate {
                status["expiresAt"] = expiration.timeIntervalSince1970 * 1000
            }
            cacheEntitlement(status)
            return status
        }

        let status: [String: Any] = [
            "active": false,
            "verified": true,
            "source": "storekit2",
            "checkedAt": Date().timeIntervalSince1970 * 1000
        ]
        cacheEntitlement(status)
        return status
    }`;

const graceAwareEntitlement = `    private func currentEntitlementStatus() async -> [String: Any] {
        for await result in Transaction.currentEntitlements {
            guard let transaction = try? checkVerified(result) else { continue }
            guard productIDs.contains(transaction.productID), transaction.revocationDate == nil else { continue }
            if let expiration = transaction.expirationDate, expiration <= Date() { continue }

            var status: [String: Any] = [
                "active": true,
                "verified": true,
                "source": "storekit2",
                "productId": transaction.productID,
                "checkedAt": Date().timeIntervalSince1970 * 1000
            ]
            if let expiration = transaction.expirationDate {
                status["expiresAt"] = expiration.timeIntervalSince1970 * 1000
            }
            cacheEntitlement(status)
            return status
        }

        if let cached = recentCachedActiveEntitlement() {
            recordEvent(name: "entitlement_cache_grace_native", properties: [
                "productId": cached["productId"] as? String ?? "unknown"
            ])
            return cached
        }

        let status: [String: Any] = [
            "active": false,
            "verified": true,
            "source": "storekit2",
            "checkedAt": Date().timeIntervalSince1970 * 1000
        ]
        cacheEntitlement(status)
        return status
    }

    private func recentCachedActiveEntitlement() -> [String: Any]? {
        guard var cached = defaults.dictionary(forKey: entitlementCacheKey),
              cached["active"] as? Bool == true,
              let checkedAt = (cached["checkedAt"] as? NSNumber)?.doubleValue else {
            return nil
        }

        let now = Date().timeIntervalSince1970 * 1000
        let age = now - checkedAt
        guard age >= 0, age <= entitlementGracePeriod * 1000 else { return nil }
        if let expiresAt = (cached["expiresAt"] as? NSNumber)?.doubleValue, expiresAt <= now {
            return nil
        }

        cached["source"] = "storekit2-cache-grace"
        cached["checkedAt"] = now
        cached["cacheGrace"] = true
        return cached
    }`;

source = replaceExactlyOnce(
  source,
  immediateOnlyEntitlement,
  graceAwareEntitlement,
  "StoreKit current-entitlement grace handling",
);

for (const marker of [
  "verified-purchase-authoritative-v2",
  "restore-sync-fallback-v2",
  "entitlement-recovered-after-sync-error-v2",
  "storekit2-cache-grace",
  "private let entitlementGracePeriod: TimeInterval = 5 * 60",
]) {
  if (!source.includes(marker)) {
    throw new Error(`Hardened StoreKit bridge is missing marker: ${marker}`);
  }
}

if (source.includes("await transaction.finish()\n                    var status = await currentEntitlementStatus()")) {
  throw new Error("The StoreKit bridge still discards a verified purchase before resolving entitlement.");
}

fs.writeFileSync(purchasesPath, source, "utf8");
console.log("Hardened StoreKit entitlements: verified purchases unlock immediately, restore tolerates sync errors, and fresh purchase state survives StoreKit propagation delay.");
