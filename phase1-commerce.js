/* Gillie Phase 1 commerce, settings hardening, and startup recovery. */

/*
 * Startup guard: the canonical inline app boots before this file. If legacy or
 * malformed local data makes that boot throw, the old splash could otherwise
 * remain forever. This guard repairs recoverable state, retries the visible
 * shell, and always removes the splash after the normal boot window.
 */
(() => {
  "use strict";

  let bootErrorMessage = "";

  window.addEventListener("error", (event) => {
    if (document.querySelector("#splash")) {
      bootErrorMessage = String(event?.message || "Unknown startup error").slice(0, 160);
    }
  }, true);

  const asArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value);
    return [];
  };

  function repairState() {
    if (typeof state === "undefined" || !state || typeof state !== "object") return false;

    [
      "ownedItems",
      "equippedDecor",
      "reasons",
      "slips",
      "cravings",
      "sosRewards",
      "checkins",
      "milestonesSeen",
      "milestonesRewarded",
      "growthSeen",
      "buddies",
    ].forEach((key) => { state[key] = asArray(state[key]); });

    state.reminders = state.reminders && typeof state.reminders === "object"
      ? state.reminders
      : { checkin: true, craving: true };
    if (typeof state.reminders.checkin !== "boolean") state.reminders.checkin = true;
    if (typeof state.reminders.craving !== "boolean") state.reminders.craving = true;

    state.cost = {
      substance: "vape",
      style: "disposables",
      unitsPerWeek: 2,
      costPerUnit: 15,
      puffsPerDay: 200,
      ...(state.cost && typeof state.cost === "object" ? state.cost : {}),
    };
    state.coach = state.coach && typeof state.coach === "object"
      ? state.coach
      : { missionDate: null, completed: {}, reviews: [] };
    state.coach.completed = state.coach.completed && typeof state.coach.completed === "object"
      ? state.coach.completed
      : {};
    state.coach.reviews = asArray(state.coach.reviews);
    state.premiumEntitlement = state.premiumEntitlement && typeof state.premiumEntitlement === "object"
      ? state.premiumEntitlement
      : { active: false, checkedAt: 0, source: "unknown" };
    state.pendingFollowup = state.pendingFollowup && typeof state.pendingFollowup === "object"
      ? state.pendingFollowup
      : null;
    state.petName = typeof state.petName === "string" && state.petName.trim()
      ? state.petName.slice(0, 14)
      : "Gillie";
    state.skin = typeof state.skin === "string" ? state.skin : "pink";
    state.theme = typeof state.theme === "string" ? state.theme : "clear";
    state.pearls = Number.isFinite(Number(state.pearls)) ? Math.max(0, Number(state.pearls)) : 0;
    state.justSlippedAt = Number(state.justSlippedAt) || 0;

    try { if (typeof save === "function") save(); } catch (_) {}
    return true;
  }

  function dismissSplash() {
    const splash = document.querySelector("#splash");
    if (!splash) return;
    splash.classList.add("hide");
    splash.style.pointerEvents = "none";
    setTimeout(() => splash.remove(), 420);
  }

  function showRecovery(error) {
    dismissSplash();
    if (document.querySelector("#gillie-startup-recovery")) return;

    const panel = document.createElement("div");
    panel.id = "gillie-startup-recovery";
    panel.setAttribute("role", "alert");
    panel.style.cssText = "position:fixed;inset:0;z-index:500;background:linear-gradient(180deg,#e8f2ef,#dceae6);display:grid;place-items:center;padding:24px;color:#11332f;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif";
    panel.innerHTML = `
      <div style="width:min(390px,100%);background:#fff;border-radius:26px;padding:24px;box-shadow:0 18px 48px rgba(17,51,47,.16);text-align:center">
        <div style="font-size:38px;margin-bottom:10px">🫧</div>
        <h1 style="font-size:25px;line-height:1.1;margin:0 0 10px">Gillie hit a startup snag.</h1>
        <p style="font-size:15px;line-height:1.45;color:#48645e;margin:0 0 18px">Your progress is still on this device. Try opening the app again first.</p>
        <button id="gillie-retry-startup" style="width:100%;min-height:50px;border:0;border-radius:999px;background:#11332f;color:#fff;font-weight:800;font-size:16px">Try again</button>
        <button id="gillie-reset-startup" style="width:100%;min-height:46px;border:0;background:transparent;color:#7e958f;font-weight:700;margin-top:8px">Start fresh on this device</button>
        <small style="display:block;margin-top:12px;color:#9aaca7">${String(error?.message || bootErrorMessage || "Startup recovery could not complete.").replace(/[<>]/g, "").slice(0, 120)}</small>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector("#gillie-retry-startup").onclick = () => location.reload();
    panel.querySelector("#gillie-reset-startup").onclick = () => {
      if (!confirm("Start fresh? This permanently deletes Gillie progress stored on this device.")) return;
      try { localStorage.removeItem("gillie_v1"); } catch (_) {}
      location.reload();
    };
  }

  function recoverStartup() {
    const splash = document.querySelector("#splash");
    if (!splash) return;

    try {
      if (!repairState()) throw new Error(bootErrorMessage || "Gillie state was unavailable.");
      const current = state;
      const onboarding = document.querySelector("#onboarding");
      const main = document.querySelector("#main");

      if (current.onboarded) {
        if (onboarding) onboarding.hidden = true;
        if (main) main.hidden = false;
        if (typeof renderAxo === "function") renderAxo();
        if (typeof renderAll === "function") renderAll();
        if (typeof startTick === "function") startTick();
        if (typeof scheduleBubbles === "function") scheduleBubbles();
        if (typeof spawnMotes === "function") spawnMotes();
        if (typeof behaviorLoop === "function") behaviorLoop();
        if (typeof wireTapPlay === "function") wireTapPlay();
      } else {
        if (main) main.hidden = true;
        if (onboarding) onboarding.hidden = false;
        if (typeof obRender === "function") obRender();
      }

      dismissSplash();
      try {
        window.Capacitor?.Plugins?.GilliePurchases?.trackEvent?.({
          name: "startup_recovered",
          properties: { hadError: Boolean(bootErrorMessage) },
        });
      } catch (_) {}
    } catch (error) {
      showRecovery(error);
    }
  }

  setTimeout(recoverStartup, 2800);
})();

(() => {
  "use strict";

  const purchases = () => window.Capacitor?.Plugins?.GilliePurchases || null;
  const notifications = () => window.Capacitor?.Plugins?.LocalNotifications || null;
  const CRAVING_FOLLOWUP_NOTIFICATION_ID = 810004;

  function track(name, properties = {}) {
    try { purchases()?.trackEvent?.({ name, properties }); } catch (_) {}
  }

  async function renderReminderStatus() {
    const checkinValue = document.querySelector("#set-reminder-checkin-v");
    const cravingValue = document.querySelector("#set-reminder-craving-v");
    if (!checkinValue || !cravingValue || typeof state === "undefined") return;
    let granted = false;
    try { granted = (await notifications()?.checkPermissions?.())?.display === "granted"; } catch (_) {}
    checkinValue.textContent = !state.reminders?.checkin ? "Off" : granted ? "8:30 PM" : "Set up";
    cravingValue.textContent = !state.reminders?.craving ? "Off" : granted ? "On" : "Set up";
  }

  function hardenSettingsRendering() {
    if (typeof renderSettings !== "function" || renderSettings.__commerceWrapped) return;
    const original = renderSettings;
    renderSettings = function renderSettingsCommerce() {
      original();
      renderReminderStatus();
    };
    renderSettings.__commerceWrapped = true;
    renderReminderStatus();
  }

  function legalElement() {
    return document.querySelector("#plus-legal");
  }

  function setLegal(message) {
    const element = legalElement();
    if (element) element.textContent = message;
  }

  async function purchaseSelectedPlan() {
    const plan = CONFIG.plus.products[selectedPlusPlan] || CONFIG.plus.products.yearly;
    const bridge = purchases();
    if (!bridge?.purchase) {
      setLegal("Purchases are available in the iOS App Store build.");
      return;
    }
    setLegal(`Opening Apple purchase sheet for ${plan.name}...`);
    track("purchase_started", { plan: selectedPlusPlan });
    try {
      const result = await bridge.purchase({ productId: plan.id });
      if (result?.active) {
        applyEntitlementStatus(result);
        document.querySelector("#plus-overlay").hidden = true;
        toast("👑", "Gillie Plus active. Your Coach plan is unlocked.");
        track("purchase_completed", { plan: selectedPlusPlan });
      } else if (result?.cancelled) {
        setLegal("Purchase cancelled. Nothing was charged.");
        track("purchase_cancelled", { plan: selectedPlusPlan });
      } else if (result?.pending) {
        setLegal("Purchase is pending with Apple. Gillie will unlock after Apple approves it.");
        track("purchase_pending", { plan: selectedPlusPlan });
      } else {
        if (result?.verified) applyEntitlementStatus(result);
        setLegal("Apple returned without an active Gillie Plus subscription. Try Restore purchases or try again.");
      }
    } catch (error) {
      const message = String(error?.message || "Purchase was not completed.");
      setLegal(/cancel/i.test(message) ? "Purchase cancelled. Nothing was charged." : message);
      track("purchase_error", { message: message.slice(0, 80) });
    }
  }

  async function restorePurchase() {
    const bridge = purchases();
    if (!bridge?.restorePurchases) {
      setLegal("Restore is available in the iOS App Store build.");
      return;
    }
    setLegal("Checking Apple purchases...");
    track("restore_started");
    try {
      const result = await bridge.restorePurchases();
      if (result?.active) {
        applyEntitlementStatus(result);
        document.querySelector("#plus-overlay").hidden = true;
        toast("👑", "Gillie Plus restored.");
        track("restore_completed", { active: true });
      } else {
        if (result?.verified) applyEntitlementStatus(result);
        setLegal("No active Gillie Plus purchase was found for this Apple ID.");
        track("restore_completed", { active: false });
      }
    } catch (error) {
      const message = String(error?.message || "Could not restore purchases right now.");
      setLegal(message);
      track("restore_error", { message: message.slice(0, 80) });
    }
  }

  async function cancelCravingFollowupNotification() {
    const plugin = notifications();
    if (!plugin?.cancel) return;
    try { await plugin.cancel({ notifications: [{ id: CRAVING_FOLLOWUP_NOTIFICATION_ID }] }); } catch (_) {}
  }

  async function rescheduleActiveCravingFollowup() {
    const plugin = notifications();
    const dueAt = typeof state !== "undefined" ? state?.pendingFollowup?.dueAt : null;
    if (!plugin?.schedule || !state?.reminders?.craving || !dueAt || dueAt <= Date.now()) return;
    try {
      const permission = await plugin.checkPermissions();
      if (permission?.display !== "granted") return;
      await cancelCravingFollowupNotification();
      await plugin.schedule({
        notifications: [{
          id: CRAVING_FOLLOWUP_NOTIFICATION_ID,
          title: "Still with you",
          body: "Gillie is checking back again. Open the app when you are ready to say whether the craving passed.",
          schedule: { at: new Date(dueAt) },
          extra: { route: "craving-followup" },
          threadIdentifier: "gillie-craving",
          relevanceScore: 0.9,
        }],
      });
      track("craving_followup_rescheduled");
    } catch (error) {
      track("craving_followup_reschedule_error", { message: String(error?.message || error).slice(0, 80) });
    }
  }

  function installFollowupNotificationControls() {
    document.querySelector("#followup-fighting")?.addEventListener("click", () => {
      setTimeout(rescheduleActiveCravingFollowup, 75);
    });
    document.querySelector("#followup-made")?.addEventListener("click", () => {
      setTimeout(cancelCravingFollowupNotification, 75);
    });
    document.querySelector("#followup-used")?.addEventListener("click", () => {
      setTimeout(cancelCravingFollowupNotification, 75);
    });
  }

  function install() {
    hardenSettingsRendering();
    const purchaseButton = document.querySelector("#plus-purchase");
    const restoreButton = document.querySelector("#plus-restore");
    if (purchaseButton) purchaseButton.onclick = purchaseSelectedPlan;
    if (restoreButton) restoreButton.onclick = restorePurchase;
    installFollowupNotificationControls();
    try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
    renderReminderStatus();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) renderReminderStatus();
  });
})();

/* Load the isolated Phase 2 polish layer after the production runtime. */
(() => {
  "use strict";
  const load = () => {
    if (!document.querySelector('link[data-gillie-phase2="true"]')) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = "./phase2-polish.css";
      stylesheet.dataset.gilliePhase2 = "true";
      document.head.appendChild(stylesheet);
    }
    if (!document.querySelector('script[data-gillie-phase2="true"]')) {
      const script = document.createElement("script");
      script.src = "./phase2-polish.js";
      script.defer = true;
      script.dataset.gilliePhase2 = "true";
      document.head.appendChild(script);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once: true });
  else load();
})();
