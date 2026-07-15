/* Gillie Follow-up Rescue — guaranteed iOS activation for craving outcome buttons. */
(() => {
  "use strict";

  if (window.__gillieFollowupRescueInstalled) return;
  window.__gillieFollowupRescueInstalled = true;

  const ENGINE = "followup-rescue-v1-ios-direct-routing";
  const OVERLAY_ID = "followup-overlay";
  const ACTIONS = Object.freeze({
    "followup-made": "made",
    "followup-fighting": "fighting",
    "followup-used": "used",
  });

  let suppressClickUntil = 0;

  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const overlay = () => $("#followup-overlay");

  function appState() {
    try { return typeof state !== "undefined" && state ? state : null; }
    catch (_) { return null; }
  }

  function isOpen() {
    const node = overlay();
    return Boolean(node && !node.hidden);
  }

  function track(name, properties = {}) {
    try {
      window.Capacitor?.Plugins?.GilliePurchases?.trackEvent?.({
        name,
        properties: { engine: ENGINE, ...properties },
      });
    } catch (_) {}
  }

  function persistAndRender() {
    try { if (typeof save === "function") save(); } catch (_) {}
    try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
  }

  function ensureInteractiveSurface() {
    const node = overlay();
    if (!node || node.hidden) return;

    try { node.inert = false; } catch (_) {}
    node.removeAttribute?.("inert");
    node.setAttribute?.("aria-hidden", "false");
    node.style?.setProperty?.("pointer-events", "auto", "important");
    node.style?.setProperty?.("touch-action", "manipulation", "important");
    node.style?.setProperty?.("z-index", "260", "important");

    const sheet = $(".sheet", node);
    try { if (sheet) sheet.inert = false; } catch (_) {}
    sheet?.removeAttribute?.("inert");
    sheet?.style?.setProperty?.("pointer-events", "auto", "important");

    Object.keys(ACTIONS).forEach((id) => {
      const button = $(`#${id}`, node);
      if (!button) return;
      try { button.inert = false; } catch (_) {}
      button.removeAttribute?.("inert");
      button.disabled = false;
      button.style?.setProperty?.("pointer-events", "auto", "important");
      button.style?.setProperty?.("touch-action", "manipulation", "important");
      button.style?.setProperty?.("position", "relative", "important");
      button.style?.setProperty?.("z-index", "6", "important");
    });
  }

  function notify(icon, message) {
    try {
      if (typeof toast === "function") toast(icon, message);
      else window.GillieV1?.announce?.(message);
    } catch (_) {}
  }

  function fallbackResolve(outcome) {
    const current = appState();
    const node = overlay();
    const pending = current?.pendingFollowup;

    if (!current || !pending) {
      if (node) node.hidden = true;
      document.body?.classList?.remove("sheet-open");
      track("followup_rescue_stale_closed", { outcome });
      return true;
    }

    const craving = Array.isArray(current.cravings)
      ? current.cravings.find((entry) => entry?.id === pending.cravingId)
      : null;
    if (craving) {
      craving.pending = false;
      craving.followedUpAt = Date.now();
    }
    if (node) node.hidden = true;

    if (outcome === "made") {
      if (craving) craving.resisted = true;
      let pearls = 0;
      try {
        const base = typeof CONFIG !== "undefined" ? Number(CONFIG?.rewards?.cravingBeaten || 0) : 0;
        if (typeof grantSosReward === "function") pearls = Number(grantSosReward(base, true)?.pearls || 0);
      } catch (_) {}
      current.pendingFollowup = null;
      persistAndRender();
      if (pearls > 0) notify("💪", `Now it’s official. +${pearls} pearls for a real craving win.`);
      else notify("💪", "Craving beaten and logged.");
      try { if (typeof axoCelebrate === "function") axoCelebrate(); } catch (_) {}
    } else if (outcome === "fighting") {
      let delayMinutes = 10;
      try { if (typeof CONFIG !== "undefined") delayMinutes = Number(CONFIG?.sos?.followupDelayMins || 10); } catch (_) {}
      current.pendingFollowup.dueAt = Date.now() + delayMinutes * 60000;
      persistAndRender();
      try {
        if (typeof window.openSOS === "function") window.openSOS();
        else if (typeof openSOS === "function") openSOS();
      } catch (_) {}
    } else {
      if (craving) craving.resisted = false;
      current.pendingFollowup = null;
      try { if (typeof save === "function") save(); } catch (_) {}
      try {
        if (typeof openSlip === "function") openSlip(pending.cravingId);
        else persistAndRender();
      } catch (_) { persistAndRender(); }
    }

    track("followup_rescue_fallback_resolved", { outcome });
    return true;
  }

  function resolveOutcome(outcome) {
    try {
      if (typeof resolveFollowup === "function") {
        resolveFollowup(outcome);
        track("followup_rescue_direct_resolved", { outcome });
        return true;
      }
    } catch (_) {}
    return fallbackResolve(outcome);
  }

  function actionButtonFromEvent(event) {
    if (!isOpen()) return null;
    const button = event.target?.closest?.("#followup-made,#followup-fighting,#followup-used");
    return button && overlay()?.contains?.(button) ? button : null;
  }

  function consume(event, button) {
    const outcome = ACTIONS[button.id];
    if (!outcome) return false;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    suppressClickUntil = Date.now() + 700;
    resolveOutcome(outcome);
    return true;
  }

  function installStyle() {
    if ($("#gillie-followup-rescue-style")) return;
    const style = document.createElement("style");
    style.id = "gillie-followup-rescue-style";
    style.textContent = `
      #${OVERLAY_ID}:not([hidden]){pointer-events:auto!important;touch-action:manipulation!important;z-index:260!important}
      #${OVERLAY_ID}:not([hidden]) .sheet{pointer-events:auto!important;touch-action:pan-y!important}
      #${OVERLAY_ID}:not([hidden]) #followup-made,
      #${OVERLAY_ID}:not([hidden]) #followup-fighting,
      #${OVERLAY_ID}:not([hidden]) #followup-used{pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:6!important}
    `;
    document.head?.appendChild?.(style);
  }

  function install() {
    installStyle();
    ensureInteractiveSurface();

    window.addEventListener("pointerup", (event) => {
      const button = actionButtonFromEvent(event);
      if (button) consume(event, button);
    }, true);

    window.addEventListener("click", (event) => {
      const button = actionButtonFromEvent(event);
      if (!button) return;
      if (Date.now() <= suppressClickUntil) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        return;
      }
      consume(event, button);
    }, true);

    if (!window.PointerEvent) {
      window.addEventListener("touchend", (event) => {
        const button = actionButtonFromEvent(event);
        if (button) consume(event, button);
      }, { capture: true, passive: false });
    }

    if (typeof MutationObserver === "function" && document.body) {
      new MutationObserver((mutations) => {
        if (mutations.some((mutation) => mutation.target?.id === OVERLAY_ID || mutation.target?.closest?.(`#${OVERLAY_ID}`))) {
          ensureInteractiveSurface();
        }
      }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ["hidden", "inert", "style"] });
    }

    window.GillieV1?.afterRender?.(ensureInteractiveSurface);
    window.GillieFollowupRescue = Object.freeze({
      ensure: ensureInteractiveSurface,
      resolve: resolveOutcome,
      engine: ENGINE,
    });
    track("followup_rescue_loaded");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
