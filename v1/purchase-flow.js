/* Gillie V1 Purchase Flow — immediate feedback, StoreKit reconciliation, and duplicate-tap protection. */
(() => {
  "use strict";

  if (window.__gilliePurchaseFlowInstalled) return;
  window.__gilliePurchaseFlowInstalled = true;

  const ENGINE = "purchase-flow-v1";
  const PRODUCT_IDS = Object.freeze({
    monthly: "gillie.plus.monthly",
    yearly: "gillie.plus.yearly",
  });
  const RECHECK_DELAYS = Object.freeze([0, 250, 800, 1800, 3500]);
  const PURCHASE_TIMEOUT_MS = 90000;
  const RECENT_ATTEMPT_MS = 5 * 60 * 1000;

  let busy = false;
  let busyMode = "";
  let attemptToken = 0;
  let attemptStartedAt = 0;
  let timeoutHandle = 0;
  let listenerInstalled = false;
  let lastFinishedToken = 0;
  const priorDisabled = new WeakMap();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const bridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;

  function track(name, properties = {}) {
    try {
      bridge()?.trackEvent?.({ name, properties: { engine: ENGINE, ...properties } });
    } catch (_) {}
  }

  function selectedPlanKey() {
    try {
      if (typeof selectedPlusPlan !== "undefined" && PRODUCT_IDS[selectedPlusPlan]) return selectedPlusPlan;
    } catch (_) {}
    return $("#plus-plans [data-plus-plan].on")?.dataset?.plusPlan || "yearly";
  }

  function selectedPlan() {
    const key = selectedPlanKey();
    let plan = null;
    try { plan = CONFIG?.plus?.products?.[key] || null; } catch (_) {}
    return {
      key,
      id: plan?.id || PRODUCT_IDS[key] || PRODUCT_IDS.yearly,
      name: plan?.name || (key === "monthly" ? "Monthly" : "Yearly"),
    };
  }

  function purchaseButton() {
    return $("#plus-purchase");
  }

  function restoreButton() {
    return $("#plus-restore");
  }

  function statusBanner() {
    return $("#gp-status-banner");
  }

  function legalElement() {
    return $("#plus-legal");
  }

  function setStatus(message, type = "working") {
    const clean = String(message || "").trim();
    const legal = legalElement();
    if (legal) legal.textContent = clean;

    const banner = statusBanner();
    if (banner) {
      banner.textContent = clean;
      banner.className = `gp-status-banner ${type}`;
      banner.hidden = !clean;
    }
  }

  function rememberAndDisable(element) {
    if (!element || priorDisabled.has(element)) return;
    priorDisabled.set(element, Boolean(element.disabled));
    element.disabled = true;
    element.setAttribute("aria-disabled", "true");
  }

  function restoreDisabledState(element) {
    if (!element || !priorDisabled.has(element)) return;
    const wasDisabled = priorDisabled.get(element);
    priorDisabled.delete(element);
    element.disabled = wasDisabled;
    element.setAttribute("aria-disabled", String(wasDisabled));
  }

  function setBusy(active, mode = "purchase", label = "") {
    busy = Boolean(active);
    busyMode = busy ? mode : "";

    const purchase = purchaseButton();
    const restore = restoreButton();
    const plans = $$("#plus-plans [data-plus-plan]");

    if (busy) {
      rememberAndDisable(purchase);
      rememberAndDisable(restore);
      plans.forEach(rememberAndDisable);
      if (purchase) {
        purchase.dataset.purchaseBusy = "1";
        purchase.setAttribute("aria-busy", "true");
        if (mode === "purchase") purchase.textContent = label || "Waiting for Apple…";
      }
      if (restore) {
        restore.dataset.purchaseBusy = "1";
        restore.setAttribute("aria-busy", "true");
        if (mode === "restore") restore.textContent = label || "Checking Apple…";
      }
      return;
    }

    [purchase, restore, ...plans].forEach(restoreDisabledState);
    if (purchase) {
      delete purchase.dataset.purchaseBusy;
      purchase.removeAttribute("aria-busy");
      if (!purchase.disabled) purchase.textContent = "Start Gillie Plus";
    }
    if (restore) {
      delete restore.dataset.purchaseBusy;
      restore.removeAttribute("aria-busy");
      restore.textContent = "Restore purchases";
    }
    document.dispatchEvent(new CustomEvent("gillie:purchase-flow-settled"));
  }

  function closePaywall() {
    const overlay = $("#plus-overlay");
    if (!overlay || overlay.hidden) return;
    try {
      if (typeof closeSheetOverlay === "function") closeSheetOverlay(overlay, false);
      else overlay.hidden = true;
    } catch (_) {
      overlay.hidden = true;
    }
  }

  function announceSuccess(message) {
    closePaywall();
    setTimeout(() => {
      try {
        if (typeof toast === "function") toast("👑", message);
      } catch (_) {}
    }, 180);
  }

  function applyActiveEntitlement(status, source = "unknown") {
    if (!status?.active) return false;
    clearTimeout(timeoutHandle);
    try {
      if (typeof applyEntitlementStatus === "function") applyEntitlementStatus(status);
    } catch (_) {}
    setBusy(false);
    setStatus("Gillie Plus is active.", "success");
    announceSuccess("Gillie Plus active. Your plan is unlocked.");
    track("purchase_flow_active", {
      source,
      productId: String(status?.productId || "").slice(0, 80),
    });
    return true;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function readEntitlement() {
    const plugin = bridge();
    if (!plugin?.getEntitlementStatus) return null;
    try {
      return await plugin.getEntitlementStatus();
    } catch (error) {
      track("purchase_entitlement_check_failed", {
        message: String(error?.message || error).slice(0, 100),
      });
      return null;
    }
  }

  async function reconcileEntitlement(token, reason = "purchase_return") {
    for (const wait of RECHECK_DELAYS) {
      if (token !== attemptToken || token === lastFinishedToken) return false;
      if (wait) await delay(wait);
      const status = await readEntitlement();
      if (status?.active) {
        lastFinishedToken = token;
        return applyActiveEntitlement(status, `recheck:${reason}`);
      }
    }
    return false;
  }

  function startTimeout(token) {
    clearTimeout(timeoutHandle);
    timeoutHandle = setTimeout(() => {
      if (token !== attemptToken || token === lastFinishedToken || !busy) return;
      setBusy(false);
      setStatus(
        "Apple is still processing this purchase. You can tap Restore purchases, or return to Gillie and it will unlock automatically when Apple confirms it.",
        "pending",
      );
      track("purchase_flow_timeout", { mode: busyMode || "purchase" });
    }, PURCHASE_TIMEOUT_MS);
  }

  async function handlePurchase(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (busy) return;

    const plugin = bridge();
    if (!plugin?.purchase) {
      setStatus("Gillie Plus purchases are available in the iOS App Store build.", "error");
      return;
    }

    const plan = selectedPlan();
    const token = ++attemptToken;
    attemptStartedAt = Date.now();
    setBusy(true, "purchase", "Opening Apple…");
    setStatus(`Opening Apple’s secure ${plan.name.toLowerCase()} purchase…`, "working");
    track("purchase_flow_started", { plan: plan.key, productId: plan.id });
    startTimeout(token);

    const reassurance = setTimeout(() => {
      if (token !== attemptToken || token === lastFinishedToken || !busy) return;
      const purchase = purchaseButton();
      if (purchase) purchase.textContent = "Waiting for Apple…";
      setStatus("Complete the Apple purchase sheet. Gillie will confirm your access automatically.", "working");
    }, 1800);

    try {
      const result = await plugin.purchase({ productId: plan.id });
      clearTimeout(reassurance);
      if (token !== attemptToken || token === lastFinishedToken) return;

      if (applyActiveEntitlement(result, "purchase_result")) {
        lastFinishedToken = token;
        return;
      }

      if (result?.cancelled) {
        clearTimeout(timeoutHandle);
        lastFinishedToken = token;
        setBusy(false);
        setStatus("Purchase cancelled. Nothing was charged.", "info");
        track("purchase_flow_cancelled", { plan: plan.key });
        return;
      }

      if (result?.pending) {
        clearTimeout(timeoutHandle);
        lastFinishedToken = token;
        setBusy(false);
        setStatus("Purchase pending with Apple. Gillie will unlock automatically when Apple approves it.", "pending");
        track("purchase_flow_pending", { plan: plan.key });
        return;
      }

      const purchase = purchaseButton();
      if (purchase) purchase.textContent = "Confirming access…";
      setStatus("Apple returned to Gillie. Confirming your subscription…", "working");
      const active = await reconcileEntitlement(token, "inactive_result");
      if (active) return;

      clearTimeout(timeoutHandle);
      lastFinishedToken = token;
      setBusy(false);
      setStatus(
        "Apple did not confirm an active subscription yet. Tap Restore purchases once; if it still does not unlock, check that the sandbox purchase completed.",
        "error",
      );
      track("purchase_flow_inactive_return", { plan: plan.key });
    } catch (error) {
      clearTimeout(reassurance);
      if (token !== attemptToken || token === lastFinishedToken) return;

      setStatus("Apple returned to Gillie. Checking whether the purchase completed…", "working");
      const active = await reconcileEntitlement(token, "purchase_error");
      if (active) return;

      clearTimeout(timeoutHandle);
      lastFinishedToken = token;
      setBusy(false);
      const message = String(error?.message || "Purchase was not completed.");
      const cancelled = /cancel/i.test(message);
      setStatus(
        cancelled ? "Purchase cancelled. Nothing was charged." : `Purchase was not completed. ${message}`,
        cancelled ? "info" : "error",
      );
      track("purchase_flow_error", { message: message.slice(0, 100), plan: plan.key });
    }
  }

  async function handleRestore(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (busy) return;

    const plugin = bridge();
    if (!plugin?.restorePurchases) {
      setStatus("Restore purchases is available in the iOS App Store build.", "error");
      return;
    }

    const token = ++attemptToken;
    attemptStartedAt = Date.now();
    setBusy(true, "restore", "Checking Apple…");
    setStatus("Checking purchases for this Apple ID…", "working");
    track("purchase_restore_started");
    startTimeout(token);

    try {
      const result = await plugin.restorePurchases();
      if (token !== attemptToken || token === lastFinishedToken) return;
      if (applyActiveEntitlement(result, "restore_result")) {
        lastFinishedToken = token;
        return;
      }

      const active = await reconcileEntitlement(token, "restore_result");
      if (active) return;

      clearTimeout(timeoutHandle);
      lastFinishedToken = token;
      setBusy(false);
      setStatus("No active Gillie Plus subscription was found for this Apple ID.", "error");
      track("purchase_restore_inactive");
    } catch (error) {
      if (token !== attemptToken || token === lastFinishedToken) return;
      const active = await reconcileEntitlement(token, "restore_error");
      if (active) return;

      clearTimeout(timeoutHandle);
      lastFinishedToken = token;
      setBusy(false);
      const message = String(error?.message || "Could not restore purchases right now.");
      setStatus(message, "error");
      track("purchase_restore_error", { message: message.slice(0, 100) });
    }
  }

  async function reconcileAfterForeground() {
    if (!attemptStartedAt || Date.now() - attemptStartedAt > RECENT_ATTEMPT_MS) return;
    const token = attemptToken;
    if (token === lastFinishedToken) return;
    if (busy) {
      const purchase = purchaseButton();
      if (purchase && busyMode === "purchase") purchase.textContent = "Confirming access…";
      setStatus("Back in Gillie. Confirming your Apple subscription…", "working");
    }
    const active = await reconcileEntitlement(token, "app_foreground");
    if (active) lastFinishedToken = token;
  }

  function installEntitlementListener() {
    if (listenerInstalled) return;
    const plugin = bridge();
    if (!plugin?.addListener) return;
    listenerInstalled = true;
    try {
      Promise.resolve(plugin.addListener("entitlementChanged", (status) => {
        if (!status?.active) return;
        lastFinishedToken = attemptToken;
        applyActiveEntitlement(status, "native_listener");
      })).catch((error) => {
        listenerInstalled = false;
        track("purchase_listener_failed", { message: String(error?.message || error).slice(0, 100) });
      });
    } catch (error) {
      listenerInstalled = false;
      track("purchase_listener_failed", { message: String(error?.message || error).slice(0, 100) });
    }
  }

  function bindButtons() {
    const purchase = purchaseButton();
    const restore = restoreButton();
    if (!purchase || !restore) return false;
    purchase.onclick = handlePurchase;
    restore.onclick = handleRestore;
    purchase.dataset.purchaseFlow = ENGINE;
    restore.dataset.purchaseFlow = ENGINE;
    return true;
  }

  function install() {
    installEntitlementListener();
    if (!bindButtons()) return false;

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        installEntitlementListener();
        setTimeout(reconcileAfterForeground, 80);
      }
    });

    document.addEventListener("gillie:purchase-flow-settled", () => {
      setTimeout(bindButtons, 20);
    });

    const observer = new MutationObserver(() => {
      if (!purchaseButton()?.dataset?.purchaseFlow) bindButtons();
      installEntitlementListener();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    track("purchase_flow_loaded", { engine: ENGINE });
    return true;
  }

  function wait(attempt = 0) {
    if (install()) return;
    if (attempt >= 120) {
      track("purchase_flow_install_failed", { reason: "buttons_missing" });
      return;
    }
    setTimeout(() => wait(attempt + 1), 50);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => wait(), { once: true });
  } else {
    wait();
  }
})();
