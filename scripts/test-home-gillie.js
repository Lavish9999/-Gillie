const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1/home-gillie.js"), "utf8");
const css = fs.readFileSync(path.join(root, "v1/home-gillie.css"), "utf8");

function canonicalMarkup(ns = "main") {
  const groups = [
    '<g class="gill g1" transform="translate(44 50) rotate(-34)"><path d="M0 0"/></g>',
    '<g class="gill g2" transform="translate(38 68) rotate(-6)"><path d="M0 0"/></g>',
    '<g class="gill g3" transform="translate(42 86) rotate(24)"><path d="M0 0"/></g>',
    '<g class="gill r g1" transform="translate(104 50) rotate(214)"><path d="M0 0"/></g>',
    '<g class="gill r g2" transform="translate(112 68) rotate(186)"><path d="M0 0"/></g>',
    '<g class="gill r g3" transform="translate(106 86) rotate(156)"><path d="M0 0"/></g>',
  ].join("");
  return `<defs><linearGradient id="${ns}-gill"></linearGradient></defs>` +
    '<g class="axo-tail"><path d="M116 92"/></g>' +
    `<g class="axo-core">${groups}<ellipse cx="74" cy="70" rx="43" ry="41"/></g>`;
}

function assertDirectGills(output, label) {
  const gillTags = output.match(/<path class="axo-gill-frond" data-home-gill="[^"]+"[^>]*>/g) || [];
  if (gillTags.length !== 6) throw new Error(`${label} must output exactly six direct-coordinate fronds; found ${gillTags.length}.`);
  if (gillTags.some((tag) => /\btransform=/.test(tag))) throw new Error(`${label} direct-coordinate fronds must not use transform attributes.`);
  for (const id of ["left-upper", "left-middle", "left-lower", "right-upper", "right-middle", "right-lower"]) {
    if (!output.includes(`data-home-gill="${id}"`)) throw new Error(`${label} is missing the ${id} frond.`);
  }
  if (/class="gill(?:\s|")/.test(output)) throw new Error(`${label} still outputs the legacy globally animated .gill groups.`);
  if ((output.match(/class="axo-gill-vein"/g) || []).length !== 6) throw new Error(`${label} must output one visible vein for each frond.`);
}

let repaintCount = 0;
let paintedMarkup = "";
const original = (_skin, _hat, _mood, ns = "main") => canonicalMarkup(ns);
const documentElement = { dataset: {} };
const context = {
  console,
  document: { documentElement },
  window: { axoSVG: original },
  axoSVG: original,
  renderAxo() {
    repaintCount += 1;
    paintedMarkup = context.axoSVG("pink", null, "happy", "main");
  },
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, { filename: "home-gillie.js" });

if (context.window.axoSVG === original || context.axoSVG === original) throw new Error("Gillie did not replace the live axoSVG renderer.");
if (context.window.axoSVG !== context.axoSVG) throw new Error("Gillie did not update both global axoSVG references.");
if (repaintCount !== 1) throw new Error(`Home Gillie must repaint the already-visible tank exactly once; repainted ${repaintCount} times.`);
if (documentElement.dataset.homeGillieEngine !== "home-gillie-direct-gills-v3") throw new Error("Gillie direct-coordinate engine marker is missing.");
if (!source.includes('ns.startsWith("reefpreview-")')) throw new Error("Direct-coordinate Gillie renderer is not enabled for Reef preview namespaces.");

const output = context.axoSVG("pink", null, "happy", "main");
assertDirectGills(output, "Home Gillie");
if (!output.includes('fill="url(#main-gill)"')) throw new Error("Home Gillie direct fronds no longer inherit the active skin gradient.");
if (!output.includes('class="axo-core"') || !output.includes('class="axo-tail"')) throw new Error("Home Gillie replacement removed unrelated body or tail animation classes.");
if (paintedMarkup !== output) throw new Error("The immediate Home repaint did not use the direct-coordinate renderer.");

const previewOutput = context.axoSVG("pink", null, "happy", "reefpreview-test");
assertDirectGills(previewOutput, "Full-size Reef preview");
if (!previewOutput.includes('fill="url(#reefpreview-test-gill)"')) throw new Error("Reef preview direct fronds no longer inherit the preview skin gradient.");

for (const namespace of ["sos", "ob", "moonlit"]) {
  const untouched = context.axoSVG("pink", null, "happy", namespace);
  if ((untouched.match(/class="gill(?:\s|")/g) || []).length !== 6) throw new Error(`Direct-gill renderer unexpectedly changed the ${namespace} character renderer.`);
  if (untouched.includes("data-home-gill=")) throw new Error(`Direct-coordinate gills leaked into the ${namespace} SVG namespace.`);
}

const homeRule = css.match(/#view-home #axo-svg \[data-home-gill\],[\s\S]*?\{([\s\S]*?)\}/)?.[1] || "";
if (!homeRule || !/animation\s*:\s*none\s*!important/.test(homeRule)) throw new Error("Shared direct-gill CSS rule is missing.");
if (/\btransform\s*:/.test(homeRule)) throw new Error("Gillie CSS must not add transform positioning to direct-coordinate fronds.");
if (!css.includes("#phase2-tank-preview .v1-preview-axo-svg [data-home-gill]")) throw new Error("Reef preview direct-gill CSS selector is missing.");
if (!css.includes("#phase2-tank-preview .v1-preview-axo-svg .axo-gill-vein")) throw new Error("Reef preview vein styling is missing.");

console.log("Gillie runtime test passed: Home and the full-size Reef preview use six direct-coordinate fronds, while SOS and onboarding remain unchanged.");
