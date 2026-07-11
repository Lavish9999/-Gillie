/* Gillie Phase 5 — full-screen production paywall using the app's existing StoreKit wiring. */
(() => {
  "use strict";

  if (window.__gilliePaywallRebuildInstalled) return;
  window.__gilliePaywallRebuildInstalled = true;

  const VERSION = "phase5-paywall-2026.07.11-redesign";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const appState = () => (typeof state !== "undefined" && state ? state : null);
  const bridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;

  let overlayObserver = null;
  let legalObserver = null;
  let planObserver = null;
  let refreshTimer = 0;
  let statusTimer = 0;
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

  function benefitSvg(kind) {
    const common = 'class="gp-benefit-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
    if (kind === "clock") {
      return `<svg ${common}><circle cx="12" cy="12" r="8.25"></circle><path d="M12 7.5v5l3.35 1.9"></path><path d="M6.7 4.9 5.25 3.45M17.3 4.9l1.45-1.45"></path></svg>`;
    }
    if (kind === "move") {
      return `<svg ${common}><path d="M5 12h12.5"></path><path d="m13.5 7.5 4.5 4.5-4.5 4.5"></path><path d="M5.5 7.25h3M5.5 16.75h3"></path></svg>`;
    }
    return `<svg ${common}><path d="M7.1 8.1A6.8 6.8 0 1 1 6 15.3"></path><path d="M7.1 3.9v4.2H2.9"></path><path d="m9.15 12 1.9 1.9 4-4.15"></path></svg>`;
  }

  function installDragGuard(sheet) {
    if (!sheet || sheet.dataset.gpDragGuard === "1") return;
    const blockLegacyDrag = (event) => {
      if (event.target.closest("button,input,textarea,select,a,label")) return;
      if (event.target.closest(".gp-hero-card,.gp-paywall-scroll")) event.stopImmediatePropagation();
    };
    sheet.addEventListener("pointerdown", blockLegacyDrag, true);
    sheet.addEventListener("touchstart", blockLegacyDrag, { capture: true, passive: true });
    sheet.dataset.gpDragGuard = "1";
  }

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

    if (![kicker, title, subtitle, close, mascot, stats, proof, now, plans, purchase, restoreRow, legal].every(Boolean)) return false;

    sheet.className = "sheet gp-paywall-sheet";
    sheet.innerHTML = "";

    const scroll = create("div", "gp-paywall-scroll");
    scroll.id = "gp-paywall-scroll";

    const hero = create("section", "gp-hero-card");
    hero.setAttribute("aria-labelledby", "plus-title");
    hero.innerHTML = `
      <div class="gp-hero-glow gp-hero-glow-one"></div>
      <div class="gp-hero-glow gp-hero-glow-two"></div>
      <div class="gp-hero-bubbles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>`;

    const heroCopy = create("div", "gp-hero-copy");
    kicker.className = "plus-kicker gp-kicker";
    title.className = "gp-title";
    subtitle.className = "gp-subtitle";
    heroCopy.append(kicker, title, subtitle);

    const mascotPanel = create("div", "gp-mascot-panel");
    mascot.className = "plus-mascot-wrap gp-mascot-wrap";
    const mascotHalo = create("div", "gp-mascot-halo");
    mascotPanel.append(mascotHalo, mascot);

    close.className = "gp-close";
    hero.append(heroCopy, mascotPanel, close);
    scroll.appendChild(hero);

    const value = create("section", "gp-value-section");
    value.innerHTML = `<div class="gp-section-label">Built for the hard moments</div>`;
    proof.className = "plus-proof gp-benefit-list";
    value.appendChild(proof);
    scroll.appendChild(value);

    now.className = "plus-now gp-adaptive-note";
    scroll.appendChild(now);

    const pricing = create("section", "gp-pricing-section");
    pricing.innerHTML = `<div class="gp-pricing-head"><span>Choose your plan</span><small>Yearly selected</small></div>`;
    plans.className = "plus-plans gp-plan-list";
    plans.setAttribute("role", "radiogroup");
    plans.setAttribute("aria-label", "Gillie Plus plan");
    pricing.appendChild(plans);
    scroll.appendChild(pricing);

    const reassurance = freeNote || create("div", "phase2-plus-free-note");
    reassurance.id = "phase2-plus-free-note";
    reassurance.className = "phase2-plus-free-note gp-free-note";
    reassurance.innerHTML = `
      <span class="gp-free-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 3.5 19 6v5.1c0 4.35-2.75 7.65-7 9.4-4.25-1.75-7-5.05-7-9.4V6l7-2.5Z"></path><path d="m8.8 12.1 2 2 4.4-4.5"></path></svg>
      </span>
      <span><b>Core quitting tools stay free</b><em>SOS, streaks, check-ins, and your tank are never taken away.</em></span>`;
    scroll.appendChild(reassurance);

    const hiddenSources = create("div", "gp-hidden-sources");
    stats.id = "plus-stat-chips";
    stats.className = "plus-stat-chips gp-hidden-stats";
    stats.hidden = true;
    hiddenSources.appendChild(stats);
    scroll.appendChild(hiddenSources);

    const dock = create("div", "gp-purchase-dock");
    dock.id = "gp-purchase-dock";

    const status = create("div", "gp-status-banner");
    status.id = "gp-status-banner";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.hidden = true;

    purchase.className = "btn plus-cta gp-primary-cta";
    const caption = create("div", "gp-cta-caption", "Billed securely by Apple. Cancel anytime.");

    const footer = create("footer", "gp-footer");
    restoreRow.className = "plus-restore-row gp-restore-row";
    const links = create("div", "gp-legal-links", `<a href="./terms.html">Terms</a><span>·</span><a href="./privacy.html">Privacy</a>`);
    legal.className = "plus-legal gp-legal-source";
    legal.setAttribute("aria-hidden", "true");
    footer.append(restoreRow, links, legal);

    dock.append(status, purchase, caption, footer);
    sheet.append(scroll, dock);

    if (oldHero) oldHero.remove();
    overlay.classList.add("gp-paywall-overlay");
    installDragGuard(sheet);
    installLegalObserver();
    installPlanObserver();
    track("paywall_rebuilt", { layout: "full_screen_dock" });
    return true;
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
    if (head) head.textContent = selected?.dataset.plusPlan === "monthly" ? "Monthly selected" : "Yearly selected";
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
    $("#plus-subtitle").textContent = "Know what to do before a craving gets loud — and how to recover without losing momentum.";

    const proof = $("#plus-proof");
    if (proof) {
      proof.innerHTML = `
        <div><span class="gp-benefit-icon">${benefitSvg("clock")}</span><span><b>Spot risky hours</b><em>Know when cravings are most likely to hit.</em></span></div>
        <div><span class="gp-benefit-icon">${benefitSvg("move")}</span><span><b>Get one useful move each day</b><em>A practical action based on your latest signals.</em></span></div>
        <div><span class="gp-benefit-icon">${benefitSvg("recover")}</span><span><b>Recover with a plan</b><em>Turn a slip into the next clear step.</em></span></div>`;
    }

    const note = $("#plus-now");
    if (note) {
      let label = "Useful from day one";
      let message = "Your first plan starts immediately and gets more personal with every check-in.";
      if (danger) {
        label = "Built around your pattern";
        message = `Gillie is watching ${danger} and can prepare your move before that window starts.`;
      } else if (trigger) {
        label = "Built around your signals";
        message = `${trigger} appears in your recent history. Plus turns that trigger into a repeatable response.`;
      } else if (hasData) {
        label = "Your pattern is forming";
        message = "Gillie is already using your latest check-ins to make tomorrow’s plan more specific.";
      }
      note.innerHTML = `<span class="gp-note-spark" aria-hidden="true">✦</span><span><strong>${label}</strong><em>${message}</em></span>`;
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
    if (temporary) statusTimer = setTimeout(clearStatus, 2800);
  }

  function handleLegalChange() {
    if (resettingLegal) return;
    const legal = $("#plus-legal");
    if (!legal) return;
    const text = legal.textContent.trim();
    const type = statusType(text);

    if (type === "working") {
      showStatus(/checking/i.test(text) ? "Checking your Apple purchases…" : "Opening Apple’s secure purchase sheet…", "working");
      return;
    }
    if (type === "pending") {
      showStatus("Your purchase is pending with Apple. Gillie will unlock as soon as it is approved.", "pending");
      return;
    }
    if (type === "error") {
      showStatus(text || "We couldn’t complete the purchase. Please try again.", "error");
      return;
    }
    if (type === "cancelled") {
      showStatus("Purchase cancelled — nothing was charged.", "info", true);
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

  function installPlanObserver() {
    const plans = $("#plus-plans");
    if (!plans || planObserver) return;
    planObserver = new MutationObserver(() => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(cleanPlanCopy, 20);
    });
    planObserver.observe(plans, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  function purchaseSuccess() {
    const current = appState();
    if (!current?.premium) return;
    clearStatus();
    const tank = $("#tank");
    try { if (tank && typeof celebrationBurst === "function") celebrationBurst(tank, "plus"); } catch (_) {}
    try { if (typeof feedGillie === "function") feedGillie(); } catch (_) {}
    try { if (typeof haptic === "function") haptic("success"); } catch (_) {}
    try { if (typeof tone === "function") tone("success"); } catch (_) {}
    try { if (typeof announce === "function") announce("Gillie Plus is active."); } catch (_) {}
  }

  function scheduleTune() {
    [0, 80, 220].forEach((delay) => setTimeout(tunePaywallContent, delay));
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
      if (target.matches("#plus-open, #set-plus, [data-act='plus'], #ship-premium-teaser")) scheduleTune();
      if (target.matches("[data-plus-plan]")) setTimeout(updatePlanAccessibility, 20);
      if (target.matches("#plus-purchase")) {
        clearStatus();
        track("paywall_cta_tapped", { plan: typeof selectedPlusPlan !== "undefined" ? selectedPlusPlan : "unknown" });
      }
      if (target.matches("#plus-restore")) clearStatus();
    }, true);

    const legal = $("#plus-legal");
    if (legal) new MutationObserver(() => {
      const text = legal.textContent.toLowerCase();
      if (/active|restored|unlocked/.test(text)) purchaseSuccess();
    }).observe(legal, { childList: true, characterData: true, subtree: true });

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
