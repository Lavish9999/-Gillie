/* Gillie V1 Store Pricing — Apple is the only authority for subscription price and billing period. */
(() => {
  "use strict";

  const ENGINE = "store-pricing-v2-retryable";
  const PRODUCT_IDS = Object.freeze({
    monthly: "gillie.plus.monthly",
    yearly: "gillie.plus.yearly",
  });

  function cleanStoreText(value, maxLength = 80) {
    return typeof value === "string"
      ? value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength)
      : "";
  }

  function cadenceFor(product) {
    const value = Math.max(1, Math.round(Number(product?.periodValue) || 1));
    const rawUnit = cleanStoreText(product?.periodUnit, 16).toLowerCase();
    const singular = rawUnit.replace(/s$/, "");
    if (!["day", "week", "month", "year"].includes(singular)) return "";
    return value === 1 ? `/ ${singular}` : `/ ${value} ${singular}s`;
  }

  function normalizeProducts(response) {
    const allowed = new Set(Object.values(PRODUCT_IDS));
    const rows = Array.isArray(response?.products) ? response.products : [];
    const output = new Map();
    rows.forEach((product) => {
      const id = cleanStoreText(product?.id, 80);
      const displayPrice = cleanStoreText(product?.displayPrice, 64);
      if (!allowed.has(id) || !displayPrice) return;
      output.set(id, {
        id,
        displayPrice,
        cadence: cadenceFor(product),
      });
    });
    return output;
  }

  const publicApi = {
    engine: ENGINE,
    productIds: PRODUCT_IDS,
    normalizeProducts,
    cadenceFor,
    load: async () => new Map(),
    snapshot: () => ({ state: "uninstalled", products: [], error: "" }),
  };
  window.GillieStorePricing = publicApi;

  window.GillieV1?.register("store-pricing", ({ qs, qsa, getState, track, announce }) => {
    const overlay = qs("#plus-overlay");
    if (!overlay || overlay.dataset.v1StorePricing === ENGINE) return;
    overlay.dataset.v1StorePricing = ENGINE;

    let loadState = "idle";
    let loadPromise = null;
    let products = new Map();
    let lastError = "";
    let lastNativeResponse = null;

    const bridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;
    const isPremium = () => Boolean(getState?.()?.premium);

    function selectedPlanKey() {
      try {
        if (typeof selectedPlusPlan !== "undefined" && PRODUCT_IDS[selectedPlusPlan]) return selectedPlusPlan;
      } catch (_) {}
      return qs('#plus-plans [data-plus-plan].on', overlay)?.dataset?.plusPlan || "yearly";
    }

    function setSelectedPlan(key) {
      if (!PRODUCT_IDS[key]) return;
      try { selectedPlusPlan = key; } catch (_) {}
      qsa("#plus-plans [data-plus-plan]", overlay).forEach((button) => {
        button.classList.toggle("on", button.dataset.plusPlan === key);
      });
    }

    function selectedProduct() {
      return products.get(PRODUCT_IDS[selectedPlanKey()]) || null;
    }

    function setLegal(message) {
      const legal = qs("#plus-legal", overlay);
      if (legal) legal.textContent = message;
    }

    function removeHardcodedSavings() {
      qsa('[data-plus-plan="yearly"] .badge', overlay).forEach((badge) => badge.remove());
      const yearlyNote = qs('[data-plus-plan="yearly"] .note', overlay);
      if (yearlyNote && /best value|save/i.test(yearlyNote.textContent || "")) yearlyNote.textContent = "Annual billing";
      const monthlyNote = qs('[data-plus-plan="monthly"] .note', overlay);
      if (monthlyNote && /flexible|full plus/i.test(monthlyNote.textContent || "")) monthlyNote.textContent = "Monthly billing";
    }

    function updateConfigFromProducts() {
      try {
        if (typeof CONFIG === "undefined" || !CONFIG?.plus?.products) return;
        Object.entries(PRODUCT_IDS).forEach(([key, id]) => {
          const product = products.get(id);
          const plan = CONFIG.plus.products[key];
          if (!plan || !product) return;
          plan.price = product.displayPrice;
          plan.cadence = product.cadence;
          plan.badge = "";
          plan.note = key === "yearly" ? "Annual billing" : "Monthly billing";
        });
      } catch (_) {}
    }

    function renderPlanState() {
      const purchase = qs("#plus-purchase", overlay);
      const restore = qs("#plus-restore", overlay);
      const premium = isPremium();
      const selected = selectedProduct();

      qsa("#plus-plans [data-plus-plan]", overlay).forEach((button) => {
        const key = button.dataset.plusPlan;
        const product = products.get(PRODUCT_IDS[key]);
        const price = qs(".price", button);

        if (loadState === "loading") {
          if (price) price.textContent = "Loading Apple price…";
          button.disabled = true;
          button.setAttribute("aria-disabled", "true");
          return;
        }

        // Keep plan selection usable after a StoreKit loading failure. The purchase
        // coordinator performs a fresh native preflight on every CTA tap.
        button.disabled = false;
        button.removeAttribute("aria-disabled");
        if (!product) {
          if (price) price.textContent = loadState === "idle" ? "Checking Apple…" : "Apple unavailable";
          return;
        }

        if (price) {
          price.replaceChildren(document.createTextNode(product.displayPrice));
          if (product.cadence) {
            const small = document.createElement("small");
            small.textContent = product.cadence;
            price.appendChild(small);
          }
        }
      });

      removeHardcodedSavings();

      if (purchase && !premium && purchase.dataset.purchaseBusy !== "1") {
        const loading = loadState === "loading";
        purchase.disabled = loading;
        purchase.setAttribute("aria-disabled", String(loading));
        purchase.classList.toggle("phase2-loading", loading);
        purchase.textContent = loading
          ? "Connecting to Apple…"
          : selected
            ? "Start Gillie Plus"
            : loadState === "error" || loadState === "unavailable"
              ? "Retry Apple connection"
              : "Check Apple plans";
      }
      if (restore && restore.dataset.purchaseBusy !== "1") restore.disabled = false;
    }

    function scheduleRender() {
      [0, 100, 280].forEach((delay) => setTimeout(renderPlanState, delay));
    }

    function rerenderPlans() {
      updateConfigFromProducts();
      try {
        if (typeof renderPlusPlans === "function") renderPlusPlans();
      } catch (_) {}
      scheduleRender();
    }

    function chooseAvailablePlan() {
      if (products.has(PRODUCT_IDS[selectedPlanKey()])) return;
      if (products.has(PRODUCT_IDS.yearly)) setSelectedPlan("yearly");
      else if (products.has(PRODUCT_IDS.monthly)) setSelectedPlan("monthly");
    }

    function snapshot() {
      return {
        state: loadState,
        products: Array.from(products.keys()),
        error: lastError,
        requestedProductIds: Object.values(PRODUCT_IDS),
        native: lastNativeResponse,
      };
    }

    async function loadAppleProducts({ announceFailure = false, force = false } = {}) {
      if (!force && loadState === "ready" && products.size) {
        rerenderPlans();
        return products;
      }
      if (loadPromise) return loadPromise;

      const plugin = bridge();
      if (!plugin?.getProducts) {
        loadState = "unavailable";
        lastError = "The native Gillie purchase bridge is missing from this build.";
        scheduleRender();
        if (!overlay.hidden) setLegal(lastError);
        track("store_pricing_bridge_missing", { engine: ENGINE });
        return products;
      }

      loadState = "loading";
      lastError = "";
      scheduleRender();
      loadPromise = (async () => {
        try {
          const response = await plugin.getProducts();
          lastNativeResponse = response || null;
          products = normalizeProducts(response);
          if (!products.size) {
            const requested = Array.isArray(response?.requestedProductIds)
              ? response.requestedProductIds.join(", ")
              : Object.values(PRODUCT_IDS).join(", ");
            throw new Error(`Apple returned no purchasable plans for ${requested}.`);
          }
          loadState = "ready";
          chooseAvailablePlan();
          rerenderPlans();
          track("store_pricing_ready", { count: products.size, engine: ENGINE });
          return products;
        } catch (error) {
          products = new Map();
          loadState = "error";
          lastError = String(error?.message || "Apple plans could not be loaded.").slice(0, 220);
          scheduleRender();
          if (!overlay.hidden || announceFailure) setLegal(lastError);
          if (announceFailure) announce?.(lastError);
          track("store_pricing_failed", { message: lastError.slice(0, 120), engine: ENGINE });
          return products;
        } finally {
          loadPromise = null;
        }
      })();
      return loadPromise;
    }

    publicApi.load = loadAppleProducts;
    publicApi.snapshot = snapshot;

    const originalOpenPlus = typeof openPlus === "function" ? openPlus : null;
    if (originalOpenPlus && !originalOpenPlus.__v1StorePricing) {
      const storeSafeOpenPlus = function storeSafeOpenPlus(...args) {
        const result = originalOpenPlus.apply(this, args);
        loadAppleProducts({ force: loadState === "error" });
        scheduleRender();
        return result;
      };
      storeSafeOpenPlus.__v1StorePricing = true;
      try { window.openPlus = storeSafeOpenPlus; } catch (_) {}
    }

    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.("button,[role='button']");
      if (!target) return;

      if (target.matches("#plus-open,#set-plus,[data-act='plus'],#ship-premium-teaser")) {
        loadAppleProducts({ force: loadState === "error" });
        scheduleRender();
      }

      if (target.matches("[data-plus-plan]")) {
        setSelectedPlan(target.dataset.plusPlan);
        setTimeout(renderPlanState, 20);
      }

      // Never consume the CTA event. The purchase-flow module owns the purchase
      // attempt and runs its own native product preflight before opening Apple.
      if (target.matches("#plus-purchase") && !isPremium() && !selectedProduct()) {
        loadAppleProducts({ announceFailure: false, force: true });
      }
    }, true);

    loadAppleProducts();
    scheduleRender();
  });
})();
