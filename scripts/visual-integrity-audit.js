const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function fail(message) {
  throw new Error(`Visual integrity audit failed: ${message}`);
}

const indexPath = path.join(out, "index.html");
if (!fs.existsSync(indexPath)) fail("www/index.html is missing");

const index = read(indexPath);
const generatedFiles = walk(out).filter((file) => /\.(?:html|css|js)$/i.test(file));
const generatedSources = generatedFiles.map((file) => ({ file, source: read(file) }));

for (const marker of [
  'data-gillie-v1-visual-integrity="true"',
  'data-gillie-v1-visual-integrity-styles="true"',
]) {
  if (!index.includes(marker)) fail(`generated index is missing ${marker}`);
}

const moonlitIndex = index.indexOf('data-gillie-v1-moonlit-reef="true"');
const integrityIndex = index.indexOf('data-gillie-v1-visual-integrity="true"');
if (integrityIndex < 0 || (moonlitIndex >= 0 && integrityIndex < moonlitIndex)) {
  fail("visual integrity must load after the feature modules it normalizes");
}

// Fake status words are not product state. Accessibility aria-live regions are unaffected.
const fakeStatusPattern = /<[^>]*class=["'][^"']*(?:tag|badge|status|pill)[^"']*["'][^>]*>\s*(LIVE|BETA|NEW)\s*<\//gi;
for (const { file, source } of generatedSources) {
  const match = fakeStatusPattern.exec(source);
  fakeStatusPattern.lastIndex = 0;
  if (match) fail(`${path.relative(out, file)} contains decorative ${match[1]} status copy`);
}

const cssSources = [];
for (const match of index.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) cssSources.push({ file: "index.html<style>", source: match[1] });
for (const file of generatedFiles.filter((item) => item.endsWith(".css"))) cssSources.push({ file: path.relative(out, file), source: read(file) });

function numberFrom(body, property) {
  const match = body.match(new RegExp(`${property}\\s*:\\s*(-?[\\d.]+)px`, "i"));
  return match ? Number(match[1]) : null;
}

function fontSizeFrom(body) {
  const direct = numberFrom(body, "font-size");
  if (direct !== null) return direct;
  const shorthand = body.match(/font\s*:[^;{}]*?([\d.]+)px(?:\/[^\s;]+)?/i);
  return shorthand ? Number(shorthand[1]) : null;
}

const cardLike = /(card|banner|hero)/i;
const largeSurfaceAllowlist = /(tank|preview|overlay|sheet|art|chart|mascot|hatch|onboarding|celebrat|media|aquarium)/i;
const statusLike = /(tag|badge|status|pill)/i;

for (const { file, source } of cssSources) {
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim();
    const body = match[2];
    if (!selector || selector.startsWith("@")) continue;

    const spacingMatch = body.match(/letter-spacing\s*:\s*(-?[\d.]+)em/i);
    if (spacingMatch && !/sr-only/i.test(selector)) {
      const spacing = Number(spacingMatch[1]);
      const fontSize = fontSizeFrom(body);
      if (spacing > 0.14 && (fontSize === null || fontSize > 12.5)) {
        fail(`${file} uses display-size letter spacing (${spacing}em) in ${selector}`);
      }
      if (spacing > 0.10 && fontSize !== null && fontSize >= 14) {
        fail(`${file} uses wide tracking on ${fontSize}px text in ${selector}`);
      }
    }

    if (cardLike.test(selector)) {
      const stripe = body.match(/border-(?:left|right|inline-start|inline-end)\s*:\s*([\d.]+)px/i);
      if (stripe && Number(stripe[1]) >= 4) {
        fail(`${file} uses a ${stripe[1]}px decorative side stripe in ${selector}`);
      }

      if (!largeSurfaceAllowlist.test(selector)) {
        const minHeight = numberFrom(body, "min-height");
        const height = numberFrom(body, "height");
        if ((minHeight !== null && minHeight >= 320) || (height !== null && height >= 320)) {
          fail(`${file} defines an oversized generic surface in ${selector}`);
        }
      }
    }

    if (statusLike.test(selector)) {
      const minHeight = numberFrom(body, "min-height");
      const height = numberFrom(body, "height");
      const fontSize = fontSizeFrom(body);
      const pillRadius = /border-radius\s*:\s*(?:999|99|50)px/i.test(body);
      if (pillRadius && ((minHeight !== null && minHeight >= 52) || (height !== null && height >= 52) || (fontSize !== null && fontSize >= 18))) {
        fail(`${file} defines an oversized status pill in ${selector}`);
      }
    }
  }
}

const integrityCssPath = path.join(out, "v1", "visual-integrity.css");
const integrityJsPath = path.join(out, "v1", "visual-integrity.js");
if (!fs.existsSync(integrityCssPath) || !fs.existsSync(integrityJsPath)) fail("generated visual integrity assets are missing");
const integrityCss = read(integrityCssPath);
const integrityJs = read(integrityJsPath);

for (const marker of [
  ".plan-preview{",
  ".plus-banner{",
  ".v1-reef-dashboard{",
  "#view-reef .v1-reef-vault",
  '[data-visual-empty-surface="true"]',
]) {
  if (!integrityCss.includes(marker)) fail(`visual integrity CSS is missing ${marker}`);
}
for (const marker of [
  "removeTemplateBadges",
  "normalizeDisplayTracking",
  "removeDecorativeAccentStripes",
  "compactOversizedStatusPills",
  "collapseEmptyOversizedSurfaces",
]) {
  if (!integrityJs.includes(marker)) fail(`visual integrity JavaScript is missing ${marker}`);
}

console.log("Visual integrity audit passed: no fake LIVE badges, display-size tracking, thick accent stripes, oversized status pills, or giant generic cards.");
