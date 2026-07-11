/* Gillie Phase 5 — immersive premium paywall using the existing StoreKit wiring. */
(() => {
  "use strict";

  if (window.__gilliePaywallRebuildInstalled) return;
  window.__gilliePaywallRebuildInstalled = true;

  const VERSION = "phase5-paywall-2026.07.11-premium-v4";
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
      return `<svg ${common}><circle cx="12" cy="12" r="8.25"></circle><path d="M12 7.75v4.5l3.1 1.8"></path></svg>`;
    }
    if (kind === "move") {
      return `<svg ${common}><path d="M4.75 12h13.5"></path><path d="m13.75 7.5 4.5 4.5-4.5 4.5"></path></svg>`;
    }
    return `<svg ${common}><path d="M7.1 8.1A6.8 6.8 0 1 1 6 15.3"></path><path d="M7.1 3.9v4.2H2.9"></path><path d="m9.15 12 1.9 1.9 4-4.15"></path></svg>`;
  }

  function shieldSvg() {
    return `<svg class="gp-free-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 19 6v5.1c0 4.35-2.75 7.65-7 9.4-4.25-1.75-7-5.05-7-9.4V6l7-2.5Z"></path><path d="m8.8 12.1 2 2 4.4-4.5"></path></svg>`;
  }

  function installDragGuard(sheet) {
    if (!sheet || sheet.dataset.gpDragGuard === "1") return;
    const blockLegacyDrag = (event) => {
      if (event.target.closest("button,input,textarea,select,a,label")) return;
      if (event.target.closest(".gp-hero-card,.gp-paywall-scroll,.gp-purchase-dock")) {
        event.stopImmediatePropagation();
      }
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

    if (![kicker, title, subtitle, close, mascot, stats, proof, now, plans, purchase, restoreRow, legal].every(Boolean)) {
      return false;
    }

    sheet.className = "sheet gp-paywall-sheet";
    sheet.innerHTML = "";

    const ambient = create("div", "gp-ambient", `
      <span class="gp-light-beam gp-light-beam-one" aria-hidden="true"></span>
      <span class="gp-light-beam gp-light-beam-two" aria-hidden="true"></span>
      <span class="gp-bubble gp-bubble-one" aria-hidden="true"></span>
      <span class="gp-bubble gp-bubble-two" aria-hidden="true"></span>
      <span class="gp-bubble gp-bubble-three" aria-hidden="true"></span>`);
    sheet.appendChild(ambient);

    close.className = "gp-close";
    sheet.appendChild(close);

    const status = create("div", "gp-status-banner");
    status.id = "gp-status-banner";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.hidden = true;
    sheet.appendChild(status);

    const scroll = create("div", "gp-paywall-scroll");
    scroll.id = "gp-paywall-scroll";

    const hero = create("header", "gp-hero-card");
    hero.setAttribute("aria-labelledby", "plus-title");

    const heroCopy = create("div", "gp-hero-copy");
    kicker.className = "plus-kicker gp-kicker";
    title.className = "gp-title";
    subtitle.className = "gp-subtitle";
    heroCopy.append(kicker, title, subtitle);

    const mascotPanel = create("div", "gp-mascot-panel");
    mascotPanel.innerHTML = `
      <span class="gp-mascot-ring gp-mascot-ring-one" aria-hidden="true"></span>
      <span class="gp-mascot-ring gp-mascot-ring-two" aria-hidden="true"></span>`;
    mascot.className = "plus-mascot-wrap gp-mascot-wrap";
    mascotPanel.appendChild(mascot);

    hero.append(heroCopy, mascotPanel);
    scroll.appendChild(hero);

    const panel = create("main", "gp-purchase-panel");

    const value = create("section", "gp-value-section");
    value.innerHTML = `
      <div class="gp-panel-intro">
        <span>Gillie learns your pattern</span>
        <strong>Support that gets smarter as you use it.</strong>
      </div>`;
    proof.className = "plus-proof gp-benefit-list";
    value.appendChild(proof);
    panel.appendChild(value);

    now.className = "plus-now gp-adaptive-note";
    panel.appendChild(now);

    const pricing = create("section", "gp-pricing-section");
    pricing.innerHTML = `
      <div class="gp-pricing-head">
        <span>Choose your plan</span>
        <small class="gp-sr-only" aria-live="polite"></small>
      </div>`;
    plans.className = "plus-plans gp-plan-list";
    plans.setAttribute("role", "radiogroup");
    plans.setAttribute("aria-label", "Gillie Plus plan");
    pricing.appendChild(plans);
    panel.appendChild(pricing);

    const action = create("section", "gp-purchase-dock");
    action.id = "gp-purchase-dock";
    purchase.className = "btn plus-cta gp-primary-cta";
    const caption = create("div", "gp-cta-caption", "Secure Apple billing · Cancel anytime");
    action.append(purchase, caption);
    panel.appendChild(action);

    const reassurance = freeNote || create("div", "phase2-plus-free-note");
    reassurance.id = "phase2-plus-free-note";
    reassurance.className = "phase2-plus-free-note gp-free-note";
    reassurance.innerHTML = `
      <span class="gp-free-icon">${shieldSvg()}</span>
      <span><b>Your quitting essentials stay free</b><em>SOS, streaks, check-ins, and your tank are never locked away.</em></span>`;
    panel.appendChild(reassurance);

    const footer = create("footer", "gp-footer");
    restoreRow.className = "plus-restore-row gp-restore-row";
    const links = create("div", "gp-legal-links", `
      <a href="./terms.html">Terms</a>
      <span aria-hidden="true">·</span>
      <a href="./privacy.html">Privacy</a>`);
    legal.className = "plus-legal gp-legal-source";
    legal.setAttribute("aria-hidden", "true");
    footer.append(restoreRow, links, legal);
    panel.appendChild(footer);

    const hiddenSources = create("div", "gp-hidden-sources");
    stats.id = "plus-stat-chips";
    stats.className = "plus-stat-chips gp-hidden-stats";
    stats.hidden = true;
    hiddenSources.appendChild(stats);
    panel.appendChild(hiddenSources);

    scroll.appendChild(panel);
    sheet.appendChild(scroll);

    if (oldHero) oldHero.remove();

    overlay.classList.add("gp-paywall-overlay");
    installDragGuard(sheet);
    installLegalObserver();
    installPlanObserver();
    track("paywall_rebuilt", { layout: "immersive_panel_v4" });
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
    if (head) {
      const label = selected?.dataset.plusPlan === "monthly" ? "Monthly selected" : "Yearly selected";
      if (head.textContent !== label) head.textContent = label;
    }
  }

  function cleanPlanCopy() {
    const yearly = $('[data-plus-plan="yearly"]');
    const monthly = $('[data-plus-plan="monthly"]');

    if (yearly) {
      const name = $(".name", yearly);
      const note = $(".note", yearly);
      const nameHtml = `Yearly <span class="badge">Save 37%</span>`;
      if (name && name.innerHTML !== nameHtml) name.innerHTML = nameHtml;
      if (note && note.textContent !== "Best value") note.textContent = "Best value";
    }

    if (monthly) {
      const name = $(".name", monthly);
      const note = $(".note", monthly);
      if (name && name.textContent !== "Monthly") name.textContent = "Monthly";
      if (note && note.textContent !== "Flexible") note.textContent = "Flexible";
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
    $("#plus-subtitle").textContent = "Know the hard moment before it arrives — and what to do next.";

    const proof = $("#plus-proof");
    if (proof) {
      proof.innerHTML = `
        <div>
          <span class="gp-benefit-icon">${benefitSvg("clock")}</span>
          <span><b>See your risk windows</b><em>Know when cravings are most likely to hit.</em></span>
        </div>
        <div>
          <span class="gp-benefit-icon">${benefitSvg("move")}</span>
          <span><b>Get one clear next move</b><em>A practical action shaped by your check-ins.</em></span>
        </div>
        <div>
          <span class="gp-benefit-icon">${benefitSvg("recover")}</span>
          <span><b>Recover without the spiral</b><em>Turn a slip into a calm, specific reset.</em></span>
        </div>`;
    }

    const note = $("#plus-now");
    if (note) {
      let label = "Starts useful today";
      let message = "Your first plan is ready immediately and sharpens with every check-in.";

      if (danger) {
        label = "Built around your pattern";
        message = `Gillie is already watching ${danger} and can prepare your move before it begins.`;
      } else if (trigger) {
        label = "Built around your signals";
        message = `${trigger} appears in your recent history. Plus turns it into a repeatable response.`;
      } else if (hasData) {
        label = "Your pattern is forming";
        message = "Gillie is already using your latest check-ins to make tomorrow more specific.";
      }

      note.innerHTML = `
        <span class="gp-note-mark" aria-hidden="true">✦</span>
        <span><strong>${label}</strong><em>${message}</em></span>`;
    }

    cleanPlanCopy();

    const purchase = $("#plus-purchase");
    if (purchase && !purchase.classList.contains("phase2-loading")) {
      purchase.textContent = "Start Gillie Plus";
    }

    const legal = $("#plus-legal");
    if (legal && !statusType(legal.textContent)) {
      legal.textContent = "Subscriptions renew through Apple until cancelled.";
      legal.dataset.defaultCopy = "1";
    }

    if (overlay.dataset.gpViewTracked !== "1") {
      overlay.dataset.gpViewTracked = "1";
      track("paywall_viewed", {
        personalized: hasData,
        danger: Boolean(danger),
        trigger: Boolean(trigger)
      });
    }
  }

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

  function installPlanObserver() {
    const plans = $("#plus-plans");
    if (!plans || planObserver) return;
    planObserver = new MutationObserver(() => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(cleanPlanCopy, 20);
    });
    planObserver.observe(plans, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
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

      if (target.matches("#plus-open, #set-plus, [data-act='plus'], #ship-premium-teaser")) {
        scheduleTune();
      }

      if (target.matches("[data-plus-plan]")) {
        setTimeout(updatePlanAccessibility, 20);
      }

      if (target.matches("#plus-purchase")) {
        clearStatus();
        track("paywall_cta_tapped", {
          plan: typeof selectedPlusPlan !== "undefined" ? selectedPlusPlan : "unknown"
        });
      }

      if (target.matches("#plus-restore")) clearStatus();
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => wait(), { once: true });
  } else {
    wait();
  }
})();
