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

/* Gillie Settings Runtime — verifies, persists, and completes every control on the You screen. */
(() => {
  "use strict";

  if (window.__gillieSettingsRuntimeInstalled) return;
  window.__gillieSettingsRuntimeInstalled = true;

  const ENGINE = "settings-runtime-v1-functional";
  const PREFS_KEY = "gillie_phase2_preferences";
  const TEXT_SCALES = Object.freeze([0.95, 1, 1.1, 1.18]);
  const QUALITY_IDS = Object.freeze([
    "phase2-set-sound",
    "phase2-set-haptics",
    "phase2-set-motion",
    "phase2-set-text",
  ]);
  const REQUIRED_IDS = Object.freeze([
    "set-name",
    "set-skin",
    "set-cost",
    ...QUALITY_IDS,
    "set-plus",
    "set-reminder-checkin",
    "set-reminder-craving",
    "set-integrity",
    "set-slip",
    "set-reset",
  ]);
  const BASE_NOTIFICATION_IDS = Object.freeze([810001, 810002, 810003, 810004, 810005]);
  let viewObserver = null;
  let refreshTimer = 0;
  let loadedTracked = false;

  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const purchaseBridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;
  const notificationBridge = () => window.Capacitor?.Plugins?.LocalNotifications || null;

  function currentState() {
    try { return typeof state !== "undefined" && state ? state : null; }
    catch (_) { return null; }
  }

  function track(name, properties = {}) {
    try { purchaseBridge()?.trackEvent?.({ name, properties: { engine: ENGINE, ...properties } }); }
    catch (_) {}
  }

  function readPreferences() {
    try {
      const value = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      const scale = TEXT_SCALES.find((item) => Math.abs(item - Number(value.textScale)) < 0.01) || 1;
      return {
        sound: value.sound !== false,
        haptics: value.haptics !== false,
        reducedMotion: Boolean(value.reducedMotion),
        textScale: scale,
      };
    } catch (_) {
      return { sound: true, haptics: true, reducedMotion: false, textScale: 1 };
    }
  }

  function applyPersistedPreferences() {
    const prefs = readPreferences();
    const root = document.documentElement;
    const percent = `${Math.round(prefs.textScale * 100)}%`;
    root?.classList?.toggle("phase2-reduced-motion", prefs.reducedMotion);
    root?.style?.setProperty?.("--phase2-text-scale", String(prefs.textScale));
    root?.style?.setProperty?.("-webkit-text-size-adjust", percent);
    root?.style?.setProperty?.("text-size-adjust", percent);
    document.body?.style?.setProperty?.("-webkit-text-size-adjust", percent);
    document.body?.style?.setProperty?.("text-size-adjust", percent);
    if (root) {
      root.dataset.gillieSound = prefs.sound ? "on" : "off";
      root.dataset.gillieHaptics = prefs.haptics ? "on" : "off";
      root.dataset.gillieMotion = prefs.reducedMotion ? "reduced" : "full";
      root.dataset.gillieTextScale = String(prefs.textScale);
    }
    return prefs;
  }

  function previewSound() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(560, context.currentTime);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.025, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.1);
      setTimeout(() => context.close?.(), 180);
    } catch (_) {}
  }

  function syncQualityAccessibility(prefs = readPreferences()) {
    const values = {
      "phase2-set-sound": [prefs.sound, prefs.sound ? "Sound effects on" : "Sound effects off"],
      "phase2-set-haptics": [prefs.haptics, prefs.haptics ? "Haptic feedback on" : "Haptic feedback off"],
      "phase2-set-motion": [prefs.reducedMotion, prefs.reducedMotion ? "Reduce motion on" : "Reduce motion off"],
    };
    Object.entries(values).forEach(([id, [pressed, label]]) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.setAttribute("aria-pressed", String(pressed));
      button.setAttribute("aria-label", label);
    });
    const text = document.getElementById("phase2-set-text");
    if (text) {
      const labels = { "0.95": "Compact", "1": "Default", "1.1": "Large", "1.18": "Extra large" };
      text.setAttribute("aria-label", `Text size ${labels[String(prefs.textScale)] || "Default"}`);
    }
  }

  function installQualityHooks() {
    QUALITY_IDS.forEach((id) => {
      const button = document.getElementById(id);
      if (!button || button.dataset.gillieSettingsHook === "1") return;
      button.dataset.gillieSettingsHook = "1";
      button.addEventListener("click", () => {
        setTimeout(() => {
          const prefs = applyPersistedPreferences();
          syncQualityAccessibility(prefs);
          if (id === "phase2-set-sound" && prefs.sound) previewSound();
          if (id === "phase2-set-haptics" && prefs.haptics) {
            try { purchaseBridge()?.haptic?.({ style: "success" }); } catch (_) {}
          }
          track("settings_quality_changed", { setting: id.replace("phase2-set-", ""), enabled: id === "phase2-set-text" ? true : Boolean(id === "phase2-set-motion" ? prefs.reducedMotion : prefs[id === "phase2-set-sound" ? "sound" : "haptics"]), textScale: prefs.textScale });
        }, 0);
      });
    });
  }

  function installCostControl() {
    const openButton = document.getElementById("set-cost");
    const saveButton = document.getElementById("ce-save");
    if (openButton && openButton.dataset.gillieCostHook !== "1") {
      openButton.dataset.gillieCostHook = "1";
      openButton.addEventListener("click", () => {
        setTimeout(() => {
          let profile = null;
          try { profile = typeof activeSubstance === "function" ? activeSubstance() : null; } catch (_) {}
          const uses = document.getElementById("ce-puffs");
          if (!uses) return;
          const puffBased = profile?.useLabel === "puffs";
          uses.min = puffBased ? "10" : "1";
          uses.step = puffBased ? "10" : "1";
        }, 0);
      });
    }
    if (!saveButton || saveButton.dataset.gillieCostSave === "1") return;
    saveButton.dataset.gillieCostSave = "1";
    saveButton.onclick = () => {
      const current = currentState();
      if (!current?.cost) return;
      let profile = null;
      try { profile = typeof activeSubstance === "function" ? activeSubstance() : null; } catch (_) {}
      const minUses = profile?.useLabel === "puffs" ? 10 : 1;
      const units = Number.parseFloat(document.getElementById("ce-units")?.value || "");
      const cost = Number.parseFloat(document.getElementById("ce-cost")?.value || "");
      const uses = Number.parseInt(document.getElementById("ce-puffs")?.value || "", 10);
      current.cost.unitsPerWeek = Number.isFinite(units) ? Math.max(0.1, units) : current.cost.unitsPerWeek;
      current.cost.costPerUnit = Number.isFinite(cost) ? Math.max(0.5, cost) : current.cost.costPerUnit;
      current.cost.puffsPerDay = Number.isFinite(uses) ? Math.max(minUses, uses) : current.cost.puffsPerDay;
      try { if (typeof save === "function") save(); } catch (_) {}
      const overlay = document.getElementById("cost-overlay");
      if (overlay) overlay.hidden = true;
      try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
      track("settings_cost_saved", { minUses, substance: String(current.cost.substance || "unknown") });
    };
  }

  async function manageActiveSubscription() {
    try {
      if (purchaseBridge()?.manageSubscriptions) await purchaseBridge().manageSubscriptions();
      else window.location.href = "https://apps.apple.com/account/subscriptions";
    } catch (_) {
      window.location.href = "https://apps.apple.com/account/subscriptions";
    }
    track("settings_manage_subscription_opened");
  }

  function installPlusControl() {
    const button = document.getElementById("set-plus");
    if (!button || button.dataset.gilliePlusSettings === "1") return;
    const original = button.onclick;
    button.dataset.gilliePlusSettings = "1";
    button.onclick = (event) => {
      if (currentState()?.premium) {
        event?.preventDefault?.();
        void manageActiveSubscription();
        return;
      }
      if (typeof original === "function") original.call(button, event);
      else {
        try { if (typeof openPlus === "function") openPlus(); } catch (_) {}
      }
    };
  }

  function allNotificationIds() {
    const ids = [...BASE_NOTIFICATION_IDS];
    try {
      if (typeof MILESTONES !== "undefined" && Array.isArray(MILESTONES)) {
        MILESTONES.forEach((_, index) => ids.push(811000 + index));
      }
    } catch (_) {}
    return [...new Set(ids)];
  }

  async function cancelAllGillieNotifications() {
    const plugin = notificationBridge();
    if (!plugin) return;
    try {
      await plugin.cancel?.({ notifications: allNotificationIds().map((id) => ({ id })) });
    } catch (_) {}
    try { await plugin.removeAllDeliveredNotifications?.(); } catch (_) {}
  }

  function clearGillieStorage(storage) {
    if (!storage) return;
    try {
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean);
      const appKey = (() => {
        try { return typeof CONFIG !== "undefined" ? CONFIG.storageKey : "gillie_v1"; }
        catch (_) { return "gillie_v1"; }
      })();
      keys.forEach((key) => {
        if (key === appKey || /^gillie(?:[._-]|$)/i.test(key)) storage.removeItem(key);
      });
    } catch (_) {}
  }

  async function eraseAllGillieData() {
    track("settings_erase_started");
    await cancelAllGillieNotifications();
    try { await purchaseBridge()?.clearDiagnostics?.(); } catch (_) {}
    clearGillieStorage(window.localStorage);
    clearGillieStorage(window.sessionStorage);
    setTimeout(() => window.location.reload(), 80);
  }

  function installResetControl() {
    const button = document.getElementById("set-reset");
    if (!button || button.dataset.gillieResetSettings === "1") return;
    button.dataset.gillieResetSettings = "1";
    button.onclick = () => {
      const current = currentState();
      const petName = String(current?.petName || "Gillie").slice(0, 20);
      const open = typeof openConfirmSheet === "function" ? openConfirmSheet : null;
      if (!open) {
        if (window.confirm("Erase all Gillie data and settings from this device? Your Apple subscription will not be cancelled.")) void eraseAllGillieData();
        return;
      }
      open({
        icon: "!",
        title: "Erase everything?",
        copy: `This releases ${petName}, deletes your streak, pearls, check-ins, cravings, shop items, sound/motion/text preferences, and scheduled Gillie notifications. Your Apple subscription is not cancelled. There is no undo.`,
        actionText: "Erase everything",
        danger: true,
        onConfirm: () => { void eraseAllGillieData(); },
      });
    };
  }

  function syncControlAccessibility() {
    const current = currentState();
    const plus = document.getElementById("set-plus");
    const plusValue = document.getElementById("set-plus-v");
    if (plus) plus.setAttribute("aria-label", current?.premium ? "Gillie Plus active. Manage Apple subscription." : "Gillie Plus free plan. View upgrade options.");
    if (plusValue) plusValue.textContent = current?.premium ? "Active 👑" : "Free plan";

    const checkin = document.getElementById("set-reminder-checkin");
    const craving = document.getElementById("set-reminder-craving");
    if (checkin) checkin.setAttribute("aria-pressed", String(Boolean(current?.reminders?.checkin)));
    if (craving) craving.setAttribute("aria-pressed", String(Boolean(current?.reminders?.craving)));

    ["set-name", "set-skin", "set-cost", "set-integrity", "set-slip", "set-reset"].forEach((id) => {
      document.getElementById(id)?.setAttribute("aria-haspopup", "dialog");
    });
    syncQualityAccessibility();
  }

  function audit() {
    const controls = {};
    REQUIRED_IDS.forEach((id) => {
      const node = document.getElementById(id);
      controls[id] = Boolean(node && (typeof node.onclick === "function" || node.dataset.gillieSettingsHook === "1"));
    });
    const ready = Object.values(controls).every(Boolean);
    const view = document.getElementById("view-you");
    if (view) {
      view.dataset.gillieSettingsRuntime = ENGINE;
      view.dataset.gillieSettingsReady = ready ? "true" : "false";
    }
    return {
      engine: ENGINE,
      ready,
      controls,
      preferences: readPreferences(),
      nativePurchases: Boolean(purchaseBridge()),
      nativeNotifications: Boolean(notificationBridge()),
      productionReminderLayer: Boolean(typeof renderSettings === "function" && renderSettings.__phase1Wrapped),
    };
  }

  function refresh() {
    const prefs = applyPersistedPreferences();
    installQualityHooks();
    installCostControl();
    installPlusControl();
    installResetControl();
    syncControlAccessibility();
    const result = audit();
    if (!loadedTracked && result.ready) {
      loadedTracked = true;
      track("settings_runtime_ready", { controls: REQUIRED_IDS.length, textScale: prefs.textScale });
    }
    return result;
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 20);
  }

  function installObserver() {
    const view = document.getElementById("view-you");
    if (!view || viewObserver) return;
    viewObserver = new MutationObserver(scheduleRefresh);
    viewObserver.observe(view, { childList: true, subtree: true });
  }

  function boot(attempt = 0) {
    const result = refresh();
    installObserver();
    if (!result.ready && attempt < 160) setTimeout(() => boot(attempt + 1), 50);
  }

  window.GillieSettingsRuntime = Object.freeze({
    engine: ENGINE,
    refresh,
    audit,
    applyPreferences: applyPersistedPreferences,
    eraseAllData: eraseAllGillieData,
    cancelNotifications: cancelAllGillieNotifications,
  });

  document.addEventListener("gillie:entitlement-updated", scheduleRefresh);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleRefresh(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(() => boot(), 0), { once: true });
  else setTimeout(() => boot(), 0);
})();