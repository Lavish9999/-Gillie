const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1/home-gillie.js"), "utf8");
const css = fs.readFileSync(path.join(root, "v1/home-gillie.css"), "utf8");

function canonicalMarkup() {
  return [
    '<g class="gill g1" transform="translate(44 50) rotate(-34)"><path d="M0 0"/></g>',
    '<g class="gill g2" transform="translate(38 68) rotate(-6)"><path d="M0 0"/></g>',
    '<g class="gill g3" transform="translate(42 86) rotate(24)"><path d="M0 0"/></g>',
    '<g class="gill r g1" transform="translate(104 50) rotate(214)"><path d="M0 0"/></g>',
    '<g class="gill r g2" transform="translate(112 68) rotate(186)"><path d="M0 0"/></g>',
    '<g class="gill r g3" transform="translate(106 86) rotate(156)"><path d="M0 0"/></g>',
    '<g class="axo-core"><ellipse cx="74" cy="70" rx="43" ry="41"/></g>',
    '<g class="axo-tail"><path d="M116 92"/></g>',
  ].join("");
}

let repaintCount = 0;
let paintedMarkup = "";
const original = () => canonicalMarkup();
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

if (context.window.axoSVG === original || context.axoSVG === original) {
  throw new Error("Home Gillie did not replace the live axoSVG renderer.");
}
if (context.window.axoSVG !== context.axoSVG) {
  throw new Error("Home Gillie did not update both global axoSVG references.");
}
if (repaintCount !== 1) {
  throw new Error(`Home Gillie must repaint the already-visible tank exactly once; repainted ${repaintCount} times.`);
}
if (documentElement.dataset.homeGillieEngine !== "home-gillie-static-gills-v2") {
  throw new Error("Home Gillie runtime engine marker is missing.");
}

const output = context.axoSVG("pink", null, "happy", "main");
const isolated = output.match(/class="axo-gill-static[^"]*"/g) || [];
if (isolated.length !== 6) {
  throw new Error(`Home Gillie must output exactly six isolated gill groups; found ${isolated.length}.`);
}
if (/class="gill(?:\s|")/.test(output)) {
  throw new Error("Home Gillie still outputs the globally animated .gill class.");
}
const transforms = output.match(/transform="translate\([^\"]+\) rotate\([^\"]+\)"/g) || [];
if (transforms.length !== 6) {
  throw new Error(`Home Gillie must retain all six authored SVG transforms; found ${transforms.length}.`);
}
if (!output.includes('class="axo-core"') || !output.includes('class="axo-tail"')) {
  throw new Error("Home Gillie isolation removed unrelated body or tail animation classes.");
}
if (paintedMarkup !== output) {
  throw new Error("The immediate Home repaint did not use the isolated six-gill renderer.");
}

const cssRule = css.match(/#view-home #axo-svg \.axo-gill-static\s*\{([\s\S]*?)\}/)?.[1] || "";
if (!cssRule || !/animation\s*:\s*none\s*!important/.test(cssRule)) {
  throw new Error("Home Gillie isolated-gill CSS rule is missing.");
}
if (/\btransform\s*:/.test(cssRule)) {
  throw new Error("Home Gillie CSS must not replace authored SVG transform attributes.");
}

console.log("Home Gillie runtime test passed: the visible tank repaints with six class-isolated, authored-position gills while body and tail motion remain available.");
