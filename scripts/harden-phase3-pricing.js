const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const phase3Path = path.join(root, "www", "phase3-ship.js");

const BEFORE = `    if (yearly) {
      $(".note", yearly).textContent = "$2.50/month · Save 37%";
      $(".price small", yearly).textContent = "/year";
    }
    if (monthly) $(".note", monthly).textContent = "Flexible monthly access · Cancel anytime";`;

const AFTER = `    if (yearly) $(".note", yearly).textContent = "Annual billing";
    if (monthly) $(".note", monthly).textContent = "Monthly billing";`;

function hardenPhase3Pricing(source) {
  const matches = source.split(BEFORE).length - 1;
  if (matches !== 1) {
    throw new Error(`Phase 3 hardcoded pricing block expected exactly once, found ${matches}.`);
  }
  const output = source.replace(BEFORE, AFTER);
  for (const forbidden of ["$2.50/month", "Save 37%", 'textContent = "/year"']) {
    if (output.includes(forbidden)) {
      throw new Error(`Phase 3 pricing hardener left a forbidden marker: ${forbidden}`);
    }
  }
  for (const required of ["Annual billing", "Monthly billing"]) {
    if (!output.includes(required)) throw new Error(`Phase 3 pricing hardener is missing: ${required}`);
  }
  return output;
}

function run() {
  if (!fs.existsSync(phase3Path)) {
    throw new Error("Missing generated www/phase3-ship.js. Run inject-phase3 first.");
  }
  const source = fs.readFileSync(phase3Path, "utf8");
  fs.writeFileSync(phase3Path, hardenPhase3Pricing(source), "utf8");
  console.log("Hardened Phase 3 paywall copy: Apple controls price and billing cadence.");
}

if (require.main === module) run();

module.exports = {
  AFTER,
  BEFORE,
  hardenPhase3Pricing,
};
