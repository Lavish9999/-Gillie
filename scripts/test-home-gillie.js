const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "v1/home-gillie.css"), "utf8");

const axoStart = index.indexOf("function axoSVG(");
const axoEnd = index.indexOf("\nfunction renderAxo()", axoStart);
if (axoStart < 0 || axoEnd < 0) throw new Error("Could not locate the canonical axoSVG renderer.");
const axoSource = index.slice(axoStart, axoEnd);

if (!axoSource.includes('const frond = (x, y, rot, len, cls)')) {
  throw new Error("Canonical Gillie renderer no longer exposes the authored gill transform contract.");
}
if (!axoSource.includes('<g class="${cls}" transform="translate(${x} ${y}) rotate(${rot})">')) {
  throw new Error("Gillie gills are no longer positioned by authored SVG transform attributes.");
}
const frondCalls = axoSource.match(/frond\([^\n]+?"gill[^\n]+?\)/g) || [];
if (frondCalls.length !== 6) {
  throw new Error(`Canonical Gillie must render exactly six gills; found ${frondCalls.length}.`);
}

const rule = css.match(/#view-home #axo-svg g\.gill\[transform\]\s*\{([\s\S]*?)\}/)?.[1] || "";
if (!rule) throw new Error("Home Gillie authored-gill CSS rule is missing.");
if (!/animation\s*:\s*none\s*!important/.test(rule)) {
  throw new Error("Home Gillie gill transform animation is not disabled.");
}
if (/\btransform\s*:/.test(rule)) {
  throw new Error("Home Gillie CSS must not replace the authored SVG transform attribute.");
}
if (/\.axo-tail[^{}]*\{[^{}]*animation\s*:\s*none/i.test(css)) {
  throw new Error("Home Gillie fix must not disable the tail animation.");
}
if (/\.axo-core[^{}]*\{[^{}]*animation\s*:\s*none/i.test(css)) {
  throw new Error("Home Gillie fix must not disable the body breathing animation.");
}

console.log("Home Gillie test passed: six authored gills stay attached while the rest of the live character remains animated.");
