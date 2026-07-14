const assert = require("assert");
const { BEFORE, hardenPhase3Pricing } = require("./harden-phase3-pricing");

const fixture = `function tunePaywall() {\n${BEFORE}\n}`;
const output = hardenPhase3Pricing(fixture);

assert(output.includes('textContent = "Annual billing"'));
assert(output.includes('textContent = "Monthly billing"'));
assert(!output.includes("$2.50/month"));
assert(!output.includes("Save 37%"));
assert(!output.includes('textContent = "/year"'));
assert.throws(() => hardenPhase3Pricing("missing marker"), /expected exactly once/);
assert.throws(() => hardenPhase3Pricing(`${fixture}\n${fixture}`), /found 2/);

console.log("Phase 3 pricing hardener test passed: stale savings and cadence copy cannot ship.");
