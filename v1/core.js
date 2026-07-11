/* Gillie V1 canonical coordinator — one boot path, no observers, no polling loops. */
(() => {
  "use strict";

  if (window.GillieV1) return;

  const installers = [];
  const renderHooks = [];
  let booted = false;
  let renderWrapped = false;

  const api = {
    version: "gillie-v1-2026.07.11",
    register(name, installer) {
      if (typeof installer === "function") installers.push({ name, installer });
    },
    afterRender(callback) {
      if (typeof callback === "function") renderHooks.push(callback);
    },
    qs(selector, root = document) {
      return root?.querySelector?.(selector) || null;
    },
    qsa(selector, root = document) {
      return Array.from(root?.querySelectorAll?.(selector) || []);
    },
    getState() {
      try { return typeof state !== "undefined" ? state : null; } catch (_) { return null; }
    },
    announce(message) {
      const live = document.querySelector("#phase2-live");
      if (live) live.textContent = String(message || "");
    },
    notify(icon, message) {
      try {
        if (typeof toast === "function") toast(icon, message);
        else api.announce(message);
      } catch (_) {
        api.announce(message);
      }
    },
    track(name, properties = {}) {
      try {
        window.Capacitor?.Plugins?.GilliePurchases?.trackEvent?.({
          name,
          properties: { surface: "v1", ...properties },
        });
      } catch (_) {}
    },
    runRenderHooks,
  };

  window.GillieV1 = api;

  function runRenderHooks() {
    for (const callback of renderHooks) {
      try { callback(); } catch (error) { console.warn("Gillie V1 render hook failed", error); }
    }
  }

  function wrapRenderAll() {
    if (renderWrapped || typeof renderAll !== "function") return;
    const original = renderAll;
    renderAll = function gillieV1RenderAll(...args) {
      const result = original.apply(this, args);
      queueMicrotask(runRenderHooks);
      return result;
    };
    renderWrapped = true;
  }

  function boot(attempt = 0) {
    if (booted) return;
    const ready = document.querySelector("#app") && api.getState();
    if (!ready && attempt < 120) {
      setTimeout(() => boot(attempt + 1), 25);
      return;
    }

    booted = true;
    document.documentElement.classList.add("gillie-v1-canonical");
    wrapRenderAll();

    for (const entry of installers) {
      try { entry.installer(api); }
      catch (error) { console.warn(`Gillie V1 module failed: ${entry.name}`, error); }
    }

    document.querySelector("#tabs")?.addEventListener("click", () => {
      requestAnimationFrame(runRenderHooks);
      setTimeout(runRenderHooks, 120);
    }, true);

    runRenderHooks();
    api.track("v1_canonical_booted", { modules: installers.length });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot(), { once: true });
  } else {
    boot();
  }
})();
