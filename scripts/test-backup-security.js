const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1", "backup.js"), "utf8");
const context = {
  window: {},
  console,
  Date,
  Math,
  Object,
  Array,
  Number,
  String,
  Boolean,
  RegExp,
  Set,
  JSON,
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, { filename: "v1/backup.js" });

const safety = context.window.GillieBackupSafety;
assert(safety, "Backup safety API was not exposed");
assert.strictEqual(typeof safety.sanitizeImported, "function", "Backup sanitizer is missing");
assert.strictEqual(safety.limits.maxFileBytes, 2 * 1024 * 1024, "Backup file limit changed unexpectedly");

const malicious = {
  onboarded: true,
  petName: '<img src=x onerror="boom">Gillie',
  skin: "PINK",
  hat: "leaf",
  pearls: Number.MAX_SAFE_INTEGER,
  reasons: ["Family<script>alert(1)</script>", ...Array(20).fill("Reason")],
  ownedItems: ["leaf", "leaf", "bad id<script>"],
  equippedDecor: ["starfish", "<svg>"],
  quitAt: Date.now(),
  originalQuitAt: Date.now() - 1000,
  bankedCleanMs: Number.MAX_SAFE_INTEGER,
  slips: [{ at: Date.now(), streakMs: 1234, trigger: '<img onerror="x">', place: "Home<script>", plan: "Walk<iframe>" }],
  cravings: [{ id: "craving_1", at: Date.now(), trigger: "Stress", resisted: true, pending: false, slip: false }],
  checkins: [{ date: "2026-07-13", mood: 99, clean: true, intensity: 99, note: "Fine<script>" }],
  cost: { substance: "vape", style: "disposables", unitsPerWeek: -50, costPerUnit: 999999999, puffsPerDay: 999999999 },
  goal: { name: "Trip<img onerror=x>", price: 999999999 },
  theme: "clear",
  buddies: [{ name: "Mochi<img>", skin: "pink" }, ...Array(10).fill({ name: "Extra", skin: "pink" })],
  coach: {
    missionDate: "not-a-date",
    completed: { safe: Date.now(), "bad key<script>": true },
    reviews: [{ date: "2026-07-13", result: "adjust", note: "Night<script>", at: Date.now() }],
  },
  reminders: { checkin: true, craving: false },
  premium: true,
  premiumEntitlement: { active: true, source: "forged" },
  unknownKey: "must not import",
};

const base = {
  petName: "Gillie",
  skin: "pink",
  cost: { substance: "vape", style: "disposables", unitsPerWeek: 2, costPerUnit: 15, puffsPerDay: 200 },
  theme: "clear",
};
const restored = safety.sanitizeImported(malicious, base);

function assertNoMarkup(value, label) {
  assert(!String(value).includes("<"), `${label} retained a less-than marker`);
  assert(!String(value).includes(">"), `${label} retained a greater-than marker`);
}

assertNoMarkup(restored.petName, "petName");
restored.reasons.forEach((value, index) => assertNoMarkup(value, `reason ${index}`));
assertNoMarkup(restored.goal.name, "goal name");
restored.buddies.forEach((buddy, index) => assertNoMarkup(buddy.name, `buddy ${index}`));
assertNoMarkup(restored.slips[0].place, "slip place");
assertNoMarkup(restored.slips[0].plan, "slip plan");
assertNoMarkup(restored.checkins[0].note, "check-in note");
assertNoMarkup(restored.coach.reviews[0].note, "coach note");

assert.strictEqual(restored.premium, false, "Backup imported a forged premium flag");
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(restored.premiumEntitlement)),
  { active: false, checkedAt: 0, source: "restore-pending-apple" },
  "Backup imported a forged entitlement",
);
assert.strictEqual(restored.pearls, safety.limits.maxPearls, "Pearls were not clamped");
assert.strictEqual(restored.bankedCleanMs, safety.limits.maxCleanMs, "Clean time was not clamped");
assert.strictEqual(restored.reasons.length, safety.limits.maxReasons, "Reasons were not limited");
assert.strictEqual(restored.buddies.length, safety.limits.maxBuddies, "Buddies were not limited");
assert.strictEqual(restored.slips[0].trigger, "Other", "Unknown trigger was not replaced");
assert.strictEqual(restored.checkins[0].mood, 5, "Mood was not clamped");
assert.strictEqual(restored.checkins[0].intensity, 3, "Craving intensity was not clamped");
assert.strictEqual(restored.cost.unitsPerWeek, 0.1, "Units per week were not clamped");
assert.strictEqual(restored.goal.price, safety.limits.maxMoney, "Goal price was not clamped");
assert.strictEqual(restored.coach.missionDate, null, "Invalid mission date was not removed");
assert.strictEqual(Object.prototype.hasOwnProperty.call(restored, "unknownKey"), false, "Unknown backup key was imported");

assert.throws(() => safety.sanitizeImported(null, base), /invalid/i);
assert.throws(() => safety.sanitizeImported([], base), /invalid/i);
assert.throws(() => safety.sanitizeImported("bad", base), /invalid/i);

console.log("Backup security test passed: imported data is bounded, entitlement-safe, and stripped of executable markup.");
