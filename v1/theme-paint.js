/* Gillie V1 Theme Paint — unmistakable water palettes and correct tank stacking. */
(() => {
  "use strict";

  if (window.__gillieThemePaintInstalled) return;
  window.__gillieThemePaintInstalled = true;

  const ENGINE = "theme-paint-v1";
  const PALETTES = Object.freeze({
    clear: null,
    sunset: {
      waterTop: "#F6B779",
      waterBottom: "#D96C82",
      sand: "#F2D2A8",
      overlay: "linear-gradient(180deg, rgba(255,196,122,.34), rgba(220,82,116,.30))",
      blend: "soft-light",
    },
    abyss: {
      waterTop: "#3F5E91",
      waterBottom: "#14244C",
      sand: "#9AA4B8",
      overlay: "linear-gradient(180deg, rgba(51,79,132,.30), rgba(7,17,48,.50))",
      blend: "multiply",
    },
    sakura: {
      waterTop: "#F6BDD3",
      waterBottom: "#C985B0",
      sand: "#F6DCCB",
      overlay: "linear-gradient(180deg, rgba(255,218,232,.32), rgba(224,122,173,.28))",
      blend: "soft-light",
    },
    moonlit: {
      waterTop: "#6878AF",
      waterBottom: "#202B62",
      sand: "#9296AC",
      overlay: "linear-gradient(180deg, rgba(113,126,188,.28), rgba(13,21,61,.48))",
      blend: "multiply",
    },
  });

  let painting = false;
  let observer = null;
  let lastSignature = "";

  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const $$ = (selector, root = document) => Array.from(root?.querySelectorAll?.(selector) || []);

  function currentState() {
    try { return typeof state !== "undefined" && state ? state : null; } catch (_) { return null; }
  }

  function selectedThemeId() {
    try {
      const active = window.GillieThemeEngine?.active?.();
      if (active?.id) return active.id;
    } catch (_) {}
    const current = currentState();
    return current?.premium ? String(current.theme || "clear") : "clear";
  }

  function tanks() {
    const result = new Set();
    const primary = $("#tank");
    if (primary) result.add(primary);
    $$(".tank, .v1-tank-preview, .phase2-tank-clone").forEach((tank) => result.add(tank));
    return Array.from(result).filter((tank) => tank?.isConnected !== false);
  }

  function themeLayer(tank) {
    let layer = $("[data-gillie-theme-layer='true']", tank) || $("#theme-tint", tank) || $(".theme-tint", tank);
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "theme-tint";
      tank.appendChild(layer);
    }
    layer.dataset.gillieThemeLayer = "true";
    layer.setAttribute("aria-hidden", "true");
    if (tank.id === "tank") layer.id = "theme-tint";
    else if (layer.id === "theme-tint") layer.removeAttribute("id");
    return layer;
  }

  function placeLayerAboveMurk(tank, layer) {
    const speech = $("#speech, .speech", tank);
    const murk = $("#murk, .murk", tank);

    if (speech) {
      if (layer.nextElementSibling !== speech) tank.insertBefore(layer, speech);
      return;
    }
    if (murk) {
      if (murk.nextElementSibling !== layer) murk.insertAdjacentElement("afterend", layer);
      return;
    }
    if (tank.lastElementChild !== layer) tank.appendChild(layer);
  }

  function clearPaint(tank, layer) {
    for (const property of ["--w1", "--w2", "--sand", "--gillie-theme-water-top", "--gillie-theme-water-bottom", "--gillie-theme-sand"]) {
      tank.style.removeProperty(property);
    }
    tank.style.removeProperty("background");
    tank.style.removeProperty("background-color");
    tank.dataset.gillieThemePaint = "clear";
    layer.style.setProperty("opacity", "0", "important");
    layer.style.setProperty("background", "transparent", "important");
    layer.style.setProperty("mix-blend-mode", "normal", "important");
  }

  function applyPaint(tank, themeId) {
    const layer = themeLayer(tank);
    placeLayerAboveMurk(tank, layer);
    const palette = PALETTES[themeId] || null;

    layer.style.setProperty("position", "absolute", "important");
    layer.style.setProperty("inset", "0", "important");
    layer.style.setProperty("z-index", "3", "important");
    layer.style.setProperty("pointer-events", "none", "important");
    layer.style.setProperty("border-radius", "inherit", "important");
    layer.style.setProperty("visibility", "visible", "important");
    layer.style.setProperty("display", "block", "important");
    layer.style.setProperty("transition", "opacity .28s ease, background .28s ease", "important");

    if (!palette) {
      clearPaint(tank, layer);
      return;
    }

    tank.dataset.gillieThemePaint = themeId;
    tank.style.setProperty("--w1", palette.waterTop, "important");
    tank.style.setProperty("--w2", palette.waterBottom, "important");
    tank.style.setProperty("--sand", palette.sand, "important");
    tank.style.setProperty("--gillie-theme-water-top", palette.waterTop);
    tank.style.setProperty("--gillie-theme-water-bottom", palette.waterBottom);
    tank.style.setProperty("--gillie-theme-sand", palette.sand);
    tank.style.setProperty("background-color", palette.waterBottom, "important");
    tank.style.setProperty(
      "background",
      `radial-gradient(105% 76% at 50% 20%, rgba(255,255,255,.20), transparent 56%), linear-gradient(180deg, ${palette.waterTop}, ${palette.waterBottom} 76%, ${palette.sand} 76.5%)`,
      "important",
    );

    layer.style.setProperty("background", palette.overlay, "important");
    layer.style.setProperty("mix-blend-mode", palette.blend, "important");
    layer.style.setProperty("opacity", "1", "important");
  }

  function paint(reason = "render") {
    if (painting) return false;
    const current = currentState();
    const themeId = selectedThemeId();
    const targets = tanks();
    if (!current || !targets.length) return false;

    painting = true;
    try {
      targets.forEach((tank) => applyPaint(tank, themeId));
      const palette = PALETTES[themeId];
      if (palette) document.documentElement?.style?.setProperty("--sand", palette.sand);

      const signature = `${themeId}:${targets.length}:${Boolean(current.premium)}`;
      if (signature !== lastSignature) {
        lastSignature = signature;
        try {
          window.Capacitor?.Plugins?.GilliePurchases?.trackEvent?.({
            name: "reef_theme_painted",
            properties: { engine: ENGINE, theme: themeId, tanks: targets.length, reason },
          });
        } catch (_) {}
      }
      document.dispatchEvent?.(new CustomEvent("gillie:theme-painted", {
        detail: { theme: themeId, tanks: targets.length, reason },
      }));
      return true;
    } finally {
      painting = false;
    }
  }

  function relevantMutation(mutation) {
    const target = mutation.target;
    if (target?.id === "tank" || target?.closest?.(".tank, #theme-row")) return true;
    return Array.from(mutation.addedNodes || []).some((node) =>
      node?.matches?.(".tank, .v1-tank-preview, .phase2-tank-clone, #theme-row") ||
      node?.querySelector?.(".tank, .v1-tank-preview, .phase2-tank-clone, #theme-row")
    );
  }

  function installObserver() {
    if (observer || !document.body || typeof MutationObserver !== "function") return;
    observer = new MutationObserver((mutations) => {
      if (painting || !mutations.some(relevantMutation)) return;
      requestAnimationFrame(() => paint("dom-update"));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function install() {
    document.addEventListener("gillie:theme-applied", () => paint("theme-applied"));
    document.addEventListener("gillie:purchase-flow-settled", () => setTimeout(() => paint("purchase-settled"), 40));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) setTimeout(() => paint("foreground"), 40);
    });
    window.GillieV1?.afterRender?.(() => requestAnimationFrame(() => paint("v1-render")));

    installObserver();
    paint("install");
    requestAnimationFrame(() => paint("install-frame"));
    setTimeout(() => paint("install-settled"), 180);

    window.GillieThemePaint = Object.freeze({
      apply: paint,
      selected: selectedThemeId,
      tanks,
      palettes: PALETTES,
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
