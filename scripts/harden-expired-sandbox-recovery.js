const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const nativePath = path.join(root, "ios", "App", "App", "GilliePurchasesPlugin.swift");
const directorPaths = [
  path.join(root, "v1", "purchase-director.js"),
  path.join(root, "www", "v1", "purchase-director.js"),
];

function replaceExactlyOnce(source, needle, replacement, label) {
  if (source.includes(replacement)) return source;
  const count = source.split(needle).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one original block, found ${count}.`);
  return source.replace(needle, replacement);
}

if (!fs.existsSync(nativePath)) throw new Error(`Missing Gillie purchases plugin: ${nativePath}`);
let native = fs.readFileSync(nativePath, "utf8");

const expiredReject = `                    if let expiration = transaction.expirationDate, expiration <= Date() {
                        recordEvent(name: "purchase_rejected_native", properties: [
                            "productId": transaction.productID,
                            "reason": "expired-transaction"
                        ])
                        call.reject("Apple returned an expired subscription transaction.")
                        return
                    }`;

const expiredRecovery = `                    if let expiration = transaction.expirationDate, expiration <= Date() {
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
                    }`;

if (!native.includes("expired-result-requires-sandbox-reset-v3")) {
  native = replaceExactlyOnce(native, expiredReject, expiredRecovery, "Expired StoreKit purchase recovery");
  fs.writeFileSync(nativePath, native, "utf8");
}

for (const marker of [
  "purchase_expired_result_native",
  "expired-result-sync-recovered-v3",
  "requiresSandboxReset",
  "expired-result-requires-sandbox-reset-v3",
]) {
  if (!native.includes(marker)) throw new Error(`Native expired-subscription recovery is missing marker: ${marker}`);
}

const proofBefore = `    const authoritativePurchaseResult = source === "purchase-result"
      && status?.verified === true
      && expectedProduct
      && !status?.cancelled
      && !status?.pending;`;

const proofAfter = `    const expiresAt = Number(status?.expiresAt || 0);
    const transactionIsCurrent = !expiresAt || expiresAt > Date.now();
    const authoritativePurchaseResult = source === "purchase-result"
      && status?.verified === true
      && expectedProduct
      && !status?.cancelled
      && !status?.pending
      && status?.expired !== true
      && status?.revoked !== true
      && status?.requiresSandboxReset !== true
      && transactionIsCurrent;`;

const resultBefore = `      if (result?.pending) {
        setHealth("", "Purchase pending with Apple. Gillie will unlock when approved.");
        track("purchase_director_pending", { productId: product.id });
        return;
      }
      if (await confirmAfterPurchase("purchase-recheck")) return;`;

const resultAfter = `      if (result?.pending) {
        setHealth("", "Purchase pending with Apple. Gillie will unlock when approved.");
        track("purchase_director_pending", { productId: product.id });
        return;
      }
      if (result?.expired || result?.requiresSandboxReset) {
        if (await confirmAfterPurchase("expired-result-recheck")) return;
        setHealth("error", "Apple returned an expired TestFlight subscription for this test account. Deleting Gillie does not clear Apple’s sandbox purchase history. Clear Purchase History for the Sandbox tester or sign in with a fresh Sandbox Apple Account, then try again.", true);
        track("purchase_director_sandbox_reset_required", {
          productId: product.id,
          expiresAt: String(result?.expiresAt || "").slice(0, 40),
        });
        return;
      }
      if (await confirmAfterPurchase("purchase-recheck")) return;`;

const catchBefore = `      const code = clean(error?.code || "PURCHASE_ERROR", 80);
      const message = clean(error?.message || error || "Purchase was not completed.");
      if (await confirmAfterPurchase("purchase-error-recheck")) return;
      setHealth("error", message, true);`;

const catchAfter = `      const code = clean(error?.code || "PURCHASE_ERROR", 80);
      const message = clean(error?.message || error || "Purchase was not completed.");
      if (await confirmAfterPurchase("purchase-error-recheck")) return;
      if (/expired subscription transaction/i.test(message)) {
        setHealth("error", "Apple returned an expired TestFlight subscription for this test account. Deleting Gillie does not clear Apple’s sandbox purchase history. Clear Purchase History for the Sandbox tester or sign in with a fresh Sandbox Apple Account, then try again.", true);
        track("purchase_director_sandbox_reset_required", { productId: product.id, source: "native-error" });
        return;
      }
      setHealth("error", message, true);`;

let directorsPatched = 0;
for (const file of directorPaths) {
  if (!fs.existsSync(file)) continue;
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes("transactionIsCurrent")) {
    source = replaceExactlyOnce(source, proofBefore, proofAfter, `${path.relative(root, file)} purchase-proof expiration guard`);
  }
  if (!source.includes("purchase_director_sandbox_reset_required")) {
    source = replaceExactlyOnce(source, resultBefore, resultAfter, `${path.relative(root, file)} expired-result UX`);
  }
  if (!source.includes('source: "native-error"')) {
    source = replaceExactlyOnce(source, catchBefore, catchAfter, `${path.relative(root, file)} expired-error UX`);
  }
  fs.writeFileSync(file, source, "utf8");

  for (const marker of [
    "transactionIsCurrent",
    "status?.expired !== true",
    "status?.requiresSandboxReset !== true",
    "purchase_director_sandbox_reset_required",
    "Deleting Gillie does not clear Apple’s sandbox purchase history",
  ]) {
    if (!source.includes(marker)) throw new Error(`${path.relative(root, file)} is missing marker: ${marker}`);
  }
  directorsPatched += 1;
}

if (!directorsPatched) throw new Error("No Gillie purchase director source was available for expired-sandbox hardening.");
console.log("Hardened expired TestFlight subscriptions: re-sync active purchases, never unlock expired proof, and direct testers to clear Apple sandbox history.");
