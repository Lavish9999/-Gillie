/* Gillie V1 Accessibility — scalable text, announced feedback, and keyboard/VoiceOver-safe dialogs. */
(() => {
  "use strict";

  const ENGINE = "accessibility-v1.1-nav-safe";
  const FOCUSABLE = [
    "button:not([disabled])",
    "a[href]",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  function normalizeViewportContent(content) {
    const parts = String(content || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !/^user-scalable\s*=\s*no$/i.test(part))
      .filter((part) => !/^maximum-scale\s*=\s*1(?:\.0+)?$/i.test(part));
    if (!parts.some((part) => /^width\s*=\s*device-width$/i.test(part))) parts.unshift("width=device-width");
    if (!parts.some((part) => /^initial-scale\s*=/i.test(part))) parts.push("initial-scale=1.0");
    return parts.join(", ");
  }

  function isDialogVisiblyOpen(overlay) {
    if (!overlay || overlay.hidden) return false;

    let style = null;
    try {
      if (typeof getComputedStyle === "function") style = getComputedStyle(overlay);
    } catch (_) {}

    if (style) {
      if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") return false;
      if (Number.parseFloat(style.opacity || "1") <= 0.02) return false;
    }

    try {
      const rect = overlay.getBoundingClientRect?.();
      if (rect && (rect.width <= 1 || rect.height <= 1)) return false;
    } catch (_) {}

    return true;
  }

  window.GillieAccessibility = Object.freeze({
    engine: ENGINE,
    focusableSelector: FOCUSABLE,
    normalizeViewportContent,
    isDialogVisiblyOpen,
  });

  window.GillieV1?.register("accessibility", ({ qs, qsa, afterRender, track }) => {
    if (document.documentElement.dataset.gillieAccessibility === ENGINE) return;
    document.documentElement.dataset.gillieAccessibility = ENGINE;

    let activeOverlay = null;
    let returnFocus = null;
    let syncTimer = 0;

    function visibleOverlays() {
      return qsa(".overlay").filter(isDialogVisiblyOpen);
    }

    function currentOverlay() {
      const overlays = visibleOverlays();
      return overlays[overlays.length - 1] || null;
    }

    function enhanceOverlay(overlay, index = 0) {
      if (!overlay) return;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-hidden", overlay.hidden ? "true" : "false");
      if (!overlay.hasAttribute("tabindex")) overlay.setAttribute("tabindex", "-1");

      const heading = qs("h1,h2,h3", overlay);
      if (heading) {
        if (!heading.id) heading.id = `gillie-dialog-title-${overlay.id || index}`;
        overlay.setAttribute("aria-labelledby", heading.id);
        overlay.removeAttribute("aria-label");
      } else if (!overlay.hasAttribute("aria-label")) {
        const label = String(overlay.id || "Gillie dialog").replace(/[-_]+/g, " ").trim();
        overlay.setAttribute("aria-label", label || "Gillie dialog");
      }
    }

    function enhanceStaticAccessibility() {
      const viewport = qs('meta[name="viewport"]');
      if (viewport) viewport.setAttribute("content", normalizeViewportContent(viewport.getAttribute("content")));
      document.documentElement.style.setProperty("-webkit-text-size-adjust", "100%");
      document.documentElement.style.setProperty("text-size-adjust", "100%");

      const toast = qs("#toast");
      if (toast) {
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        toast.setAttribute("aria-atomic", "true");
      }

      const tabs = qs("#tabs");
      if (tabs) tabs.setAttribute("aria-label", "Gillie navigation");
      qsa("#tabs button[data-view]").forEach((button) => {
        const name = button.dataset.view || button.textContent.trim();
        if (!button.getAttribute("aria-label")) button.setAttribute("aria-label", name);
      });

      qsa(".overlay").forEach(enhanceOverlay);
    }

    function setElementInert(element, inert) {
      if (!element) return;
      try { element.inert = inert; } catch (_) {}
      if (inert) element.setAttribute("inert", "");
      else element.removeAttribute("inert");
    }

    function setBackgroundInert(inert) {
      const main = qs("#main");

      // Never inert the entire main shell. The bottom navigation is inside it,
      // and a stale ancestor inert attribute makes every tab permanently
      // untappable. Modal isolation belongs on the content surfaces instead.
      if (main) setElementInert(main, false);

      const surfaces = [
        ...qsa("#main .view"),
        qs("#sos-fab"),
        qs("#onboarding"),
      ].filter(Boolean);
      surfaces.forEach((surface) => setElementInert(surface, inert));

      const tabs = qs("#tabs");
      if (tabs) {
        setElementInert(tabs, false);
        tabs.setAttribute("aria-hidden", inert ? "true" : "false");
        qsa("button[data-view]", tabs).forEach((button) => {
          button.disabled = false;
          setElementInert(button, false);
        });
      }
    }

    function focusableIn(overlay) {
      return qsa(FOCUSABLE, overlay).filter((element) => {
        if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      });
    }

    function focusInitial(overlay) {
      if (!overlay) return;
      const preferred = qs("[autofocus],.sheet-close,#sos-close,button:not([disabled]),input:not([disabled])", overlay);
      const target = preferred || overlay;
      try { target.focus({ preventScroll: true }); }
      catch (_) { try { target.focus(); } catch (_) {} }
    }

    function synchronizeDialogs(trigger = null) {
      clearTimeout(syncTimer);
      enhanceStaticAccessibility();
      const next = currentOverlay();

      if (next && next !== activeOverlay) {
        if (trigger?.focus) returnFocus = trigger;
        else if (document.activeElement && !next.contains(document.activeElement)) returnFocus = document.activeElement;
        activeOverlay = next;
        enhanceOverlay(next);
        setBackgroundInert(true);
        focusInitial(next);
        track("accessible_dialog_opened", { id: next.id || "unknown" });
        return;
      }

      if (!next && activeOverlay) {
        const closedId = activeOverlay.id || "unknown";
        activeOverlay = null;
        setBackgroundInert(false);
        const target = returnFocus;
        returnFocus = null;
        if (target?.isConnected && typeof target.focus === "function") {
          try { target.focus({ preventScroll: true }); }
          catch (_) { try { target.focus(); } catch (_) {} }
        }
        track("accessible_dialog_closed", { id: closedId });
        return;
      }

      // Always reconcile the shell, even when no locally tracked dialog
      // transition occurred. This clears stale inert state from older layers.
      if (!next) {
        setBackgroundInert(false);
        return;
      }

      activeOverlay = next;
      enhanceOverlay(next);
      setBackgroundInert(true);
    }

    function scheduleSync(trigger = null) {
      clearTimeout(syncTimer);
      [0, 90, 240].forEach((delay) => {
        setTimeout(() => synchronizeDialogs(trigger), delay);
      });
    }

    function closeActiveOverlay() {
      const overlay = currentOverlay();
      if (!overlay) return;
      const close = qs(".sheet-close,#sos-close,[data-dialog-close]", overlay);
      if (close) {
        close.click();
        scheduleSync();
        return;
      }
      try {
        if (typeof closeSheetOverlay === "function") closeSheetOverlay(overlay, true);
        else overlay.hidden = true;
      } catch (_) { overlay.hidden = true; }
      scheduleSync();
    }

    document.addEventListener("keydown", (event) => {
      const overlay = currentOverlay();
      if (!overlay) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeActiveOverlay();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = focusableIn(overlay);
      if (!focusable.length) {
        event.preventDefault();
        overlay.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !overlay.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }, true);

    document.addEventListener("focusin", (event) => {
      const overlay = currentOverlay();
      if (!overlay || overlay.contains(event.target)) return;
      focusInitial(overlay);
    }, true);

    document.addEventListener("click", (event) => {
      const trigger = event.target?.closest?.("button,a,[role='button']") || null;
      scheduleSync(trigger);
    }, true);

    afterRender(() => scheduleSync());
    enhanceStaticAccessibility();
    scheduleSync();
  });
})();