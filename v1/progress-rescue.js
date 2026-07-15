/* Gillie Progress Rescue — last-loaded, device-safe Progress interaction controller. */
(() => {
  "use strict";

  const ENGINE = "progress-rescue-v1";
  if (window.__gillieProgressRescueInstalled) return;
  window.__gillieProgressRescueInstalled = true;

  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const $$ = (selector, root = document) => Array.from(root?.querySelectorAll?.(selector) || []);
  const ACTION_SELECTOR = "button,summary,[role='button'],a[href]";
  let syntheticActivation = false;
  let repairQueued = false;
  let lastHandledAt = 0;

  function appState() {
    try { return typeof state !== "undefined" ? state : null; }
    catch (_) { return null; }
  }

  function progressView() {
    return $("#view-progress");
  }

  function progressIsActive() {
    const view = progressView();
    const tab = $('#tabs button[data-view="progress"]');
    if (!view || view.hidden) return false;
    if (view.dataset?.v1Active === "false") return false;
    return Boolean(tab?.classList.contains("on") || window.GillieV1?.activeView === "progress");
  }

  function visiblyOpenDialog(overlay) {
    if (!overlay || overlay.hidden) return false;
    let style = null;
    try { style = getComputedStyle(overlay); } catch (_) {}
    if (style) {
      if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") return false;
      if (Number.parseFloat(style.opacity || "1") <= 0.02) return false;
    }
    try {
      const rect = overlay.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) return false;
    } catch (_) {}
    return true;
  }

  function realDialogOpen() {
    return $$(".overlay").some(visiblyOpenDialog)
      || Boolean($("#pv-plus-welcome:not([hidden])"))
      || Boolean($(".gillie-rating-overlay:not([hidden])"));
  }

  function clearInert(element) {
    if (!element) return;
    try { element.inert = false; } catch (_) {}
    element.removeAttribute?.("inert");
  }

  function repairInteractionSurface() {
    repairQueued = false;
    const view = progressView();
    if (!view) return;

    const main = $("#main");
    const tabs = $("#tabs");
    [document.documentElement, document.body, $("#app"), main, view, tabs, ...$$('[inert]', main || document), ...$$('#tabs button[data-view]')]
      .filter(Boolean)
      .forEach(clearInert);

    view.hidden = false;
    view.dataset.v1Active = "true";
    view.dataset.progressRescue = ENGINE;
    view.setAttribute("aria-hidden", "false");
    view.style.setProperty("pointer-events", "auto", "important");
    view.style.setProperty("touch-action", "pan-y", "important");

    $$("button,summary,[role='button'],a[href],input,select,textarea", view).forEach((control) => {
      clearInert(control);
      if ("disabled" in control && !control.matches("[data-progress-disabled='true']")) control.disabled = false;
      control.style?.setProperty?.("pointer-events", "auto", "important");
      control.style?.setProperty?.("touch-action", "manipulation", "important");
    });

    $$(".overlay").forEach((overlay) => {
      if (visiblyOpenDialog(overlay)) {
        overlay.style.removeProperty("pointer-events");
        overlay.setAttribute("aria-hidden", "false");
        return;
      }
      overlay.style.setProperty("pointer-events", "none", "important");
      overlay.setAttribute("aria-hidden", "true");
      if (!overlay.hidden) overlay.hidden = true;
    });

    const anyOpen = $$(".overlay").some(visiblyOpenDialog);
    document.body.classList.toggle("sheet-open", anyOpen);
    document.documentElement.dataset.progressRescueActive = progressIsActive() ? "true" : "false";
  }

  function queueRepair() {
    if (repairQueued) return;
    repairQueued = true;
    requestAnimationFrame(repairInteractionSurface);
  }

  function ensureStyles() {
    if ($("#progress-rescue-style")) return;
    const style = document.createElement("style");
    style.id = "progress-rescue-style";
    style.textContent = `
      #view-progress[data-progress-rescue="${ENGINE}"]{
        pointer-events:auto!important;
        touch-action:pan-y!important;
        isolation:isolate;
      }
      #view-progress[data-progress-rescue="${ENGINE}"]::before,
      #view-progress[data-progress-rescue="${ENGINE}"]::after{pointer-events:none!important}
      #view-progress[data-progress-rescue="${ENGINE}"] button,
      #view-progress[data-progress-rescue="${ENGINE}"] summary,
      #view-progress[data-progress-rescue="${ENGINE}"] [role="button"],
      #view-progress[data-progress-rescue="${ENGINE}"] a[href]{
        pointer-events:auto!important;
        touch-action:manipulation!important;
      }
      #progress-rescue-actions{
        position:relative;
        z-index:55;
        margin:12px 0 14px;
        padding:14px;
        border:1px solid rgba(17,51,47,.09);
        border-radius:18px;
        background:rgba(255,255,255,.94);
        box-shadow:0 8px 22px rgba(17,51,47,.07);
      }
      #progress-rescue-actions .progress-rescue-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      #progress-rescue-actions .progress-rescue-head b{font-size:14px;color:var(--ink)}
      #progress-rescue-actions .progress-rescue-head small{font-size:9px;font-weight:900;letter-spacing:.08em;color:var(--ink-faint)}
      #progress-rescue-actions .progress-rescue-buttons{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:11px}
      #progress-rescue-actions button{min-height:44px;padding:9px 7px;border-radius:13px;background:#153d38;color:#fff;font-size:11.5px;font-weight:850}
      #progress-rescue-actions button[data-progress-rescue-action="sos"]{background:var(--coral-deep)}
      #progress-rescue-actions button[data-progress-rescue-action="share"]{background:#edf4f1;color:var(--ink)}
      html[data-gillie-dialog-open="true"] #progress-rescue-actions{z-index:0}
      .overlay[hidden]{pointer-events:none!important}
    `;
    document.head.appendChild(style);
  }

  function ensureActionPanel() {
    const view = progressView();
    if (!view) return;
    let panel = $("#progress-rescue-actions", view);
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "progress-rescue-actions";
      panel.setAttribute("aria-label", "Progress quick actions");
      panel.innerHTML = `
        <div class="progress-rescue-head"><b>Progress tools</b><small>CONTROLS V2</small></div>
        <div class="progress-rescue-buttons">
          <button type="button" data-progress-rescue-action="checkin">Check in</button>
          <button type="button" data-progress-rescue-action="sos">Craving SOS</button>
          <button type="button" data-progress-rescue-action="share">Share</button>
        </div>`;
      const statRow = $(".stat-row", view);
      statRow?.insertAdjacentElement("afterend", panel);
    }
  }

  function invokePropertyHandler(element) {
    if (!element || typeof element.onclick !== "function") return false;
    try {
      element.onclick.call(element, {
        currentTarget: element,
        target: element,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {},
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  function activateNative(element) {
    if (!element) return;
    syntheticActivation = true;
    try {
      if (element.tagName === "SUMMARY") {
        const details = element.closest("details");
        if (details) details.open = !details.open;
        return;
      }
      HTMLElement.prototype.click.call(element);
    } catch (_) {
      invokePropertyHandler(element);
    } finally {
      queueMicrotask(() => { syntheticActivation = false; queueRepair(); });
    }
  }

  function openOverlayFromTrigger(triggerId, overlayId) {
    const trigger = $(triggerId);
    const overlay = $(overlayId);
    let invoked = invokePropertyHandler(trigger);
    if (!invoked && trigger) {
      syntheticActivation = true;
      try { HTMLElement.prototype.click.call(trigger); } catch (_) {}
      syntheticActivation = false;
    }
    setTimeout(() => {
      if (overlay && overlay.hidden) overlay.hidden = false;
      try { if (typeof syncOverlayLock === "function") syncOverlayLock(); } catch (_) {}
      queueRepair();
    }, 0);
  }

  async function shareProgress() {
    const current = appState() || {};
    let days = 0;
    try { if (typeof currentStreakMs === "function") days = Math.floor(Math.max(0, currentStreakMs()) / 86400000); } catch (_) {}
    const money = $("#stat-money")?.textContent?.trim() || "$0";
    const cravings = (current.cravings || []).filter((entry) => entry?.resisted).length;
    const text = `${days} day${days === 1 ? "" : "s"} clean with Gillie · ${money} saved · ${cravings} cravings beaten.`;
    try {
      if (navigator.share) await navigator.share({ title: "My Gillie progress", text });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        try { if (typeof toast === "function") toast("↗", "Progress summary copied."); } catch (_) {}
      }
    } catch (_) {}
  }

  function runRescueAction(action) {
    if (action === "checkin") {
      openOverlayFromTrigger("#checkin-open", "#checkin-overlay");
      return;
    }
    if (action === "sos") {
      openOverlayFromTrigger("#sos-fab", "#sos-overlay");
      return;
    }
    if (action === "share") {
      shareProgress();
      return;
    }
    if (action === "plus") {
      openOverlayFromTrigger("#plus-open", "#plus-overlay");
    }
  }

  function actionAtPoint(target, clientX, clientY) {
    const view = progressView();
    if (!view) return null;
    const direct = target?.closest?.(ACTION_SELECTOR);
    if (direct && view.contains(direct)) return direct;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || typeof document.elementsFromPoint !== "function") return null;
    for (const node of document.elementsFromPoint(clientX, clientY)) {
      const candidate = node?.closest?.(ACTION_SELECTOR);
      if (candidate && view.contains(candidate)) return candidate;
    }
    return null;
  }

  function handleProgressPress(event, clientX = event.clientX, clientY = event.clientY) {
    if (syntheticActivation || !progressIsActive() || realDialogOpen()) return;
    const now = Date.now();
    if (now - lastHandledAt < 180) return;
    const element = actionAtPoint(event.target, clientX, clientY);
    if (!element) return;

    const rescueAction = element.dataset?.progressRescueAction;
    if (rescueAction) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      lastHandledAt = now;
      runRescueAction(rescueAction);
      return;
    }

    if (element.matches('[data-ship-progress="checkin"],[data-v1-progress="checkin"]')) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      lastHandledAt = now;
      runRescueAction("checkin");
      return;
    }
    if (element.matches('[data-ship-progress="sos"],[data-v1-progress="sos"]')) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      lastHandledAt = now;
      runRescueAction("sos");
      return;
    }
    if (element.matches("[data-plus-weekly-unlock]")) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      lastHandledAt = now;
      runRescueAction("plus");
      return;
    }

    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    lastHandledAt = now;
    activateNative(element);
  }

  function installPressRouting() {
    document.addEventListener("pointerup", (event) => handleProgressPress(event), true);
    document.addEventListener("touchend", (event) => {
      if (window.PointerEvent || !event.changedTouches?.length) return;
      const touch = event.changedTouches[0];
      handleProgressPress(event, touch.clientX, touch.clientY);
    }, { capture: true, passive: false });
    document.addEventListener("click", (event) => {
      if (syntheticActivation || Date.now() - lastHandledAt < 420) return;
      handleProgressPress(event);
    }, true);
  }

  function installRecoveryHooks() {
    $("#tabs")?.addEventListener("click", (event) => {
      const button = event.target?.closest?.('button[data-view="progress"]');
      if (!button) return;
      [0, 40, 160, 420].forEach((delay) => setTimeout(() => {
        ensureActionPanel();
        queueRepair();
      }, delay));
    }, true);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) queueRepair();
    });
    window.addEventListener("pageshow", queueRepair);

    const main = $("#main");
    if (main && typeof MutationObserver === "function") {
      new MutationObserver(() => {
        if (progressIsActive()) queueRepair();
      }).observe(main, { attributes: true, subtree: true, attributeFilter: ["inert", "hidden", "style"] });
    }

    window.GillieV1?.afterRender?.(() => {
      ensureActionPanel();
      queueRepair();
    });

    setInterval(() => {
      if (!progressIsActive()) return;
      ensureActionPanel();
      repairInteractionSurface();
    }, 1000);
  }

  function install() {
    ensureStyles();
    ensureActionPanel();
    installPressRouting();
    installRecoveryHooks();
    document.documentElement.dataset.gillieProgressEngine = ENGINE;
    [0, 50, 250, 700].forEach((delay) => setTimeout(() => {
      ensureActionPanel();
      queueRepair();
    }, delay));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
