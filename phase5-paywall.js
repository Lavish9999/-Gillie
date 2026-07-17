/* Gillie Phase 5 — premium mascot-led paywall presenter using the existing StoreKit wiring. */
(() => {
  "use strict";

  if (window.__gilliePaywallRebuildInstalled) return;
  window.__gilliePaywallRebuildInstalled = true;

  const VERSION = "phase5-paywall-2026.07.16-hero-v5";
  const PRODUCT_IDS = Object.freeze({
    monthly: "gillie.plus.monthly",
    yearly: "gillie.plus.yearly",
  });
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const bridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;

  let overlayObserver = null;
  let legalObserver = null;
  let planObserver = null;
  let healthObserver = null;
  let refreshTimer = 0;
  let statusTimer = 0;
  let cancelResetTimer = 0;
  let resettingLegal = false;
  let lastCancelToastAt = 0;
  let openerElement = null;

  function track(name, properties = {}) {
    try { bridge()?.trackEvent?.({ name, properties: { phase: VERSION, ...properties } }); } catch (_) {}
  }

  function hapticsAllowed() {
    return document.documentElement?.dataset?.gillieHaptics !== "off";
  }

  function selectionHaptic() {
    if (!hapticsAllowed()) return;
    try { bridge()?.haptic?.({ style: "selection" }); } catch (_) {}
  }

  function create(tag, className, html = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html) node.innerHTML = html;
    return node;
  }

  /* ------------------------------------------------------------------
     StoreKit-derived presentation state.
     Trial copy may only appear when Apple verifies an introductory free
     trial for the product AND this user's eligibility for it.
  ------------------------------------------------------------------ */

  function pricingDetails() {
    try {
      const details = window.GillieStorePricing?.details?.();
      return details instanceof Map ? details : new Map();
    } catch (_) {
      return new Map();
    }
  }

  function selectedPlanKey() {
    try {
      if (typeof selectedPlusPlan !== "undefined" && PRODUCT_IDS[selectedPlusPlan]) return selectedPlusPlan;
    } catch (_) {}
    return $("#plus-plans [data-plus-plan].on")?.dataset?.plusPlan || "yearly";
  }

  function deriveTrialState(details, planKey) {
    const product = details?.get?.(PRODUCT_IDS[planKey] || PRODUCT_IDS.yearly);
    const offer = product?.introOffer || null;
    if (!offer || offer.paymentMode !== "freeTrial" || product.introEligible !== true) {
      return { eligible: false, days: null, label: "" };
    }
    let days = null;
    if (offer.periodUnit === "day") days = offer.periodValue;
    else if (offer.periodUnit === "week") days = offer.periodValue * 7;
    const label = days
      ? `${days} days free`
      : `${offer.periodValue}-${offer.periodUnit} free trial`;
    return { eligible: true, days, label, periodValue: offer.periodValue, periodUnit: offer.periodUnit };
  }

  function savingsPercent(monthlyPrice, yearlyPrice) {
    const monthly = Number(monthlyPrice);
    const yearly = Number(yearlyPrice);
    if (!Number.isFinite(monthly) || !Number.isFinite(yearly) || monthly <= 0 || yearly <= 0) return null;
    const percent = Math.round((1 - yearly / (monthly * 12)) * 100);
    return percent >= 5 && percent <= 95 ? percent : null;
  }

  function formatCurrency(amount, currencyCode) {
    if (!Number.isFinite(Number(amount)) || !currencyCode) return "";
    try {
      return new Intl.NumberFormat(navigator.language || undefined, {
        style: "currency",
        currency: currencyCode,
      }).format(Number(amount));
    } catch (_) {
      return "";
    }
  }

  function presentationState() {
    const details = pricingDetails();
    const planKey = selectedPlanKey();
    const monthly = details.get(PRODUCT_IDS.monthly) || null;
    const yearly = details.get(PRODUCT_IDS.yearly) || null;
    const selected = planKey === "monthly" ? monthly : yearly;
    return {
      planKey,
      monthly,
      yearly,
      selected,
      trial: deriveTrialState(details, planKey),
      savings: savingsPercent(monthly?.price, yearly?.price),
      yearlyMonthlyEquivalent: yearly?.price && yearly?.currencyCode
        ? formatCurrency(yearly.price / 12, yearly.currencyCode)
        : "",
    };
  }

  /* ------------------------------------------------------------------
     Iconography — small aquatic line icons, no emoji.
  ------------------------------------------------------------------ */

  function benefitSvg(kind) {
    const common = 'class="gp-benefit-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
    if (kind === "guide") {
      return `<svg ${common}><circle cx="12" cy="12" r="8.4"></circle><path d="m14.8 9.2-1.7 4-4 1.7 1.7-4z"></path></svg>`;
    }
    if (kind === "support") {
      return `<svg ${common}><circle cx="12" cy="12" r="8.4"></circle><circle cx="12" cy="12" r="3.4"></circle><path d="M9.6 9.6 6.1 6.1m8.3 3.5 3.5-3.5M9.6 14.4l-3.5 3.5m8.3-3.5 3.5 3.5"></path></svg>`;
    }
    return `<svg ${common}><path d="M4 15.5c2.6-4.4 4.4.9 7-3.5s4.4.9 7-3.5"></path><path d="M4.75 19.25h14.5"></path></svg>`;
  }

  function shieldSvg() {
    return `<svg class="gp-free-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 19 6v5.1c0 4.35-2.75 7.65-7 9.4-4.25-1.75-7-5.05-7-9.4V6l7-2.5Z"></path><path d="m8.8 12.1 2 2 4.4-4.5"></path></svg>`;
  }

  function checkSvg() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 12.4 4 4.1 8-8.9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
  }

  function installDragGuard(sheet) {
    if (!sheet || sheet.dataset.gpDragGuard === "1") return;
    const blockLegacyDrag = (event) => {
      if (event.target.closest("button,input,textarea,select,a,label")) return;
      if (event.target.closest(".gp-hero-card,.gp-paywall-scroll,.gp-purchase-dock,.gp-topbar")) {
        event.stopImmediatePropagation();
      }
    };
    sheet.addEventListener("pointerdown", blockLegacyDrag, true);
    sheet.addEventListener("touchstart", blockLegacyDrag, { capture: true, passive: true });
    sheet.dataset.gpDragGuard = "1";
  }

  /* ------------------------------------------------------------------
     Structure. Rebuilds the legacy sheet into:
     topbar (Restore / close) · scroll (hero, message, benefits,
     trial timeline, plans, reassurance, legal footer) · purchase dock.
  ------------------------------------------------------------------ */

  function buildPaywallStructure() {
    const overlay = $("#plus-overlay");
    const sheet = $("#plus-overlay > .sheet");
    if (!overlay || !sheet) return false;
    if (sheet.classList.contains("gp-paywall-sheet")) return true;

    const oldHero = $(".plus-tank-hero", sheet);
    const kicker = $("#plus-kicker", sheet);
    const title = $("#plus-title", sheet);
    const subtitle = $("#plus-subtitle", sheet);
    const close = $("#plus-soft-close", sheet);
    const mascot = $(".plus-mascot-wrap", sheet);
    const stats = $("#plus-stat-chips", sheet);
    const proof = $("#plus-proof", sheet);
    const now = $("#plus-now", sheet);
    const plans = $("#plus-plans", sheet);
    const purchase = $("#plus-purchase", sheet);
    const freeNote = $("#phase2-plus-free-note", sheet);
    const restoreRow = $(".plus-restore-row", sheet);
    const legal = $("#plus-legal", sheet);

    if (![kicker, title, subtitle, close, mascot, stats, proof, now, plans, purchase, restoreRow, legal].every(Boolean)) {
      return false;
    }

    sheet.className = "sheet gp-paywall-sheet";
    sheet.innerHTML = "";

    const topbar = create("div", "gp-topbar");
    restoreRow.className = "gp-restore-top";
    const restoreLead = $("span", restoreRow);
    if (restoreLead) restoreLead.hidden = true;
    close.className = "gp-close";
    close.setAttribute("aria-label", "Close Gillie Plus");
    topbar.append(restoreRow, close);
    sheet.appendChild(topbar);

    const status = create("div", "gp-status-banner");
    status.id = "gp-status-banner";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.hidden = true;
    sheet.appendChild(status);

    const scroll = create("div", "gp-paywall-scroll");
    scroll.id = "gp-paywall-scroll";

    const hero = create("div", "gp-hero-card");
    hero.setAttribute("aria-hidden", "true");
    hero.innerHTML = `
      <span class="gp-ray gp-ray-one"></span>
      <span class="gp-ray gp-ray-two"></span>
      <span class="gp-hero-glow"></span>
      <span class="gp-bubble gp-bubble-one"></span>
      <span class="gp-bubble gp-bubble-two"></span>
      <span class="gp-bubble gp-bubble-three"></span>
      <span class="gp-bubble gp-bubble-four"></span>
      <span class="gp-bubble gp-bubble-five"></span>
      <span class="gp-reef-pedestal"></span>`;
    mascot.className = "plus-mascot-wrap gp-mascot-wrap";
    hero.appendChild(mascot);
    scroll.appendChild(hero);

    const message = create("header", "gp-message");
    message.setAttribute("aria-labelledby", "plus-title");
    kicker.className = "plus-kicker gp-kicker";
    title.className = "gp-title";
    subtitle.className = "gp-subtitle";
    const trialBadge = create("span", "gp-trial-badge");
    trialBadge.id = "gp-trial-badge";
    trialBadge.hidden = true;
    message.append(kicker, title, subtitle, trialBadge);
    scroll.appendChild(message);

    proof.className = "plus-proof gp-benefit-list";
    scroll.appendChild(proof);

    const timeline = create("section", "gp-trial-timeline");
    timeline.id = "gp-trial-timeline";
    timeline.hidden = true;
    timeline.setAttribute("aria-label", "How your free trial works");
    scroll.appendChild(timeline);

    const pricing = create("section", "gp-pricing-section");
    pricing.innerHTML = `
      <div class="gp-pricing-head">
        <h3>Choose your plan</h3>
        <small class="gp-sr-only" aria-live="polite"></small>
      </div>`;
    plans.className = "plus-plans gp-plan-list";
    plans.setAttribute("role", "radiogroup");
    plans.setAttribute("aria-label", "Gillie Plus plan");
    pricing.appendChild(plans);
    scroll.appendChild(pricing);

    const reassurance = freeNote || create("div", "phase2-plus-free-note");
    reassurance.id = "phase2-plus-free-note";
    reassurance.className = "phase2-plus-free-note gp-free-note";
    reassurance.innerHTML = `
      <span class="gp-free-icon">${shieldSvg()}</span>
      <span><b>Your quitting essentials stay free</b><em>SOS, streaks, check-ins, and your tank are never locked away.</em></span>`;
    scroll.appendChild(reassurance);

    const footer = create("footer", "gp-footer");
    legal.className = "plus-legal gp-legal-source";
    legal.setAttribute("aria-hidden", "true");
    footer.appendChild(legal);
    scroll.appendChild(footer);

    const hiddenSources = create("div", "gp-hidden-sources");
    stats.className = "plus-stat-chips gp-hidden-stats";
    stats.hidden = true;
    now.className = "plus-now gp-hidden-stats";
    now.hidden = true;
    hiddenSources.append(stats, now);
    scroll.appendChild(hiddenSources);

    sheet.appendChild(scroll);

    const dock = create("div", "gp-purchase-dock");
    dock.id = "gp-purchase-dock";
    const dockNote = create("p", "gp-cta-note");
    dockNote.id = "gp-cta-note";
    dockNote.hidden = true;
    purchase.className = "btn plus-cta gp-primary-cta";
    const caption = create("p", "gp-cta-caption");
    caption.id = "gp-cta-caption";
    dock.append(dockNote, purchase, caption);
    sheet.appendChild(dock);

    if (oldHero) oldHero.remove();

    overlay.classList.add("gp-paywall-overlay");
    installDragGuard(sheet);
    installLegalObserver();
    installPlanObserver();
    installHealthObserver();
    track("paywall_rebuilt", { layout: "mascot_hero_v5" });
    return true;
  }

  /* ------------------------------------------------------------------
     Copy + trial-aware presentation.
  ------------------------------------------------------------------ */

  function renderBenefits() {
    const proof = $("#plus-proof");
    if (!proof) return;
    proof.dataset.gpBenefits = VERSION;
    proof.innerHTML = `
      <div>
        <span class="gp-benefit-icon">${benefitSvg("guide")}</span>
        <span><b>Personalized daily guidance</b><em>A focused plan based on your check-ins, cravings and progress.</em></span>
      </div>
      <div>
        <span class="gp-benefit-icon">${benefitSvg("support")}</span>
        <span><b>Smarter craving support</b><em>Get practical help when an urge hits instead of generic motivation.</em></span>
      </div>
      <div>
        <span class="gp-benefit-icon">${benefitSvg("patterns")}</span>
        <span><b>Progress that reveals patterns</b><em>See what is working, what triggers you and where you are improving.</em></span>
      </div>`;
  }

  function renderTimeline(state) {
    const timeline = $("#gp-trial-timeline");
    if (!timeline) return;
    if (!state.trial.eligible) {
      timeline.hidden = true;
      timeline.innerHTML = "";
      return;
    }
    timeline.hidden = false;
    timeline.innerHTML = `
      <ol class="gp-timeline-list">
        <li class="gp-timeline-step">
          <span class="gp-timeline-dot" aria-hidden="true"></span>
          <span class="gp-timeline-copy"><b>Today</b><em>Meet Gillie and start your personal quit plan.</em></span>
        </li>
        <li class="gp-timeline-step">
          <span class="gp-timeline-dot" aria-hidden="true"></span>
          <span class="gp-timeline-copy"><b>Before your trial ends</b><em>Cancel anytime in your Apple subscription settings.</em></span>
        </li>
        <li class="gp-timeline-step gp-timeline-billing">
          <span class="gp-timeline-dot" aria-hidden="true"></span>
          <span class="gp-timeline-copy"><b>After the free trial</b><em>Your selected Gillie Plus plan renews unless canceled.</em></span>
        </li>
      </ol>`;
  }

  function cadenceWord(product, fallback) {
    const cadence = String(product?.cadence || "").replace(/^\/\s*/, "").trim();
    return cadence || fallback;
  }

  function idleCtaLabel() {
    const state = presentationState();
    if (state.trial.eligible) {
      return state.trial.days ? `Start my ${state.trial.days} free days` : "Start my free trial";
    }
    return "Start Gillie Plus";
  }

  function idleRestoreLabel() {
    return "Restore";
  }

  function renderDock(state) {
    const note = $("#gp-cta-note");
    const caption = $("#gp-cta-caption");
    const purchase = $("#plus-purchase");
    if (!note || !caption || !purchase) return;

    const selected = state.selected;
    const priceText = selected?.displayPrice || "";
    const per = cadenceWord(selected, state.planKey === "monthly" ? "month" : "year");

    if (state.trial.eligible) {
      note.hidden = false;
      note.textContent = "No payment due today";
      caption.textContent = priceText
        ? `Then ${priceText} / ${per}, unless canceled.`
        : "Cancel anytime before your trial ends.";
    } else {
      note.hidden = true;
      note.textContent = "";
      caption.textContent = priceText
        ? `${priceText} / ${per} · Cancel anytime`
        : "Cancel anytime in your Apple subscription settings.";
    }

    if (purchase.dataset.purchaseBusy !== "1" && purchase.dataset.v1ManageSubscription !== "true") {
      const label = idleCtaLabel();
      if (purchase.textContent !== label) purchase.textContent = label;
    }
  }

  function planAriaLabel(key, state) {
    const product = key === "monthly" ? state.monthly : state.yearly;
    const price = product?.displayPrice || "price loading";
    const per = cadenceWord(product, key === "monthly" ? "month" : "year");
    const descriptor = key === "monthly" ? "cancel anytime" : "best value";
    const selectedNow = state.planKey === key ? "selected" : "not selected";
    return `${key === "monthly" ? "Monthly" : "Yearly"} Gillie Plus, ${price} per ${per}, ${descriptor}, ${selectedNow}.`;
  }

  function decoratePlans() {
    const state = presentationState();
    const yearlyButton = $('[data-plus-plan="yearly"]');
    const monthlyButton = $('[data-plus-plan="monthly"]');

    if (yearlyButton) {
      const name = $(".name", yearlyButton);
      const note = $(".note", yearlyButton);
      if (name) {
        const badge = state.savings !== null
          ? ` <span class="badge" data-gp-computed="true">Save ${state.savings}%</span>`
          : "";
        const nameHtml = `Yearly${badge}`;
        if (name.innerHTML !== nameHtml) name.innerHTML = nameHtml;
      }
      if (note && note.textContent !== "Best value") note.textContent = "Best value";
      let equiv = $(".gp-plan-equiv", yearlyButton);
      if (state.yearlyMonthlyEquivalent) {
        if (!equiv) {
          equiv = create("span", "gp-plan-equiv");
          yearlyButton.appendChild(equiv);
        }
        const equivText = `≈ ${state.yearlyMonthlyEquivalent} / month`;
        if (equiv.textContent !== equivText) equiv.textContent = equivText;
      } else if (equiv) {
        equiv.remove();
      }
    }

    if (monthlyButton) {
      const name = $(".name", monthlyButton);
      const note = $(".note", monthlyButton);
      if (name && name.textContent !== "Monthly") name.textContent = "Monthly";
      if (note && note.textContent !== "Cancel anytime") note.textContent = "Cancel anytime";
    }

    $$("#plus-plans [data-plus-plan]").forEach((button) => {
      const key = button.dataset.plusPlan;
      const selected = button.classList.contains("on");
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(selected));
      button.setAttribute("aria-label", planAriaLabel(key, state));
      if (!$(".gp-plan-check", button)) {
        const check = create("span", "gp-plan-check");
        check.setAttribute("aria-hidden", "true");
        check.innerHTML = checkSvg();
        button.prepend(check);
      }
    });

    const head = $(".gp-pricing-head small");
    if (head) {
      const label = state.planKey === "monthly" ? "Monthly selected" : "Yearly selected";
      if (head.textContent !== label) head.textContent = label;
    }

    renderDock(state);
  }

  function applyPresentation() {
    const overlay = $("#plus-overlay");
    if (!overlay || overlay.hidden || !buildPaywallStructure()) return;

    const state = presentationState();

    const kicker = $("#plus-kicker");
    const title = $("#plus-title");
    const subtitle = $("#plus-subtitle");
    const trialBadge = $("#gp-trial-badge");

    if (kicker) kicker.textContent = "YOUR PERSONAL QUIT PLAN";
    if (state.trial.eligible) {
      if (title) title.textContent = "Try Gillie Plus free";
      if (subtitle) subtitle.textContent = "Get personalized support for cravings, triggers and the moments that usually pull you back.";
      if (trialBadge) {
        trialBadge.hidden = false;
        trialBadge.textContent = state.trial.days ? `${state.trial.days} DAYS FREE` : "FREE TRIAL";
      }
    } else {
      if (title) title.textContent = "Meet Gillie Plus";
      if (subtitle) subtitle.textContent = "A quit plan that adapts to your cravings, triggers and progress.";
      if (trialBadge) {
        trialBadge.hidden = true;
        trialBadge.textContent = "";
      }
    }

    if ($("#plus-proof")?.dataset.gpBenefits !== VERSION) renderBenefits();
    renderTimeline(state);
    decoratePlans();

    const legal = $("#plus-legal");
    if (legal && !statusType(legal.textContent)) {
      legal.textContent = "Subscriptions renew through Apple until cancelled.";
      legal.dataset.defaultCopy = "1";
    }

    if (overlay.dataset.gpViewTracked !== "1") {
      overlay.dataset.gpViewTracked = "1";
      track("paywall_viewed", {
        plan: state.planKey,
        trialEligible: state.trial.eligible,
        trialDays: state.trial.days || 0,
        pricingLoaded: Boolean(state.selected),
      });
      if (state.trial.eligible) track("paywall_trial_presented", { days: state.trial.days || 0 });
    }
  }

  /* ------------------------------------------------------------------
     Status handling: transient states surface in the floating banner,
     purchase cancellation becomes a temporary toast, never permanent copy.
  ------------------------------------------------------------------ */

  function statusType(text) {
    const value = String(text || "").toLowerCase();
    if (/cancelled|canceled/.test(value)) return "cancelled";
    if (/pending|approves/.test(value)) return "pending";
    if (/opening|checking/.test(value)) return "working";
    if (/failed|could not|not available|not found|no active|without an active|try again|error/.test(value)) return "error";
    return "";
  }

  function clearStatus() {
    clearTimeout(statusTimer);
    const banner = $("#gp-status-banner");
    if (!banner) return;
    banner.hidden = true;
    banner.className = "gp-status-banner";
    banner.textContent = "";
  }

  function showStatus(message, type = "info", temporary = false) {
    const banner = $("#gp-status-banner");
    if (!banner) return;
    clearTimeout(statusTimer);
    banner.textContent = message;
    banner.className = `gp-status-banner ${type}`;
    banner.hidden = false;
    if (temporary) statusTimer = setTimeout(clearStatus, 1800);
  }

  function handleLegalChange() {
    if (resettingLegal) return;
    const legal = $("#plus-legal");
    if (!legal) return;

    const text = legal.textContent.trim();
    const type = statusType(text);

    if (type === "working") {
      showStatus(
        /checking/i.test(text)
          ? "Checking your Apple purchases…"
          : "Opening Apple’s secure purchase sheet…",
        "working"
      );
      return;
    }

    if (type === "pending") {
      showStatus("Purchase pending with Apple. Gillie will unlock when approved.", "pending");
      return;
    }

    if (type === "error") {
      showStatus(text || "We couldn’t complete the purchase. Please try again.", "error");
      return;
    }

    if (type === "cancelled") {
      showStatus("Nothing charged. You can try again anytime.", "info", true);
      resettingLegal = true;
      setTimeout(() => {
        legal.textContent = "Subscriptions renew through Apple until cancelled.";
        resettingLegal = false;
      }, 80);
      return;
    }

    clearStatus();
  }

  function installLegalObserver() {
    const legal = $("#plus-legal");
    if (!legal || legalObserver) return;
    legalObserver = new MutationObserver(handleLegalChange);
    legalObserver.observe(legal, { childList: true, characterData: true, subtree: true });
  }

  function handleHealthChange() {
    const health = $("#gp-store-health");
    if (!health) return;
    const text = health.textContent || "";
    if (!/purchase cancelled\. nothing was charged/i.test(text)) return;
    if (Date.now() - lastCancelToastAt < 4000) return;
    lastCancelToastAt = Date.now();
    try { if (typeof toast === "function") toast("🫧", "Purchase canceled. Nothing was charged."); } catch (_) {}
    track("paywall_cancel_toast_shown");
    clearTimeout(cancelResetTimer);
    cancelResetTimer = setTimeout(() => {
      const row = $("#gp-store-health");
      if (row && /purchase cancelled\. nothing was charged/i.test(row.textContent || "")) {
        try { window.GilliePaywallRuntimeFix?.probe?.("cancel-reset"); } catch (_) {}
      }
    }, 2600);
  }

  function installHealthObserver() {
    if (healthObserver) return;
    const overlay = $("#plus-overlay");
    if (!overlay) return;
    healthObserver = new MutationObserver(handleHealthChange);
    healthObserver.observe(overlay, { childList: true, subtree: true, characterData: true });
  }

  function installPlanObserver() {
    const plans = $("#plus-plans");
    if (!plans || planObserver) return;
    planObserver = new MutationObserver(() => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(decoratePlans, 20);
    });
    planObserver.observe(plans, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  function scheduleTune() {
    [0, 80, 220].forEach((delay) => setTimeout(applyPresentation, delay));
  }

  function rememberOpener() {
    const active = document.activeElement;
    if (active && active !== document.body && typeof active.focus === "function") {
      openerElement = active;
    }
  }

  function restoreOpenerFocus() {
    const opener = openerElement;
    openerElement = null;
    if (!opener || !opener.isConnected) return;
    try { opener.focus({ preventScroll: true }); } catch (_) {}
  }

  function installOverlayObserver() {
    const overlay = $("#plus-overlay");
    if (!overlay || overlayObserver) return;

    overlayObserver = new MutationObserver(() => {
      if (!overlay.hidden) {
        clearStatus();
        scheduleTune();
      } else {
        overlay.dataset.gpViewTracked = "0";
        clearStatus();
        restoreOpenerFocus();
      }
    });

    overlayObserver.observe(overlay, { attributes: true, attributeFilter: ["hidden"] });
  }

  function install() {
    if (!buildPaywallStructure()) return false;
    installOverlayObserver();

    document.addEventListener("click", (event) => {
      const target = event.target.closest("button, [role='button']");
      if (!target) return;

      if (target.matches("#plus-open, #set-plus, [data-act='plus'], #ship-premium-teaser")) {
        rememberOpener();
        scheduleTune();
      }

      if (target.matches("[data-plus-plan]")) {
        selectionHaptic();
        // Re-run the full presentation: trial framing is per product, so the
        // headline, timeline, and dock must all follow the selected plan.
        setTimeout(applyPresentation, 20);
      }

      if (target.matches("#plus-purchase")) {
        clearStatus();
        track("paywall_cta_tapped", {
          plan: selectedPlanKey(),
          trialEligible: deriveTrialState(pricingDetails(), selectedPlanKey()).eligible,
        });
      }

      if (target.matches("#plus-restore")) clearStatus();
    }, true);

    document.addEventListener("gillie:store-pricing-ready", () => scheduleTune());
    document.addEventListener("gillie:entitlement-updated", () => scheduleTune());

    window.GilliePaywallPresenter = Object.freeze({
      version: VERSION,
      idleCtaLabel,
      idleRestoreLabel,
      refresh: applyPresentation,
      deriveTrialState,
      savingsPercent,
      formatCurrency,
      state: presentationState,
    });

    scheduleTune();
    track("paywall_rebuild_loaded", { version: VERSION });
    return true;
  }

  // Pure presentation logic, exposed immediately so release tests can verify
  // trial gating and savings math without a live DOM.
  window.GilliePaywallLogic = Object.freeze({
    version: VERSION,
    productIds: PRODUCT_IDS,
    deriveTrialState,
    savingsPercent,
    formatCurrency,
  });

  function wait(attempt = 0) {
    if ((window.__gillieShipPolishInstalled && $("#plus-overlay")) || attempt >= 120) {
      install();
      return;
    }
    setTimeout(() => wait(attempt + 1), 50);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => wait(), { once: true });
  } else {
    wait();
  }
})();
