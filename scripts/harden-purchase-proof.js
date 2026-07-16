const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const targets = [
  path.join(root, "v1", "purchase-director.js"),
  path.join(root, "www", "v1", "purchase-director.js"),
];

const original = `  function applyEntitlement(status, source) {
    if (!status?.active) return false;
    let active = true;`;

const hardened = `  function recoverVerifiedPurchaseProof(status, source) {
    const productId = clean(status?.productId, 80);
    const expectedProduct = Object.values(PRODUCT_IDS).includes(productId);
    const authoritativePurchaseResult = source === "purchase-result"
      && status?.verified === true
      && expectedProduct
      && !status?.cancelled
      && !status?.pending;

    if (status?.active || !authoritativePurchaseResult) return status;

    track("purchase_director_verified_result_recovered", { productId });
    return {
      ...status,
      active: true,
      source: status.source || "storekit2-verified-purchase-result",
      purchaseProofRecovered: true,
    };
  }

  function applyEntitlement(status, source) {
    status = recoverVerifiedPurchaseProof(status, source);
    if (!status?.active) return false;
    let active = true;`;

let patched = 0;
for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes("purchase_director_verified_result_recovered")) {
    const count = source.split(original).length - 1;
    if (count !== 1) {
      throw new Error(`${path.relative(root, file)}: expected one checkout entitlement block, found ${count}.`);
    }
    source = source.replace(original, hardened);
    fs.writeFileSync(file, source, "utf8");
  }

  for (const marker of [
    "recoverVerifiedPurchaseProof",
    "purchase_director_verified_result_recovered",
    "purchaseProofRecovered: true",
    'source === "purchase-result"',
  ]) {
    if (!source.includes(marker)) {
      throw new Error(`${path.relative(root, file)} is missing hardened purchase proof marker: ${marker}`);
    }
  }
  patched += 1;
}

if (!patched) throw new Error("No Gillie purchase director source was available to harden.");
console.log("Hardened Gillie checkout: verified native purchase proof survives delayed StoreKit entitlement propagation.");
