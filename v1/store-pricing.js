/* Gillie V1 Store Pricing — localized Apple prices without owning or disabling checkout. */
(() => {
  "use strict";

  const ENGINE = "store-pricing-v2-retryable";
  const CHECKOUT_OWNER = "purchase-director-v1-authoritative";
  const PRODUCT_IDS = Object.freeze({
    monthly: "gillie.plus.monthly",
    yearly: "gillie.plus.yearly",
  });

  const clean = (value, max = 80) => typeof value === "string"
    ? value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";

  function cadenceFor(product) {
    const value = Math.max(1, Math.round(Number(product?.periodValue) || 1));
    const unit = clean(product?.periodUnit, 16).toLowerCase().replace(/s$/, "");
    if (!["day", "week", "month", "year"].includes(unit)) return "";
    return value === 1 ? `/ ${unit}` : `/ ${value} ${unit}s`;
  }

  function normalizeProducts(response) {
    const allowed = new Set(Object.values(PRODUCT_IDS));
    const output = new Map();
    (Array.isArray(response?.products) ? response.products : []).forEach((product) => {
      const id = clean(product?.id);
      const displayPrice = clean(product?.displayPrice, 64);
      if (!allowed.has(id) || !displayPrice) return;
      output.set(id, { id, displayPrice, cadence: cadenceFor(product) });
    });
    return output;
  }

  const publicApi = {
    engine: ENGINE,
    checkoutOwner: CHECKOUT_OWNER,
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
    overlay.dataset.checkoutOwner = CHECKOUT_OWNER;

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

    function selectPlan(key) {
      if (!PRODUCT_IDS[key]) return;
      try { selectedPlusPlan = key; } catch (_) {}
      qsa("#plus-plans [data-plus-plan]", overlay).forEach((button) => {
        button.classList.toggle("on", button.dataset.plusPlan === key);
        button.disabled = false;
        button.setAttribute("aria-disabled", "false");
      });
    }

    function setLegal(message) {
      const legal = qs("#plus-legal", overlay);
      if (legal) legal.textContent = message;
    }

    function updateConfig() {
      try {
        Object.entries(PRODUCT_IDS).forEach(([key, id]) => {
          const product = products.get(id);
          const plan = CONFIG?.plus?.products?.[key];
          if (!product || !plan) return;
          plan.price = product.displayPrice;
          plan.cadence = product.cadence;
          plan.badge = "";
          plan.note = key === "yearly" ? "Annual billing" : "Monthly billing";
        });
      } catch (_) {}
    }

    function render() {
      const purchase = qs("#plus-purchase", overlay);
      const restore = qs("#plus-restore", overlay);
      const selectedProduct = products.get(PRODUCT_IDS[selectedPlanKey()]);

      qsa("#plus-plans [data-plus-plan]", overlay).forEach((button) => {
        const product = products.get(PRODUCT_IDS[button.dataset.plusPlan]);
        const price = qs(".price", button);
        button.disabled = false;
        button.setAttribute("aria-disabled", "false");
        if (!price) return;
        if (loadState === "loading") {
          price.textContent = "Loading Apple price…";
          return;
        }
        if (!product) {
          price.textContent = loadState === "idle" ? "Checking Apple…" : "Apple unavailable";
          return;
        }
        price.replaceChildren(document.createTextNode(product.displayPrice));
        if (product.cadence) {
          const small = document.createElement("small");
          small.textContent = product.cadence;
          price.appendChild(small);
        }
      });

      qsa('[data-plus-plan="yearly"] .badge', overlay).forEach((badge) => badge.remove());
      if (purchase && !isPremium() && purchase.dataset.purchaseBusy !== "1") {
        // Pricing is display-only. The authoritative purchase director owns the tap,
        // busy state, product preflight, Apple sheet, and entitlement confirmation.
        purchase.disabled = false;
        purchase.setAttribute("aria-disabled", "false");
        purchase.classList.remove("phase2-loading");
        if (purchase.dataset.purchaseDirector !== CHECKOUT_OWNER) {
          purchase.textContent = selectedProduct
            ? "Start Gillie Plus"
            : loadState === "error" || loadState === "unavailable"
              ? "Try Gillie Plus"
              : "Start Gillie Plus";
        }
      }
      if (restore && restore.dataset.purchaseBusy !== "1") {
        restore.disabled = false;
        restore.setAttribute("aria-disabled", "false");
      }
    }

    function scheduleRender() {
      [0, 100, 280].forEach((delay) => setTimeout(render, delay));
    }

    function rerenderPlans() {
      updateConfig();
      try { if (typeof renderPlusPlans === "function") renderPlusPlans(); } catch (_) {}
      scheduleRender();
    }

    function chooseAvailablePlan() {
      if (products.has(PRODUCT_IDS[selectedPlanKey()])) return;
      if (products.has(PRODUCT_IDS.yearly)) selectPlan("yearly");
      else if (products.has(PRODUCT_IDS.monthly)) selectPlan("monthly");
    }

    function snapshot() {
      return {
        state: loadState,
        products: Array.from(products.keys()),
        error: lastError,
        requestedProductIds: Object.values(PRODUCT_IDS),
        native: lastNativeResponse,
        checkoutOwner: CHECKOUT_OWNER,
      };
    }

    async function loadAppleProducts({ announceFailure = false, force = false } = {}) {
      if (!force && loadState === "ready" && products.size) {
        rerenderPlans();
        return products;
      }
      if (loadPromise) return loadPromise;

      const native = bridge();
      if (!native?.getProducts) {
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
          const response = await native.getProducts();
          lastNativeResponse = response || null;
          products = normalizeProducts(response);
          if (!products.size) {
            const requested = Array.isArray(response?.requestedProductIds)
              ? response.requestedProductIds.join(", ")
              : Object.values(PRODUCT_IDS).join(", ");
            throw new Error(`Apple returned zero Gillie Plus products for ${requested}.`);
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

    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.("button,[role='button']");
      if (!target) return;
      if (target.matches("#plus-open,#set-plus,[data-act='plus'],#ship-premium-teaser")) {
        loadAppleProducts({ force: loadState === "error" });
        scheduleRender();
      }
      if (target.matches("[data-plus-plan]")) {
        selectPlan(target.dataset.plusPlan);
        setTimeout(render, 20);
      }
      // Never start a second product request from the purchase tap. The purchase
      // director performs the single bounded preflight immediately before checkout.
    }, true);

    loadAppleProducts();
    scheduleRender();
  });
})();
