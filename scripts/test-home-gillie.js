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

if (context.window.axoSVG === original || context.axoSVG === original) throw new Error("Home Gillie did not replace the live axoSVG renderer.");
if (context.window.axoSVG !== context.axoSVG) throw new Error("Home Gillie did not update both global axoSVG references.");
if (repaintCount !== 1) throw new Error(`Home Gillie must repaint the already-visible tank exactly once; repainted ${repaintCount} times.`);
if (documentElement.dataset.homeGillieEngine !== "home-gillie-direct-gills-v3") throw new Error("Home Gillie direct-coordinate engine marker is missing.");

const output = context.axoSVG("pink", null, "happy", "main");
const gillTags = output.match(/<path class="axo-gill-frond" data-home-gill="[^"]+"[^>]*>/g) || [];
if (gillTags.length !== 6) throw new Error(`Home Gillie must output exactly six direct-coordinate fronds; found ${gillTags.length}.`);
if (gillTags.some((tag) => /\btransform=/.test(tag))) throw new Error("Home Gillie direct-coordinate fronds must not use transform attributes.");
for (const id of ["left-upper", "left-middle", "left-lower", "right-upper", "right-middle", "right-lower"]) {
  if (!output.includes(`data-home-gill="${id}"`)) throw new Error(`Home Gillie is missing the ${id} frond.`);
}
if (/class="gill(?:\s|")/.test(output)) throw new Error("Home Gillie still outputs the legacy globally animated .gill groups.");
if ((output.match(/class="axo-gill-vein"/g) || []).length !== 6) throw new Error("Home Gillie must output one visible vein for each of the six fronds.");
if (!output.includes('fill="url(#main-gill)"')) throw new Error("Home Gillie direct fronds no longer inherit the active skin gradient.");
if (!output.includes('class="axo-core"') || !output.includes('class="axo-tail"')) throw new Error("Home Gillie replacement removed unrelated body or tail animation classes.");
if (paintedMarkup !== output) throw new Error("The immediate Home repaint did not use the direct-coordinate renderer.");

const sosOutput = context.axoSVG("pink", null, "happy", "sos");
if ((sosOutput.match(/class="gill(?:\s|")/g) || []).length !== 6) throw new Error("Home Gillie replacement unexpectedly changed the SOS character renderer.");
if (sosOutput.includes("data-home-gill=")) throw new Error("Home-only direct gills leaked into a non-Home SVG namespace.");

const gillRule = css.match(/#view-home #axo-svg \[data-home-gill\]\s*\{([\s\S]*?)\}/)?.[1] || "";
if (!gillRule || !/animation\s*:\s*none\s*!important/.test(gillRule)) throw new Error("Home Gillie direct-gill CSS rule is missing.");
if (/\btransform\s*:/.test(gillRule)) throw new Error("Home Gillie CSS must not add transform positioning to direct-coordinate fronds.");
if (!css.includes(".axo-gill-vein")) throw new Error("Home Gillie frond vein styling is missing.");

console.log("Home Gillie runtime test passed: the live tank repaints with six direct-coordinate fronds, no legacy gill groups, preserved skin color, and untouched SOS/body/tail behavior.");
