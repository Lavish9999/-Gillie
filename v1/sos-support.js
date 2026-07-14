/* Gillie V1 SOS Support — human help without interrupting the breathing-first flow. */
(() => {
  "use strict";

  window.GillieV1?.register("sos-support", ({ qs, notify, track }) => {
    const SOS_SUPPORT_ENGINE = "sos-support-v1";
    const QUITLINE_PHONE = "+18007848669";
    const QUITLINE_TEXT = "333888";
    const TRUSTED_MESSAGE = "I’m having a strong nicotine craving. Can you stay with me for a few minutes while it passes?";

    function ensureSupportOverlay() {
      let overlay = qs("#v1-sos-support-overlay");
      if (overlay) return overlay;

      overlay = document.createElement("div");
      overlay.id = "v1-sos-support-overlay";
      overlay.className = "overlay v1-sos-support-overlay";
      overlay.hidden = true;
      overlay.innerHTML = `
        <div class="sheet v1-sos-support-sheet">
          <button type="button" class="sheet-close v1-sos-support-close" data-dialog-close aria-label="Close human support">×</button>
          <span class="v1-sos-support-kicker">HUMAN SUPPORT</span>
          <h2>Bring another person into this moment.</h2>
          <p class="sub">Gillie can help you slow down. A trained counselor or someone you trust can help you stay with the decision.</p>
          <div class="v1-sos-support-actions">
            <a href="tel:${QUITLINE_PHONE}" data-sos-support-action="quitline-call">
              <span aria-hidden="true">☎</span>
              <span><b>Call 1-800-QUIT-NOW</b><small>Free U.S. state quitline counseling</small></span>
            </a>
            <a href="sms:${QUITLINE_TEXT}" data-sos-support-action="quitline-text">
              <span aria-hidden="true">✉</span>
              <span><b>Text QUITNOW to 333888</b><small>Opens Messages to the U.S. quitline service</small></span>
            </a>
            <button type="button" data-sos-support-action="trusted-person">
              <span aria-hidden="true">♥</span>
              <span><b>Message someone I trust</b><small>Share a ready-to-send craving support message</small></span>
            </button>
            <a href="https://smokefree.gov/tools-tips/get-extra-help/speak-to-an-expert" target="_blank" rel="noopener noreferrer" data-sos-support-action="smokefree">
              <span aria-hidden="true">↗</span>
              <span><b>Open Smokefree.gov support</b><small>Official U.S. quit counseling and LiveHelp information</small></span>
            </a>
          </div>
          <p class="v1-sos-support-region">These phone and text options are U.S. resources. Message and data rates may apply.</p>
          <p class="v1-sos-support-emergency"><b>Gillie is not emergency or medical care.</b> For severe symptoms or immediate danger, contact your local emergency services.</p>
          <button type="button" class="btn ghost" data-dialog-close>Back to breathing</button>
        </div>`;
      document.body.appendChild(overlay);

      overlay.addEventListener("click", async (event) => {
        const close = event.target.closest("[data-dialog-close]");
        if (close) {
          overlay.hidden = true;
          document.body.classList.remove("v1-sos-support-open");
          track("sos_human_support_closed");
          return;
        }

        const action = event.target.closest("[data-sos-support-action]")?.dataset.sosSupportAction;
        if (!action) return;
        track("sos_human_support_action", { action });

        if (action !== "trusted-person") return;
        event.preventDefault();
        try {
          if (navigator.share) {
            await navigator.share({
              title: "Stay with me through this craving",
              text: TRUSTED_MESSAGE,
            });
            notify("♥", "Support message ready.");
            return;
          }
          await navigator.clipboard.writeText(TRUSTED_MESSAGE);
          notify("♥", "Support message copied. Send it to someone you trust.");
        } catch (error) {
          if (String(error?.name || "").includes("Abort")) return;
          notify("!", "Gillie could not open sharing. Try calling or texting someone directly.");
        }
      });

      return overlay;
    }

    function openSupport() {
      const overlay = ensureSupportOverlay();
      overlay.hidden = false;
      document.body.classList.add("sheet-open", "v1-sos-support-open");
      track("sos_human_support_opened");
    }

    function installEntryPoint() {
      const actions = qs("#sos-overlay .sos-actions");
      if (!actions || qs("[data-open-sos-support]", actions)) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn ghost v1-sos-human-support";
      button.dataset.openSosSupport = "true";
      button.textContent = "Talk to a person";
      const close = qs("#sos-close", actions);
      actions.insertBefore(button, close || null);
      button.addEventListener("click", openSupport);
    }

    installEntryPoint();
    ensureSupportOverlay();
    document.documentElement.dataset.sosSupportEngine = SOS_SUPPORT_ENGINE;
    track("sos_human_support_installed", { engine: SOS_SUPPORT_ENGINE });
  });
})();

