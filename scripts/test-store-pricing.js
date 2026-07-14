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
assert.strictEqual(pricing.engine, "store-pricing-v1");
assert.strictEqual(pricing.productIds.monthly, "gillie.plus.monthly");
assert.strictEqual(pricing.productIds.yearly, "gillie.plus.yearly");

const products = pricing.normalizeProducts({
  products: [
    { id: "gillie.plus.monthly", displayPrice: "$3.99", periodValue: 1, periodUnit: "month" },
    { id: "gillie.plus.yearly", displayPrice: "US$29.99", periodValue: 1, periodUnit: "year" },
    { id: "other.product", displayPrice: "$999", periodValue: 1, periodUnit: "year" },
    { id: "gillie.plus.monthly", displayPrice: "", periodValue: 1, periodUnit: "month" },
  ],
});

assert(products instanceof Map, "Normalized products must be a Map");
assert.strictEqual(products.size, 2, "Unknown or empty-price products were not filtered");
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(products.get("gillie.plus.monthly"))),
  { id: "gillie.plus.monthly", displayPrice: "$3.99", cadence: "/ month" },
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(products.get("gillie.plus.yearly"))),
  { id: "gillie.plus.yearly", displayPrice: "US$29.99", cadence: "/ year" },
);
assert.strictEqual(pricing.cadenceFor({ periodValue: 3, periodUnit: "months" }), "/ 3 months");
assert.strictEqual(pricing.cadenceFor({ periodValue: 1, periodUnit: "unknown" }), "");
assert.strictEqual(pricing.normalizeProducts(null).size, 0);
assert.strictEqual(pricing.normalizeProducts({ products: "bad" }).size, 0);

console.log("Store pricing test passed: only localized Apple products are accepted and billing periods are normalized safely.");
