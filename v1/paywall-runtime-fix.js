/* Gillie V1 Paywall Runtime Fix — safe header chrome and live StoreKit readiness. */
(() => {
  "use strict";

  if (window.__gilliePaywallRuntimeFixInstalled) return;
  window.__gilliePaywallRuntimeFixInstalled = true;

  const ENGINE = "paywall-runtime-fix-v1";
  const EXPECTED_IDS = Object.freeze(["gillie.plus.monthly", "gillie.plus.yearly"]);
  let probeToken = 0;
  let observer = null;

  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const bridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;

  function track(name, properties = {}) {
    try { bridge()?.trackEvent?.({ name, properties: { engine: ENGINE, ...properties } }); }
    catch (_) {}
  }

  function setNativeChrome(paywallVisible) {
    try {
      bridge()?.setInterfaceStyle?.({
        lightStatusBar: Boolean(paywallVisible),
        surface: paywallVisible ? "plus" : "app",
      });
    } catch (_) {}
    document.documentElement.classList.toggle("gillie-plus-system-chrome", Boolean(paywallVisible));
  }

  function ensureHealthRow() {
    const overlay = $("#plus-overlay");
    if (!overlay) return null;
    let row = $("#gp-store-health", overlay);
    if (row) return row;

    row = document.createElement("div");
    row.id = "gp-store-health";
    row.className = "gp-store-health";
    row.setAttribute("role", "status");
    row.setAttribute("aria-live", "polite");
    row.textContent = "Checking Apple billing…";

    const pricing = $(".gp-pricing-section", overlay);
    const planList = $("#plus-plans", overlay);
    if (planList?.parentElement) planList.parentElement.insertBefore(row, planList);
    else if (pricing) pricing.appendChild(row);
    return row;
  }

  function setHealth(type, message, allowCopy = false) {
    const row = ensureHealthRow();
    if (!row) return;
    row.className = `gp-store-health ${type || ""}`.trim();
    row.replaceChildren(document.createTextNode(message));

    if (allowCopy) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Copy details";
      button.style.cssText = "margin-left:auto;padding:0;border:0;background:transparent;color:inherit;font:inherit;font-weight:850;text-decoration:underline;text-underline-offset:2px";
      button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "Copying…";
        try {
          await window.GilliePurchaseFlow?.copyDiagnostics?.();
          button.textContent = "Copied";
        } catch (_) {
          button.textContent = "Copy details";
          button.disabled = false;
        }
      });
      row.appendChild(button);
    }
  }

  function normalizeProducts(response) {
    const products = Array.isArray(response?.products) ? response.products : [];
    return products.filter((product) => EXPECTED_IDS.includes(String(product?.id || "")));
  }

  async function probeStoreKit(reason = "paywall-open") {
    const token = ++probeToken;
    const native = bridge();
    setHealth("", "Checking Apple billing…");

    if (!native?.getProducts) {
      setHealth("error", "This build is missing the native Apple billing bridge.", true);
      track("paywall_storekit_probe_failed", { reason, code: "bridge-missing" });
      return false;
    }

    try {
      try { await window.GillieStorePricing?.load?.({ force: true }); } catch (_) {}
      const response = await native.getProducts();
      if (token !== probeToken) return false;

      const products = normalizeProducts(response);
      const returned = products.map((product) => product.id);
      const missing = EXPECTED_IDS.filter((id) => !returned.includes(id));

      if (!products.length) {
        const bundle = String(response?.bundleId || "com.lavish9999.gillie");
        setHealth("error", `Apple returned no Gillie Plus plans for ${bundle}.`, true);
        track("paywall_storekit_probe_empty", {
          reason,
          bundle,
          requested: EXPECTED_IDS.join(","),
        });
        return false;
      }

      if (missing.length) {
        setHealth("ready", `Apple billing connected. ${products.length} of ${EXPECTED_IDS.length} plans available.`);
      } else {
        setHealth("ready", "Apple billing connected. Monthly and yearly plans are ready.");
      }
      track("paywall_storekit_probe_ready", {
        reason,
        count: products.length,
        returned: returned.join(","),
        missing: missing.join(","),
      });
      return true;
    } catch (error) {
      if (token !== probeToken) return false;
      const message = String(error?.message || error || "Apple billing could not be reached.").replace(/\s+/g, " ").trim().slice(0, 180);
      setHealth("error", message || "Apple billing could not be reached.", true);
      track("paywall_storekit_probe_failed", { reason, code: "request-error", message: message.slice(0, 80) });
      return false;
    }
  }

  function syncOverlay(reason = "mutation") {
    const overlay = $("#plus-overlay");
    if (!overlay) return false;
    const visible = !overlay.hidden;
    setNativeChrome(visible);
    if (visible) {
      ensureHealthRow();
      setTimeout(() => probeStoreKit(reason), 40);
    } else {
      probeToken += 1;
    }
    return true;
  }

  function install() {
    const overlay = $("#plus-overlay");
    if (!overlay) return false;

    observer?.disconnect?.();
    observer = new MutationObserver(() => syncOverlay("overlay-change"));
    observer.observe(overlay, { attributes: true, attributeFilter: ["hidden", "class"] });

    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.("#plus-open,#set-plus,[data-act='plus'],#ship-premium-teaser,#plus-purchase,#plus-restore,.gp-close");
      if (!target) return;
      if (target.matches("#plus-purchase,#plus-restore")) setTimeout(() => probeStoreKit(target.id), 80);
      else setTimeout(() => syncOverlay("paywall-control"), 20);
    }, true);

    document.addEventListener("gillie:purchase-flow-settled", () => setTimeout(() => probeStoreKit("purchase-settled"), 80));
    document.addEventListener("gillie:entitlement-updated", () => setTimeout(() => probeStoreKit("entitlement-updated"), 80));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) setTimeout(() => syncOverlay("foreground"), 60);
    });
    window.addEventListener("pagehide", () => setNativeChrome(false));

    window.GilliePaywallRuntimeFix = Object.freeze({
      engine: ENGINE,
      probe: probeStoreKit,
      sync: syncOverlay,
    });
    syncOverlay("install");
    track("paywall_runtime_fix_loaded");
    return true;
  }

  function boot(attempt = 0) {
    if (install()) return;
    if (attempt < 160) setTimeout(() => boot(attempt + 1), 50);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => boot(), { once: true });
  else boot();
})();
