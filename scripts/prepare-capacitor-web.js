const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const entries = [
  "index.html",
  "phase1-runtime.js",
  "phase1-commerce.js",
  "phase2-polish.js",
  "phase2-polish.css",
  "manifest.webmanifest",
  "privacy.html",
  "terms.html",
  "support.html",
  "assets",
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

const indexPath = path.join(root, "index.html");
if (!fs.existsSync(indexPath)) throw new Error("Missing root index.html");
const source = fs.readFileSync(indexPath, "utf8");
const commerceSource = fs.readFileSync(path.join(root, "phase1-commerce.js"), "utf8");
const requiredMarkers = [
  "plus-tank-hero",
  '<script src="./phase1-runtime.js"></script>',
  '<script src="./phase1-commerce.js"></script>',
  "gillie.plus.monthly",
  "gillie.plus.yearly",
];
for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Canonical index.html is missing required production marker: ${marker}`);
  }
}
for (const marker of ["phase2-polish.css", "phase2-polish.js"]) {
  if (!commerceSource.includes(marker)) {
    throw new Error(`Commerce loader is missing Phase 2 asset: ${marker}`);
  }
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const entry of entries) {
  const src = path.join(root, entry);
  if (!fs.existsSync(src)) throw new Error(`Missing required Capacitor asset: ${entry}`);
  copyRecursive(src, path.join(out, entry));
}

/*
 * Production startup fix.
 *
 * The original Reef MutationObserver watched child-list and all attribute
 * mutations. Its callback then rewrote observed data attributes, ARIA text,
 * and badge text every time it ran. That created a self-sustaining microtask
 * loop which starved splash-removal timers and WKWebView recovery work.
 */
const phase2OutputPath = path.join(out, "phase2-polish.js");
let phase2Output = fs.readFileSync(phase2OutputPath, "utf8");

const observerNeedle = '    const observer = new MutationObserver(decorateReefCards);\n    [$("#theme-row"), $("#buddy-grid"), $("#shop-grid")].filter(Boolean).forEach((node) => observer.observe(node, { childList: true, subtree: true, attributes: true }));';
const observerReplacement = '    let reefDecorateQueued = false;\n    const observer = new MutationObserver(() => {\n      if (reefDecorateQueued) return;\n      reefDecorateQueued = true;\n      requestAnimationFrame(() => {\n        reefDecorateQueued = false;\n        decorateReefCards();\n      });\n    });\n    [$("#theme-row"), $("#buddy-grid"), $("#shop-grid")].filter(Boolean).forEach((node) => observer.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] }));';

if (!phase2Output.includes(observerNeedle)) {
  throw new Error("Phase 2 Reef observer marker changed; refusing to build without the startup-loop fix.");
}
phase2Output = phase2Output.replace(observerNeedle, observerReplacement);

const decoratorStart = phase2Output.indexOf("  function decorateReefCards() {");
const decoratorEnd = phase2Output.indexOf("\n\n  function filterReef", decoratorStart);
if (decoratorStart < 0 || decoratorEnd < 0) {
  throw new Error("Could not locate decorateReefCards for the startup-loop fix.");
}

const fixedDecorator = `  function decorateReefCards() {
    $$("#view-reef .theme-card, #view-reef .shop-card, #view-reef .buddy-card").forEach((card) => {
      const text = card.textContent.toLowerCase();
      const owned = card.classList.contains("owned") || card.classList.contains("equipped") || /owned|equipped|wearing|active/.test(text);
      const plus = /plus|locked/.test(text) || card.classList.contains("locked");
      const ownedValue = owned ? "true" : "false";
      const plusValue = plus ? "true" : "false";
      const badgeText = owned ? (card.classList.contains("equipped") ? "Equipped" : "Owned") : plus ? "Plus" : "Pearls";
      const description = plus && !appState()?.premium
        ? "Gillie Plus item. Tap to see how to unlock it."
        : owned
          ? "Owned item."
          : "Available Reef item.";

      if (card.dataset.phase2Owned !== ownedValue) card.dataset.phase2Owned = ownedValue;
      if (card.dataset.phase2Plus !== plusValue) card.dataset.phase2Plus = plusValue;

      let badge = $(".phase2-card-badge", card);
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "phase2-card-badge";
        badge.textContent = badgeText;
        card.appendChild(badge);
      } else if (badge.textContent !== badgeText) {
        badge.textContent = badgeText;
      }

      if (card.getAttribute("aria-description") !== description) {
        card.setAttribute("aria-description", description);
      }
    });
  }`;
phase2Output = `${phase2Output.slice(0, decoratorStart)}${fixedDecorator}${phase2Output.slice(decoratorEnd)}`;

/*
 * Tap and motion fix.
 *
 * Phase 2 previously animated transform on #axo-wrap and #axo-svg while the
 * production aquarium already used those same transform properties for
 * centering, drifting, flipping, and floating. Touch pointermove also fired
 * the desktop follow behavior. The result was snapping and duplicate tap
 * reactions. Keep mobile taps single, leave route movement to the production
 * drift loop, and use the existing inner-SVG tap animation.
 */
const aliveStart = phase2Output.indexOf("  function installGillieAlive() {");
const aliveEnd = phase2Output.indexOf("\n\n  function spawnTankHearts() {", aliveStart);
if (aliveStart < 0 || aliveEnd < 0) {
  throw new Error("Could not locate Gillie Alive functions for the motion fix.");
}

const fixedAlive = `  function installGillieAlive() {
    const tank = $("#tank");
    const wrap = $("#axo-wrap");
    if (!tank || !wrap) return;
    wrap.classList.add("phase2-alive");

    tank.addEventListener("pointermove", (event) => {
      if (preferences.reducedMotion) return;
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      const rect = tank.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      tank.style.setProperty("--phase2-look-x", x.toFixed(3));
      tank.style.setProperty("--phase2-look-y", y.toFixed(3));
      wrap.classList.add("phase2-following");
      clearTimeout(tank.__phase2FollowTimer);
      tank.__phase2FollowTimer = setTimeout(() => wrap.classList.remove("phase2-following"), 900);
    }, { passive: true });

    tank.addEventListener("pointerleave", () => wrap.classList.remove("phase2-following"));

    wrap.addEventListener("pointerdown", (event) => {
      event.stopImmediatePropagation();
      reactToTankTap();
    }, { capture: true });

    clearInterval(aliveTimer);
    aliveTimer = setInterval(() => {
      if (document.hidden || preferences.reducedMotion || $("#main")?.hidden) return;
      const moods = ["phase2-curious", "phase2-snoozy", "phase2-proud"];
      wrap.classList.remove(...moods);
      const current = appState();
      const recentSlip = current?.justSlippedAt && now() - current.justSlippedAt < 6 * 3600000;
      const mood = recentSlip ? "phase2-snoozy" : moods[Math.floor(Math.random() * moods.length)];
      wrap.classList.add(mood);
      clearTimeout(wrap.__phase2MoodTimer);
      wrap.__phase2MoodTimer = setTimeout(() => wrap.classList.remove(mood), 3800);
    }, 9000);
  }

  function reactToTankTap() {
    const svg = $("#axo-svg");
    const speech = $("#speech");
    if (!svg || !speech) return;
    const lines = [
      "I’m here, team.",
      "One clean decision at a time.",
      "That tap counts as checking in on me.",
      "The water remembers every hour you protected.",
      "You handle the urge. I’ll handle the bubbles.",
    ];

    svg.classList.remove("tapjoy");
    void svg.offsetWidth;
    svg.classList.add("tapjoy");
    clearTimeout(svg.__phase2TapTimer);
    svg.__phase2TapTimer = setTimeout(() => svg.classList.remove("tapjoy"), 760);

    speech.textContent = lines[Math.floor(Math.random() * lines.length)];
    speech.classList.remove("phase2-speech-pop");
    void speech.offsetWidth;
    speech.classList.add("phase2-speech-pop");
    clearTimeout(speech.__phase2PopTimer);
    speech.__phase2PopTimer = setTimeout(() => speech.classList.remove("phase2-speech-pop"), 650);

    haptic("medium");
    tone("bubble");
    spawnTankHearts();
    track("tank_gillie_tapped");
  }`;
phase2Output = `${phase2Output.slice(0, aliveStart)}${fixedAlive}${phase2Output.slice(aliveEnd)}`;
phase2Output = `/* Gillie startup and companion-motion fixes applied. */\n${phase2Output}`;
fs.writeFileSync(phase2OutputPath, phase2Output, "utf8");

const phase2CssOutputPath = path.join(out, "phase2-polish.css");
let phase2CssOutput = fs.readFileSync(phase2CssOutputPath, "utf8");
phase2CssOutput += `

