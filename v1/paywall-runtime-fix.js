/* Gillie V1 Paywall Runtime Fix — CSS-only safe header chrome and one shared StoreKit readiness probe. */
(() => {
  "use strict";

  if (window.__gilliePaywallRuntimeFixInstalled) return;
  window.__gilliePaywallRuntimeFixInstalled = true;

  const ENGINE = "paywall-runtime-fix-v1";
  const SYSTEM_CHROME_MODE = "css-only-system-chrome-v2";
  const CHECKOUT_OWNER = "purchase-director-v2-direct-native";
  const PROBE_MODE = "single-open-storekit-probe";
  const SHARED_LOOKUP_MODE = "shared-timed-storekit-lookup-v1";
  const EXPECTED_IDS = Object.freeze(["gillie.plus.monthly", "gillie.plus.yearly"]);
  const ENTRY_SETTLE_MS = 240;
  const ENTRY_ANIMATION_MS = 320;
  let probeToken = 0;
  let entryToken = 0;
  let entryTimer = 0;
  let observer = null;
  let lastVisible = false;

  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const bridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;
  const checkoutBusy = () => Boolean(window.GilliePurchaseDirector?.busy?.());

  function track(name, properties = {}) {
    try { bridge()?.trackEvent?.({ name, properties: { engine: ENGINE, chromeMode: SYSTEM_CHROME_MODE, probeMode: PROBE_MODE, sharedLookup: SHARED_LOOKUP_MODE, ...properties } }); }
    catch (_) {}
  }

  function setSystemChrome(paywallVisible) {
    const active = Boolean(paywallVisible);
    document.documentElement?.classList?.toggle("gillie-plus-system-chrome", active);
    const overlay = $("#plus-overlay");
    if (overlay) overlay.dataset.systemChrome = active ? SYSTEM_CHROME_MODE : "";
    // Deliberately CSS-only. Never mutate the native root view.
  }

  function ensurePaywallSurface(reason = "surface-check") {
    const overlay = $("#plus-overlay");
    if (!overlay || overlay.hidden) return false;
    const sheet = $("#plus-overlay > .sheet") || $(".sheet", overlay);
    if (!sheet) {
      track("paywall_surface_missing", { reason, part: "sheet" });
      return false;
    }
    overlay.style.setProperty("visibility", "visible", "important");
    overlay.style.setProperty("opacity", "1", "important");
    sheet.style.setProperty("visibility", "visible", "important");
    if (overlay.classList.contains("gp-paywall-preparing")) sheet.style.removeProperty("opacity");
    else sheet.style.setProperty("opacity", "1", "important");
    const content = $(".gp-paywall-scroll", sheet) || $(".plus-tank-hero", sheet) || $("#plus-title", sheet);
    if (content) {
      content.style?.setProperty?.("visibility", "visible", "important");
      content.style?.setProperty?.("opacity", "1", "important");
      sheet.dataset.paywallSurfaceReady = "true";
      return true;
    }
    track("paywall_surface_missing", { reason, part: "content" });
    return false;
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
    if (checkoutBusy()) return;
    const row = ensureHealthRow();
    if (!row) return;
    row.className = `gp-store-health ${type || ""}`.trim();
    row.replaceChildren(document.createTextNode(message));
    if (allowCopy) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Copy details";
      button.style.cssText = "margin-left:auto;padding:0;border:0;background:transparent;color:inherit;font:inherit;font-weight:850;text-decoration:underline;text-underline-offset:2px";
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
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

  async function probeStoreKit(reason = "paywall-open") {
    const overlay = $("#plus-overlay");
    if (!overlay || overlay.hidden || checkoutBusy()) return false;
    const token = ++probeToken;
    const pricing = window.GillieStorePricing;
    setHealth("", "Checking Apple billing…");
    if (!pricing?.load) {
      setHealth("error", "This build is missing the shared Apple pricing bridge.", true);
      track("paywall_storekit_probe_failed", { reason, code: "pricing-bridge-missing" });
      return false;
    }

    try {
      const before = pricing.snapshot?.() || {};
      const map = await pricing.load({ force: before.state === "error" || before.state === "unavailable" });
      if (token !== probeToken || overlay.hidden || checkoutBusy()) return false;
      const returned = map && typeof map.keys === "function" ? Array.from(map.keys()) : [];
      const missing = EXPECTED_IDS.filter((id) => !returned.includes(id));
      const after = pricing.snapshot?.() || {};
      if (!returned.length) {
        const bundle = String(after.native?.bundleId || "com.lavish9999.gillie");
        const message = String(after.error || `Apple returned no Gillie Plus plans for ${bundle}.`).slice(0, 180);
        setHealth("error", message, true);
        track("paywall_storekit_probe_empty", { reason, bundle, requested: EXPECTED_IDS.join(",") });
        return false;
      }
      if (missing.length) setHealth("ready", `Apple billing connected. ${returned.length} of ${EXPECTED_IDS.length} plans available.`);
      else setHealth("ready", "Apple billing connected. Monthly and yearly plans are ready.");
      track("paywall_storekit_probe_ready", { reason, count: returned.length, returned: returned.join(","), missing: missing.join(",") });
      return true;
    } catch (error) {
      if (token !== probeToken || overlay.hidden || checkoutBusy()) return false;
      const message = String(error?.message || error || "Apple billing could not be reached.").replace(/\s+/g, " ").trim().slice(0, 180);
      setHealth("error", message || "Apple billing could not be reached.", true);
      track("paywall_storekit_probe_failed", { reason, code: "request-error", message: message.slice(0, 80) });
      return false;
    }
  }

  function cancelStableEntry() {
    entryToken += 1;
    clearTimeout(entryTimer);
    entryTimer = 0;
    const overlay = $("#plus-overlay");
    const sheet = $("#plus-overlay > .sheet") || $(".sheet", overlay);
    overlay?.classList?.remove("gp-paywall-preparing", "gp-paywall-entering");
    if (sheet) {
      sheet.style.removeProperty("opacity");
      delete sheet.dataset.paywallEntryState;
    }
  }

  function startStableEntry(reason = "paywall-open") {
    const overlay = $("#plus-overlay");
    if (!overlay || overlay.hidden) return false;
    const sheet = $("#plus-overlay > .sheet") || $(".sheet", overlay);
    if (!sheet) return false;

    const token = ++entryToken;
    clearTimeout(entryTimer);
    overlay.classList.add("gp-runtime-controlled-entry", "gp-paywall-preparing");
    overlay.classList.remove("gp-paywall-entering");
    sheet.style.removeProperty("opacity");
    sheet.dataset.paywallEntryState = "preparing";

    ensurePaywallSurface(`${reason}:prepare`);
    ensureHealthRow();

    entryTimer = setTimeout(() => {
      if (token !== entryToken || overlay.hidden) return;
      ensureHealthRow();
      ensurePaywallSurface(`${reason}:ready`);
      overlay.classList.remove("gp-paywall-preparing");
      void sheet.offsetWidth;
      overlay.classList.add("gp-paywall-entering");
      sheet.dataset.paywallEntryState = "animating";
      track("paywall_stable_entry_started", { reason, settleMs: ENTRY_SETTLE_MS });

      entryTimer = setTimeout(() => {
        if (token !== entryToken || overlay.hidden) return;
        overlay.classList.remove("gp-paywall-entering");
        sheet.dataset.paywallEntryState = "settled";
        ensurePaywallSurface(`${reason}:settled`);
      }, ENTRY_ANIMATION_MS);
    }, ENTRY_SETTLE_MS);
    return true;
  }

  function syncOverlay(reason = "mutation") {
    const overlay = $("#plus-overlay");
    if (!overlay) return false;
    const visible = !overlay.hidden;
    setSystemChrome(visible);
    if (visible) {
      if (!lastVisible) startStableEntry(reason);
      else {
        ensurePaywallSurface(reason);
        ensureHealthRow();
      }
      if (!lastVisible) setTimeout(() => probeStoreKit("paywall-open"), 40);
    } else {
      probeToken += 1;
      cancelStableEntry();
    }
    lastVisible = visible;
    return true;
  }

  function install() {
    const overlay = $("#plus-overlay");
    if (!overlay) return false;
    overlay.classList.add("gp-runtime-controlled-entry");
    observer?.disconnect?.();
    observer = new MutationObserver(() => syncOverlay("overlay-change"));
    observer.observe(overlay, { attributes: true, attributeFilter: ["hidden"] });
    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.("#plus-open,#set-plus,[data-act='plus'],#ship-premium-teaser,.gp-close,#plus-soft-close");
      if (!target) return;
      setTimeout(() => syncOverlay("paywall-control"), 20);
    }, true);
    document.addEventListener("gillie:purchase-flow-settled", () => {
      if (!overlay.hidden && !checkoutBusy()) setTimeout(() => probeStoreKit("purchase-settled"), 120);
    });
    document.addEventListener("gillie:entitlement-updated", () => {
      if (!overlay.hidden && !checkoutBusy()) setTimeout(() => probeStoreKit("entitlement-updated"), 120);
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !overlay.hidden) {
        ensurePaywallSurface("foreground");
        if (!checkoutBusy()) setTimeout(() => probeStoreKit("foreground"), 160);
      }
    });
    window.addEventListener("pagehide", () => setSystemChrome(false));
    window.GilliePaywallRuntimeFix = Object.freeze({
      engine: ENGINE,
      chromeMode: SYSTEM_CHROME_MODE,
      checkoutOwner: CHECKOUT_OWNER,
      probeMode: PROBE_MODE,
      sharedLookupMode: SHARED_LOOKUP_MODE,
      probe: probeStoreKit,
      sync: syncOverlay,
      ensureSurface: ensurePaywallSurface,
    });
    if (!overlay.hidden) syncOverlay("install-visible");
    track("paywall_runtime_fix_loaded", {
      startupSideEffects: false,
      nativeViewMutation: false,
      checkoutOwner: CHECKOUT_OWNER,
      probeMode: PROBE_MODE,
      sharedLookupMode: SHARED_LOOKUP_MODE,
      stableEntry: true,
    });
    return true;
  }

  function boot(attempt = 0) {
    if (install()) return;
    if (attempt < 160) setTimeout(() => boot(attempt + 1), 50);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => boot(), { once: true });
  else boot();
})();
