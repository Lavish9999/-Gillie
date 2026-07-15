/* Gillie Interaction Director — bounded Progress routing plus direct dialog controls. */
(() => {
  "use strict";

  const ENGINE = "interaction-director-v6-dialog-safe";
  if (window.__gillieInteractionDirectorInstalled) return;
  window.__gillieInteractionDirectorInstalled = true;
  window.__gillieProgressRescueInstalled = true;

  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const $$ = (selector, root = document) => Array.from(root?.querySelectorAll?.(selector) || []);
  const CONTROL_SELECTOR = "button,summary,[role='button'],a[href],input,select,textarea";
  let repairQueued = false;
  let activePress = null;
  let syntheticActivation = false;
  let suppressClickUntil = 0;
  let suppressClickOwner = null;

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

  function visiblyOpen(element) {
    if (!element || element.hidden) return false;
    let style = null;
    try { style = getComputedStyle(element); } catch (_) {}
    if (style) {
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (Number.parseFloat(style.opacity || "1") <= 0.02) return false;
    }
    try {
      const rect = element.getBoundingClientRect();
      return rect.width > 2 && rect.height > 2 && rect.bottom > 0 && rect.top < window.innerHeight;
    } catch (_) {
      return true;
    }
  }

  function visibleOverlay() {
    const overlays = $$(".overlay").filter(visiblyOpen);
    return overlays[overlays.length - 1] || null;
  }

  function openDialogSurface(overlay) {
    if (!overlay) return false;
    clearInert(overlay);
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    overlay.style.removeProperty("display");
    overlay.style.removeProperty("visibility");
    overlay.style.removeProperty("opacity");
    overlay.style.setProperty("pointer-events", "auto", "important");
    $$(CONTROL_SELECTOR, overlay).forEach((control) => {
      clearInert(control);
      control.style?.setProperty?.("pointer-events", "auto", "important");
      if (control.matches("button,a,[role='button']")) control.style?.setProperty?.("touch-action", "manipulation", "important");
    });
    document.body.classList.add("sheet-open");
    document.documentElement.dataset.gillieDialogOpen = "true";
    return true;
  }

  function repairProgressSurface() {
    repairQueued = false;
    const view = progressView();
    if (!view || !progressIsSelected() || visibleOverlay()) return;

    const main = $("#main");
    const tabs = $("#tabs");
    [document.documentElement, document.body, $("#app"), main, view, tabs, ...$$('[inert]', main || document), ...$$('#tabs button[data-view]')]
      .filter(Boolean)
      .forEach(clearInert);

    view.dataset.progressRescue = ENGINE;
    view.setAttribute("aria-hidden", "false");
    view.style.setProperty("pointer-events", "auto", "important");
    view.style.setProperty("touch-action", "pan-y", "important");

    $$(CONTROL_SELECTOR, view).forEach((control) => {
      clearInert(control);
      if ("disabled" in control && control.matches("button[data-days],[data-ship-progress],[data-v1-progress],[data-plus-weekly-unlock],#phase2-share-progress,#progress-rescue-actions button")) {
        control.disabled = false;
      }
      control.style?.setProperty?.("pointer-events", "auto", "important");
      if (control.matches("button,a,[role='button'],summary")) control.style?.setProperty?.("touch-action", "manipulation", "important");
    });
  }

  function repairVisibleOverlay() {
    const overlay = visibleOverlay();
    if (!overlay) return;
    openDialogSurface(overlay);
  }

  function queueRepair() {
    if (repairQueued) return;
    repairQueued = true;
    requestAnimationFrame(() => {
      if (visibleOverlay()) {
        repairQueued = false;
        repairVisibleOverlay();
      } else {
        repairProgressSurface();
      }
    });
  }

  function ensureStyles() {
    if ($("#progress-rescue-style")) return;
    const style = document.createElement("style");
    style.id = "progress-rescue-style";
    style.textContent = `
      #view-progress[data-progress-rescue="${ENGINE}"]{pointer-events:auto!important;touch-action:pan-y!important;isolation:isolate}
      #view-progress[data-progress-rescue="${ENGINE}"]::before,
      #view-progress[data-progress-rescue="${ENGINE}"]::after{pointer-events:none!important}
      #view-progress[data-progress-rescue="${ENGINE}"] button,
      #view-progress[data-progress-rescue="${ENGINE}"] summary,
      #view-progress[data-progress-rescue="${ENGINE}"] [role="button"],
      #view-progress[data-progress-rescue="${ENGINE}"] a[href]{pointer-events:auto!important;touch-action:manipulation!important}
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
      .overlay:not([hidden]),.overlay:not([hidden]) button,.overlay:not([hidden]) a,.overlay:not([hidden]) [role="button"]{pointer-events:auto!important}
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
        <div class="progress-rescue-head"><b>Progress tools</b><small>CONTROLS V6</small></div>
        <div class="progress-rescue-buttons">
          <button type="button" data-progress-rescue-action="checkin">Check in</button>
          <button type="button" data-progress-rescue-action="sos">Craving SOS</button>
          <button type="button" data-progress-rescue-action="share">Share</button>
        </div>`;
      $(".stat-row", view)?.insertAdjacentElement("afterend", panel);
    } else {
      const badge = $(".progress-rescue-head small", panel);
      if (badge) badge.textContent = "CONTROLS V6";
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

  function openCheckinDirect() {
    const trigger = $("#checkin-open");
    const overlay = $("#checkin-overlay");
    if (trigger) {
      try { trigger.disabled = false; } catch (_) {}
      invokePropertyHandler(trigger);
    }
    openDialogSurface(overlay);
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
  }

  function openSosSupportDirect() {
    const support = $("#v1-sos-support-overlay");
    if (!support) return false;
    openDialogSurface(support);
    document.body.classList.add("v1-sos-support-open");
    return true;
  }

  async function trustedPersonDirect() {
    const text = "I’m having a strong nicotine craving. Can you stay with me for a few minutes while it passes?";
    try {
      if (navigator.share) await navigator.share({ title: "Stay with me through this craving", text });
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    } catch (_) {}
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
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    } catch (_) {}
  }

  function pointInsideProgressContent(clientX, clientY) {
    if (!progressIsSelected() || visibleOverlay() || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
    const view = progressView();
    const tabs = $("#tabs");
    if (!view || !tabs) return false;
    const viewRect = view.getBoundingClientRect();
    const tabsRect = tabs.getBoundingClientRect();
    const bottom = Math.min(viewRect.bottom, tabsRect.top - 2);
    return clientX >= viewRect.left && clientX <= viewRect.right && clientY >= Math.max(0, viewRect.top) && clientY < bottom;
  }

  function controlAtPoint(owner, target, clientX, clientY) {
    if (!owner) return null;
    const direct = target?.closest?.(CONTROL_SELECTOR);
    if (direct && owner.contains(direct)) return direct;
    if (typeof document.elementsFromPoint !== "function") return null;
    for (const node of document.elementsFromPoint(clientX, clientY)) {
      const candidate = node?.closest?.(CONTROL_SELECTOR);
      if (candidate && owner.contains(candidate)) return candidate;
    }
    return null;
  }

  function progressAction(control) {
    let action = control?.dataset?.progressRescueAction || null;
    if (control?.matches?.('[data-ship-progress="checkin"],[data-v1-progress="checkin"]')) action = "checkin";
    if (control?.matches?.('[data-ship-progress="sos"],[data-v1-progress="sos"]')) action = "sos";
    if (control?.matches?.("[data-plus-weekly-unlock]")) action = "plus";
    return action;
  }

  function activateProgressControl(control) {
    if (!control) return false;
    const action = progressAction(control);
    if (action === "checkin") { openCheckinDirect(); return true; }
    if (action === "sos") { openSosDirect(); return true; }
    if (action === "share") { void shareProgress(); return true; }
    if (action === "plus") { openPlusDirect(); return true; }

    if (control.tagName === "SUMMARY") {
      const details = control.closest("details");
      if (details) details.open = !details.open;
      return true;
    }

    syntheticActivation = true;
    try { HTMLElement.prototype.click.call(control); }
    catch (_) { return invokePropertyHandler(control); }
    finally { queueMicrotask(() => { syntheticActivation = false; queueRepair(); }); }
    return true;
  }

  function closeOverlayDirect(overlay) {
    if (!overlay) return;
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    if (overlay.id === "v1-sos-support-overlay") document.body.classList.remove("v1-sos-support-open");
    if (!visibleOverlay()) {
      document.body.classList.remove("sheet-open");
      document.documentElement.dataset.gillieDialogOpen = "false";
    }
    queueRepair();
  }

  function activateOverlayControl(overlay, control) {
    if (!overlay || !control) return false;
    if (control.disabled) return false;

    if (control.matches("[data-open-sos-support]")) return openSosSupportDirect();
    if (control.matches("[data-dialog-close],.sheet-close")) {
      closeOverlayDirect(overlay);
      return true;
    }
    if (control.matches('[data-sos-support-action="trusted-person"]')) {
      void trustedPersonDirect();
      return true;
    }
    if (control.tagName === "A" && control.href) {
      try { window.location.href = control.href; } catch (_) {}
      return true;
    }
    if (control.tagName === "SUMMARY") {
      const details = control.closest("details");
      if (details) details.open = !details.open;
      return true;
    }
    if (invokePropertyHandler(control)) return true;

    // Known SOS controls are assigned by addEventListener in later modules. Their
    // core behavior remains explicit here so a capture-phase blocker cannot freeze
    // the emergency screen.
    if (control.id === "sos-close") {
      try { if (typeof closeSOS === "function") closeSOS(); else closeOverlayDirect(overlay); }
      catch (_) { closeOverlayDirect(overlay); }
      return true;
    }
    if (control.id === "sos-beat") {
      try {
        if (typeof closeSOS === "function") closeSOS();
        if (typeof openTriggerPicker === "function") openTriggerPicker(true);
      } catch (_) {}
      return true;
    }
    if (control.id === "sos-slipped") {
      try {
        if (typeof closeSOS === "function") closeSOS();
        if (typeof openSlip === "function") openSlip();
      } catch (_) {}
      return true;
    }
    return false;
  }

  function validCompletedPress(clientX, clientY, pointerId) {
    if (!activePress) return false;
    if (pointerId !== null && activePress.pointerId !== pointerId) return false;
    const distance = Math.hypot(clientX - activePress.x, clientY - activePress.y);
    const elapsed = Date.now() - activePress.at;
    return distance <= 14 && elapsed <= 900;
  }

  function beginPress(event, clientX, clientY, pointerId) {
    const overlay = visibleOverlay();
    const owner = overlay || (pointInsideProgressContent(clientX, clientY) ? progressView() : null);
    if (!owner) {
      activePress = null;
      return;
    }
    activePress = { owner, pointerId, x: clientX, y: clientY, at: Date.now() };
  }

  function finishPress(event, clientX, clientY, pointerId) {
    if (syntheticActivation || !validCompletedPress(clientX, clientY, pointerId)) {
      activePress = null;
      return;
    }

    const owner = activePress.owner;
    const overlay = owner?.classList?.contains("overlay") && visiblyOpen(owner) ? owner : null;
    const control = controlAtPoint(owner, event.target, clientX, clientY);
    activePress = null;
    if (!control) return;

    const handled = overlay ? activateOverlayControl(overlay, control) : activateProgressControl(control);
    if (!handled) return;

    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    suppressClickUntil = Date.now() + 500;
    suppressClickOwner = owner;
  }

  function installRouting() {
    if (window.__gillieInteractionDirectorRouting === ENGINE) return;
    window.__gillieInteractionDirectorRouting = ENGINE;

    window.addEventListener("pointerdown", (event) => beginPress(event, event.clientX, event.clientY, event.pointerId), true);
    window.addEventListener("pointerup", (event) => finishPress(event, event.clientX, event.clientY, event.pointerId), true);
    window.addEventListener("pointercancel", () => { activePress = null; }, true);

    window.addEventListener("click", (event) => {
      if (syntheticActivation || Date.now() > suppressClickUntil || !suppressClickOwner) return;
      if (!suppressClickOwner.contains?.(event.target)) return;
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      suppressClickOwner = null;
    }, true);

    window.addEventListener("touchstart", (event) => {
      if (window.PointerEvent || !event.touches?.length) return;
      const touch = event.touches[0];
      beginPress(event, touch.clientX, touch.clientY, "touch");
    }, { capture: true, passive: true });

    window.addEventListener("touchend", (event) => {
      if (window.PointerEvent || !event.changedTouches?.length) return;
      const touch = event.changedTouches[0];
      finishPress(event, touch.clientX, touch.clientY, "touch");
    }, { capture: true, passive: false });
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

    if (typeof MutationObserver === "function") {
      new MutationObserver(() => queueRepair()).observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ["hidden", "inert"],
      });
    }

    window.GillieV1?.afterRender?.(() => {
      ensureActionPanel();
      queueRepair();
    });

    setInterval(() => {
      ensureActionPanel();
      if (visibleOverlay()) repairVisibleOverlay();
      else if (progressIsSelected()) repairProgressSurface();
    }, 1000);
  }

  function install() {
    ensureStyles();
    ensureActionPanel();
    installRouting();
    installRecoveryHooks();
    document.documentElement.dataset.gillieProgressEngine = ENGINE;
    document.documentElement.dataset.gillieInteractionDirector = ENGINE;
    [0, 50, 250, 700].forEach((delay) => setTimeout(() => {
      ensureActionPanel();
      queueRepair();
    }, delay));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
