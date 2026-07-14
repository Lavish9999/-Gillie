const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const source = read("v1/theme-engine.js");
const injector = read("scripts/inject-support-recovery.js");

for (const marker of [
  "theme-engine-v1",
  "#theme-row [data-theme]",
  "event.stopImmediatePropagation()",
  "current.theme = theme.id",
  "document.documentElement.style.setProperty(\"--sand\"",
  "tint.style.setProperty(\"background\"",
  "tint.style.setProperty(\"opacity\"",
  "gillie:theme-applied",
  "GillieThemeEngine",
  "reef_theme_selected",
  "reef_theme_locked_tapped",
]) {
  assert(source.includes(marker), `Theme engine is missing: ${marker}`);
}

assert(source.includes("theme.premium && !current?.premium"), "Premium themes must stay entitlement-gated");
assert(!source.includes("state.premium = true"), "Theme engine must never forge Plus entitlement");
assert(!source.includes("current.premium = true"), "Theme engine must never forge Plus entitlement");
assert(source.includes('style.setProperty("z-index", "2", "important")'), "Theme tint must be forced into the visible tank stack");
assert(source.includes('style.setProperty("pointer-events", "none", "important")'), "Theme tint must never block tank interaction");
assert(source.includes("requestAnimationFrame(() => applyThemeImmediately"), "Theme must be re-applied after canonical rerenders");
assert(source.includes("new MutationObserver"), "Theme engine must repair DOM rerenders");

for (const marker of [
  '"v1/theme-engine.js"',
  'data-gillie-v1-theme-engine="true"',
  "theme-engine-v1",
  "GillieThemeEngine",
]) {
  assert(injector.includes(marker), `Theme engine injection is missing: ${marker}`);
}

console.log("Reef theme selection and persistence contracts passed.");
