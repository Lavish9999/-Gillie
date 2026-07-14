/* Gillie V1 Theme Access — core tank themes work independently of Gillie Plus. */
(() => {
  "use strict";

  if (window.__gillieThemeAccessInstalled) return;
  window.__gillieThemeAccessInstalled = true;

  const ENGINE = "theme-access-v1-basic-free";
  const BASIC_THEME_IDS = new Set(["clear", "sunset", "abyss", "sakura"]);
  let adaptedEngine = null;

  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const $$ = (selector, root = document) => Array.from(root?.querySelectorAll?.(selector) || []);

  function currentState() {
    try { return typeof state !== "undefined" && state ? state : null; } catch (_) { return null; }
  }

  function themeRecord(themeId) {
    const id = String(themeId || "clear");
    try {
      if (typeof THEMES !== "undefined" && Array.isArray(THEMES)) {
        const match = THEMES.find((theme) => theme?.id === id);
        if (match) return match;
      }
    } catch (_) {}
    return { id, name: id === "clear" ? "Clearwater" : id, premium: !BASIC_THEME_IDS.has(id) };
  }

  function persist() {
    try { if (typeof save === "function") save(); } catch (_) {}
  }

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

  function updateButtons(themeId) {
    $$("#theme-row [data-theme]").forEach((button) => {
      const selected = button.dataset.theme === themeId;
      const free = BASIC_THEME_IDS.has(button.dataset.theme);
      button.classList.toggle("on", selected);
      button.setAttribute("aria-pressed", String(selected));
      if (free) {
        button.dataset.themeLocked = "false";
        button.setAttribute("aria-label", `${themeRecord(button.dataset.theme).name}${selected ? ", active" : ""}`);
      }
    });
  }

  function repaint(reason) {
    requestAnimationFrame?.(() => {
      try { window.GillieThemePaint?.apply?.(reason); } catch (_) {}
    });
  }

  function selectBasicTheme(themeId, options = {}) {
    const id = String(themeId || "clear");
    if (!BASIC_THEME_IDS.has(id)) return adaptedEngine?.select?.(id, options) ?? false;
    const current = currentState();
    if (!current) return false;

    unlockBasicThemes();
    current.theme = id;
    persist();
    try { if (typeof renderThemes === "function") renderThemes(); } catch (_) {}
    updateButtons(id);
    try { adaptedEngine?.apply?.(`theme-access:${options.reason || "select"}`); } catch (_) {}
    repaint(`theme-access:${options.reason || "select"}`);

    if (options.announceSelection !== false) {
      try {
        const name = themeRecord(id).name;
        if (typeof toast === "function") toast("🎨", `${current.petName || "Gillie"}'s tank is now ${name}.`);
      } catch (_) {}
    }
    try {
      window.Capacitor?.Plugins?.GilliePurchases?.trackEvent?.({
        name: "reef_free_theme_selected",
        properties: { engine: ENGINE, theme: id },
      });
    } catch (_) {}
    return true;
  }

  function activeTheme() {
    const current = currentState();
    const id = String(current?.theme || "clear");
    if (BASIC_THEME_IDS.has(id)) return themeRecord(id);
    return adaptedEngine?.active?.() || themeRecord("clear");
  }

  function installEngineAdapter() {
    const candidate = window.GillieThemeEngine;
    if (!candidate || candidate === window.GillieThemeAccess?.engineAdapter || candidate === adaptedEngine) return Boolean(adaptedEngine);
    adaptedEngine = candidate;
    const wrapper = Object.freeze({
      ...candidate,
      active: activeTheme,
      select: selectBasicTheme,
    });
    window.GillieThemeEngine = wrapper;
    if (window.GillieThemeAccess) window.GillieThemeAccess.engineAdapter = wrapper;
    updateButtons(String(currentState()?.theme || "clear"));
    repaint("theme-access-adapter");
    return true;
  }

  function handleThemeClick(event) {
    const button = event.target?.closest?.("#theme-row [data-theme]");
    if (!button || !BASIC_THEME_IDS.has(button.dataset.theme)) return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    installEngineAdapter();
    selectBasicTheme(button.dataset.theme, { reason: "theme-card-tap" });
  }

  unlockBasicThemes();
  document.addEventListener?.("click", handleThemeClick, true);
  document.addEventListener?.("gillie:theme-applied", () => {
    installEngineAdapter();
    repaint("theme-engine-applied");
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      unlockBasicThemes();
      setTimeout(installEngineAdapter, 0);
      setTimeout(installEngineAdapter, 180);
    }, { once: true });
  } else {
    setTimeout(installEngineAdapter, 0);
    setTimeout(installEngineAdapter, 180);
  }

  const api = {
    engine: ENGINE,
    engineAdapter: null,
    freeThemeIds: Array.from(BASIC_THEME_IDS),
    refresh: () => {
      unlockBasicThemes();
      installEngineAdapter();
      repaint("theme-access-refresh");
    },
    isFree: (themeId) => BASIC_THEME_IDS.has(String(themeId || "")),
    select: selectBasicTheme,
    active: activeTheme,
  };
  window.GillieThemeAccess = api;
})();