/* Gillie reliability guard — first-launch consent, destructive reset, and resilient bottom navigation. */
(() => {
  "use strict";

  if (window.__gillieReliabilityGuardInstalled) return;
  window.__gillieReliabilityGuardInstalled = true;

  const ENGINE = "reliability-guard-v1";
  const INTRO_SEEN_KEY = "gillie.launch.intro.seen.v1";
  const RESET_PARAM = "gillieReset";
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  let navRepairTimer = 0;

  const purchaseBridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;
  const notificationBridge = () => window.Capacitor?.Plugins?.LocalNotifications || null;

  function track(name, properties = {}) {
    try { purchaseBridge()?.trackEvent?.({ name, properties: { engine: ENGINE, ...properties } }); }
    catch (_) {}
  }

  function clearWebStorage() {
    try { window.localStorage?.clear?.(); } catch (_) {}
    try { window.sessionStorage?.clear?.(); } catch (_) {}
  }

  function finishPendingResetIfNeeded() {
    let url;
    try { url = new URL(window.location.href); } catch (_) { return false; }
    if (!url.searchParams.has(RESET_PARAM)) return false;
    clearWebStorage();
    url.searchParams.delete(RESET_PARAM);
    window.location.replace(url.toString());
    return true;
  }

  if (finishPendingResetIfNeeded()) return;

  function installFirstLaunchGate() {
    let firstLaunch = false;
    try { firstLaunch = !window.localStorage.getItem(INTRO_SEEN_KEY); } catch (_) { firstLaunch = true; }
    if (!firstLaunch) return;

    const originalSetTimeout = window.setTimeout;
    let intercepted = false;
    const startedAt = Date.now();

    window.setTimeout = function gillieFirstLaunchTimeout(callback, delay, ...args) {
      const source = typeof callback === "function" ? Function.prototype.toString.call(callback) : "";
      const launchTimer = source.includes("finishLaunch") && source.includes("timer") && Number(delay) >= 600 && Number(delay) <= 3500;
      if (!intercepted && launchTimer) {
        intercepted = true;
        document.documentElement.dataset.gillieFirstLaunchGate = "waiting-for-tap";
        track("first_launch_auto_dismiss_blocked", { delay: Number(delay) });
        return nativeSetTimeout(() => {}, 2147480000);
      }
      return nativeSetTimeout(callback, delay, ...args);
    };

    const restoreTimer = () => {
      if (intercepted || Date.now() - startedAt > 4000) {
        window.setTimeout = originalSetTimeout;
        return;
      }
      nativeSetTimeout(restoreTimer, 20);
    };
    nativeSetTimeout(restoreTimer, 20);

    document.addEventListener("click", (event) => {
      if (!event.target?.closest?.("#splash.gillie-launch-intro")) return;
      document.documentElement.dataset.gillieFirstLaunchGate = "continued-by-user";
      track("first_launch_continue_tapped");
    }, true);
  }

  function resetDialog() {
    let overlay = document.getElementById("gillie-hard-reset-overlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "gillie-hard-reset-overlay";
    overlay.className = "overlay";
    overlay.hidden = true;
    overlay.style.zIndex = "10000";
    overlay.innerHTML = `
      <div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="gillie-hard-reset-title" aria-describedby="gillie-hard-reset-copy">
        <div class="grab"></div>
        <div class="confirm-icon">!</div>
        <h2 id="gillie-hard-reset-title">Erase everything?</h2>
        <p class="sub" id="gillie-hard-reset-copy">This permanently deletes your Gillie progress, preferences, reminders, and local diagnostics from this device. Your Apple subscription is not cancelled.</p>
        <div class="sheet-actions">
          <button type="button" class="btn danger" data-hard-reset-confirm>Erase everything</button>
          <button type="button" class="btn ghost" data-hard-reset-cancel>Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function closeResetDialog() {
    const overlay = document.getElementById("gillie-hard-reset-overlay");
    if (overlay) overlay.hidden = true;
    if (![...document.querySelectorAll(".overlay")].some((node) => !node.hidden)) {
      document.body.classList.remove("sheet-open");
    }
  }

  function fireAndForgetNativeCleanup() {
    const notification = notificationBridge();
    const ids = [810001, 810002, 810003, 810004, 810005, ...Array.from({ length: 40 }, (_, index) => 811000 + index)];
    try { void notification?.cancel?.({ notifications: ids.map((id) => ({ id })) }); } catch (_) {}
    try { void notification?.removeAllDeliveredNotifications?.(); } catch (_) {}
    try { void purchaseBridge()?.clearDiagnostics?.(); } catch (_) {}
    try { navigator.serviceWorker?.getRegistrations?.().then((registrations) => registrations.forEach((registration) => registration.unregister())); } catch (_) {}
    try { window.caches?.keys?.().then((keys) => keys.forEach((key) => window.caches.delete(key))); } catch (_) {}
  }

  function performHardReset() {
    if (window.__gillieEraseInProgress) return;
    window.__gillieEraseInProgress = true;
    const confirm = document.querySelector("[data-hard-reset-confirm]");
    if (confirm) {
      confirm.disabled = true;
      confirm.textContent = "Erasing…";
    }

    track("hard_reset_started");
    fireAndForgetNativeCleanup();
    try { window.save = () => {}; } catch (_) {}
    clearWebStorage();

    const url = new URL(window.location.href);
    url.searchParams.set(RESET_PARAM, String(Date.now()));
    window.location.replace(url.toString());
  }

  function installHardReset() {
    resetDialog();
    document.addEventListener("click", (event) => {
      const reset = event.target?.closest?.("#set-reset");
      if (reset) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const overlay = resetDialog();
        overlay.hidden = false;
        document.body.classList.add("sheet-open");
        nativeSetTimeout(() => overlay.querySelector("[data-hard-reset-confirm]")?.focus?.({ preventScroll: true }), 50);
        return;
      }

      if (event.target?.closest?.("[data-hard-reset-cancel]")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeResetDialog();
        return;
      }

      if (event.target?.closest?.("[data-hard-reset-confirm]")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        performHardReset();
      }
    }, true);
  }

  function isVisiblyBlocking(node) {
    if (!node || node.hidden) return false;
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") return false;
    if (Number.parseFloat(style.opacity || "1") <= 0.02) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }

  function activeBlockers() {
    return [...document.querySelectorAll(".overlay,.gillie-rating-overlay,#phase2-hatch-cinematic,#splash.gillie-launch-intro")]
      .filter(isVisiblyBlocking);
  }

  function fallbackActivateTab(button) {
    const viewName = button?.dataset?.view;
    const target = viewName ? document.getElementById(`view-${viewName}`) : null;
    if (!target) return false;

    document.querySelectorAll("#main .view").forEach((view) => { view.hidden = view !== target; });
    document.querySelectorAll("#tabs button[data-view]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("on", active);
      item.setAttribute("aria-selected", String(active));
      item.disabled = false;
    });
    try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
    nativeSetTimeout(() => { try { target.scrollTop = 0; } catch (_) {} }, 0);
    track("bottom_nav_fallback_used", { view: viewName });
    return true;
  }

  function repairNavigation() {
    const tabs = document.getElementById("tabs");
    if (!tabs) return false;
    const blockers = activeBlockers();
    const clear = blockers.length === 0;

    if (clear) {
      document.body.classList.remove("sheet-open", "gillie-rating-open", "v1-sos-support-open", "v1-welcome-recovery-open");
      tabs.style.setProperty("pointer-events", "auto", "important");
      tabs.style.setProperty("z-index", "190", "important");
      tabs.removeAttribute("inert");
      tabs.setAttribute("aria-hidden", "false");
      tabs.querySelectorAll("button[data-view]").forEach((button) => {
        button.disabled = false;
        button.style.setProperty("pointer-events", "auto", "important");
      });
    } else {
      tabs.style.removeProperty("z-index");
    }
    return clear;
  }

  function installNavigationGuard() {
    document.addEventListener("pointerdown", (event) => {
      if (event.target?.closest?.("#tabs")) repairNavigation();
    }, true);

    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.("#tabs button[data-view]");
      if (!button) return;
      repairNavigation();
      const viewName = button.dataset.view;
      nativeSetTimeout(() => {
        const target = document.getElementById(`view-${viewName}`);
        if (!target || target.hidden) fallbackActivateTab(button);
      }, 0);
    }, true);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) nativeSetTimeout(repairNavigation, 80);
    });

    window.addEventListener("pageshow", () => nativeSetTimeout(repairNavigation, 80));
    navRepairTimer = nativeSetInterval(repairNavigation, 700);
    nativeSetTimeout(repairNavigation, 0);
  }

  function installAfterDom() {
    installHardReset();
    installNavigationGuard();
    document.documentElement.dataset.gillieReliabilityGuard = ENGINE;
    track("reliability_guard_ready");
  }

  installFirstLaunchGate();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installAfterDom, { once: true });
  else installAfterDom();
})();