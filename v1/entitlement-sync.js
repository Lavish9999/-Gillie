/* Gillie V1 Entitlement Sync — restore verified Plus state on boot, foreground, purchase, and StoreKit updates. */
(() => {
  "use strict";

  if (window.__gillieEntitlementSyncInstalled) return;
  window.__gillieEntitlementSyncInstalled = true;

  const ENGINE = "entitlement-sync-v1-always-on";
  const RETRY_DELAYS = Object.freeze([0, 350, 1200]);
  let syncToken = 0;
  let listenerInstalled = false;
  let lastSignature = "";

  const bridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;

  function track(name, properties = {}) {
    try { bridge()?.trackEvent?.({ name, properties: { engine: ENGINE, ...properties } }); }
    catch (_) {}
  }

  function applyStatus(status, source = "unknown") {
    if (!status || typeof status !== "object") return false;
    const normalized = {
      ...status,
      active: Boolean(status.active),
      source: status.source || source,
    };

    let active = normalized.active;
    try {
      if (typeof applyEntitlementStatus === "function") active = Boolean(applyEntitlementStatus(normalized));
    } catch (_) {}

    const signature = `${active}:${normalized.productId || "none"}:${normalized.expiresAt || "none"}`;
    if (signature !== lastSignature) {
      lastSignature = signature;
      track("plus_entitlement_state_applied", {
        active,
        source,
        productId: String(normalized.productId || "").slice(0, 80),
      });
    }

    document.dispatchEvent?.(new CustomEvent("gillie:entitlement-updated", {
      detail: { ...normalized, active, syncSource: source },
    }));
    document.dispatchEvent?.(new CustomEvent("gillie:purchase-flow-settled", {
      detail: { active, source },
    }));

    requestAnimationFrame?.(() => {
      try { window.GillieThemeAccess?.refresh?.(); } catch (_) {}
      try { window.GillieThemeEngine?.apply?.(`entitlement:${source}`); } catch (_) {}
      try { window.GillieThemePaint?.apply?.(`entitlement:${source}`); } catch (_) {}
    });
    return active;
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function sync(reason = "manual") {
    const native = bridge();
    if (!native?.getEntitlementStatus) {
      track("plus_entitlement_bridge_missing", { reason });
      return false;
    }

    const token = ++syncToken;
    let lastError = null;
    for (const delay of RETRY_DELAYS) {
      if (delay) await wait(delay);
      if (token !== syncToken) return false;
      try {
        const status = await native.getEntitlementStatus();
        if (token !== syncToken) return false;
        return applyStatus(status, reason);
      } catch (error) {
        lastError = error;
      }
    }

    track("plus_entitlement_sync_failed", {
      reason,
      message: String(lastError?.message || lastError || "unknown").slice(0, 100),
    });
    return false;
  }

  function installListener() {
    if (listenerInstalled) return;
    const native = bridge();
    if (!native?.addListener) return;
    listenerInstalled = true;
    try {
      Promise.resolve(native.addListener("entitlementChanged", (status) => {
        applyStatus(status, "storekit-listener");
      })).catch(() => { listenerInstalled = false; });
    } catch (_) {
      listenerInstalled = false;
    }
  }

  function install() {
    installListener();
    setTimeout(() => sync("app-boot"), 0);
    setTimeout(() => sync("app-boot-settled"), 900);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        installListener();
        setTimeout(() => sync("foreground"), 80);
      }
    });
    document.addEventListener("gillie:purchase-flow-settled", (event) => {
      if (event?.detail?.source === "entitlement-sync") return;
      setTimeout(() => sync("purchase-settled"), 180);
    });

    window.GillieEntitlementSync = Object.freeze({
      engine: ENGINE,
      sync,
      apply: applyStatus,
    });
    document.documentElement.dataset.entitlementSyncEngine = ENGINE;
    track("plus_entitlement_sync_loaded");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
