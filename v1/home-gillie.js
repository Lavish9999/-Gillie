/* Gillie V1 Home character — direct-coordinate six-frond anatomy for the live tank. */
(() => {
  "use strict";

  const ENGINE = "home-gillie-direct-gills-v3";
  const original = typeof window.axoSVG === "function"
    ? window.axoSVG
    : (typeof axoSVG === "function" ? axoSVG : null);

  if (!original || original.__gillieDirectGills === true) return;

  const LEGACY_GILL_GROUP = /<g class="gill[^"]*" transform="[^"]*">[\s\S]*?<\/g>/g;

  function directGillMarkup(ns) {
    const fill = `url(#${ns}-gill)`;
    return `
      <path class="axo-gill-frond" data-home-gill="left-upper" d="M45 53 C36 45 27 35 16 34 C11 34 8 38 10 43 C16 52 29 56 44 57 Z" fill="${fill}"/>
      <path class="axo-gill-vein" d="M42 52 C33 47 25 42 17 41"/>
      <path class="axo-gill-frond" data-home-gill="left-middle" d="M40 67 C28 61 15 60 7 65 C3 68 4 74 8 78 C18 84 31 79 42 72 Z" fill="${fill}"/>
      <path class="axo-gill-vein" d="M37 68 C27 66 18 68 10 72"/>
      <path class="axo-gill-frond" data-home-gill="left-lower" d="M45 84 C34 88 24 97 21 107 C19 112 23 116 29 115 C40 112 48 102 51 91 Z" fill="${fill}"/>
      <path class="axo-gill-vein" d="M43 88 C35 94 29 101 27 109"/>

      <path class="axo-gill-frond" data-home-gill="right-upper" d="M103 53 C112 45 121 35 132 34 C137 34 140 38 138 43 C132 52 119 56 104 57 Z" fill="${fill}"/>
      <path class="axo-gill-vein" d="M106 52 C115 47 123 42 131 41"/>
      <path class="axo-gill-frond" data-home-gill="right-middle" d="M108 67 C120 61 133 60 141 65 C145 68 144 74 140 78 C130 84 117 79 106 72 Z" fill="${fill}"/>
      <path class="axo-gill-vein" d="M111 68 C121 66 130 68 138 72"/>
      <path class="axo-gill-frond" data-home-gill="right-lower" d="M103 84 C114 88 124 97 127 107 C129 112 125 116 119 115 C108 112 100 102 97 91 Z" fill="${fill}"/>
      <path class="axo-gill-vein" d="M105 88 C113 94 119 101 121 109"/>
    `;
  }

  function replaceHomeGills(markup, ns) {
    const source = String(markup || "");
    if (ns !== "main") return source;

    const matches = source.match(LEGACY_GILL_GROUP) || [];
    if (matches.length !== 6) {
      console.warn(`Home Gillie direct-gill renderer expected 6 legacy groups and found ${matches.length}.`);
      return source;
    }

    const withoutLegacy = source.replace(LEGACY_GILL_GROUP, "");
    const anchor = '<g class="axo-core">';
    if (!withoutLegacy.includes(anchor)) {
      console.warn("Home Gillie direct-gill renderer could not find the axo-core anchor.");
      return source;
    }

    return withoutLegacy.replace(anchor, `${anchor}${directGillMarkup(ns)}`);
  }

  function hardenedAxoSVG(...args) {
    const ns = String(args[3] || "main");
    return replaceHomeGills(original.apply(this, args), ns);
  }

  Object.defineProperty(hardenedAxoSVG, "__gillieDirectGills", {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
  Object.defineProperty(hardenedAxoSVG, "__gillieOriginalAxoSVG", {
    value: original,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  window.axoSVG = hardenedAxoSVG;
  try { axoSVG = hardenedAxoSVG; } catch (_) {}

  document.documentElement.dataset.homeGillieEngine = ENGINE;

  try {
    if (typeof renderAxo === "function") renderAxo();
  } catch (error) {
    console.warn("Home Gillie could not repaint after direct-gill installation.", error);
  }
})();
