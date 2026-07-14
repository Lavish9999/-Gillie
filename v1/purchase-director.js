/* Gillie Purchase Director — one authoritative tap path from paywall to verified entitlement. */
(() => {
  "use strict";

  if (window.__gilliePurchaseDirectorInstalled) return;
  window.__gilliePurchaseDirectorInstalled = true;

  const ENGINE = "purchase-director-v1-authoritative";
  const PRODUCT_IDS = Object.freeze({
    monthly: "gillie.plus.monthly",
    yearly: "gillie.plus.yearly",
  });
  const PRODUCT_TIMEOUT_MS = 15000;
  const PURCHASE_TIMEOUT_MS = 120000;
  const RESTORE_TIMEOUT_MS = 45000;

  let busy = false;
  let operation = 0;
  let overlayObserver = null;
  let bodyObserver = null;

  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const $$ = (selector, root = document) => Array.from(root?.querySelectorAll?.(selector) || []);
  const bridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;
  const clean = (value, max = 240) => String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

  function track(name, properties = {}) {
    try { bridge()?.trackEvent?.({ name, properties: { engine: ENGINE, ...properties } }); }
    catch (_) {}
  }

  function withTimeout(promise, timeoutMs, code, message) {
    let timer = 0;
    return Promise.race([
      Promise.resolve(promise).finally(() => clearTimeout(timer)),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error(message), { code })), timeoutMs);
      }),
    ]);
  }

  function selectedPlanKey() {
    try {
      if (typeof selectedPlusPlan !== "undefined" && PRODUCT_IDS[selectedPlusPlan]) return selectedPlusPlan;
    } catch (_) {}
    return $("#plus-plans [data-plus-plan].on")?.dataset?.plusPlan || "yearly";
  }

  function selectPlan(key) {
    if (!PRODUCT_IDS[key]) return;
    try { selectedPlusPlan = key; } catch (_) {}
    $$("#plus-plans [data-plus-plan]").forEach((button) => {
      const selected = button.dataset.plusPlan === key;
      button.classList.toggle("on", selected);
      button.setAttribute("aria-checked", String(selected));
    });
  }

  function setHealth(type, message, allowCopy = false) {
    const overlay = $("#plus-overlay");
    if (!overlay) return;
    let row = $("#gp-store-health", overlay);
    if (!row) {
      row = document.createElement("div");
      row.id = "gp-store-health";
      row.className = "gp-store-health";
      row.setAttribute("role", "status");
      row.setAttribute("aria-live", "polite");
      const plans = $("#plus-plans", overlay);
      if (plans?.parentElement) plans.parentElement.insertBefore(row, plans);
      else $(".gp-pricing-section", overlay)?.appendChild(row);
    }
    row.className = `gp-store-health ${type || ""}`.trim();
    row.replaceChildren(document.createTextNode(clean(message)));
    if (allowCopy) {
      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "Copy details";
      copy.style.cssText = "margin-left:auto;padding:0;border:0;background:transparent;color:inherit;font:inherit;font-weight:850;text-decoration:underline;text-underline-offset:2px";
      copy.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        copy.disabled = true;
        copy.textContent = "Copying…";
        try {
          await window.GilliePurchaseFlow?.copyDiagnostics?.();
          copy.textContent = "Copied";
        } catch (_) {
          copy.disabled = false;
          copy.textContent = "Copy details";
        }
      };
      row.appendChild(copy);
    }
  }

  function setButtonState(active, mode = "purchase") {
    busy = Boolean(active);
    const purchase = $("#plus-purchase");
    const restore = $("#plus-restore");
    const plans = $$("#plus-plans [data-plus-plan]");

    if (purchase) {
      purchase.disabled = false;
      purchase.setAttribute("aria-disabled", "false");
      purchase.dataset.purchaseDirector = ENGINE;
      purchase.dataset.purchaseBusy = busy ? "1" : "0";
      purchase.setAttribute("aria-busy", String(busy && mode === "purchase"));
      purchase.classList.toggle("phase2-loading", busy && mode === "purchase");
      purchase.textContent = busy && mode === "purchase" ? "Opening Apple…" : "Start Gillie Plus";
    }
    if (restore) {
      restore.disabled = false;
      restore.dataset.purchaseDirector = ENGINE;
      restore.dataset.purchaseBusy = busy ? "1" : "0";
      restore.setAttribute("aria-busy", String(busy && mode === "restore"));
      restore.textContent = busy && mode === "restore" ? "Checking Apple…" : "Restore purchases";
    }
    plans.forEach((button) => {
      button.disabled = false;
      button.setAttribute("aria-disabled", "false");
    });
  }

  function normalizeProducts(response) {
    const allowed = new Set(Object.values(PRODUCT_IDS));
    return (Array.isArray(response?.products) ? response.products : [])
      .map((product) => ({
        id: clean(product?.id, 80),
        displayPrice: clean(product?.displayPrice, 80),
      }))
      .filter((product) => allowed.has(product.id));
  }

  function applyEntitlement(status, source) {
    if (!status?.active) return false;
    let active = true;
    try {
      if (window.GillieEntitlementSync?.apply) active = Boolean(window.GillieEntitlementSync.apply(status, source));
      else if (typeof applyEntitlementStatus === "function") active = Boolean(applyEntitlementStatus(status));
    } catch (_) {}
    if (!active) return false;
    const overlay = $("#plus-overlay");
    if (overlay) overlay.hidden = true;
    try { if (typeof toast === "function") toast("👑", "Gillie Plus active. Your plan is unlocked."); } catch (_) {}
    setHealth("ready", "Gillie Plus is active.");
    track("purchase_director_entitlement_active", { source, productId: clean(status.productId, 80) });
    return true;
  }

  async function readEntitlement() {
    const native = bridge();
    if (!native?.getEntitlementStatus) return null;
    try {
      return await withTimeout(
        native.getEntitlementStatus(),
        12000,
        "ENTITLEMENT_TIMEOUT",
        "Apple took too long to confirm the subscription.",
      );
    } catch (_) {
      return null;
    }
  }

  async function availablePlan(native, requestedKey) {
    const response = await withTimeout(
      native.getProducts(),
      PRODUCT_TIMEOUT_MS,
      "PRODUCT_LOOKUP_TIMEOUT",
      "Apple billing did not return the Gillie Plus plans in time.",
    );
    const products = normalizeProducts(response);
    if (!products.length) {
      const error = Object.assign(
        new Error(`Apple returned no Gillie Plus plans for ${clean(response?.bundleId || "com.lavish9999.gillie", 100)}.`),
        { code: "STORE_PRODUCTS_EMPTY", response },
      );
      throw error;
    }

    const requestedId = PRODUCT_IDS[requestedKey] || PRODUCT_IDS.yearly;
    const chosen = products.find((product) => product.id === requestedId) || products[0];
    const chosenKey = Object.entries(PRODUCT_IDS).find(([, id]) => id === chosen.id)?.[0] || requestedKey;
    selectPlan(chosenKey);
    return { product: chosen, response, key: chosenKey };
  }

  async function confirmAfterPurchase(source) {
    for (const delay of [0, 350, 1200, 2800]) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      const status = await readEntitlement();
      if (status?.active && applyEntitlement(status, source)) return true;
    }
    return false;
  }

  async function purchase() {
    if (busy) return;
    const native = bridge();
    if (!native?.getProducts || !native?.purchase) {
      setHealth("error", "This build is missing the native Apple purchase bridge.", true);
      track("purchase_director_bridge_missing");
      return;
    }

    const token = ++operation;
    const requestedKey = selectedPlanKey();
    setButtonState(true, "purchase");
    setHealth("", "Checking this plan with Apple…");
    track("purchase_director_started", { plan: requestedKey });

    try {
      const { product, key } = await availablePlan(native, requestedKey);
      if (token !== operation) return;
      setHealth("", `Opening Apple’s secure ${key === "monthly" ? "monthly" : "yearly"} purchase sheet…`);

      const result = await withTimeout(
        native.purchase({ productId: product.id }),
        PURCHASE_TIMEOUT_MS,
        "PURCHASE_TIMEOUT",
        "Apple checkout did not return to Gillie in time.",
      );
      if (token !== operation) return;

      if (applyEntitlement(result, "purchase-result")) return;
      if (result?.cancelled) {
        setHealth("", "Purchase cancelled. Nothing was charged.");
        track("purchase_director_cancelled", { productId: product.id });
        return;
      }
      if (result?.pending) {
        setHealth("", "Purchase pending with Apple. Gillie will unlock when approved.");
        track("purchase_director_pending", { productId: product.id });
        return;
      }
      if (await confirmAfterPurchase("purchase-recheck")) return;

      setHealth("error", "Apple returned without an active Gillie Plus entitlement. Tap Restore purchases, then Copy details if it remains inactive.", true);
      track("purchase_director_inactive", { productId: product.id });
    } catch (error) {
      if (token !== operation) return;
      const code = clean(error?.code || "PURCHASE_ERROR", 80);
      const message = clean(error?.message || error || "Purchase was not completed.");
      if (await confirmAfterPurchase("purchase-error-recheck")) return;
      setHealth("error", message, true);
      track("purchase_director_failed", { code, message: message.slice(0, 100) });
    } finally {
      if (token === operation) setButtonState(false);
    }
  }

  async function restore() {
    if (busy) return;
    const native = bridge();
    if (!native?.restorePurchases) {
      setHealth("error", "This build is missing Restore Purchases.", true);
      return;
    }

    const token = ++operation;
    setButtonState(true, "restore");
    setHealth("", "Checking purchases for this Apple ID…");
    track("purchase_director_restore_started");
    try {
      const result = await withTimeout(
        native.restorePurchases(),
        RESTORE_TIMEOUT_MS,
        "RESTORE_TIMEOUT",
        "Apple took too long to restore purchases.",
      );
      if (token !== operation) return;
      if (applyEntitlement(result, "restore-result")) return;
      if (await confirmAfterPurchase("restore-recheck")) return;
      setHealth("error", "No active Gillie Plus subscription was found for this Apple ID.", true);
      track("purchase_director_restore_inactive");
    } catch (error) {
      if (token !== operation) return;
      const message = clean(error?.message || error || "Could not restore purchases.");
      if (await confirmAfterPurchase("restore-error-recheck")) return;
      setHealth("error", message, true);
      track("purchase_director_restore_failed", { message: message.slice(0, 100) });
    } finally {
      if (token === operation) setButtonState(false);
    }
  }

  function captureCheckout(event) {
    const target = event.target?.closest?.("#plus-purchase,#plus-restore");
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (target.id === "plus-restore") restore();
    else purchase();
  }

  function enforceOwnership() {
    const purchaseButton = $("#plus-purchase");
    const restoreButton = $("#plus-restore");
    if (!purchaseButton || !restoreButton) return false;
    purchaseButton.onclick = null;
    restoreButton.onclick = null;
    setButtonState(busy, busy && restoreButton.getAttribute("aria-busy") === "true" ? "restore" : "purchase");
    document.documentElement.dataset.purchaseDirector = ENGINE;
    return true;
  }

  function syncPaywall() {
    const overlay = $("#plus-overlay");
    if (!overlay) return false;
    enforceOwnership();
    if (!overlay.hidden && !busy) setButtonState(false);
    return true;
  }

  function install() {
    const overlay = $("#plus-overlay");
    if (!overlay || !enforceOwnership()) return false;

    document.addEventListener("click", captureCheckout, true);
    overlayObserver?.disconnect?.();
    overlayObserver = new MutationObserver(syncPaywall);
    overlayObserver.observe(overlay, { attributes: true, attributeFilter: ["hidden", "class"] });

    bodyObserver?.disconnect?.();
    bodyObserver = new MutationObserver(() => {
      if ($("#plus-purchase")?.dataset?.purchaseDirector !== ENGINE) enforceOwnership();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !overlay.hidden) {
        enforceOwnership();
        confirmAfterPurchase("foreground");
      }
    });

    window.GilliePurchaseDirector = Object.freeze({
      engine: ENGINE,
      purchase,
      restore,
      busy: () => busy,
      enforce: enforceOwnership,
    });
    track("purchase_director_loaded");
    return true;
  }

  function boot(attempt = 0) {
    if (install()) return;
    if (attempt < 180) setTimeout(() => boot(attempt + 1), 50);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => boot(), { once: true });
  else boot();
})();
