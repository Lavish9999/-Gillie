/* Gillie V1 Theme Access — basic tank themes work independently of Gillie Plus. */
(() => {
  "use strict";

  if (window.__gillieThemeAccessInstalled) return;
  window.__gillieThemeAccessInstalled = true;

  const ENGINE = "theme-access-v1-basic-free";
  const BASIC_THEME_IDS = new Set(["clear", "sunset", "abyss", "sakura"]);

  function unlockBasicThemes() {
    try {
      if (typeof THEMES !== "undefined" && Array.isArray(THEMES)) {
        THEMES.forEach((theme) => {
          if (BASIC_THEME_IDS.has(theme?.id)) theme.premium = false;
        });
      }
    } catch (_) {}

    document.documentElement.dataset.themeAccessEngine = ENGINE;
    document.dispatchEvent?.(new CustomEvent("gillie:theme-access-ready", {
      detail: { engine: ENGINE, freeThemes: Array.from(BASIC_THEME_IDS) },
    }));
  }

  unlockBasicThemes();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", unlockBasicThemes, { once: true });
  }

  window.GillieThemeAccess = Object.freeze({
    engine: ENGINE,
    freeThemeIds: Array.from(BASIC_THEME_IDS),
    refresh: unlockBasicThemes,
    isFree: (themeId) => BASIC_THEME_IDS.has(String(themeId || "")),
  });
})();
