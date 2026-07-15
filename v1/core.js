/* Gillie V1 canonical coordinator — one boot path, late-module safe, strict tab isolation. */
(() => {
  "use strict";

  if (window.GillieV1) return;

  const VIEW_NAMES = ["home", "progress", "reef", "you"];
  const installers = [];
  const registeredNames = new Set();
  const installedNames = new Set();
  const renderHooks = [];
  let booted = false;
  let renderWrapped = false;
  let activeViewName = "home";

  const api = {
    version: "gillie-v1-2026.07.15.1",
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
    activateView(name, options = {}) {
      return enforceViewIsolation(name, options);
    },
    runRenderHooks,
    get activeView() {
      return activeViewName;
    },
    get installedModules() {
      return Array.from(installedNames);
    },
    get isBooted() {
      return booted;
    },
  };

  window.GillieV1 = api;

  function normalizeViewName(name) {
    return VIEW_NAMES.includes(String(name || "")) ? String(name) : "home";
  }

  function selectedViewName() {
    const selected = document.querySelector("#tabs button.on[data-view]")?.dataset?.view;
    if (VIEW_NAMES.includes(selected)) return selected;

    const visible = VIEW_NAMES.find((name) => {
      const view = document.querySelector(`#view-${name}`);
      return view && view.hidden === false && view.dataset?.v1Active !== "false";
    });
    return visible || activeViewName || "home";
  }

  function setInert(element, inactive) {
    if (!element) return;
    try { element.inert = inactive; } catch (_) {}
    if (inactive) element.setAttribute?.("inert", "");
    else element.removeAttribute?.("inert");
  }

  function releaseStaleShellLock() {
    const main = document.querySelector("#main");
    if (!main) return;

    // Older dialog code could leave the whole shell inert after a sheet closed.
    // The individual views are isolated below, so the shell itself must never
    // remain inert or the fixed bottom navigation becomes untappable.
    try { main.inert = false; } catch (_) {}
    main.removeAttribute?.("inert");
  }

  function enforceViewIsolation(requestedName = selectedViewName(), { preserveScroll = true } = {}) {
    const name = normalizeViewName(requestedName);
    activeViewName = name;
    releaseStaleShellLock();

    for (const viewName of VIEW_NAMES) {
      const view = document.querySelector(`#view-${viewName}`);
      const tab = document.querySelector(`#tabs button[data-view="${viewName}"]`);
      const active = viewName === name;

      if (view) {
        view.hidden = !active;
        view.dataset.v1Active = active ? "true" : "false";
        view.setAttribute?.("aria-hidden", active ? "false" : "true");
        setInert(view, !active);
        if (active && !preserveScroll && typeof view.scrollTo === "function") view.scrollTo({ top: 0, behavior: "auto" });
      }

      if (tab) {
        tab.disabled = false;
        tab.classList?.toggle?.("on", active);
        tab.setAttribute?.("aria-selected", active ? "true" : "false");
        tab.setAttribute?.("tabindex", active ? "0" : "-1");
        tab.removeAttribute?.("inert");
      }
    }

    const tabs = document.querySelector("#tabs");
    if (tabs) {
      try { tabs.inert = false; } catch (_) {}
      tabs.removeAttribute?.("inert");
      tabs.setAttribute?.("aria-hidden", "false");
    }

    const root = document.documentElement;
    if (root) root.dataset.gillieV1ActiveView = name;
    return name;
  }

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
    enforceViewIsolation(selectedViewName());
    for (const callback of renderHooks) {
      try { callback(); } catch (error) { console.warn("Gillie V1 render hook failed", error); }
    }
    // Rendering modules may change attributes while rebuilding a screen. The
    // navigation contract always wins after every render cycle.
    enforceViewIsolation(activeViewName);
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

  function activateFromTabEvent(event) {
    const button = event.target?.closest?.("button[data-view]");
    const requested = button?.dataset?.view;
    if (!VIEW_NAMES.includes(requested)) return false;

    // Change screens synchronously. Delayed legacy renders may still run, but
    // every reconciliation below uses the user's newest requested tab.
    event.preventDefault?.();
    enforceViewIsolation(requested, { preserveScroll: false });
    queueMicrotask(() => enforceViewIsolation(requested));
    requestAnimationFrame(() => {
      enforceViewIsolation(requested);
      runRenderHooks();
    });
    setTimeout(() => enforceViewIsolation(requested), 140);
    return true;
  }

  function installTabIsolation() {
    const tabs = document.querySelector("#tabs");
    if (!tabs || tabs.dataset?.v1Isolation === "true") return;
    if (tabs.dataset) tabs.dataset.v1Isolation = "true";

    tabs.addEventListener("pointerdown", (event) => {
      const button = event.target?.closest?.("button[data-view]");
      const requested = button?.dataset?.view;
      if (!VIEW_NAMES.includes(requested)) return;
      releaseStaleShellLock();
      enforceViewIsolation(requested, { preserveScroll: false });
    }, true);

    tabs.addEventListener("click", activateFromTabEvent, true);

    document.addEventListener?.("visibilitychange", () => {
      if (!document.hidden) enforceViewIsolation(selectedViewName());
    });
    window.addEventListener?.("pageshow", () => enforceViewIsolation(selectedViewName()));

    enforceViewIsolation(selectedViewName());
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
    installTabIsolation();

    for (const entry of installers) installEntry(entry);

    updateRuntimeMarker();
    runRenderHooks();
    api.track("v1_canonical_booted", {
      registeredModules: installers.length,
      installedModules: installedNames.size,
      activeView: activeViewName,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot(), { once: true });
  } else {
    boot();
  }
})();