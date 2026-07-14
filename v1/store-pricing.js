/* Gillie V1 Store Pricing — Apple is the only authority for subscription price and billing period. */
(() => {
  "use strict";

  const ENGINE = "store-pricing-v1";
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

  window.GillieStorePricing = Object.freeze({
    engine: ENGINE,
    productIds: PRODUCT_IDS,
    normalizeProducts,
    cadenceFor,
  });

  window.GillieV1?.register("store-pricing", ({ qs, qsa, getState, track, announce }) => {
    const overlay = qs("#plus-overlay");
    if (!overlay || overlay.dataset.v1StorePricing === ENGINE) return;
    overlay.dataset.v1StorePricing = ENGINE;

    let loadState = "idle";
    let loadPromise = null;
    let products = new Map();
    let lastError = "";

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
        if (loadState !== "ready" || !product) {
          if (price) price.textContent = "Unavailable";
          button.disabled = true;
          button.setAttribute("aria-disabled", "true");
          return;
        }
        button.disabled = false;
        button.removeAttribute("aria-disabled");
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

      if (purchase && !premium) {
        const ready = loadState === "ready" && Boolean(selected);
        purchase.disabled = !ready;
        purchase.setAttribute("aria-disabled", String(!ready));
        purchase.classList.toggle("phase2-loading", loadState === "loading");
        purchase.textContent = loadState === "loading"
          ? "Loading Apple price…"
          : ready
            ? "Start Gillie Plus"
            : "Apple price unavailable";
      }
      if (restore) restore.disabled = false;
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

    async function loadAppleProducts({ announceFailure = false } = {}) {
      if (loadState === "ready" && products.size) {
        rerenderPlans();
        return products;
      }
      if (loadPromise) return loadPromise;

      const plugin = bridge();
      if (!plugin?.getProducts) {
        loadState = "unavailable";
        lastError = "Gillie Plus pricing is available in the iOS App Store build.";
        scheduleRender();
        if (!overlay.hidden) setLegal(lastError);
        return products;
      }

      loadState = "loading";
      lastError = "";
      scheduleRender();
      loadPromise = (async () => {
        try {
          const response = await plugin.getProducts();
          products = normalizeProducts(response);
          if (!products.size) throw new Error("Apple did not return an available Gillie Plus plan.");
          loadState = "ready";
          chooseAvailablePlan();
          rerenderPlans();
          track("store_pricing_ready", { count: products.size, engine: ENGINE });
          return products;
        } catch (error) {
          loadState = "error";
          lastError = "Apple prices are temporarily unavailable. Restore purchases is still available.";
          scheduleRender();
          if (!overlay.hidden || announceFailure) setLegal(lastError);
          if (announceFailure) announce?.(lastError);
          track("store_pricing_failed", { message: String(error?.message || error).slice(0, 80), engine: ENGINE });
          return products;
        } finally {
          loadPromise = null;
        }
      })();
      return loadPromise;
    }

    const originalOpenPlus = typeof openPlus === "function" ? openPlus : null;
    if (originalOpenPlus && !originalOpenPlus.__v1StorePricing) {
      const storeSafeOpenPlus = function storeSafeOpenPlus(...args) {
        const result = originalOpenPlus.apply(this, args);
        loadAppleProducts();
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
        loadAppleProducts();
        scheduleRender();
      }

      if (target.matches("[data-plus-plan]")) {
        setTimeout(() => {
          chooseAvailablePlan();
          renderPlanState();
        }, 20);
      }

      if (target.matches("#plus-purchase") && !isPremium() && !selectedProduct()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setLegal(loadState === "loading" ? "Loading Apple prices…" : (lastError || "Apple price is not available yet."));
        loadAppleProducts({ announceFailure: true });
      }
    }, true);

    loadAppleProducts();
    scheduleRender();
  });
})();
