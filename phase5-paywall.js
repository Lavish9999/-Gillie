/* Gillie Phase 5 — production paywall rebuild using the app's existing StoreKit wiring. */
(() => {
  "use strict";

  if (window.__gilliePaywallRebuildInstalled) return;
  window.__gilliePaywallRebuildInstalled = true;

  const VERSION = "phase5-paywall-2026.07.11";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const appState = () => (typeof state !== "undefined" && state ? state : null);
  const bridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;

  let overlayObserver = null;
  let legalObserver = null;
  let planObserver = null;
  let refreshTimer = 0;
  let resettingLegal = false;

  function track(name, properties = {}) {
    try { bridge()?.trackEvent?.({ name, properties: { phase: VERSION, ...properties } }); } catch (_) {}
  }

  function create(tag, className, html = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html) node.innerHTML = html;
    return node;
  }

  function ensureToast(sheet) {
    let toast = $("#gp-purchase-toast");
    if (!toast) {
      toast = create("div", "gp-purchase-toast");
      toast.id = "gp-purchase-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      sheet.appendChild(toast);
    }
    return toast;
  }

  function showToast(message) {
    const toast = $("#gp-purchase-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(window.__gilliePaywallToastTimer);
    window.__gilliePaywallToastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function buildPaywallStructure() {
    const overlay = $("#plus-overlay");
    const sheet = $("#plus-overlay > .sheet");
    if (!overlay || !sheet) return false;
    if (sheet.classList.contains("gp-paywall-sheet")) return true;

    const grab = $(".grab", sheet);
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

    if (![kicker, title, subtitle, close, mascot, proof, now, plans, purchase, restoreRow, legal].every(Boolean)) return false;

    sheet.className = "sheet gp-paywall-sheet";
    sheet.innerHTML = "";

    if (grab) {
      grab.className = "grab gp-grabber";
      sheet.appendChild(grab);
    }

    const hero = create("section", "gp-hero-card");
    const heroCopy = create("div", "gp-hero-copy");
    kicker.className = "plus-kicker gp-kicker";
    title.className = "gp-title";
    subtitle.className = "gp-subtitle";
    close.className = "gp-close";
    heroCopy.append(kicker, title, subtitle);

    const mascotPanel = create("div", "gp-mascot-panel");
    mascot.className = "plus-mascot-wrap gp-mascot-wrap";
    mascotPanel.appendChild(mascot);

    const context = create("div", "gp-context");
    context.id = "gp-context";
    hero.append(heroCopy, mascotPanel, close, context);
    sheet.appendChild(hero);

    if (oldHero) oldHero.remove();
    if (stats) {
      stats.id = "plus-stat-chips";
      stats.className = "plus-stat-chips gp-hidden-stats";
      stats.hidden = true;
      sheet.appendChild(stats);
    }

    const value = create("section", "gp-value-section");
    value.innerHTML = `<div class="gp-section-label">What Plus does for you</div>`;
    proof.className = "plus-proof gp-benefit-list";
    value.appendChild(proof);
    sheet.appendChild(value);

    now.className = "plus-now gp-personal-note";
    sheet.appendChild(now);

    const pricing = create("section", "gp-pricing-section");
    pricing.innerHTML = `<div class="gp-pricing-head"><span>Choose your plan</span><small>Yearly is selected</small></div>`;
    plans.className = "plus-plans gp-plan-list";
    pricing.appendChild(plans);
    sheet.appendChild(pricing);

    const ctaWrap = create("div", "gp-cta-wrap");
    purchase.className = "btn plus-cta gp-primary-cta";
    ctaWrap.appendChild(purchase);
    ctaWrap.appendChild(create("div", "gp-cta-caption", "Billed securely by Apple. Cancel anytime."));
    sheet.appendChild(ctaWrap);

    const reassurance = freeNote || create("div", "phase2-plus-free-note");
    reassurance.id = "phase2-plus-free-note";
    reassurance.className = "phase2-plus-free-note gp-free-note";
    reassurance.innerHTML = `<b>Core quitting tools stay free.</b><span>SOS, streaks, check-ins, and your tank are never taken away.</span>`;
    sheet.appendChild(reassurance);

    const footer = create("footer", "gp-footer");
    restoreRow.className = "plus-restore-row gp-restore-row";
    footer.appendChild(restoreRow);
    const links = create("div", "gp-legal-links", `<a href="./terms.html">Terms</a><span>·</span><a href="./privacy.html">Privacy</a>`);
    footer.appendChild(links);
    legal.className = "plus-legal gp-legal-status";
    footer.appendChild(legal);
    sheet.appendChild(footer);

    ensureToast(sheet);
    installLegalObserver();
    installPlanObserver();
    overlay.classList.add("gp-paywall-overlay");
    track("paywall_rebuilt");
    return true;
  }

  function streakLabel() {
    try {
      const days = Math.max(0, Math.floor(currentStreakMs() / 86400000));
      return days > 0 ? `Day ${days}` : "Day 0";
    } catch (_) {
      return "Starting now";
    }
  }

  function dangerLabel() {
    try { return typeof dangerWindow === "function" ? dangerWindow()?.label || null : null; } catch (_) { return null; }
  }

  function triggerLabel() {
    try { return typeof topTrigger === "function" ? topTrigger() || null : null; } catch (_) { return null; }
  }

  function enoughData(current) {
    return (current?.checkins?.length || 0) >= 3 || (current?.cravings?.length || 0) >= 1;
  }

  function updatePlanAccessibility() {
    const plans = $$("#plus-plans [data-plus-plan]");
    plans.forEach((button) => {
      const selected = button.classList.contains("on");
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(selected));
    });
    const selected = plans.find((button) => button.classList.contains("on"));
    const head = $(".gp-pricing-head small");
    if (head) head.textContent = selected?.dataset.plusPlan === "monthly" ? "Monthly is selected" : "Yearly is selected";
  }

  function cleanPlanCopy() {
    const yearly = $('[data-plus-plan="yearly"]');
    const monthly = $('[data-plus-plan="monthly"]');
    if (yearly) {
      const name = $(".name", yearly);
      const note = $(".note", yearly);
      if (name && name.dataset.gpCopy !== "yearly") {
        name.innerHTML = `Yearly <span class="badge">BEST VALUE</span>`;
        name.dataset.gpCopy = "yearly";
      }
      if (note && note.dataset.gpCopy !== "yearly") {
        note.textContent = "Save 37% · about $2.50/month";
        note.dataset.gpCopy = "yearly";
      }
    }
    if (monthly) {
      const name = $(".name", monthly);
      const note = $(".note", monthly);
      if (name && name.dataset.gpCopy !== "monthly") {
        name.textContent = "Monthly";
        name.dataset.gpCopy = "monthly";
      }
      if (note && note.dataset.gpCopy !== "monthly") {
        note.textContent = "Flexible access · cancel anytime";
        note.dataset.gpCopy = "monthly";
      }
    }
    updatePlanAccessibility();
  }

  function tunePaywallContent() {
    const overlay = $("#plus-overlay");
    if (!overlay || overlay.hidden || !buildPaywallStructure()) return;

    const current = appState() || {};
    const danger = dangerLabel();
    const trigger = triggerLabel();
    const hasData = enoughData(current);

    $("#plus-kicker").textContent = "GILLIE PLUS";
    $("#plus-title").textContent = "A quit plan that adapts to you";
    $("#plus-subtitle").textContent = "Get one useful move each day, spot risky hours, and recover without losing momentum.";

    const context = $("#gp-context");
    if (context) {
      const status = danger ? `Watching ${danger}` : hasData ? "Building your pattern" : "Learning your routine";
      context.innerHTML = `<span>${streakLabel()}</span><i></i><span>${status}</span>`;
    }

    const proof = $("#plus-proof");
    if (proof) {
      proof.innerHTML = `
        <div><span class="gp-benefit-icon">◔</span><span><b>See risky hours</b><em>Know when cravings usually get louder.</em></span></div>
        <div><span class="gp-benefit-icon">→</span><span><b>Get one daily move</b><em>A practical action based on your latest signals.</em></span></div>
        <div><span class="gp-benefit-icon">↺</span><span><b>Recover with a plan</b><em>Turn a slip into the next clear step.</em></span></div>`;
    }

    const note = $("#plus-now");
    if (note) {
      let message = "Starts immediately with a simple daily plan, then becomes more personal after your next few check-ins.";
      if (danger) message = `Your current pattern points to ${danger}. Plus prepares a move before that window starts.`;
      else if (trigger) message = `${trigger} appears in your recent signals. Plus turns that trigger into a repeatable plan.`;
      note.innerHTML = `<div><strong>${hasData ? "Built from your signals" : "Starts today"}</strong><span>${message}</span></div>`;
    }

    cleanPlanCopy();
    const purchase = $("#plus-purchase");
    if (purchase && !purchase.classList.contains("phase2-loading")) purchase.textContent = "Start Gillie Plus";

    const legal = $("#plus-legal");
    if (legal && !statusType(legal.textContent)) {
      legal.textContent = "Subscriptions renew through Apple until cancelled.";
      legal.dataset.defaultCopy = "1";
    }

    if (overlay.dataset.gpViewTracked !== "1") {
      overlay.dataset.gpViewTracked = "1";
      track("paywall_viewed", { personalized: hasData, danger: Boolean(danger), trigger: Boolean(trigger) });
    }
  }

  function statusType(text) {
    const value = String(text || "").toLowerCase();
    if (/cancelled|canceled/.test(value)) return "cancelled";
    if (/pending|approves/.test(value)) return "pending";
    if (/opening|checking/.test(value)) return "working";
    if (/failed|could not|not available|not found|without an active|try again|error/.test(value)) return "error";
    return "";
  }

  function handleLegalChange() {
    if (resettingLegal) return;
    const legal = $("#plus-legal");
    if (!legal) return;
    const text = legal.textContent.trim();
    const type = statusType(text);
    legal.classList.toggle("show", type === "pending" || type === "error");
    legal.classList.toggle("working", type === "working");

    if (type === "cancelled") {
      showToast("Purchase cancelled. Nothing was charged.");
      resettingLegal = true;
      setTimeout(() => {
        legal.textContent = "Subscriptions renew through Apple until cancelled.";
        legal.classList.remove("show", "working");
        resettingLegal = false;
      }, 80);
    }
  }

  function installLegalObserver() {
    const legal = $("#plus-legal");
    if (!legal || legalObserver) return;
    legalObserver = new MutationObserver(handleLegalChange);
    legalObserver.observe(legal, { childList: true, characterData: true, subtree: true });
  }

  function installPlanObserver() {
    const plans = $("#plus-plans");
    if (!plans || planObserver) return;
    planObserver = new MutationObserver(() => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(cleanPlanCopy, 20);
    });
    planObserver.observe(plans, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  function scheduleTune() {
    [0, 80, 220].forEach((delay) => setTimeout(tunePaywallContent, delay));
  }

  function installOverlayObserver() {
    const overlay = $("#plus-overlay");
    if (!overlay || overlayObserver) return;
    overlayObserver = new MutationObserver(() => {
      if (!overlay.hidden) scheduleTune();
      else overlay.dataset.gpViewTracked = "0";
    });
    overlayObserver.observe(overlay, { attributes: true, attributeFilter: ["hidden"] });
  }

  function install() {
    if (!buildPaywallStructure()) return false;
    installOverlayObserver();
    document.addEventListener("click", (event) => {
      const target = event.target.closest("button, [role='button']");
      if (!target) return;
      if (target.matches("#plus-open, #set-plus, [data-act='plus'], #ship-premium-teaser")) scheduleTune();
      if (target.matches("[data-plus-plan]")) setTimeout(updatePlanAccessibility, 20);
      if (target.matches("#plus-purchase")) track("paywall_cta_tapped", { plan: typeof selectedPlusPlan !== "undefined" ? selectedPlusPlan : "unknown" });
    }, true);
    scheduleTune();
    track("paywall_rebuild_loaded", { version: VERSION });
    return true;
  }

  function wait(attempt = 0) {
    if ((window.__gillieShipPolishInstalled && $("#plus-overlay")) || attempt >= 120) {
      install();
      return;
    }
    setTimeout(() => wait(attempt + 1), 50);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => wait(), { once: true });
  else wait();
})();
