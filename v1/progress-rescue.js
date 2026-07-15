/* Gillie Progress Rescue — last-loaded, device-safe Progress interaction controller. */
(() => {
  "use strict";

  const ENGINE = "progress-rescue-v2-dialogs";
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

  function progressIsSelected() {
    const view = progressView();
    const tab = $('#tabs button[data-view="progress"]');
    if (!view || view.hidden || view.dataset?.v1Active === "false") return false;
    return Boolean(tab?.classList.contains("on") || window.GillieV1?.activeView === "progress");
  }

  function clearInert(element) {
    if (!element) return;
    try { element.inert = false; } catch (_) {}
    element.removeAttribute?.("inert");
  }

  function openOverlays() {
    return $$(".overlay").filter((overlay) => !overlay.hidden);
  }

  function realDialogOpen() {
    return openOverlays().length > 0
      || Boolean($("#pv-plus-welcome:not([hidden])"))
      || Boolean($(".gillie-rating-overlay:not([hidden])"));
  }

  function openDialogSurface(overlay) {
    if (!overlay) return false;
    clearInert(overlay);
    overlay.hidden = false;
    overlay.removeAttribute("inert");
    overlay.setAttribute("aria-hidden", "false");
    overlay.style.removeProperty("display");
    overlay.style.removeProperty("visibility");
    overlay.style.removeProperty("opacity");
    overlay.style.setProperty("pointer-events", "auto", "important");
    document.body.classList.add("sheet-open");
    document.documentElement.dataset.gillieDialogOpen = "true";
    return true;
  }

  function repairInteractionSurface() {
    repairQueued = false;
    const view = progressView();
    if (!view) return;

    const selected = progressIsSelected();
    document.documentElement.dataset.progressRescueActive = selected ? "true" : "false";
    if (!selected) return;

    const main = $("#main");
    const tabs = $("#tabs");
    [document.documentElement, document.body, $("#app"), main, view, tabs, ...$$('[inert]', main || document), ...$$('#tabs button[data-view]')]
      .filter(Boolean)
      .forEach(clearInert);

    view.dataset.progressRescue = ENGINE;
    view.setAttribute("aria-hidden", "false");
    view.style.setProperty("pointer-events", "auto", "important");
    view.style.setProperty("touch-action", "pan-y", "important");

    $$("button,summary,[role='button'],a[href],input,select,textarea", view).forEach((control) => {
      clearInert(control);
      if ("disabled" in control && control.matches("button[data-days],[data-ship-progress],[data-v1-progress],[data-plus-weekly-unlock],#phase2-share-progress,#progress-rescue-actions button")) {
        control.disabled = false;
      }
      control.style?.setProperty?.("pointer-events", "auto", "important");
      control.style?.setProperty?.("touch-action", "manipulation", "important");
    });

    $$(".overlay").forEach((overlay) => {
      if (overlay.hidden) {
        overlay.setAttribute("aria-hidden", "true");
        overlay.style.removeProperty("pointer-events");
        return;
      }
      clearInert(overlay);
      overlay.setAttribute("aria-hidden", "false");
      overlay.style.setProperty("pointer-events", "auto", "important");
    });

    const hasOpenOverlay = openOverlays().length > 0;
    document.body.classList.toggle("sheet-open", hasOpenOverlay);
    document.documentElement.dataset.gillieDialogOpen = hasOpenOverlay ? "true" : "false";
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
      #view-progress[data-progress-rescue="${ENGINE}"]{pointer-events:auto!important;touch-action:pan-y!important;isolation:isolate}
      #view-progress[data-progress-rescue="${ENGINE}"]::before,#view-progress[data-progress-rescue="${ENGINE}"]::after{pointer-events:none!important}
      #view-progress[data-progress-rescue="${ENGINE}"] button,#view-progress[data-progress-rescue="${ENGINE}"] summary,#view-progress[data-progress-rescue="${ENGINE}"] [role="button"],#view-progress[data-progress-rescue="${ENGINE}"] a[href]{pointer-events:auto!important;touch-action:manipulation!important}
      #progress-rescue-actions{position:relative;z-index:55;margin:12px 0 14px;padding:14px;border:1px solid rgba(17,51,47,.09);border-radius:18px;background:rgba(255,255,255,.94);box-shadow:0 8px 22px rgba(17,51,47,.07)}
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
        <div class="progress-rescue-head"><b>Progress tools</b><small>CONTROLS V3</small></div>
        <div class="progress-rescue-buttons">
          <button type="button" data-progress-rescue-action="checkin">Check in</button>
          <button type="button" data-progress-rescue-action="sos">Craving SOS</button>
          <button type="button" data-progress-rescue-action="share">Share</button>
        </div>`;
      $(".stat-row", view)?.insertAdjacentElement("afterend", panel);
    } else {
      const badge = $(".progress-rescue-head small", panel);
      if (badge) badge.textContent = "CONTROLS V3";
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
      } else {
        HTMLElement.prototype.click.call(element);
      }
    } catch (_) {
      invokePropertyHandler(element);
    } finally {
      queueMicrotask(() => {
        syntheticActivation = false;
        queueRepair();
      });
    }
  }

  function openCheckinDirect() {
    const trigger = $("#checkin-open");
    const overlay = $("#checkin-overlay");
    if (trigger) {
      try { trigger.disabled = false; } catch (_) {}
      invokePropertyHandler(trigger);
    }
    openDialogSurface(overlay);
    queueRepair();
  }

  function openSosDirect() {
    const overlay = $("#sos-overlay");
    let opened = false;
    try {
      if (typeof window.openSOS === "function") {
        window.openSOS();
        opened = true;
      } else if (typeof openSOS === "function") {
        openSOS();
        opened = true;
      }
    } catch (_) {}
    if (!opened) invokePropertyHandler($("#sos-fab"));
    openDialogSurface(overlay);
    queueRepair();
  }

  function openPlusDirect() {
    const overlay = $("#plus-overlay");
    let opened = false;
    try {
      if (typeof window.openPlus === "function") {
        window.openPlus();
        opened = true;
      } else if (typeof openPlus === "function") {
        openPlus();
        opened = true;
      }
    } catch (_) {}
    if (!opened) invokePropertyHandler($("#plus-open"));
    openDialogSurface(overlay);
    queueRepair();
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
    if (action === "checkin") return openCheckinDirect();
    if (action === "sos") return openSosDirect();
    if (action === "share") return shareProgress();
    if (action === "plus") return openPlusDirect();
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
    if (syntheticActivation || !progressIsSelected() || realDialogOpen()) return;
    const now = Date.now();
    if (now - lastHandledAt < 180) return;
    const element = actionAtPoint(event.target, clientX, clientY);
    if (!element) return;

    let action = element.dataset?.progressRescueAction || null;
    if (element.matches('[data-ship-progress="checkin"],[data-v1-progress="checkin"]')) action = "checkin";
    if (element.matches('[data-ship-progress="sos"],[data-v1-progress="sos"]')) action = "sos";
    if (element.matches("[data-plus-weekly-unlock]")) action = "plus";

    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    lastHandledAt = now;
    if (action) runRescueAction(action);
    else activateNative(element);
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
      if (!event.target?.closest?.('button[data-view="progress"]')) return;
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
        if (progressIsSelected()) queueRepair();
      }).observe(main, { attributes: true, subtree: true, attributeFilter: ["inert", "hidden", "style"] });
    }

    window.GillieV1?.afterRender?.(() => {
      ensureActionPanel();
      if (progressIsSelected()) queueRepair();
    });

    setInterval(() => {
      if (!progressIsSelected()) return;
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
      if (progressIsSelected()) queueRepair();
    }, delay));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
