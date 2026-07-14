/* Gillie Phase 4 — launch hardening, fair free economy, and StoreKit pricing. */
(() => {
  "use strict";

  if (window.__gillieLaunchHardeningInstalled) return;
  window.__gillieLaunchHardeningInstalled = true;

  const VERSION = "phase4-2026.07.11";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const bridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;
  const currentState = () => (typeof state !== "undefined" && state ? state : null);

  let priceLoadPromise = null;
  let pricesLoaded = false;
  let previousCounts = null;

  function track(name, properties = {}) {
    try { bridge()?.trackEvent?.({ name, properties: { phase: VERSION, ...properties } }); } catch (_) {}
  }

  function patchEconomyAndCopy() {
    if (window.__gillieLaunchDataPatched) return;
    window.__gillieLaunchDataPatched = true;

    try {
      if (typeof THEMES !== "undefined") {
        const sunset = THEMES.find((theme) => theme.id === "sunset");
        if (sunset) sunset.premium = false;
      }

      if (typeof SHOP_ITEMS !== "undefined") {
        const pebble = SHOP_ITEMS.find((item) => item.id === "pebble");
        const starfish = SHOP_ITEMS.find((item) => item.id === "starfish");
        if (pebble) pebble.price = 20;
        if (starfish) starfish.price = 30;
      }

      if (typeof SPEECH !== "undefined" && Array.isArray(SPEECH.late)) {
        SPEECH.late = SPEECH.late.map((line) => line === "Crystal clear in here. Your doing." ? "Crystal clear in here. Look what you’re doing." : line);
      }

      if (typeof MILESTONES !== "undefined") {
        const saferDescriptions = {
          m20min: "Your body begins adjusting soon after nicotine stops. Individual timelines vary.",
          m24h: "The first day can bring strong cravings as nicotine levels fall.",
          m72h: "Withdrawal often feels strongest during the first few days, then changes over time.",
          m1w: "Many people begin noticing cravings becoming shorter or more predictable.",
          m2w: "Some people notice breathing or circulation changes over the next several weeks.",
          m1m: "Some people report easier breathing, improved taste or smell, and less coughing.",
          m3m: "Routines without nicotine may start feeling more familiar, though cravings can still happen.",
          m6m: "For many people, urges are less frequent and easier to plan for.",
          m1y: "One year is a major behavior-change milestone. Recovery experiences vary.",
        };
        MILESTONES.forEach((milestone) => {
          if (saferDescriptions[milestone.id]) milestone.desc = saferDescriptions[milestone.id];
        });
      }

      if (typeof CONFIG !== "undefined" && CONFIG.plus) {
        CONFIG.plus.kicker = "Your personal quit plan";
        CONFIG.plus.subtitle = "Get one practical move for the moments most likely to break your streak.";
        CONFIG.plus.cta = "Start Gillie Plus";
        if (CONFIG.plus.products?.yearly) CONFIG.plus.products.yearly.note = "Annual billing";
        if (CONFIG.plus.products?.monthly) CONFIG.plus.products.monthly.note = "Monthly billing";
      }

      try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
      track("launch_data_patched", { freeTheme: "sunset", starterChoices: 2 });
    } catch (error) {
      track("launch_data_patch_failed", { message: String(error?.message || error).slice(0, 80) });
    }
  }

  function periodLabel(product) {
    const unit = String(product?.periodUnit || "").toLowerCase();
    const value = Number(product?.periodValue || 1);
    if (!unit) return "";
    if (value === 1) return `/ ${unit}`;
    return `/ ${value} ${unit}s`;
  }

  function applyVisiblePaywallPrices() {
    if (typeof CONFIG === "undefined") return;
    for (const key of ["yearly", "monthly"]) {
      const plan = CONFIG.plus?.products?.[key];
      const button = document.querySelector(`[data-plus-plan="${key}"]`);
      if (!plan || !button) continue;
      const price = $(".price", button);
      const note = $(".note", button);
      if (price) {
        price.replaceChildren(document.createTextNode(plan.price || "Loading Apple price…"));
        if (plan.cadence) {
          const small = document.createElement("small");
          small.textContent = plan.cadence;
          price.appendChild(small);
        }
      }
      if (note) note.textContent = plan.note || "";
    }
  }

  async function localizeStoreKitPrices() {
    if (pricesLoaded) {
      applyVisiblePaywallPrices();
      return;
    }
    if (priceLoadPromise) return priceLoadPromise;

    const native = bridge();
    if (!native?.getProducts || typeof CONFIG === "undefined") return;

    priceLoadPromise = (async () => {
      try {
        const response = await native.getProducts();
        const products = Array.isArray(response?.products) ? response.products : [];
        let matched = 0;

        Object.values(CONFIG.plus?.products || {}).forEach((plan) => {
          const product = products.find((item) => item.id === plan.id);
          if (!product?.displayPrice) return;
          plan.price = String(product.displayPrice).slice(0, 64);
          plan.cadence = periodLabel(product) || "";
          matched += 1;
        });

        pricesLoaded = matched > 0;
        try { if (typeof renderPlusPlans === "function") renderPlusPlans(); } catch (_) {}
        applyVisiblePaywallPrices();
        track("store_prices_localized", { matched, returned: products.length });
      } catch (error) {
        track("store_prices_localize_failed", { message: String(error?.message || error).slice(0, 80) });
      } finally {
        priceLoadPromise = null;
      }
    })();

    return priceLoadPromise;
  }

  function tuneReefPlacement() {
    const view = $("#view-reef");
    if (!view) return;

    const banner = $("#plus-banner", view);
    const themeRow = $("#theme-row", view);
    if (banner && themeRow && banner.previousElementSibling !== themeRow) {
      themeRow.insertAdjacentElement("afterend", banner);
    }
    banner?.classList.add("ship-reef-plus-strip");

    const starter = $("#ship-reef-starter", view);
    if (starter) {
      const label = $("b", starter);
      const action = $("i", starter);
      if (label) label.textContent = "Choose your first decoration now.";
      if (action) action.textContent = "Shop ›";
    }
  }

  function tuneQuickCheckin() {
    const button = $('[data-ship-action="checkin"]');
    if (button) button.textContent = "Check in";
  }

  function revealEarnedInsights() {
    const current = currentState();
    const view = $("#view-progress");
    if (!current || !view) return;
    const ready = (current.checkins?.length || 0) >= 3 && Math.max(current.cravings?.length || 0, current.sosRewards?.length || 0) >= 1;
    const heading = $$(".section-h", view).find((node) => node.textContent.trim().toLowerCase() === "your insights");
    const box = $("#insights-box", view);
    const show = ready && current.premium;
    if (heading) heading.hidden = !show;
    if (box) box.hidden = !show;
  }

  function applyViewPolish() {
    tuneReefPlacement();
    tuneQuickCheckin();
    revealEarnedInsights();
    applyVisiblePaywallPrices();
  }

  function snapshotCounts() {
    const current = currentState();
    if (!current) return null;
    return {
      checkins: current.checkins?.length || 0,
      cravings: current.cravings?.length || 0,
      owned: current.ownedItems?.length || 0,
      premium: Boolean(current.premium),
    };
  }

  function captureCompletedActions(source) {
    const next = snapshotCounts();
    if (!next) return;
    if (previousCounts) {
      if (next.checkins > previousCounts.checkins) track("checkin_completed", { source, total: next.checkins });
      if (next.cravings > previousCounts.cravings) track("sos_or_craving_logged", { source, total: next.cravings });
      if (next.owned > previousCounts.owned) track("reef_purchase_completed", { source, totalOwned: next.owned });
      if (next.premium && !previousCounts.premium) track("subscription_became_active", { source });
    }
    previousCounts = next;
  }

  function handleClick(event) {
    const target = event.target.closest("button, [role='button']");
    if (!target) return;

    if (target.closest("#tabs")) setTimeout(applyViewPolish, 80);
    if (target.matches("#plus-open, #set-plus, [data-act='plus'], #ship-premium-teaser")) {
      setTimeout(() => {
        localizeStoreKitPrices();
        applyViewPolish();
      }, 80);
    }

    if (target.matches("#checkin-save, #trigger-save, #followup-made, [data-act='buy'], #plus-purchase")) {
      const source = target.id || target.dataset.act || "action";
      setTimeout(() => {
        captureCompletedActions(source);
        applyViewPolish();
      }, 350);
    }
  }

  function install() {
    patchEconomyAndCopy();
    previousCounts = snapshotCounts();
    document.addEventListener("click", handleClick, true);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      localizeStoreKitPrices();
      applyViewPolish();
      captureCompletedActions("app_foreground");
    });

    setTimeout(applyViewPolish, 100);
    setTimeout(applyViewPolish, 500);
    setTimeout(() => {
      localizeStoreKitPrices();
      applyViewPolish();
    }, 1200);
    track("launch_hardening_loaded", { version: VERSION });
  }

  function waitForApp(attempt = 0) {
    if ((window.__gillieShipPolishInstalled && currentState()) || attempt >= 100) {
      install();
      return;
    }
    setTimeout(() => waitForApp(attempt + 1), 50);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => waitForApp(), { once: true });
  else waitForApp();
})();
