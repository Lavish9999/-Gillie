/* Gillie Phase 1 commerce and settings hardening. */
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
    const dueAt = state?.pendingFollowup?.dueAt;
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
    try { renderAll(); } catch (_) {}
    renderReminderStatus();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) renderReminderStatus();
  });
})();
