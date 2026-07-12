/* Gillie V1 canonical coordinator — one boot path, late-module safe, no observers or polling loops. */
(() => {
  "use strict";

  if (window.GillieV1) return;

  const installers = [];
  const registeredNames = new Set();
  const installedNames = new Set();
  const renderHooks = [];
  let booted = false;
  let renderWrapped = false;

  const api = {
    version: "gillie-v1-2026.07.12.3",
    register(name, installer) {
      if (typeof installer !== "function") return;
      const moduleName = String(name || `module-${installers.length + 1}`);
      if (registeredNames.has(moduleName)) return;

      const entry = { name: moduleName, installer };
      registeredNames.add(moduleName);
      installers.push(entry);

      // Deferred scripts execute in order, but core can boot before the later
      // module files have registered. Install late registrations immediately.
      if (booted) queueMicrotask(() => installEntry(entry));
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
    get installedModules() {
      return Array.from(installedNames);
    },
    get isBooted() {
      return booted;
    },
  };

  window.GillieV1 = api;

  function updateRuntimeMarker() {
    const root = document.documentElement;
    if (!root) return;
    const names = Array.from(installedNames).sort();
    root.dataset.gillieV1ModuleCount = String(names.length);
    root.dataset.gillieV1Modules = names.join(",");
  }

  function installEntry(entry) {
    if (!entry || installedNames.has(entry.name)) return;
    installedNames.add(entry.name);
    try {
      entry.installer(api);
      updateRuntimeMarker();
      api.track("v1_module_installed", { module: entry.name, moduleCount: installedNames.size });
    } catch (error) {
      installedNames.delete(entry.name);
      updateRuntimeMarker();
      console.warn(`Gillie V1 module failed: ${entry.name}`, error);
    }
  }

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

    for (const entry of installers) installEntry(entry);

    document.querySelector("#tabs")?.addEventListener("click", () => {
      requestAnimationFrame(runRenderHooks);
      setTimeout(runRenderHooks, 120);
    }, true);

    updateRuntimeMarker();
    runRenderHooks();
    api.track("v1_canonical_booted", {
      registeredModules: installers.length,
      installedModules: installedNames.size,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot(), { once: true });
  } else {
    boot();
  }
})();
