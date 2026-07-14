/* Gillie V1 Purchase Flow — native product preflight, StoreKit reconciliation, and diagnosable failures. */
(() => {
  "use strict";

  if (window.__gilliePurchaseFlowInstalled) return;
  window.__gilliePurchaseFlowInstalled = true;

  const ENGINE = "purchase-flow-v1";
  const ENGINE_VERSION = "purchase-flow-v2-native-preflight";
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
  let lastFailure = null;
  const priorDisabled = new WeakMap();

  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const $$ = (selector, root = document) => Array.from(root?.querySelectorAll?.(selector) || []);
  const bridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;

  function track(name, properties = {}) {
    try {
      bridge()?.trackEvent?.({ name, properties: { engine: ENGINE, version: ENGINE_VERSION, ...properties } });
    } catch (_) {}
  }

  function cleanText(value, maxLength = 240) {
    return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
  }

  function selectedPlanKey() {
    try {
      if (typeof selectedPlusPlan !== "undefined" && PRODUCT_IDS[selectedPlusPlan]) return selectedPlusPlan;
    } catch (_) {}
    return $("#plus-plans [data-plus-plan].on")?.dataset?.plusPlan || "yearly";
  }

  function setSelectedPlanKey(key) {
    if (!PRODUCT_IDS[key]) return;
    try { selectedPlusPlan = key; } catch (_) {}
    $$("#plus-plans [data-plus-plan]").forEach((button) => {
      button.classList.toggle("on", button.dataset.plusPlan === key);
      button.setAttribute("aria-checked", String(button.dataset.plusPlan === key));
    });
  }

  function planForKey(key) {
    let plan = null;
    try { plan = CONFIG?.plus?.products?.[key] || null; } catch (_) {}
    return {
      key,
      id: plan?.id || PRODUCT_IDS[key] || PRODUCT_IDS.yearly,
      name: plan?.name || (key === "monthly" ? "Monthly" : "Yearly"),
    };
  }

  function selectedPlan() {
    return planForKey(selectedPlanKey());
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
    const clean = cleanText(message, 500);
    const legal = legalElement();
    if (legal) legal.textContent = clean;

    const banner = statusBanner();
    if (banner) {
      banner.textContent = clean;
      banner.className = `gp-status-banner ${type}`;
      banner.hidden = !clean;
    }

    if (type === "error") ensureDiagnosticsButton(true);
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
      purchase.disabled = false;
      purchase.setAttribute("aria-disabled", "false");
      purchase.textContent = "Start Gillie Plus";
    }
    if (restore) {
      delete restore.dataset.purchaseBusy;
      restore.removeAttribute("aria-busy");
      restore.disabled = false;
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
    lastFailure = null;
    try {
      if (typeof applyEntitlementStatus === "function") applyEntitlementStatus(status);
    } catch (_) {}
    setBusy(false);
    setStatus("Gillie Plus is active.", "success");
    ensureDiagnosticsButton(false);
    announceSuccess("Gillie Plus active. Your plan is unlocked.");
    track("purchase_flow_active", {
      source,
      productId: cleanText(status?.productId, 80),
    });
    return true;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeNativeProducts(response) {
    const allowed = new Set(Object.values(PRODUCT_IDS));
    const rows = Array.isArray(response?.products) ? response.products : [];
    return rows
      .map((product) => ({
        id: cleanText(product?.id, 80),
        displayPrice: cleanText(product?.displayPrice, 80),
        displayName: cleanText(product?.displayName, 80),
      }))
      .filter((product) => allowed.has(product.id));
  }

  async function preflightSelectedPlan(plugin, requestedPlan = selectedPlan()) {
    if (!plugin?.getProducts) {
      const error = new Error("The native Gillie purchase bridge cannot load Apple products in this build.");
      error.code = "BRIDGE_PRODUCTS_MISSING";
      throw error;
    }

    const response = await plugin.getProducts();
    const products = normalizeNativeProducts(response);
    const availableIds = products.map((product) => product.id);
    let plan = requestedPlan;

    if (!availableIds.includes(plan.id)) {
      const fallbackKey = ["yearly", "monthly"].find((key) => availableIds.includes(PRODUCT_IDS[key]));
      if (fallbackKey) {
        setSelectedPlanKey(fallbackKey);
        plan = planForKey(fallbackKey);
      } else {
        const requested = Array.isArray(response?.requestedProductIds)
          ? response.requestedProductIds.join(", ")
          : Object.values(PRODUCT_IDS).join(", ");
        const returned = Array.isArray(response?.returnedProductIds)
          ? response.returnedProductIds.join(", ")
          : availableIds.join(", ");
        const error = new Error(
          `Apple returned no Gillie Plus plans for this build. Requested: ${requested || "none"}. Returned: ${returned || "none"}.`,
        );
        error.code = "STORE_PRODUCTS_EMPTY";
        error.details = response || null;
        throw error;
      }
    }

    track("purchase_product_preflight_ready", {
      requestedPlan: requestedPlan.key,
      resolvedPlan: plan.key,
      productId: plan.id,
      availableCount: availableIds.length,
    });
    return { plan, response, products };
  }

  async function readEntitlement() {
    const plugin = bridge();
    if (!plugin?.getEntitlementStatus) return null;
    try {
      return await plugin.getEntitlementStatus();
    } catch (error) {
      track("purchase_entitlement_check_failed", {
        message: cleanText(error?.message || error, 100),
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

  function recordFailure(stage, error, extra = {}) {
    const message = cleanText(error?.message || error || "Unknown purchase error.", 500);
    lastFailure = {
      stage,
      code: cleanText(error?.code || "UNKNOWN", 80),
      message,
      at: new Date().toISOString(),
      ...extra,
    };
    track("purchase_flow_error", {
      stage,
      code: lastFailure.code,
      message: message.slice(0, 140),
      ...extra,
    });
    return message;
  }

  function friendlyFailure(error) {
    const message = cleanText(error?.message || error || "Purchase was not completed.", 500);
    if (/cancel/i.test(message)) return { text: "Purchase cancelled. Nothing was charged.", type: "info" };
    if (error?.code === "STORE_PRODUCTS_EMPTY" || /returned no Gillie Plus plans|not available in this storefront/i.test(message)) {
      return {
        text: "Apple did not return either Gillie Plus plan for this TestFlight build. The app is connected, but the subscriptions are not available to StoreKit for this bundle/storefront yet. Tap Copy purchase details below.",
        type: "error",
      };
    }
    if (error?.code === "BRIDGE_PRODUCTS_MISSING" || /native Gillie purchase bridge/i.test(message)) {
      return {
        text: "This build is missing the native Gillie purchase bridge. It cannot open Apple checkout. Install the corrected TestFlight build.",
        type: "error",
      };
    }
    return { text: `Purchase was not completed. ${message}`, type: "error" };
  }

  async function handlePurchase(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (busy) return;

    const plugin = bridge();
    if (!plugin?.purchase || !plugin?.getProducts) {
      const error = Object.assign(new Error("The native Gillie purchase bridge is missing."), { code: "BRIDGE_PRODUCTS_MISSING" });
      recordFailure("bridge", error);
      setStatus(friendlyFailure(error).text, "error");
      return;
    }

    const requestedPlan = selectedPlan();
    const token = ++attemptToken;
    attemptStartedAt = Date.now();
    setBusy(true, "purchase", "Connecting to Apple…");
    setStatus("Confirming this TestFlight build can see your Gillie Plus plan…", "working");
    track("purchase_flow_started", { plan: requestedPlan.key, productId: requestedPlan.id });
    startTimeout(token);

    let reassurance = 0;
    try {
      const preflight = await preflightSelectedPlan(plugin, requestedPlan);
      if (token !== attemptToken || token === lastFinishedToken) return;
      const plan = preflight.plan;

      const purchase = purchaseButton();
      if (purchase) purchase.textContent = "Opening Apple…";
      setStatus(`Opening Apple’s secure ${plan.name.toLowerCase()} purchase…`, "working");
      reassurance = setTimeout(() => {
        if (token !== attemptToken || token === lastFinishedToken || !busy) return;
        const button = purchaseButton();
        if (button) button.textContent = "Waiting for Apple…";
        setStatus("Complete the Apple purchase sheet. Gillie will confirm your access automatically.", "working");
      }, 1800);

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
      const inactive = Object.assign(new Error("Apple completed checkout without returning an active entitlement."), { code: "INACTIVE_AFTER_PURCHASE" });
      recordFailure("entitlement", inactive, { plan: plan.key, productId: plan.id });
      setStatus("Apple did not confirm an active subscription. Tap Restore purchases once. If it remains inactive, copy the purchase details below.", "error");
    } catch (error) {
      clearTimeout(reassurance);
      if (token !== attemptToken || token === lastFinishedToken) return;

      // A StoreKit error can occur after a completed sheet. Recheck entitlement
      // before showing failure so users are never charged without being unlocked.
      setStatus("Checking whether Apple completed the purchase…", "working");
      const active = await reconcileEntitlement(token, "purchase_error");
      if (active) return;

      clearTimeout(timeoutHandle);
      lastFinishedToken = token;
      setBusy(false);
      recordFailure("purchase", error, { plan: requestedPlan.key, productId: requestedPlan.id });
      const friendly = friendlyFailure(error);
      setStatus(friendly.text, friendly.type);
    }
  }

  async function handleRestore(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (busy) return;

    const plugin = bridge();
    if (!plugin?.restorePurchases) {
      const error = Object.assign(new Error("The native Gillie restore bridge is missing."), { code: "BRIDGE_RESTORE_MISSING" });
      recordFailure("restore-bridge", error);
      setStatus("This build is missing the native Restore Purchases connection.", "error");
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
      const error = Object.assign(new Error("No active Gillie Plus subscription was found for this Apple ID."), { code: "NO_ACTIVE_ENTITLEMENT" });
      recordFailure("restore", error);
      setStatus(error.message, "error");
      track("purchase_restore_inactive");
    } catch (error) {
      if (token !== attemptToken || token === lastFinishedToken) return;
      const active = await reconcileEntitlement(token, "restore_error");
      if (active) return;

      clearTimeout(timeoutHandle);
      lastFinishedToken = token;
      setBusy(false);
      const message = recordFailure("restore", error);
      setStatus(message || "Could not restore purchases right now.", "error");
      track("purchase_restore_error", { message: message.slice(0, 100) });
    }
  }

  async function collectDiagnostics() {
    const plugin = bridge();
    const report = {
      engine: ENGINE_VERSION,
      generatedAt: new Date().toISOString(),
      selectedPlan: selectedPlan(),
      expectedProductIds: PRODUCT_IDS,
      pricing: window.GillieStorePricing?.snapshot?.() || null,
      lastFailure,
      bridge: {
        available: Boolean(plugin),
        getProducts: Boolean(plugin?.getProducts),
        purchase: Boolean(plugin?.purchase),
        restorePurchases: Boolean(plugin?.restorePurchases),
        getEntitlementStatus: Boolean(plugin?.getEntitlementStatus),
      },
    };

    if (plugin?.getProducts) {
      try { report.products = await plugin.getProducts(); }
      catch (error) { report.productsError = cleanText(error?.message || error, 500); }
    }
    if (plugin?.getEntitlementStatus) {
      try { report.entitlement = await plugin.getEntitlementStatus(); }
      catch (error) { report.entitlementError = cleanText(error?.message || error, 500); }
    }
    if (plugin?.getDiagnostics) {
      try {
        const native = await plugin.getDiagnostics();
        report.nativeApp = native?.app || null;
        report.nativeEvents = Array.isArray(native?.events) ? native.events.slice(-30) : [];
      } catch (error) {
        report.nativeDiagnosticsError = cleanText(error?.message || error, 500);
      }
    }
    return report;
  }

  async function copyDiagnostics() {
    const button = $("#gillie-purchase-diagnostics");
    if (button) button.textContent = "Collecting…";
    try {
      const report = await collectDiagnostics();
      const text = JSON.stringify(report, null, 2);
      if (navigator.share && typeof File === "function") {
        const file = new File([text], "gillie-purchase-diagnostics.json", { type: "application/json" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: "Gillie purchase details", files: [file] });
          if (button) button.textContent = "Purchase details shared";
          return report;
        }
      }
      await navigator.clipboard.writeText(text);
      if (button) button.textContent = "Purchase details copied";
      try { if (typeof toast === "function") toast("✓", "Purchase details copied."); } catch (_) {}
      return report;
    } catch (error) {
      if (button) button.textContent = "Copy purchase details";
      setStatus(`Could not copy purchase details. ${cleanText(error?.message || error, 200)}`, "error");
      return null;
    }
  }

  function ensureDiagnosticsButton(visible = Boolean(lastFailure)) {
    const overlay = $("#plus-overlay");
    if (!overlay) return null;
    let button = $("#gillie-purchase-diagnostics", overlay);
    if (!button) {
      button = document.createElement("button");
      button.id = "gillie-purchase-diagnostics";
      button.type = "button";
      button.textContent = "Copy purchase details";
      button.style.cssText = "display:block;width:100%;margin:10px 0 0;padding:10px 12px;border:1px solid rgba(126,149,143,.35);border-radius:14px;background:rgba(255,255,255,.7);color:#48645e;font-weight:800;font-size:12px";
      button.addEventListener("click", copyDiagnostics);
      const restoreRow = $(".plus-restore-row", overlay) || $(".gp-restore-row", overlay);
      if (restoreRow?.insertAdjacentElement) restoreRow.insertAdjacentElement("afterend", button);
      else $(".gp-footer", overlay)?.appendChild(button);
    }
    button.hidden = !visible;
    if (!visible) button.textContent = "Copy purchase details";
    return button;
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
        track("purchase_listener_failed", { message: cleanText(error?.message || error, 100) });
      });
    } catch (error) {
      listenerInstalled = false;
      track("purchase_listener_failed", { message: cleanText(error?.message || error, 100) });
    }
  }

  function bindButtons() {
    const purchase = purchaseButton();
    const restore = restoreButton();
    if (!purchase || !restore) return false;
    purchase.onclick = handlePurchase;
    restore.onclick = handleRestore;
    purchase.dataset.purchaseFlow = ENGINE_VERSION;
    restore.dataset.purchaseFlow = ENGINE_VERSION;
    ensureDiagnosticsButton(Boolean(lastFailure));
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
      if (purchaseButton()?.dataset?.purchaseFlow !== ENGINE_VERSION) bindButtons();
      installEntitlementListener();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.GilliePurchaseFlow = Object.freeze({
      engine: ENGINE_VERSION,
      productIds: PRODUCT_IDS,
      preflight: () => preflightSelectedPlan(bridge(), selectedPlan()),
      purchase: handlePurchase,
      restore: handleRestore,
      diagnostics: collectDiagnostics,
      copyDiagnostics,
      lastFailure: () => lastFailure,
    });

    track("purchase_flow_loaded", { engine: ENGINE_VERSION });
    return true;
  }

  function wait(attempt = 0) {
    if (install()) return;
    if (attempt < 160) setTimeout(() => wait(attempt + 1), 50);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => wait(), { once: true });
  } else {
    wait();
  }
})();
