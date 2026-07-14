/* Gillie V1 Theme Engine — reliable theme selection, immediate tank updates, and persistence. */
(() => {
  "use strict";

  if (window.__gillieThemeEngineInstalled) return;
  window.__gillieThemeEngineInstalled = true;

  const ENGINE = "theme-engine-v1";
  const FALLBACK_THEMES = Object.freeze({
    clear: { id: "clear", name: "Clearwater", tint: "transparent", blend: "normal", sand: "#EDDDBC", premium: false },
    sunset: { id: "sunset", name: "Sunset Lagoon", tint: "linear-gradient(180deg, rgba(255,158,92,.56), rgba(242,112,138,.42))", blend: "soft-light", sand: "#F2D2A8", premium: true },
    abyss: { id: "abyss", name: "Abyss", tint: "linear-gradient(180deg, rgba(24,46,92,.48), rgba(10,22,54,.64))", blend: "multiply", sand: "#9AA4B8", premium: true },
    sakura: { id: "sakura", name: "Sakura", tint: "linear-gradient(180deg, rgba(255,190,214,.62), rgba(255,150,190,.42))", blend: "soft-light", sand: "#F6DCCB", premium: true },
    moonlit: { id: "moonlit", name: "Moonlit Reef", tint: "linear-gradient(180deg, rgba(79,91,154,.42), rgba(16,25,67,.72))", blend: "multiply", sand: "#9296AC", premium: true },
  });

  let applying = false;
  let observer = null;
  let lastApplied = "";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function currentState() {
    try { return typeof state !== "undefined" && state ? state : null; } catch (_) { return null; }
  }

  function track(name, properties = {}) {
    try {
      window.Capacitor?.Plugins?.GilliePurchases?.trackEvent?.({ name, properties: { engine: ENGINE, ...properties } });
    } catch (_) {}
  }

  function catalog() {
    const map = new Map(Object.entries(FALLBACK_THEMES));
    try {
      if (typeof THEMES !== "undefined" && Array.isArray(THEMES)) {
        THEMES.forEach((theme) => {
          if (!theme?.id) return;
          map.set(theme.id, { ...(map.get(theme.id) || {}), ...theme });
        });
      }
    } catch (_) {}
    return map;
  }

  function themeFor(id) {
    const themes = catalog();
    return themes.get(id) || themes.get("clear") || FALLBACK_THEMES.clear;
  }

  function activeTheme(current = currentState()) {
    if (!current?.premium) return themeFor("clear");
    return themeFor(current.theme || "clear");
  }

  function ensureTintLayer(tank) {
    let tint = $("#theme-tint", tank) || $("#theme-tint");
    if (!tint) {
      tint = document.createElement("div");
      tint.id = "theme-tint";
      tank.appendChild(tint);
    } else if (tint.parentElement !== tank) {
      tank.appendChild(tint);
    }
    tint.setAttribute("aria-hidden", "true");
    return tint;
  }

  function updateSelection(themeId, current = currentState()) {
    $$("#theme-row [data-theme]").forEach((button) => {
      const theme = themeFor(button.dataset.theme);
      const selected = button.dataset.theme === themeId;
      const locked = Boolean(theme.premium && !current?.premium);
      button.classList.toggle("on", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.dataset.themeActive = selected ? "true" : "false";
      button.dataset.themeLocked = locked ? "true" : "false";
      button.setAttribute("aria-label", `${theme.name || button.dataset.theme}${selected ? ", active" : locked ? ", Gillie Plus" : ""}`);
    });
  }

  function applyThemeImmediately(reason = "render") {
    if (applying) return false;
    const current = currentState();
    const tank = $("#tank");
    if (!current || !tank) return false;

    applying = true;
    try {
      const theme = activeTheme(current);
      const tint = ensureTintLayer(tank);
      const isClear = theme.id === "clear";

      tank.dataset.gillieTheme = theme.id;
      tank.style.setProperty("--gillie-theme-tint", theme.tint || "transparent");
      tank.style.setProperty("--gillie-theme-sand", theme.sand || "#EDDDBC");
      document.documentElement.style.setProperty("--sand", theme.sand || "#EDDDBC");

      tint.style.setProperty("position", "absolute", "important");
      tint.style.setProperty("inset", "0", "important");
      tint.style.setProperty("z-index", "2", "important");
      tint.style.setProperty("pointer-events", "none", "important");
      tint.style.setProperty("border-radius", "inherit", "important");
      tint.style.setProperty("background", theme.tint || "transparent", "important");
      tint.style.setProperty("mix-blend-mode", theme.blend || "normal", "important");
      tint.style.setProperty("opacity", isClear ? "0" : "1", "important");
      tint.style.setProperty("visibility", "visible", "important");
      tint.style.setProperty("display", "block", "important");
      tint.style.setProperty("transition", "opacity .28s ease, background .28s ease", "important");

      updateSelection(theme.id, current);
      const signature = `${theme.id}:${Boolean(current.premium)}`;
      if (signature !== lastApplied) {
        lastApplied = signature;
        track("reef_theme_applied", { theme: theme.id, premium: Boolean(current.premium), reason });
      }
      document.dispatchEvent(new CustomEvent("gillie:theme-applied", { detail: { theme: theme.id, reason } }));
      return true;
    } finally {
      applying = false;
    }
  }

  function persist() {
    try { if (typeof save === "function") save(); } catch (_) {}
  }

  function showPlus() {
    try {
      if (typeof openPlus === "function") {
        openPlus();
        return;
      }
    } catch (_) {}
    ($("#plus-open") || $("#set-plus") || $("[data-act='plus']"))?.click();
  }

  function announce(theme) {
    try {
      if (typeof toast === "function") toast("🎨", `${currentState()?.petName || "Gillie"}'s tank is now ${theme.name}.`);
    } catch (_) {}
  }

  function selectTheme(themeId, { announceSelection = true, reason = "tap" } = {}) {
    const current = currentState();
    if (!current) return false;
    const theme = themeFor(themeId);

    if (theme.premium && !current.premium) {
      track("reef_theme_locked_tapped", { theme: theme.id });
      showPlus();
      return false;
    }

    current.theme = theme.id;
    persist();
    applyThemeImmediately(reason);
    try { if (typeof renderThemes === "function") renderThemes(); } catch (_) {}
    requestAnimationFrame(() => applyThemeImmediately(`${reason}:after-render`));
    setTimeout(() => applyThemeImmediately(`${reason}:settled`), 80);
    if (announceSelection) announce(theme);
    track("reef_theme_selected", { theme: theme.id, premium: Boolean(current.premium), reason });
    return true;
  }

  function handleThemeClick(event) {
    const button = event.target.closest?.("#theme-row [data-theme]");
    if (!button) return;
    const theme = themeFor(button.dataset.theme);
    const current = currentState();

    event.preventDefault();
    event.stopImmediatePropagation();
    if (theme.premium && !current?.premium) {
      showPlus();
      track("reef_theme_locked_tapped", { theme: theme.id });
      return;
    }
    selectTheme(theme.id, { announceSelection: true, reason: "theme-card-tap" });
  }

  function installObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver((mutations) => {
      if (applying) return;
      const relevant = mutations.some((mutation) => {
        const target = mutation.target;
        return target?.id === "theme-row" || target?.id === "tank" || target?.closest?.("#theme-row, #tank");
      });
      if (relevant) requestAnimationFrame(() => applyThemeImmediately("dom-update"));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function install() {
    document.addEventListener("click", handleThemeClick, true);
    document.addEventListener("gillie:purchase-flow-settled", () => setTimeout(() => applyThemeImmediately("purchase-settled"), 40));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) setTimeout(() => applyThemeImmediately("foreground"), 40);
    });
    installObserver();
    applyThemeImmediately("install");
    requestAnimationFrame(() => applyThemeImmediately("install-frame"));
    setTimeout(() => applyThemeImmediately("install-settled"), 180);
    window.GillieThemeEngine = Object.freeze({ apply: applyThemeImmediately, select: selectTheme, active: () => activeTheme(currentState()) });
    track("reef_theme_engine_loaded", { engine: ENGINE });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
