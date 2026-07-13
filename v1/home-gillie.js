/* Gillie V1 Home character — isolate authored gill placement from global transform animations. */
(() => {
  "use strict";

  const ENGINE = "home-gillie-static-gills-v2";
  const original = typeof window.axoSVG === "function"
    ? window.axoSVG
    : (typeof axoSVG === "function" ? axoSVG : null);

  if (!original || original.__gillieStaticGills === true) return;

  function isolateGillClasses(markup) {
    let count = 0;
    const isolated = String(markup || "").replace(
      /class="gill(?=[\s"])([^"]*)"/g,
      (_match, suffix) => {
        count += 1;
        return `class="axo-gill-static${suffix}"`;
      },
    );

    // axoSVG has one canonical six-gill anatomy. Refuse to partially rewrite it.
    if (count !== 6) {
      console.warn(`Home Gillie gill isolation expected 6 groups and found ${count}.`);
      return String(markup || "");
    }
    return isolated;
  }

  function hardenedAxoSVG(...args) {
    return isolateGillClasses(original.apply(this, args));
  }

  Object.defineProperty(hardenedAxoSVG, "__gillieStaticGills", {
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

  // The legacy renderer may have painted once before deferred V1 assets loaded.
  // Repaint immediately with isolated gill classes; later renders use the wrapper.
  try {
    if (typeof renderAxo === "function") renderAxo();
  } catch (error) {
    console.warn("Home Gillie could not repaint after gill isolation.", error);
  }
})();
