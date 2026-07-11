/* Gillie Phase 3 — ship-quality revenue and retention polish. */
(() => {
  "use strict";

  const VERSION = "phase3-2026.07.11";
  const STARTER_GRANT_KEY = "gillie_ship_starter_pearls_v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const appState = () => (typeof state !== "undefined" && state ? state : null);
  const nativeBridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;
  const localDayKey = (time = Date.now()) => {
    const date = new Date(time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  let refreshQueued = false;
  let observer = null;

  function track(name, properties = {}) {
    try { nativeBridge()?.trackEvent?.({ name, properties: { phase: VERSION, ...properties } }); } catch (_) {}
  }

  function saveAndRender() {
    try { if (typeof save === "function") save(); } catch (_) {}
    try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
  }

  function showOverlay(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.hidden = false;
  }

  function openCheckin(source = "unknown") {
    const trigger = document.getElementById("checkin-open");
    if (trigger) trigger.click();
    else showOverlay("checkin-overlay");
    track("activation_checkin_opened", { source });
  }

  function openSos(source = "unknown") {
    const button = document.getElementById("sos-fab");
    if (button) button.click();
    else if (typeof openSOS === "function") openSOS();
    else showOverlay("sos-overlay");
    track("activation_sos_opened", { source });
  }

  function openPlus(source = "unknown") {
    track("paywall_opened", { source });
    try {
      if (typeof window.openPlus === "function") window.openPlus();
      else if (typeof openPlus === "function") openPlus();
      else document.getElementById("plus-open")?.click();
    } catch (_) {
      showOverlay("plus-overlay");
    }
    setTimeout(tunePaywall, 20);
  }

  function grantStarterPearls() {
    const current = appState();
    if (!current?.onboarded) return;
    let alreadyGranted = false;
    try { alreadyGranted = localStorage.getItem(STARTER_GRANT_KEY) === "1"; } catch (_) {}
    if (alreadyGranted) return;

    const before = Math.max(0, Number(current.pearls) || 0);
    const target = 35;
    const amount = Math.max(0, target - before);
    if (amount > 0) current.pearls = before + amount;
    try { localStorage.setItem(STARTER_GRANT_KEY, "1"); } catch (_) {}
    saveAndRender();
    if (amount > 0) {
      setTimeout(() => {
        try { if (typeof toast === "function") toast("🫧", `Starter gift: +${amount} pearls. Your first Reef item is ready.`); } catch (_) {}
      }, 900);
      track("starter_pearls_granted", { amount, balance: current.pearls });
    }
  }

  function installStatusScrim() {
    if ($("#ship-status-scrim")) return;
    const scrim = document.createElement("div");
    scrim.id = "ship-status-scrim";
    scrim.setAttribute("aria-hidden", "true");
    document.body.appendChild(scrim);
  }

  function activeView() {
    return $("#tabs button.on")?.dataset.view || "home";
  }

  function updateActiveView() {
    const view = activeView();
    document.body.dataset.shipView = view;
    const sos = $("#sos-fab");
    if (sos) {
      sos.setAttribute("aria-label", "Open Craving SOS");
      sos.title = "Craving SOS";
    }
  }

  function dangerWindowLabel() {
    try {
      if (typeof dangerWindow === "function") return dangerWindow()?.label || null;
    } catch (_) {}
    return null;
  }

  function hasCheckedInToday(current) {
    return (current?.checkins || []).some((entry) => entry?.date === localDayKey());
  }

  function buildQuickCheckin() {
    const current = appState();
    const flow = $("#ship-home-flow");
    if (!current || !flow) return;

    let card = $("#ship-quick-checkin");
    if (!card) {
      card = document.createElement("section");
      card.id = "ship-quick-checkin";
      card.className = "ship-quick-checkin";
      flow.prepend(card);
    }

    const complete = hasCheckedInToday(current);
    card.innerHTML = complete
      ? `<div><small>Today</small><b>Check-in complete</b><span>Gillie has today’s signal.</span></div><button type="button" data-ship-action="progress">View progress</button>`
      : `<div><small>Quick check-in</small><b>How are you right now?</b><span>One answer makes tomorrow more useful.</span></div><div class="ship-checkin-actions"><button type="button" data-ship-action="checkin">I’m okay</button><button type="button" data-ship-action="sos">Craving</button></div>`;

    card.querySelector('[data-ship-action="checkin"]')?.addEventListener("click", () => openCheckin("home_quick_checkin"));
    card.querySelector('[data-ship-action="sos"]')?.addEventListener("click", () => openSos("home_quick_checkin"));
    card.querySelector('[data-ship-action="progress"]')?.addEventListener("click", () => $("#tabs button[data-view='progress']")?.click());
  }

  function milestoneText() {
    const source = $("#next-milestone");
    if (!source) return "Your next recovery milestone is already counting down.";
    const text = source.textContent.replace(/\s+/g, " ").trim();
    return text.replace(/^NEXT MILESTONE\s*/i, "").slice(0, 150) || "Your next recovery milestone is already counting down.";
  }

  function combineGrowthAndMilestone() {
    const growth = $("#growth-card");
    if (!growth) return;
    growth.classList.add("ship-growth-card");

    let line = $(".ship-milestone-line", growth);
    if (!line) {
      line = document.createElement("button");
      line.type = "button";
      line.className = "ship-milestone-line";
      growth.appendChild(line);
      line.addEventListener("click", () => {
        $("#tabs button[data-view='progress']")?.click();
        setTimeout(() => $("#ship-recovery-details")?.setAttribute("open", ""), 100);
      });
    }
    const nextText = milestoneText();
    if (line.dataset.copy !== nextText) {
      line.dataset.copy = nextText;
      line.innerHTML = `<span>Next recovery milestone</span><b>${nextText}</b><i>›</i>`;
    }
  }

  function buildPremiumTeaser() {
    const current = appState();
    const flow = $("#ship-home-flow");
    if (!current || !flow) return;

    let teaser = $("#ship-premium-teaser");
    if (!teaser) {
      teaser = document.createElement("button");
      teaser.id = "ship-premium-teaser";
      teaser.type = "button";
      teaser.className = "ship-premium-teaser";
      flow.appendChild(teaser);
    }

    if (current.premium) {
      teaser.innerHTML = `<span class="ship-teaser-icon">✓</span><span><small>Gillie Plus</small><b>Open today’s personal plan</b><em>Use your latest check-ins and triggers.</em></span><i>›</i>`;
      teaser.onclick = () => {
        try { if (typeof openTodayPlan === "function") openTodayPlan(); else showOverlay("today-plan-overlay"); } catch (_) { showOverlay("today-plan-overlay"); }
        track("plus_plan_opened", { source: "home" });
      };
      return;
    }

    const checkins = current.checkins?.length || 0;
    const danger = dangerWindowLabel();
    const title = danger ? `Protect ${danger} before it hits` : checkins >= 3 ? "Turn your check-ins into a risk plan" : "Build a plan around your risky moments";
    const copy = danger ? "Plus turns the pattern into one practical move." : "Daily moves, risk alerts and slip recovery.";
    teaser.innerHTML = `<span class="ship-teaser-icon">✦</span><span><small>Gillie Plus</small><b>${title}</b><em>${copy}</em></span><i>›</i>`;
    teaser.onclick = () => openPlus("home_personal_teaser");
  }

  function buildHome() {
    const view = $("#view-home");
    const primary = $("#phase2-primary-action");
    if (!view || !primary) return;

    let flow = $("#ship-home-flow");
    if (!flow) {
      flow = document.createElement("section");
      flow.id = "ship-home-flow";
      flow.className = "ship-home-flow";
      primary.insertAdjacentElement("afterend", flow);
    }

    const growth = $("#growth-card");
    if (growth && growth.parentElement !== flow) flow.appendChild(growth);

    ["phase2-home-focus", "phase2-home-secondary", "plan-preview", "goal-card", "coach-card", "checkin-card", "next-milestone"].forEach((id) => {
      const element = document.getElementById(id);
      if (element && element !== growth) element.classList.add("ship-hidden-home-card");
    });

    buildQuickCheckin();
    combineGrowthAndMilestone();
    buildPremiumTeaser();
  }

  function sectionHeading(view, text) {
    return $$(".section-h", view).find((node) => node.textContent.trim().toLowerCase() === text.toLowerCase()) || null;
  }

  function hideSection(view, title, contentSelector, hidden) {
    const heading = sectionHeading(view, title);
    const content = contentSelector ? $(contentSelector, view) : heading?.nextElementSibling;
    if (heading) heading.hidden = hidden;
    if (content) content.hidden = hidden;
  }

  function buildRecoveryDisclosure(view) {
    const list = $("#ms-list", view);
    if (!list) return;
    let details = $("#ship-recovery-details", view);
    if (!details) {
      details = document.createElement("details");
      details.id = "ship-recovery-details";
      details.className = "ship-recovery-details";
      details.innerHTML = `<summary><span><small>Recovery guide</small><b>View the healing timeline</b></span><i>⌄</i></summary><div class="ship-recovery-content"></div>`;
      const anchor = $("#phase2-progress-dashboard", view) || $("#ship-progress-activation", view) || $(".stat-row", view);
      anchor?.insertAdjacentElement("afterend", details);
      details.addEventListener("toggle", () => track("recovery_timeline_toggled", { open: details.open }));
    }
    const content = $(".ship-recovery-content", details);
    if (list.parentElement !== content) content.appendChild(list);
    const note = $("#timeline-note", view);
    if (note && note.parentElement !== content) content.appendChild(note);
    const heading = sectionHeading(view, "Healing timeline");
    if (heading) heading.hidden = true;
  }

  function buildProgressActivation() {
    const view = $("#view-progress");
    const current = appState();
    if (!view || !current) return;

    const checkins = current.checkins?.length || 0;
    const sosSessions = Math.max(current.cravings?.length || 0, current.sosRewards?.length || 0);
    const ready = checkins >= 3 && sosSessions >= 1;
    let activation = $("#ship-progress-activation", view);

    if (!ready) {
      if (!activation) {
        activation = document.createElement("section");
        activation.id = "ship-progress-activation";
        activation.className = "ship-progress-activation";
        $(".stat-row", view)?.insertAdjacentElement("afterend", activation);
      }
      activation.hidden = false;
      activation.innerHTML = `
        <small>Unlock your first useful pattern</small>
        <h2>Give Gillie four real signals.</h2>
        <p>Three check-ins and one SOS session are enough to replace blank charts with something personal.</p>
        <div class="ship-activation-steps">
          <div class="${checkins >= 3 ? "done" : ""}"><span>${Math.min(3, checkins)}/3</span><b>Daily check-ins</b></div>
          <div class="${sosSessions >= 1 ? "done" : ""}"><span>${Math.min(1, sosSessions)}/1</span><b>Craving SOS</b></div>
        </div>
        <div class="ship-activation-actions">
          <button type="button" data-ship-progress="checkin">Check in now</button>
          <button type="button" data-ship-progress="sos">Start SOS</button>
        </div>`;
      activation.querySelector('[data-ship-progress="checkin"]')?.addEventListener("click", () => openCheckin("progress_activation"));
      activation.querySelector('[data-ship-progress="sos"]')?.addEventListener("click", () => openSos("progress_activation"));
      $("#phase2-progress-dashboard", view)?.setAttribute("hidden", "");
      hideSection(view, "Your insights", "#insights-box", true);
      hideSection(view, "Recent check-ins", "#checkin-log", checkins === 0);
      hideSection(view, "Craving triggers", "#trigger-chart", sosSessions === 0);
    } else {
      if (activation) activation.hidden = true;
      $("#phase2-progress-dashboard", view)?.removeAttribute("hidden");
      hideSection(view, "Your insights", "#insights-box", true);
      hideSection(view, "Recent check-ins", "#checkin-log", checkins === 0);
      hideSection(view, "Craving triggers", "#trigger-chart", sosSessions === 0);
    }

    buildRecoveryDisclosure(view);
  }

  function buildReefStarterMessage() {
    const view = $("#view-reef");
    const current = appState();
    if (!view || !current) return;
    const ownsAnything = (current.ownedItems?.length || 0) > 0;
    let message = $("#ship-reef-starter", view);
    if (ownsAnything) {
      message?.remove();
      return;
    }
    if (!message) {
      message = document.createElement("button");
      message.id = "ship-reef-starter";
      message.type = "button";
      message.className = "ship-reef-starter";
      const themesHeading = sectionHeading(view, "Tank themes");
      themesHeading?.insertAdjacentElement("beforebegin", message);
      message.onclick = () => {
        sectionHeading(view, "Decor & hats")?.scrollIntoView({ behavior: "smooth", block: "start" });
        track("reef_first_purchase_prompt_opened", { balance: current.pearls });
      };
    }
    message.innerHTML = `<span>🫧</span><span><small>Starter reward ready</small><b>You have enough pearls for your first item.</b></span><i>Shop decor ›</i>`;
  }

  function tuneReef() {
    const view = $("#view-reef");
    const current = appState();
    if (!view || !current) return;

    const banner = $("#plus-banner", view);
    if (banner && !current.premium) {
      $(".t", banner).textContent = "Personal quit planning";
      $(".s", banner).textContent = "Risk alerts, daily moves and slip recovery built from your check-ins.";
      const button = $("button", banner);
      if (button) button.textContent = "See Gillie Plus";
    }

    $$("#shop-grid .phase2-card-badge", view).forEach((badge) => badge.remove());
    buildReefStarterMessage();
  }

  function paywallHasEnoughData(current) {
    return (current?.checkins?.length || 0) >= 3 || (current?.cravings?.length || 0) >= 1;
  }

  function tunePaywall() {
    const overlay = $("#plus-overlay");
    const current = appState();
    if (!overlay || overlay.hidden || !current) return;

    const enoughData = paywallHasEnoughData(current);
    const danger = dangerWindowLabel();
    $("#plus-kicker", overlay).textContent = "YOUR PERSONAL QUIT PLAN";
    $("#plus-title", overlay).textContent = "Gillie Plus";
    $("#plus-subtitle", overlay).textContent = enoughData
      ? (danger ? `Get a practical move before ${danger}, your current risk window.` : "Turn your real check-ins and cravings into a daily protection plan.")
      : "Start with a daily plan now. Gillie personalizes it as you check in.";

    const stats = $$("#plus-stat-chips .plus-stat-chip", overlay);
    if (!enoughData && stats[2]) {
      $("b", stats[2]).textContent = "Learning";
      $("span", stats[2]).textContent = "Personal pattern";
    }

    const proof = $("#plus-proof", overlay);
    if (proof) {
      proof.innerHTML = `
        <div><b>See risky hours</b><span>Know when cravings usually get louder.</span></div>
        <div><b>Get one daily move</b><span>A practical action based on your latest signals.</span></div>
        <div><b>Recover with a plan</b><span>Turn a slip into the next clear step.</span></div>`;
    }

    const nowBox = $("#plus-now", overlay);
    if (nowBox) {
      nowBox.innerHTML = enoughData
        ? `<div><strong>What Plus does next:</strong> ${danger ? `Builds a protection move for ${danger}.` : "Turns your newest pattern into tomorrow’s plan."}</div>`
        : `<div><strong>Starts immediately:</strong> A simple daily plan today, then deeper personalization after your next few check-ins.</div>`;
    }

    const yearly = $('[data-plus-plan="yearly"]', overlay);
    const monthly = $('[data-plus-plan="monthly"]', overlay);
    if (yearly) {
      $(".note", yearly).textContent = "$2.50/month · Save 37%";
      $(".price small", yearly).textContent = "/year";
    }
    if (monthly) $(".note", monthly).textContent = "Flexible monthly access · Cancel anytime";

    const cta = $("#plus-purchase", overlay);
    if (cta) {
      cta.textContent = "Start Gillie Plus";
      cta.setAttribute("aria-label", "Start Gillie Plus subscription");
    }
    const legal = $("#plus-legal", overlay);
    if (legal && !/opening|checking|pending|cancelled|active|restored|error/i.test(legal.textContent)) {
      legal.textContent = "Core tracking, SOS, streaks, check-ins and the tank stay free. Subscriptions renew through Apple until cancelled.";
    }
    overlay.classList.add("ship-paywall");
  }

  function tuneCopy() {
    const primary = $("#phase2-primary-action");
    if (primary) {
      const detail = $("em", primary);
      const title = $("b", primary)?.textContent || "";
      if (detail && /day gets noisy/i.test(detail.textContent)) detail.textContent = "Protect the next 20 minutes with one clear move.";
      if (/See today’s clean plan/i.test(title) && detail) detail.textContent = "Protect the next 20 minutes with one clear move.";
    }

    const checkinSub = $("#checkin-overlay .sub");
    if (checkinSub) checkinSub.textContent = "A quick honest answer helps Gillie plan tomorrow.";
  }

  function installRevenueTracking() {
    if (document.body.dataset.shipRevenueTracking === "1") return;
    document.body.dataset.shipRevenueTracking = "1";
    document.addEventListener("click", (event) => {
      const target = event.target.closest("button, [role='button']");
      if (!target) return;
      if (target.matches("#plus-open, #set-plus, [data-act='plus']")) {
        const source = target.id || target.dataset.act || "unknown";
        track("paywall_opened", { source });
        setTimeout(tunePaywall, 30);
      }
      if (target.matches("#plus-purchase")) track("purchase_cta_tapped", { plan: typeof selectedPlusPlan !== "undefined" ? selectedPlusPlan : "unknown" });
      if (target.matches("[data-act='buy']")) track("reef_purchase_started", { item: target.dataset.id || "unknown" });
    }, true);
  }

  function refresh() {
    installStatusScrim();
    updateActiveView();
    buildHome();
    buildProgressActivation();
    tuneReef();
    tunePaywall();
    tuneCopy();
  }

  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      refresh();
    });
  }

  function installObserver() {
    if (observer || !$("#main")) return;
    observer = new MutationObserver(scheduleRefresh);
    observer.observe($("#main"), { childList: true, subtree: true });
  }

  function install() {
    if (window.__gillieShipPolishInstalled) return;
    window.__gillieShipPolishInstalled = true;
    document.documentElement.classList.add("ship-polish-ready");
    grantStarterPearls();
    installRevenueTracking();
    $("#tabs")?.addEventListener("click", () => setTimeout(scheduleRefresh, 20));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleRefresh(); });
    installObserver();
    refresh();
    setTimeout(refresh, 300);
    setTimeout(refresh, 1000);
    track("ship_polish_loaded", { version: VERSION });
  }

  function waitForPhase2(attempt = 0) {
    if (window.__gilliePhase2Installed || attempt >= 80) {
      install();
      return;
    }
    setTimeout(() => waitForPhase2(attempt + 1), 50);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => waitForPhase2(), { once: true });
  else waitForPhase2();
})();
