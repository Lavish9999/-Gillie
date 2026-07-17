import Capacitor
import Foundation
import Security
import StoreKit
import UIKit

@objc(GilliePurchasesPlugin)
public class GilliePurchasesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GilliePurchasesPlugin"
    public let jsName = "GilliePurchases"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getEntitlementStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "claimPlusWelcomeBundle", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "haptic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "trackEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDiagnostics", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearDiagnostics", returnType: CAPPluginReturnPromise)
    ]

    private let productIDs = ["gillie.plus.monthly", "gillie.plus.yearly"]
    private let defaults = UserDefaults.standard
    private let entitlementCacheKey = "gillie.storekit.entitlement"
    private let entitlementGracePeriod: TimeInterval = 5 * 60
    private let eventLogKey = "gillie.diagnostics.events"
    private let metricLogKey = "gillie.diagnostics.metricPayloads"
    private let installIDKey = "gillie.diagnostics.installID"
    private let welcomeClaimService = "com.gillie.plus.welcome"
    private let welcomeClaimAccount = "bundle.v1"
    private let welcomeClaimFallbackKey = "gillie.plus.welcome.claimed.v1"
    private var transactionListener: Task<Void, Never>?

    public override func load() {
        super.load()
        ensureInstallID()
        transactionListener = Task { [weak self] in
            guard let self else { return }
            for await update in Transaction.updates {
                do {
                    let transaction = try self.checkVerified(update)
                    await transaction.finish()
                    let status = await self.currentEntitlementStatus()
                    await MainActor.run {
                        self.notifyListeners("entitlementChanged", data: status)
                    }
                } catch {
                    self.recordEvent(name: "storekit_update_unverified", properties: ["error": error.localizedDescription])
                }
            }
        }
    }

    deinit {
        transactionListener?.cancel()
    }

    @objc func getEntitlementStatus(_ call: CAPPluginCall) {
        Task {
            let status = await currentEntitlementStatus()
            call.resolve(status)
        }
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        Task {
            do {
                let products = try await loadAvailableProducts()
                var output: [[String: Any]] = []
                for product in products {
                    var item: [String: Any] = [
                        "id": product.id,
                        "displayName": product.displayName,
                        "description": product.description,
                        "displayPrice": product.displayPrice,
                        "price": NSDecimalNumber(decimal: product.price).doubleValue,
                        "currencyCode": product.priceFormatStyle.currencyCode
                    ]
                    if let subscription = product.subscription {
                        item["periodValue"] = subscription.subscriptionPeriod.value
                        item["periodUnit"] = periodUnitName(subscription.subscriptionPeriod.unit)
                        // Trial presentation contract: the paywall may only advertise a free
                        // trial that StoreKit verifies for this product and this user.
                        if let intro = subscription.introductoryOffer {
                            item["introOffer"] = [
                                "paymentMode": paymentModeName(intro.paymentMode),
                                "periodValue": intro.period.value,
                                "periodUnit": periodUnitName(intro.period.unit),
                                "periodCount": intro.periodCount,
                                "displayPrice": intro.displayPrice,
                                "price": NSDecimalNumber(decimal: intro.price).doubleValue
                            ]
                            item["introEligible"] = await subscription.isEligibleForIntroOffer
                        } else {
                            item["introEligible"] = false
                        }
                    }
                    output.append(item)
                }
                let returnedIDs = products.map(\.id)
                let missingIDs = productIDs.filter { !returnedIDs.contains($0) }
                recordEvent(name: "store_products_loaded_native", properties: [
                    "count": output.count,
                    "missing": missingIDs.joined(separator: ",")
                ])
                call.resolve([
                    "products": output,
                    "requestedProductIds": productIDs,
                    "returnedProductIds": returnedIDs,
                    "missingProductIds": missingIDs,
                    "bundleId": Bundle.main.bundleIdentifier ?? "unknown"
                ])
            } catch {
                recordEvent(name: "store_products_failed_native", properties: ["error": error.localizedDescription])
                call.reject("Gillie Plus products could not be loaded: \(error.localizedDescription)")
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
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
                    let suffix = lastLookupError.map { " Last Apple error: \($0.localizedDescription)" } ?? ""
                    recordEvent(name: "purchase_selected_product_missing_native", properties: [
                        "productId": productID,
                        "bundleId": Bundle.main.bundleIdentifier ?? "unknown"
                    ])
                    call.reject("Apple could not find \(productID) for \(Bundle.main.bundleIdentifier ?? "this app"). The product ID, subscription availability, Paid Apps agreement, tax, banking, and TestFlight build association must all be active.\(suffix)")
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
                    guard transaction.revocationDate == nil else {
                        recordEvent(name: "purchase_rejected_native", properties: [
                            "productId": transaction.productID,
                            "reason": "revoked-transaction"
                        ])
                        call.reject("Apple returned a revoked subscription transaction.")
                        return
                    }
                    if let expiration = transaction.expirationDate, expiration <= Date() {
                        await transaction.finish()
                        recordEvent(name: "purchase_expired_result_native", properties: [
                            "productId": transaction.productID,
                            "transactionId": String(transaction.id),
                            "purchaseDate": transaction.purchaseDate.timeIntervalSince1970 * 1000,
                            "expiresAt": expiration.timeIntervalSince1970 * 1000
                        ])

                        var recoveredStatus = await currentEntitlementStatus()
                        if recoveredStatus["active"] as? Bool == true {
                            recoveredStatus["checkoutMode"] = "expired-result-current-entitlement-v3"
                            recordEvent(name: "purchase_expired_result_recovered_native", properties: [
                                "productId": recoveredStatus["productId"] as? String ?? transaction.productID,
                                "mode": "current-entitlement"
                            ])
                            call.resolve(recoveredStatus)
                            return
                        }

                        do {
                            try await AppStore.sync()
                        } catch {
                            recordEvent(name: "purchase_expired_result_sync_failed_native", properties: [
                                "productId": transaction.productID,
                                "error": error.localizedDescription
                            ])
                        }

                        recoveredStatus = await currentEntitlementStatus()
                        if recoveredStatus["active"] as? Bool == true {
                            recoveredStatus["checkoutMode"] = "expired-result-sync-recovered-v3"
                            recordEvent(name: "purchase_expired_result_recovered_native", properties: [
                                "productId": recoveredStatus["productId"] as? String ?? transaction.productID,
                                "mode": "app-store-sync"
                            ])
                            call.resolve(recoveredStatus)
                            return
                        }

                        call.resolve([
                            "active": false,
                            "verified": true,
                            "source": "storekit2-expired-purchase-result",
                            "productId": transaction.productID,
                            "transactionId": String(transaction.id),
                            "purchaseDate": transaction.purchaseDate.timeIntervalSince1970 * 1000,
                            "expiresAt": expiration.timeIntervalSince1970 * 1000,
                            "checkedAt": Date().timeIntervalSince1970 * 1000,
                            "expired": true,
                            "requiresSandboxReset": true,
                            "checkoutMode": "expired-result-requires-sandbox-reset-v3"
                        ])
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
                call.reject("Apple checkout failed for \(productID): \(error.localizedDescription)")
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
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
                call.reject("Restore failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func claimPlusWelcomeBundle(_ call: CAPPluginCall) {
        Task {
            let entitlement = await currentEntitlementStatus()
            guard entitlement["active"] as? Bool == true else {
                recordEvent(name: "plus_welcome_claim_rejected", properties: ["reason": "inactive_entitlement"])
                call.resolve(["active": false, "fresh": false, "source": "storekit2"])
                return
            }

            let now = Date().timeIntervalSince1970 * 1000
            if hasClaimedPlusWelcomeBundle() {
                recordEvent(name: "plus_welcome_claim_existing", properties: [:])
                call.resolve([
                    "active": true,
                    "fresh": false,
                    "claimedAt": now,
                    "source": "keychain"
                ])
                return
            }

            guard markPlusWelcomeBundleClaimed() else {
                recordEvent(name: "plus_welcome_claim_failed", properties: ["reason": "claim_marker_write_failed"])
                call.reject("Gillie could not secure the Plus welcome bundle claim.")
                return
            }

            recordEvent(name: "plus_welcome_claim_fresh", properties: ["bonusPearls": 250, "buddyCredits": 1])
            call.resolve([
                "active": true,
                "fresh": true,
                "claimedAt": now,
                "bonusPearls": 250,
                "buddyCredits": 1,
                "source": "keychain"
            ])
        }
    }

    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        guard let url = URL(string: "https://apps.apple.com/account/subscriptions") else {
            call.reject("Subscription settings are unavailable.")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { success in
                if success {
                    self.recordEvent(name: "manage_subscription_opened_native", properties: [:])
                    call.resolve(["opened": true])
                } else {
                    call.reject("Could not open Apple subscription settings.")
                }
            }
        }
    }

    @objc func haptic(_ call: CAPPluginCall) {
        let style = call.getString("style") ?? "light"
        DispatchQueue.main.async {
            switch style {
            case "success":
                let generator = UINotificationFeedbackGenerator()
                generator.prepare()
                generator.notificationOccurred(.success)
            case "warning":
                let generator = UINotificationFeedbackGenerator()
                generator.prepare()
                generator.notificationOccurred(.warning)
            case "error":
                let generator = UINotificationFeedbackGenerator()
                generator.prepare()
                generator.notificationOccurred(.error)
            case "heavy":
                let generator = UIImpactFeedbackGenerator(style: .heavy)
                generator.prepare()
                generator.impactOccurred()
            case "medium":
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.prepare()
                generator.impactOccurred()
            case "selection":
                let generator = UISelectionFeedbackGenerator()
                generator.prepare()
                generator.selectionChanged()
            default:
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.prepare()
                generator.impactOccurred()
            }
            self.recordEvent(name: "haptic_played_native", properties: ["style": style])
            call.resolve(["played": true, "style": style])
        }
    }

    @objc func requestReview(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }) else {
                call.reject("No active window is available for the review request.")
                return
            }
            if #available(iOS 14.0, *) {
                SKStoreReviewController.requestReview(in: scene)
            } else {
                SKStoreReviewController.requestReview()
            }
            self.recordEvent(name: "review_prompt_requested_native", properties: [:])
            call.resolve(["requested": true])
        }
    }

    @objc func trackEvent(_ call: CAPPluginCall) {
        guard let name = call.getString("name"), isSafeEventName(name) else {
            call.reject("Invalid event name.")
            return
        }
        let properties = sanitizeProperties(call.getObject("properties") ?? [:])
        recordEvent(name: name, properties: properties)
        call.resolve(["saved": true])
    }

    @objc func getDiagnostics(_ call: CAPPluginCall) {
        let events = defaults.array(forKey: eventLogKey) ?? []
        let metrics = defaults.stringArray(forKey: metricLogKey) ?? []
        call.resolve([
            "app": appInfo(),
            "installId": ensureInstallID(),
            "events": events,
            "metricPayloads": metrics
        ])
    }

    @objc func clearDiagnostics(_ call: CAPPluginCall) {
        defaults.removeObject(forKey: eventLogKey)
        defaults.removeObject(forKey: metricLogKey)
        defaults.removeObject(forKey: installIDKey)
        call.resolve(["cleared": true])
    }

    private func loadAvailableProducts() async throws -> [Product] {
        var productsByID: [String: Product] = [:]
        var lastError: Error?

        for attempt in 1...3 {
            do {
                let batch = try await Product.products(for: productIDs)
                batch.forEach { productsByID[$0.id] = $0 }

                let missingAfterBatch = productIDs.filter { productsByID[$0] == nil }
                for productID in missingAfterBatch {
                    let single = try await Product.products(for: [productID])
                    single.forEach { productsByID[$0.id] = $0 }
                }

                let missing = productIDs.filter { productsByID[$0] == nil }
                recordEvent(name: "store_products_attempt_native", properties: [
                    "attempt": attempt,
                    "count": productsByID.count,
                    "missing": missing.joined(separator: ",")
                ])
                if missing.isEmpty { break }
            } catch {
                lastError = error
                recordEvent(name: "store_products_attempt_failed_native", properties: [
                    "attempt": attempt,
                    "error": error.localizedDescription
                ])
            }

            if attempt < 3 {
                try? await Task<Never, Never>.sleep(nanoseconds: UInt64(attempt) * 350_000_000)
            }
        }

        if productsByID.isEmpty, let lastError { throw lastError }
        return productIDs.compactMap { productsByID[$0] }
    }

    private func currentEntitlementStatus() async -> [String: Any] {
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
    }

    private func cacheEntitlement(_ status: [String: Any]) {
        var cache: [String: Any] = [:]
        status.forEach { key, value in
            if value is NSNull { return }
            cache[key] = value
        }
        defaults.set(cache, forKey: entitlementCacheKey)
    }

    private func hasClaimedPlusWelcomeBundle() -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: welcomeClaimService,
            kSecAttrAccount as String: welcomeClaimAccount,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: false
        ]
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        if status == errSecSuccess { return true }
        return defaults.bool(forKey: welcomeClaimFallbackKey)
    }

    private func markPlusWelcomeBundleClaimed() -> Bool {
        let data = Data("claimed".utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: welcomeClaimService,
            kSecAttrAccount as String: welcomeClaimAccount
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        let addStatus = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil)
        if addStatus == errSecSuccess || addStatus == errSecDuplicateItem {
            defaults.set(true, forKey: welcomeClaimFallbackKey)
            return true
        }
        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess {
            defaults.set(true, forKey: welcomeClaimFallbackKey)
            return true
        }
        return false
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw StoreKitError.notAvailableInStorefront
        case .verified(let safe):
            return safe
        }
    }

    private func paymentModeName(_ mode: Product.SubscriptionOffer.PaymentMode) -> String {
        switch mode {
        case .freeTrial: return "freeTrial"
        case .payAsYouGo: return "payAsYouGo"
        case .payUpFront: return "payUpFront"
        default: return "unknown"
        }
    }

    private func periodUnitName(_ unit: Product.SubscriptionPeriod.Unit) -> String {
        switch unit {
        case .day: return "day"
        case .week: return "week"
        case .month: return "month"
        case .year: return "year"
        @unknown default: return "period"
        }
    }

    private func isSafeEventName(_ name: String) -> Bool {
        guard name.count >= 2, name.count <= 64 else { return false }
        return name.range(of: "^[a-z0-9_.-]+$", options: .regularExpression) != nil
    }

    private func sanitizeProperties(_ source: JSObject) -> [String: Any] {
        var output: [String: Any] = [:]
        for (key, value) in source.prefix(12) {
            guard key.count <= 40,
                  key.range(of: "^[A-Za-z0-9_.-]+$", options: .regularExpression) != nil else { continue }
            if let boolean = value as? Bool { output[key] = boolean }
            else if let text = value as? String { output[key] = String(text.prefix(80)) }
            else if let number = value as? NSNumber { output[key] = number }
        }
        return output
    }

    private func recordEvent(name: String, properties: [String: Any]) {
        var events = defaults.array(forKey: eventLogKey) as? [[String: Any]] ?? []
        events.append([
            "name": name,
            "properties": properties,
            "at": Date().timeIntervalSince1970 * 1000
        ])
        defaults.set(Array(events.suffix(250)), forKey: eventLogKey)
    }

    private func ensureInstallID() -> String {
        if let existing = defaults.string(forKey: installIDKey), !existing.isEmpty { return existing }
        let created = UUID().uuidString.lowercased()
        defaults.set(created, forKey: installIDKey)
        return created
    }

    private func appInfo() -> [String: Any] {
        let bundle = Bundle.main
        return [
            "version": bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown",
            "build": bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown",
            "bundleId": bundle.bundleIdentifier ?? "unknown",
            "systemVersion": UIDevice.current.systemVersion,
            "device": UIDevice.current.model
        ]
    }
}
