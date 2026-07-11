import Capacitor
import Foundation
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
    private let eventLogKey = "gillie.diagnostics.events"
    private let metricLogKey = "gillie.diagnostics.metricPayloads"
    private let installIDKey = "gillie.diagnostics.installID"
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
                let products = try await Product.products(for: productIDs)
                let output: [[String: Any]] = products.map { product in
                    var item: [String: Any] = [
                        "id": product.id,
                        "displayName": product.displayName,
                        "description": product.description,
                        "displayPrice": product.displayPrice
                    ]
                    if let period = product.subscription?.subscriptionPeriod {
                        item["periodValue"] = period.value
                        item["periodUnit"] = periodUnitName(period.unit)
                    }
                    return item
                }
                recordEvent(name: "store_products_loaded_native", properties: ["count": output.count])
                call.resolve(["products": output])
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

        Task {
            do {
                let products = try await Product.products(for: productIDs)
                guard let product = products.first(where: { $0.id == productID }) else {
                    recordEvent(name: "purchase_product_missing", properties: ["productId": productID, "returned": products.count])
                    call.reject("The selected Gillie Plus plan is not available in this storefront.")
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
                call.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                let status = await currentEntitlementStatus()
                recordEvent(name: "restore_completed_native", properties: ["active": status["active"] as? Bool ?? false])
                call.resolve(status)
            } catch {
                recordEvent(name: "restore_failed_native", properties: ["error": error.localizedDescription])
                call.reject("Restore failed: \(error.localizedDescription)")
            }
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
        call.resolve(["cleared": true])
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

        let status: [String: Any] = [
            "active": false,
            "verified": true,
            "source": "storekit2",
            "checkedAt": Date().timeIntervalSince1970 * 1000
        ]
        cacheEntitlement(status)
        return status
    }

    private func cacheEntitlement(_ status: [String: Any]) {
        var cache: [String: Any] = [:]
        status.forEach { key, value in
            if value is NSNull { return }
            cache[key] = value
        }
        defaults.set(cache, forKey: entitlementCacheKey)
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw StoreKitError.notAvailableInStorefront
        case .verified(let safe):
            return safe
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
