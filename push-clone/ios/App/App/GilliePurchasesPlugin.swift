import Capacitor
import Foundation
import StoreKit

@objc(GilliePurchasesPlugin)
public class GilliePurchasesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GilliePurchasesPlugin"
    public let jsName = "GilliePurchases"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getEntitlementStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise)
    ]

    private let productIDs = [
        "gillie.plus.monthly",
        "gillie.plus.yearly"
    ]

    // App Store Connect setup:
    // 1. Create auto-renewable subscription group "Gillie Plus".
    // 2. Add product IDs gillie.plus.monthly and gillie.plus.yearly.
    // 3. Submit the first app build and first IAP products together.
    // 4. Test purchase and restore in TestFlight sandbox before release.

    @objc func getEntitlementStatus(_ call: CAPPluginCall) {
        Task {
            let active = await hasActiveGilliePlusEntitlement()
            call.resolve([
                "active": active,
                "source": "storekit2"
            ])
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productID = call.getString("productId"), productIDs.contains(productID) else {
            call.reject("Unknown Gillie Plus product ID.")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: [productID])
                guard let product = products.first else {
                    call.reject("Gillie Plus product is not available. Check App Store Connect product IDs.")
                    return
                }

                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    let transaction = try checkVerified(verification)
                    await transaction.finish()
                    let active = await hasActiveGilliePlusEntitlement()
                    call.resolve([
                        "active": active,
                        "source": "storekit2"
                    ])
                case .userCancelled:
                    call.reject("Purchase cancelled.")
                case .pending:
                    call.resolve([
                        "active": false,
                        "source": "storekit2",
                        "pending": true
                    ])
                @unknown default:
                    call.reject("Unknown purchase result.")
                }
            } catch {
                call.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                let active = await hasActiveGilliePlusEntitlement()
                call.resolve([
                    "active": active,
                    "source": "storekit2"
                ])
            } catch {
                call.reject("Restore failed: \(error.localizedDescription)")
            }
        }
    }

    private func hasActiveGilliePlusEntitlement() async -> Bool {
        for await entitlement in Transaction.currentEntitlements {
            guard let transaction = try? checkVerified(entitlement) else { continue }
            if productIDs.contains(transaction.productID), transaction.revocationDate == nil {
                return true
            }
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
}
