/* Gillie V1 Purchase Flow — StoreKit product preflight, checkout, restore, and diagnostics. */
(() => {
  "use strict";

  if (window.__gilliePurchaseFlowInstalled) return;
  window.__gilliePurchaseFlowInstalled = true;

  const ENGINE = "purchase-flow-v1";
  const VERSION = "purchase-flow-v3-production-branch";
  const PRODUCT_IDS = Object.freeze({
    monthly: "gillie.plus.monthly",
    yearly: "gillie.plus.yearly",
  });
  const RECHECK_DELAYS = Object.freeze([0, 250, 800, 1800, 3500]);
  const PURCHASE_TIMEOUT_MS = 90000;
  const RECENT_ATTEMPT_MS = 5 * 60 * 1000;

  let busy = false;
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
  const clean = (value, max = 500) => String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

  function track(name, properties = {}) {
    try { bridge()?.trackEvent?.({ name, properties: { engine: ENGINE, version: VERSION, ...properties } }); }
    catch (_) {}
  }

  function selectedPlanKey() {
    try {
      if (typeof selectedPlusPlan !== "undefined" && PRODUCT_IDS[selectedPlusPlan]) return selectedPlusPlan;
    } catch (_) {}
    return $("#plus-plans [data-plus-plan].on")?.dataset?.plusPlan || "yearly";
  }

  function choosePlan(key) {
    if (!PRODUCT_IDS[key]) return;
    try { selectedPlusPlan = key; } catch (_) {}
    $$("#plus-plans [data-plus-plan]").forEach((button) => {
      const selected = button.dataset.plusPlan === key;
      button.classList.toggle("on", selected);
      button.setAttribute("aria-checked", String(selected));
    });
  }

  function planFor(key = selectedPlanKey()) {
    let configured = null;
    try { configured = CONFIG?.plus?.products?.[key] || null; } catch (_) {}
    return {
      key,
      id: configured?.id || PRODUCT_IDS[key] || PRODUCT_IDS.yearly,
      name: configured?.name || (key === "monthly" ? "Monthly" : "Yearly"),
    };
  }

  function setStatus(message, type = "working") {
    const text = clean(message);
    const legal = $("#plus-legal");
    if (legal) legal.textContent = text;
    const banner = $("#gp-status-banner");
    if (banner) {
      banner.textContent = text;
      banner.className = `gp-status-banner ${type}`;
      banner.hidden = !text;
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
    const purchase = $("#plus-purchase");
    const restore = $("#plus-restore");
    const plans = $$("#plus-plans [data-plus-plan]");

    if (busy) {
      [purchase, restore, ...plans].forEach(rememberAndDisable);
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

  function applyActiveEntitlement(status, source = "unknown") {
    if (!status?.active) return false;
    clearTimeout(timeoutHandle);
    lastFailure = null;
    try { if (typeof applyEntitlementStatus === "function") applyEntitlementStatus(status); } catch (_) {}
    setBusy(false);
    ensureDiagnosticsButton(false);
    setStatus("Gillie Plus is active.", "success");
    const overlay = $("#plus-overlay");
    if (overlay) overlay.hidden = true;
    try { if (typeof toast === "function") toast("👑", "Gillie Plus active. Your plan is unlocked."); } catch (_) {}
    track("purchase_flow_active", { source, productId: clean(status?.productId, 80) });
    return true;
  }

  function normalizeProducts(response) {
    const expected = new Set(Object.values(PRODUCT_IDS));
    return (Array.isArray(response?.products) ? response.products : [])
      .map((product) => ({ id: clean(product?.id, 80), displayPrice: clean(product?.displayPrice, 80) }))
      .filter((product) => expected.has(product.id));
  }

  async function preflight(native = bridge(), requested = planFor()) {
    if (!native?.getProducts) {
      throw Object.assign(new Error("The native Gillie purchase bridge cannot load Apple products in this build."), {
        code: "BRIDGE_PRODUCTS_MISSING",
      });
    }

    const response = await native.getProducts();
    const products = normalizeProducts(response);
    const available = products.map((product) => product.id);
    let resolved = requested;

    if (!available.includes(resolved.id)) {
      const fallback = ["yearly", "monthly"].find((key) => available.includes(PRODUCT_IDS[key]));
      if (fallback) {
        choosePlan(fallback);
        resolved = planFor(fallback);
      } else {
        const requestedIds = Array.isArray(response?.requestedProductIds)
          ? response.requestedProductIds.join(", ")
          : Object.values(PRODUCT_IDS).join(", ");
        const returnedIds = Array.isArray(response?.returnedProductIds)
          ? response.returnedProductIds.join(", ")
          : available.join(", ");
        throw Object.assign(
          new Error(`Apple returned zero Gillie Plus products. Requested: ${requestedIds || "none"}. Returned: ${returnedIds || "none"}.`),
          { code: "STORE_PRODUCTS_EMPTY", details: response || null },
        );
      }
    }

    track("purchase_product_preflight_ready", {
      requestedPlan: requested.key,
      resolvedPlan: resolved.key,
      productId: resolved.id,
      availableCount: available.length,
    });
    return { plan: resolved, response };
  }

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function readEntitlement() {
    const native = bridge();
    if (!native?.getEntitlementStatus) return null;
    try { return await native.getEntitlementStatus(); }
    catch (error) {
      track("purchase_entitlement_check_failed", { message: clean(error?.message || error, 120) });
      return null;
    }
  }

  async function reconcileEntitlement(token, reason) {
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
      setStatus("Apple is still processing this purchase. Tap Restore purchases, or return to Gillie and it will unlock when Apple confirms it.", "pending");
      track("purchase_flow_timeout");
    }, PURCHASE_TIMEOUT_MS);
  }

  function rememberFailure(stage, error, extra = {}) {
    lastFailure = {
      stage,
      code: clean(error?.code || "UNKNOWN", 80),
      message: clean(error?.message || error || "Unknown purchase error."),
      at: new Date().toISOString(),
      ...extra,
    };
    track("purchase_flow_error", {
      stage,
      code: lastFailure.code,
      message: lastFailure.message.slice(0, 140),
      ...extra,
    });
  }

  function visibleFailure(error) {
    const message = clean(error?.message || error || "Purchase was not completed.");
    if (/cancel/i.test(message)) return { text: "Purchase cancelled. Nothing was charged.", type: "info" };
    if (error?.code === "STORE_PRODUCTS_EMPTY") {
      return {
        text: "Apple returned zero Gillie Plus products for this TestFlight build. The app bridge is present, but StoreKit cannot see the monthly or yearly subscription. Tap Copy purchase details below.",
        type: "error",
      };
    }
    if (error?.code === "BRIDGE_PRODUCTS_MISSING") {
      return { text: "This build is missing the native Gillie purchase bridge and cannot open Apple checkout.", type: "error" };
    }
    return { text: `Purchase was not completed. ${message}`, type: "error" };
  }

  async function handlePurchase(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (busy) return;

    const native = bridge();
    if (!native?.purchase || !native?.getProducts) {
      const error = Object.assign(new Error("The native Gillie purchase bridge is missing."), { code: "BRIDGE_PRODUCTS_MISSING" });
      rememberFailure("bridge", error);
      setStatus(visibleFailure(error).text, "error");
      return;
    }

    const requested = planFor();
    const token = ++attemptToken;
    attemptStartedAt = Date.now();
    setBusy(true, "purchase", "Connecting to Apple…");
    setStatus("Checking that Apple can see this Gillie Plus plan…", "working");
    track("purchase_flow_started", { plan: requested.key, productId: requested.id });
    startTimeout(token);

    let reassurance = 0;
    try {
      const { plan } = await preflight(native, requested);
      if (token !== attemptToken || token === lastFinishedToken) return;
      const purchaseButton = $("#plus-purchase");
      if (purchaseButton) purchaseButton.textContent = "Opening Apple…";
      setStatus(`Opening Apple’s secure ${plan.name.toLowerCase()} purchase…`, "working");
      reassurance = setTimeout(() => {
        if (token !== attemptToken || token === lastFinishedToken || !busy) return;
        const button = $("#plus-purchase");
        if (button) button.textContent = "Waiting for Apple…";
        setStatus("Complete the Apple purchase sheet. Gillie will confirm your access automatically.", "working");
      }, 1800);

      const result = await native.purchase({ productId: plan.id });
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
        return;
      }
      if (result?.pending) {
        clearTimeout(timeoutHandle);
        lastFinishedToken = token;
        setBusy(false);
        setStatus("Purchase pending with Apple. Gillie will unlock when Apple approves it.", "pending");
        return;
      }

      const confirmButton = $("#plus-purchase");
      if (confirmButton) confirmButton.textContent = "Confirming access…";
      setStatus("Apple returned to Gillie. Confirming your subscription…", "working");
      if (await reconcileEntitlement(token, "inactive_result")) return;

      clearTimeout(timeoutHandle);
      lastFinishedToken = token;
      setBusy(false);
      const inactiveError = Object.assign(new Error("Apple returned without an active Gillie Plus entitlement."), { code: "INACTIVE_AFTER_PURCHASE" });
      rememberFailure("entitlement", inactiveError, { plan: plan.key, productId: plan.id });
      setStatus("Apple did not confirm an active subscription. Tap Restore purchases once, then copy the purchase details if it remains inactive.", "error");
    } catch (error) {
      clearTimeout(reassurance);
      if (token !== attemptToken || token === lastFinishedToken) return;
      setStatus("Checking whether Apple completed the purchase…", "working");
      if (await reconcileEntitlement(token, "purchase_error")) return;

      clearTimeout(timeoutHandle);
      lastFinishedToken = token;
      setBusy(false);
      rememberFailure("purchase", error, { plan: requested.key, productId: requested.id });
      const friendly = visibleFailure(error);
      setStatus(friendly.text, friendly.type);
    }
  }

  async function handleRestore(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (busy) return;

    const native = bridge();
    if (!native?.restorePurchases) {
      const error = Object.assign(new Error("The native Restore Purchases bridge is missing."), { code: "BRIDGE_RESTORE_MISSING" });
      rememberFailure("restore-bridge", error);
      setStatus(error.message, "error");
      return;
    }

    const token = ++attemptToken;
    attemptStartedAt = Date.now();
    setBusy(true, "restore", "Checking Apple…");
    setStatus("Checking purchases for this Apple ID…", "working");
    track("purchase_restore_started");
    startTimeout(token);

    try {
      const result = await native.restorePurchases();
      if (token !== attemptToken || token === lastFinishedToken) return;
      if (applyActiveEntitlement(result, "restore_result")) {
        lastFinishedToken = token;
        return;
      }
      if (await reconcileEntitlement(token, "restore_result")) return;

      clearTimeout(timeoutHandle);
      lastFinishedToken = token;
      setBusy(false);
      const restoreError = Object.assign(new Error("No active Gillie Plus subscription was found for this Apple ID."), { code: "NO_ACTIVE_ENTITLEMENT" });
      rememberFailure("restore", restoreError);
      setStatus(restoreError.message, "error");
    } catch (error) {
      if (token !== attemptToken || token === lastFinishedToken) return;
      if (await reconcileEntitlement(token, "restore_error")) return;
      clearTimeout(timeoutHandle);
      lastFinishedToken = token;
      setBusy(false);
      rememberFailure("restore", error);
      setStatus(clean(error?.message || error || "Could not restore purchases right now."), "error");
    }
  }

  async function collectDiagnostics() {
    const native = bridge();
    const report = {
      engine: VERSION,
      generatedAt: new Date().toISOString(),
      selectedPlan: planFor(),
      expectedProductIds: PRODUCT_IDS,
      pricing: window.GillieStorePricing?.snapshot?.() || null,
      lastFailure,
      bridge: {
        available: Boolean(native),
        getProducts: Boolean(native?.getProducts),
        purchase: Boolean(native?.purchase),
        restorePurchases: Boolean(native?.restorePurchases),
        getEntitlementStatus: Boolean(native?.getEntitlementStatus),
      },
    };
    try { if (native?.getProducts) report.products = await native.getProducts(); }
    catch (error) { report.productsError = clean(error?.message || error); }
    try { if (native?.getEntitlementStatus) report.entitlement = await native.getEntitlementStatus(); }
    catch (error) { report.entitlementError = clean(error?.message || error); }
    try {
      if (native?.getDiagnostics) {
        const diagnostics = await native.getDiagnostics();
        report.nativeApp = diagnostics?.app || null;
        report.nativeEvents = Array.isArray(diagnostics?.events) ? diagnostics.events.slice(-30) : [];
      }
    } catch (error) {
      report.nativeDiagnosticsError = clean(error?.message || error);
    }
    return report;
  }

  async function copyDiagnostics() {
    const button = $("#gillie-purchase-diagnostics");
    if (button) button.textContent = "Collecting…";
    try {
      const text = JSON.stringify(await collectDiagnostics(), null, 2);
      await navigator.clipboard.writeText(text);
      if (button) button.textContent = "Purchase details copied";
      try { if (typeof toast === "function") toast("✓", "Purchase details copied."); } catch (_) {}
    } catch (error) {
      if (button) button.textContent = "Copy purchase details";
      setStatus(`Could not copy purchase details. ${clean(error?.message || error, 200)}`, "error");
    }
  }

  function ensureDiagnosticsButton(show = Boolean(lastFailure)) {
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
    button.hidden = !show;
    if (!show) button.textContent = "Copy purchase details";
    return button;
  }

  async function reconcileAfterForeground() {
    if (!attemptStartedAt || Date.now() - attemptStartedAt > RECENT_ATTEMPT_MS) return;
    const token = attemptToken;
    if (token === lastFinishedToken) return;
    if (busy) setStatus("Back in Gillie. Confirming your Apple subscription…", "working");
    if (await reconcileEntitlement(token, "app_foreground")) lastFinishedToken = token;
  }

  function installEntitlementListener() {
    if (listenerInstalled) return;
    const native = bridge();
    if (!native?.addListener) return;
    listenerInstalled = true;
    try {
      Promise.resolve(native.addListener("entitlementChanged", (status) => {
        if (!status?.active) return;
        lastFinishedToken = attemptToken;
        applyActiveEntitlement(status, "native_listener");
      })).catch(() => { listenerInstalled = false; });
    } catch (_) {
      listenerInstalled = false;
    }
  }

  function bindButtons() {
    const purchase = $("#plus-purchase");
    const restore = $("#plus-restore");
    if (!purchase || !restore) return false;
    purchase.onclick = handlePurchase;
    restore.onclick = handleRestore;
    purchase.dataset.purchaseFlow = VERSION;
    restore.dataset.purchaseFlow = VERSION;
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
    document.addEventListener("gillie:purchase-flow-settled", () => setTimeout(bindButtons, 20));
    const observer = new MutationObserver(() => {
      if ($("#plus-purchase")?.dataset?.purchaseFlow !== VERSION) bindButtons();
      installEntitlementListener();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.GilliePurchaseFlow = Object.freeze({
      engine: VERSION,
      productIds: PRODUCT_IDS,
      preflight: () => preflight(bridge(), planFor()),
      diagnostics: collectDiagnostics,
      copyDiagnostics,
      lastFailure: () => lastFailure,
    });
    track("purchase_flow_loaded", { engine: VERSION });
    return true;
  }

  function boot(attempt = 0) {
    if (install()) return;
    if (attempt < 160) setTimeout(() => boot(attempt + 1), 50);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => boot(), { once: true });
  else boot();
})();
