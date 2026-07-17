const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1", "store-pricing.js"), "utf8");
const context = {
  window: {},
  console,
  Object,
  Array,
  Number,
  String,
  Set,
  Map,
  Math,
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, { filename: "v1/store-pricing.js" });

const pricing = context.window.GillieStorePricing;
assert(pricing, "Store pricing API was not exposed");
assert.strictEqual(pricing.engine, "store-pricing-v2-retryable");
assert.strictEqual(pricing.productIds.monthly, "gillie.plus.monthly");
assert.strictEqual(pricing.productIds.yearly, "gillie.plus.yearly");
assert.strictEqual(typeof pricing.load, "function", "Store pricing must expose a retryable load action");
assert.strictEqual(typeof pricing.snapshot, "function", "Store pricing must expose a diagnostics snapshot");

const products = pricing.normalizeProducts({
  products: [
    { id: "gillie.plus.monthly", displayPrice: "$3.79", price: 3.79, currencyCode: "USD", periodValue: 1, periodUnit: "month" },
    {
      id: "gillie.plus.yearly",
      displayPrice: "US$28.49",
      price: 28.49,
      currencyCode: "USD",
      periodValue: 1,
      periodUnit: "year",
      introOffer: { paymentMode: "freeTrial", periodValue: 7, periodUnit: "day", periodCount: 1, displayPrice: "$0.00" },
      introEligible: true,
    },
    { id: "other.product", displayPrice: "$999", periodValue: 1, periodUnit: "year" },
    { id: "gillie.plus.monthly", displayPrice: "", periodValue: 1, periodUnit: "month" },
  ],
});

assert(products instanceof Map, "Normalized products must be a Map");
assert.strictEqual(products.size, 2, "Unknown or empty-price products were not filtered");
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(products.get("gillie.plus.monthly"))),
  {
    id: "gillie.plus.monthly",
    displayPrice: "$3.79",
    cadence: "/ month",
    price: 3.79,
    currencyCode: "USD",
    introOffer: null,
    introEligible: false,
  },
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(products.get("gillie.plus.yearly"))),
  {
    id: "gillie.plus.yearly",
    displayPrice: "US$28.49",
    cadence: "/ year",
    price: 28.49,
    currencyCode: "USD",
    introOffer: { paymentMode: "freeTrial", periodValue: 7, periodUnit: "day", periodCount: 1, displayPrice: "$0.00" },
    introEligible: true,
  },
);

// Trial eligibility must never be assumed: a missing/false flag or a malformed
// offer normalizes to "no trial".
const guarded = pricing.normalizeProducts({
  products: [
    {
      id: "gillie.plus.yearly",
      displayPrice: "US$28.49",
      introOffer: { paymentMode: "freeTrial", periodValue: 7, periodUnit: "day" },
      introEligible: "yes",
    },
    { id: "gillie.plus.monthly", displayPrice: "$3.79", introOffer: { paymentMode: "freeTrial", periodValue: 1, periodUnit: "eon" } },
  ],
});
assert.strictEqual(guarded.get("gillie.plus.yearly").introEligible, false, "Non-boolean eligibility must not enable trial copy");
assert.strictEqual(guarded.get("gillie.plus.monthly").introOffer, null, "Malformed intro offers must be discarded");
assert.strictEqual(pricing.cadenceFor({ periodValue: 3, periodUnit: "months" }), "/ 3 months");
assert.strictEqual(pricing.cadenceFor({ periodValue: 1, periodUnit: "unknown" }), "");
assert.strictEqual(pricing.normalizeProducts(null).size, 0);
assert.strictEqual(pricing.normalizeProducts({ products: "bad" }).size, 0);

const openerBlock = source.slice(source.indexOf('target.matches("#plus-open'));
assert(openerBlock.includes('loadAppleProducts({ force: loadState === "error" })'), "A failed price load must be retryable when the paywall reopens");
assert(!source.includes("stopImmediatePropagation"), "Store pricing must never swallow the Plus purchase click");
assert(source.includes("The purchase\n      // director joins this shared loadPromise") || source.includes("Never start a second product request from the purchase"), "Purchase taps must never start a second product request");
assert(!source.includes("Apple price unavailable\";\n        purchase.disabled = true"), "A pricing error must not permanently disable checkout");

console.log("Store pricing test passed: Apple products are normalized, zero-product failures remain retryable, and pricing cannot swallow checkout.");