/* Build 25: preserve aquarium centering and keep tap speech inside the tank. */
#axo-wrap{
  transition:left 4.8s cubic-bezier(.37,0,.18,1),top 4.8s cubic-bezier(.37,0,.18,1),width 1.2s ease,filter .45s ease!important;
  backface-visibility:hidden;
  -webkit-backface-visibility:hidden;
}
#axo-wrap.phase2-alive{
  animation:float 6.4s ease-in-out infinite!important;
  transform-origin:50% 55%;
  will-change:left,top,transform;
}
#axo-wrap.phase2-alive #axo-svg{
  animation:none!important;
  will-change:transform;
}
#axo-wrap.phase2-alive #axo-svg.tapjoy{
  animation:tapBounce .7s cubic-bezier(.35,.9,.4,1)!important;
}
#axo-wrap.phase2-alive #axo-svg.celebrate{
  animation:celebrate .95s cubic-bezier(.35,.8,.35,1)!important;
}
#axo-wrap.phase2-following{
  animation:float 6.4s ease-in-out infinite!important;
  translate:calc(var(--phase2-look-x,0) * 12px) calc(var(--phase2-look-y,0) * 7px);
  transition:left 4.8s cubic-bezier(.37,0,.18,1),top 4.8s cubic-bezier(.37,0,.18,1),translate .42s cubic-bezier(.2,.75,.25,1),filter .45s ease!important;
}
#axo-wrap.phase2-petted,
#axo-wrap.phase2-playful,
#axo-wrap.phase2-feeding{
  animation:float 6.4s ease-in-out infinite!important;
}
#axo-wrap.phase2-curious{animation-duration:6.4s!important;filter:brightness(1.03)}
#axo-wrap.phase2-playful{filter:saturate(1.06) brightness(1.03)}
#axo-wrap.phase2-feeding{filter:brightness(1.06)}

