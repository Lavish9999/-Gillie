/* Gillie Phase 3 — ship-quality polish, truthful progress, fair Reef, and launch telemetry. */
(() => {
  "use strict";

  if (window.__gillieShipPolishInstalled) return;
  window.__gillieShipPolishInstalled = true;

  const VERSION = "phase3-2026.07.11";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const now = () => Date.now();
  const bridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;
  const appState = () => (typeof state !== "undefined" && state ? state : null);

  const track = (name, properties = {}) => {
    try { bridge()?.trackEvent?.({ name, properties: { phase: VERSION, ...properties } }); } catch (_) {}
  };

  function safeText(value) {
    return String(value ?? "").replace(/[<>]/g, "").trim();
  }

  function dayKey(time = now()) {
    const date = new Date(time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function localDateFromKey(key) {
    const match = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function sameLocalDay(timeA, timeB) {
    return dayKey(timeA) === dayKey(timeB);
  }

  function localDateLabel(key) {
    const date = localDateFromKey(key);
    if (!date) return safeText(key);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function currentProfile() {
    try { if (typeof profile === "function") return profile(); } catch (_) {}
    return { freeLabel: "nicotine-free", moneyLabel: "not spent", skippedLabel: "uses skipped" };
  }

  function currentStreakMs(current = appState()) {
    if (!current?.quitAt) return 0;
    return Math.max(0, now() - Number(current.quitAt || now()));
  }

  function getWeekStart() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 6);
    return date.getTime();
  }

  function dangerWindowLabel() {
    const current = appState();
    const samples = (current?.cravings || []).filter((entry) => Number(entry?.at || 0) > now() - 30 * 86400000);
    if (!samples.length) return "";
    const blocks = [
      { from: 0, to: 4, label: "12–4 AM" },
      { from: 4, to: 8, label: "4–8 AM" },
      { from: 8, to: 12, label: "8 AM–12 PM" },
      { from: 12, to: 16, label: "12–4 PM" },
      { from: 16, to: 20, label: "4–8 PM" },
      { from: 20, to: 24, label: "8 PM–12 AM" },
    ];
    const counts = blocks.map((block) => samples.filter((entry) => {
      const hour = new Date(Number(entry.at)).getHours();
      return hour >= block.from && hour < block.to;
    }).length);
    const max = Math.max(...counts);
    return max ? blocks[counts.indexOf(max)].label : "";
  }

  function grantStarterPearls() {
    const current = appState();
    if (!current || !current.onboarded || current.starterPearlsGrantedAt) return;
    const alreadyHasStarter = Number(current.pearls || 0) >= 20 || (current.ownedItems || []).length > 0;
    current.starterPearlsGrantedAt = now();
    if (!alreadyHasStarter) current.pearls = Math.max(0, Number(current.pearls || 0)) + 20;
    try { if (typeof save === "function") save(); } catch (_) {}
    if (!alreadyHasStarter) {
      try { if (typeof toast === "function") toast("🦪", "20 starter pearls · choose something for the Reef"); } catch (_) {}
      track("starter_pearls_granted", { amount: 20 });
    }
  }

  function installLocalDateCorrectness() {
    try {
      if (typeof renderCheckin !== "function" || renderCheckin.__phase3LocalDate) return;
      const original = renderCheckin;
      const wrapped = function phase3RenderCheckin(...args) {
        const result = original.apply(this, args);
        const current = appState();
        const today = dayKey();
        const entry = current?.checkins?.find((item) => item.date === today);
        const sub = $("#checkin-sub");
        if (entry && sub) sub.textContent = `Checked in today · mood ${entry.mood || "—"}/5`;
        return result;
      };
      wrapped.__phase3LocalDate = true;
      window.renderCheckin = wrapped;
    } catch (_) {}

    try {
      const saveButton = $("#checkin-save");
      if (saveButton && !saveButton.dataset.phase3LocalDate) {
        saveButton.dataset.phase3LocalDate = "1";
        saveButton.addEventListener("click", () => setTimeout(() => {
          const current = appState();
          const latest = current?.checkins?.[current.checkins.length - 1];
          if (latest && !/^\d{4}-\d{2}-\d{2}$/.test(String(latest.date || ""))) latest.date = dayKey();
        }, 0), true);
      }
    } catch (_) {}
  }

  function installProgressIntegrity() {
    const current = appState();
    const view = $("#view-progress");
    if (!current || !view) return;

    const profileData = currentProfile();
    const statMoney = $("#stat-money", view);
    const statPuffs = $("#stat-puffs", view);
    const statCravings = $("#stat-cravings", view);
    const moneyLabel = $("#stat-money-label", view);
    const puffsLabel = $("#stat-puffs-label", view);
    const duration = currentStreakMs(current);
    let money = 0;
    let skipped = 0;
    try { if (typeof costPerMs === "function") money = duration * costPerMs(); } catch (_) {}
    try { if (typeof usesPerMs === "function") skipped = duration * usesPerMs(); } catch (_) {}
    if (statMoney) statMoney.textContent = `$${money.toFixed(money >= 100 ? 0 : 2)}`;
    if (statPuffs) statPuffs.textContent = Math.floor(skipped).toLocaleString();
    if (moneyLabel) moneyLabel.textContent = profileData.moneyLabel || "not spent";
    if (puffsLabel) puffsLabel.textContent = profileData.skippedLabel || "uses skipped";

    const resolved = (current.cravings || []).filter((entry) => !entry.pending);
    const resisted = resolved.filter((entry) => entry.resisted).length;
    if (statCravings) statCravings.textContent = String(resisted);

    const checkinLog = $("#checkin-log", view);
    if (checkinLog && (current.checkins || []).length) {
      checkinLog.innerHTML = [...current.checkins]
        .slice(-8)
        .reverse()
        .map((entry) => `<div class="log-row"><span>${localDateLabel(entry.date)}</span><b>${entry.clean ? "Clean" : "Used"} · mood ${Number(entry.mood || 0)}/5</b></div>`)
        .join("");
    }
  }

  function buildProgressNudge() {
    const current = appState();
    const view = $("#view-progress");
    if (!current || !view || $("#ship-progress-nudge", view)) return;
    const checkins = current.checkins?.length || 0;
    const cravings = current.cravings?.length || 0;
    const nudge = document.createElement("section");
    nudge.id = "ship-progress-nudge";
    nudge.className = "ship-progress-nudge";
    if (!checkins && !cravings) {
      nudge.innerHTML = `<b>Your patterns start with one honest log.</b><span>Check in daily and use SOS when an urge hits. Gillie keeps the details private on this device.</span>`;
    } else if (checkins < 3) {
      nudge.innerHTML = `<b>${3 - checkins} more check-in${3 - checkins === 1 ? "" : "s"} to your first pattern.</b><span>Consistency matters more than perfect answers.</span>`;
    } else {
      nudge.innerHTML = `<b>Your recent patterns are taking shape.</b><span>${dangerWindowLabel() ? `Your most active craving window is ${dangerWindowLabel()}.` : "Log the next urge to sharpen your risk window."}</span>`;
    }
    const statRow = $(".stat-row", view);
    statRow?.insertAdjacentElement("afterend", nudge);
  }

  function buildReefStarterMessage() {
    const current = appState();
    const view = $("#view-reef");
    if (!current || !view) return;
    let starter = $("#ship-reef-starter", view);
    if (!starter) {
      starter = document.createElement("button");
      starter.id = "ship-reef-starter";
      starter.className = "ship-reef-starter";
      starter.innerHTML = `<span>🦪</span><div><b>Make the tank yours.</b><small>Starter pearls can unlock a first decoration now.</small></div><i>Shop ›</i>`;
      starter.addEventListener("click", () => $("#shop-grid", view)?.scrollIntoView({ behavior: "smooth", block: "start" }));
      const heading = $$(".section-h", view).find((node) => /decor/i.test(node.textContent));
      heading?.insertAdjacentElement("beforebegin", starter);
    }
    starter.hidden = (current.ownedItems || []).length > 0;
  }

  function improveReef() {
    const view = $("#view-reef");
    if (!view) return;
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
    if (yearly) $(".note", yearly).textContent = "Annual billing";
    if (monthly) $(".note", monthly).textContent = "Monthly billing";

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
      if (target.matches("#plus-open, #set-plus, [data-act='plus']")) track("paywall_open_requested", { source: target.id || target.dataset.act || "unknown" });
      if (target.matches("#plus-purchase")) track("purchase_cta_tapped", { plan: typeof selectedPlusPlan !== "undefined" ? selectedPlusPlan : "unknown" });
      if (target.matches("#plus-restore")) track("restore_tapped");
      if (target.matches("#checkin-open, [data-ship-action='checkin']")) track("checkin_opened");
      if (target.matches("#sos-open, [data-ship-action='sos']")) track("sos_opened");
    }, true);
  }

  function apply() {
    const current = appState();
    if (!current) return;
    grantStarterPearls();
    installLocalDateCorrectness();
    installProgressIntegrity();
    buildProgressNudge();
    improveReef();
    tunePaywall();
    tuneCopy();
    installRevenueTracking();
    document.documentElement.dataset.gilliePhase3 = VERSION;
  }

  function start(attempt = 0) {
    if ((window.__gillieCommerceInstalled && appState()) || attempt >= 100) {
      apply();
      [120, 500, 1200].forEach((delay) => setTimeout(apply, delay));
      document.addEventListener("click", (event) => {
        const target = event.target.closest("button, [role='button']");
        if (!target) return;
        if (target.closest("#tabs") || target.matches("#plus-open, #set-plus, [data-act='plus'], #checkin-save, #trigger-save")) {
          setTimeout(apply, 80);
          setTimeout(apply, 300);
        }
      }, true);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(apply, 120); });
      track("phase3_loaded", { version: VERSION });
      return;
    }
    setTimeout(() => start(attempt + 1), 50);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => start(), { once: true });
  else start();
})();