#speech{
  left:50%!important;
  right:auto!important;
  width:calc(100% - 28px)!important;
  max-width:360px!important;
  transform:translateX(-50%)!important;
  white-space:normal;
  overflow-wrap:anywhere;
  word-break:normal;
  line-height:1.28;
  z-index:30;
  will-change:transform,opacity;
}
#speech.phase2-speech-pop{
  animation:phase2SpeechSafe .55s cubic-bezier(.2,.85,.3,1) both!important;
}
@keyframes phase2SpeechSafe{
  0%{opacity:.18;transform:translateX(-50%) translateY(8px) scale(.97)}
  65%{opacity:1;transform:translateX(-50%) translateY(-2px) scale(1.01)}
  100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}
}
`;
fs.writeFileSync(phase2CssOutputPath, phase2CssOutput, "utf8");

for (const marker of [
  "Gillie startup and companion-motion fixes applied",
  "event.pointerType !== \"mouse\"",
  "phase2SpeechSafe",
  "attributeFilter: [\"class\"]",
]) {
  const target = marker === "phase2SpeechSafe" ? phase2CssOutput : phase2Output;
  if (!target.includes(marker)) throw new Error(`Generated Gillie fix marker is missing: ${marker}`);
}

console.log("Prepared Gillie web assets with startup, tap-bubble, and fluid-motion fixes.");
