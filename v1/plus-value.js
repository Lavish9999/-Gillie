/* Gillie V1 Plus Value — premium positioning, weekly report, fair Reef rewards, and welcome bundle. */
(() => {
  "use strict";

  window.GillieV1?.register("plus-value", ({ qs, qsa, afterRender, getState, notify, track }) => {
    const ENGINE = "plus-value-v1";
    const WEEKLY_REPORT_DAYS = 7;
    const DAILY_TARGET = 3;
    const PERFECT_TARGET = 5;
    const WELCOME_PEARLS = 250;
    const WELCOME_BUDDY_CREDITS = 1;
    const DAY_MS = 86400000;
    const HOUR_BLOCKS = [
      { label: "12–4a", from: 0 }, { label: "4–8a", from: 4 }, { label: "8a–12p", from: 8 },
      { label: "12–4p", from: 12 }, { label: "4–8p", from: 16 }, { label: "8p–12a", from: 20 },
    ];

    let welcomeClaimInFlight = false;

    const bridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[character]));

    function dayKey(time = Date.now()) {
      const date = new Date(time);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function persist() {
      try { if (typeof save === "function") save(); } catch (_) {}
    }

    function refreshApp() {
      try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
    }

    function ensurePlusValue(current) {
      const existing = current.plusValue && typeof current.plusValue === "object" ? current.plusValue : {};
      current.plusValue = {
        perfectCareClaims: existing.perfectCareClaims && typeof existing.perfectCareClaims === "object" ? existing.perfectCareClaims : {},
      };
      const welcome = current.plusWelcome && typeof current.plusWelcome === "object" ? current.plusWelcome : {};
      current.plusWelcome = {
        version: 1,
        claimedAt: Math.max(0, Number(welcome.claimedAt || 0)),
        bonusPearlsGranted: Math.max(0, Number(welcome.bonusPearlsGranted || 0)),
        buddyCredits: Math.max(0, Number(welcome.buddyCredits || 0)),
        nativeCheckedAt: Math.max(0, Number(welcome.nativeCheckedAt || 0)),
      };
      return { value: current.plusValue, welcome: current.plusWelcome };
    }

    // Paywall copy and layout are owned by the Phase 5 presenter
    // (phase5-paywall.js). Plus Value contributes post-purchase value only.

    function weeklyCleanMs(current, start, end) {
      let total = 0;
      const quitAt = Number(current.quitAt || 0);
      if (quitAt) total += Math.max(0, end - Math.max(start, quitAt));
      for (const slip of current.slips || []) {
        const at = Number(slip?.at || 0);
        if (at < start || at > end) continue;
        const duration = Math.max(0, Number(slip?.streakMs || 0));
        total += Math.max(0, at - Math.max(start, at - duration));
      }
      return Math.min(WEEKLY_REPORT_DAYS * DAY_MS, total);
    }

    function weeklyReportData(current) {
      const end = Date.now();
      const start = end - WEEKLY_REPORT_DAYS * DAY_MS;
      const cravings = (current.cravings || []).filter((entry) => Number(entry?.at || 0) >= start);
      const slips = (current.slips || []).filter((entry) => Number(entry?.at || 0) >= start);
      const checkins = (current.checkins || []).filter((entry) => {
        const timestamp = new Date(`${entry?.date || ""}T12:00:00`).getTime();
        return Number.isFinite(timestamp) && timestamp >= start;
      });
      const resolved = cravings.filter((entry) => !entry?.pending);
      const resisted = resolved.filter((entry) => entry?.resisted).length;
      const triggerCounts = {};
      cravings.forEach((entry) => {
        const trigger = String(entry?.trigger || "").trim();
        if (trigger) triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
      });
      const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0] || null;
      const hourCounts = HOUR_BLOCKS.map((block) => cravings.filter((entry) => {
        const hour = new Date(Number(entry?.at || 0)).getHours();
        return hour >= block.from && hour < block.from + 4;
      }).length);
      const maxHour = Math.max(...hourCounts, 0);
      const riskWindow = maxHour ? HOUR_BLOCKS[hourCounts.indexOf(maxHour)] : null;
      const moods = checkins.map((entry) => Number(entry?.mood || 0)).filter((value) => value > 0);
      const midpoint = Math.max(1, Math.floor(moods.length / 2));
      const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      const earlyMood = average(moods.slice(0, midpoint));
      const lateMood = average(moods.slice(midpoint));
      const moodTrend = moods.length < 2 ? "Still forming" : lateMood > earlyMood + 0.35 ? "Trending lighter" : lateMood < earlyMood - 0.35 ? "Needs extra care" : "Holding steady";
      const cleanMs = weeklyCleanMs(current, start, end);
      let money = 0;
      try { if (typeof costPerMs === "function") money = cleanMs * costPerMs(); } catch (_) {}
      const workedReview = [...(current.coach?.reviews || [])].reverse().find((review) => Number(review?.at || 0) >= start && review?.result === "worked");
      const whatWorked = workedReview
        ? "Your most recent Coach plan was marked as working."
        : resisted
          ? `You made it through ${resisted} of ${resolved.length || resisted} resolved logged urge${(resolved.length || resisted) === 1 ? "" : "s"}.`
          : "Use SOS follow-up this week to record what actually helped an urge pass.";
      const nextFocus = riskWindow
        ? `Prepare one replacement before ${riskWindow.label}, your busiest logged craving window.`
        : topTrigger
          ? `Build one repeatable response for ${topTrigger[0]}.`
          : "Log one trigger after the next urge so next week’s report can be more specific.";
      return { start, end, cravings, slips, checkins, resisted, resolved, topTrigger, riskWindow, moodTrend, cleanMs, money, whatWorked, nextFocus };
    }

    function formatDuration(milliseconds) {
      const hours = Math.floor(Math.max(0, milliseconds) / 3600000);
      const days = Math.floor(hours / 24);
      const remainder = hours % 24;
      return days ? `${days}d ${remainder}h` : `${hours}h`;
    }

    function renderWeeklyReport() {
      const view = qs("#view-progress");
      const current = getState?.();
      if (!view || !current?.onboarded) return;
      let section = qs("#v1-weekly-report", view);
      if (!section) {
        section = document.createElement("section");
        section.id = "v1-weekly-report";
        section.className = "v1-weekly-report";
        const basic = qs("#v1-basic-insights", view);
        if (basic) basic.insertAdjacentElement("afterend", section);
        else view.appendChild(section);
      }

      if (!current.premium) {
        section.className = "v1-weekly-report locked";
        section.innerHTML = `
          <span class="v1-kicker">Gillie Plus weekly report</span>
          <h2>See the week your streak cannot show.</h2>
          <p>Craving patterns, mood movement, what worked, and one clear focus for the next seven days.</p>
          <button type="button" data-plus-weekly-unlock>Unlock Weekly Report</button>`;
        return;
      }

      const report = weeklyReportData(current);
      const startLabel = new Date(report.start).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const endLabel = new Date(report.end).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const winRate = report.resolved.length ? Math.round((report.resisted / report.resolved.length) * 100) : null;
      section.className = "v1-weekly-report active";
      section.dataset.reportEngine = ENGINE;
      section.innerHTML = `
        <div class="pv-report-head"><div><span class="v1-kicker">Your Weekly Pattern Report</span><h2>${startLabel}–${endLabel}</h2></div><span>PRIVATE · ON DEVICE</span></div>
        <div class="pv-report-grid">
          <div><small>Clean time added</small><b>${formatDuration(report.cleanMs)}</b></div>
          <div><small>Craving win rate</small><b>${winRate === null ? "—" : `${winRate}%`}</b></div>
          <div><small>Most logged trigger</small><b>${escapeHtml(report.topTrigger?.[0] || "Still forming")}</b></div>
          <div><small>Mood movement</small><b>${escapeHtml(report.moodTrend)}</b></div>
        </div>
        <div class="pv-report-money"><span>Estimated money kept this week</span><b>$${report.money.toFixed(report.money >= 100 ? 0 : 2)}</b></div>
        <div class="pv-report-note"><small>WHAT WORKED</small><p>${escapeHtml(report.whatWorked)}</p></div>
        <div class="pv-report-note focus"><small>NEXT WEEK’S FOCUS</small><p>${escapeHtml(report.nextFocus)}</p></div>
        ${report.checkins.length + report.cravings.length === 0 ? `<p class="pv-report-building">Your first report is ready. Each check-in and SOS follow-up will make next week more specific.</p>` : ""}`;
    }

    function reefClaimed(current, today = dayKey()) {
      const claims = current.reefProgress?.claims?.[today];
      return new Set(Array.isArray(claims) ? claims : []);
    }

    function awardPearls(current, base) {
      try { if (typeof grant === "function") return grant(base); } catch (_) {}
      const amount = base * (current.premium ? 2 : 1);
      current.pearls = Math.max(0, Number(current.pearls || 0)) + amount;
      return amount;
    }

    function claimPlusDailyChest() {
      const current = getState?.();
      if (!current?.premium) return;
      const today = dayKey();
      const claimed = reefClaimed(current, today);
      if (claimed.size < DAILY_TARGET) return;
      current.reefProgress ||= { bonusXp: 0, claims: {}, dailyBonusClaims: {}, lastSeenLevel: 1 };
      current.reefProgress.dailyBonusClaims ||= {};
      if (current.reefProgress.dailyBonusClaims[today]) return;
      current.reefProgress.dailyBonusClaims[today] = true;
      current.reefProgress.bonusXp = Math.max(0, Number(current.reefProgress.bonusXp || 0)) + 35;
      const pearls = awardPearls(current, 15);
      persist();
      notify("🎁", `Plus completion chest · +35 XP · +${pearls} pearls`);
      track("plus_reef_chest_claimed", { target: DAILY_TARGET, xp: 35, pearls });
      refreshApp();
    }

    function claimPerfectCare() {
      const current = getState?.();
      if (!current?.premium) return;
      const today = dayKey();
      const claimed = reefClaimed(current, today);
      if (claimed.size < PERFECT_TARGET) return;
      const { value } = ensurePlusValue(current);
      if (value.perfectCareClaims[today]) return;
      value.perfectCareClaims[today] = true;
      current.reefProgress ||= { bonusXp: 0, claims: {}, dailyBonusClaims: {}, lastSeenLevel: 1 };
      current.reefProgress.bonusXp = Math.max(0, Number(current.reefProgress.bonusXp || 0)) + 20;
      const pearls = awardPearls(current, 10);
      persist();
      notify("✨", `Perfect Reef Care · +20 XP · +${pearls} pearls`);
      track("plus_perfect_care_claimed", { target: PERFECT_TARGET, xp: 20, pearls });
      refreshApp();
    }

    function renderReefValue() {
      const view = qs("#view-reef");
      const current = getState?.();
      if (!view || !current?.premium) return;
      ensurePlusValue(current);
      const today = dayKey();
      const claimed = reefClaimed(current, today);
      const badge = qs("#v1-reef-care .v1-reef-section-heading > strong", view);
      const intro = qs("#v1-reef-care .v1-reef-care-intro", view);
      const chest = qs("#v1-reef-care .v1-reef-daily-bonus", view);
      if (badge) badge.textContent = `${Math.min(claimed.size, DAILY_TARGET)}/${DAILY_TARGET}`;
      if (intro) intro.textContent = "Complete any 3 care actions today. Coach has its own Plus reward; finish all 5 for a perfect-care bonus.";
      if (chest) {
        const already = Boolean(current.reefProgress?.dailyBonusClaims?.[today]);
        const ready = claimed.size >= DAILY_TARGET;
        chest.classList.toggle("ready", ready);
        chest.classList.toggle("claimed", already);
        const label = qs("div > span", chest);
        const title = qs("div > b", chest);
        const reward = qs("div > small", chest);
        if (label) label.textContent = "Plus completion chest";
        if (title) title.textContent = already ? "Collected for today" : ready ? "Your chest is ready" : `${Math.max(0, DAILY_TARGET - claimed.size)} care action${DAILY_TARGET - claimed.size === 1 ? "" : "s"} left`;
        if (reward) reward.textContent = "+35 XP · +30 pearls";
        const button = qs("[data-reef-daily-bonus]", chest);
        if (button && !already) {
          button.disabled = !ready;
          button.textContent = ready ? "Open chest" : "Keep caring";
        }
      }

      let perfect = qs("#pv-perfect-care", view);
      if (!perfect && chest) {
        perfect = document.createElement("div");
        perfect.id = "pv-perfect-care";
        perfect.className = "pv-perfect-care";
        chest.insertAdjacentElement("afterend", perfect);
      }
      if (perfect) {
        const done = Boolean(current.plusValue?.perfectCareClaims?.[today]);
        const ready = claimed.size >= PERFECT_TARGET;
        perfect.className = `pv-perfect-care ${ready ? "ready" : ""} ${done ? "claimed" : ""}`;
        perfect.innerHTML = `
          <div><span>Perfect care bonus</span><b>${done ? "Collected for today" : ready ? "All five actions complete" : `${Math.max(0, PERFECT_TARGET - claimed.size)} action${PERFECT_TARGET - claimed.size === 1 ? "" : "s"} to perfect care`}</b><small>+20 XP · +20 pearls</small></div>
          ${done ? `<span class="pv-perfect-done">✓</span>` : `<button type="button" data-plus-perfect-care ${ready ? "" : "disabled"}>${ready ? "Claim bonus" : "Keep caring"}</button>`}`;
      }
    }

    function ensureWelcomeOverlay() {
      let overlay = qs("#pv-plus-welcome");
      if (overlay) return overlay;
      overlay = document.createElement("div");
      overlay.id = "pv-plus-welcome";
      overlay.className = "pv-plus-welcome";
      overlay.hidden = true;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-labelledby", "pv-welcome-title");
      overlay.innerHTML = `
        <div class="pv-welcome-sheet">
          <button type="button" class="pv-welcome-close" data-plus-welcome-close aria-label="Close welcome">×</button>
          <div class="pv-welcome-orb" aria-hidden="true">✦</div>
          <span class="pv-welcome-kicker">GILLIE PLUS IS READY</span>
          <h2 id="pv-welcome-title">Your quit toolkit just opened up.</h2>
          <p>Start with the benefits that feel valuable immediately—then let Coach and your Weekly Report sharpen as you use Gillie.</p>
          <div class="pv-welcome-benefits">
            <div><i>250</i><span><b>Welcome pearls</b><small>Spend them in the Reef today.</small></span></div>
            <div><i>1</i><span><b>First tank mate included</b><small>Your first adoption costs no pearls.</small></span></div>
            <div><i>7d</i><span><b>Weekly Pattern Report</b><small>Private insights built from your own logs.</small></span></div>
            <div><i>☾</i><span><b>Moonlit Reef</b><small>Preview and equip the full collection.</small></span></div>
          </div>
          <button type="button" class="pv-welcome-primary" data-plus-welcome-explore>Explore your Plus benefits</button>
          <button type="button" class="pv-welcome-later" data-plus-welcome-close>Not now</button>
        </div>`;
      document.body.appendChild(overlay);
      return overlay;
    }

    function showWelcomeOverlay() {
      const overlay = ensureWelcomeOverlay();
      overlay.hidden = false;
      document.body.classList.add("sheet-open", "pv-welcome-open");
    }

    function closeWelcomeOverlay() {
      const overlay = qs("#pv-plus-welcome");
      if (overlay) overlay.hidden = true;
      document.body.classList.remove("pv-welcome-open");
      if (!qs(".overlay:not([hidden]),#moonlit-reef-preview:not([hidden]),#phase2-tank-preview:not([hidden])")) document.body.classList.remove("sheet-open");
    }

    async function claimWelcomeIfNeeded() {
      const current = getState?.();
      if (!current?.premium || welcomeClaimInFlight) return;
      const { welcome } = ensurePlusValue(current);
      if (welcome.claimedAt) return;
      const native = bridge();
      if (!native?.claimPlusWelcomeBundle) return;
      welcomeClaimInFlight = true;
      try {
        const result = await native.claimPlusWelcomeBundle();
        if (!result?.active) return;
        welcome.nativeCheckedAt = Date.now();
        welcome.claimedAt = Math.max(1, Number(result.claimedAt || Date.now()));
        if (result.fresh) {
          const pearls = Math.max(0, Number(result.bonusPearls || WELCOME_PEARLS));
          const buddyCredits = Math.max(0, Number(result.buddyCredits || WELCOME_BUDDY_CREDITS));
          current.pearls = Math.max(0, Number(current.pearls || 0)) + pearls;
          welcome.bonusPearlsGranted = pearls;
          welcome.buddyCredits += buddyCredits;
          persist();
          refreshApp();
          setTimeout(showWelcomeOverlay, 260);
          track("plus_welcome_bundle_claimed", { pearls, buddyCredits, engine: ENGINE });
        } else {
          persist();
        }
      } catch (error) {
        track("plus_welcome_bundle_failed", { message: String(error?.message || error).slice(0, 80) });
      } finally {
        welcomeClaimInFlight = false;
      }
    }

    function tuneBuddyCredit() {
      const current = getState?.();
      if (!current?.premium) return;
      const { welcome } = ensurePlusValue(current);
      if (welcome.buddyCredits < 1) return;
      const add = qs("#buddy-add");
      const sub = qs(".s", add);
      if (sub) sub.textContent = "First adoption included with Plus";
      const overlay = qs("#buddy-overlay");
      if (overlay && !overlay.hidden && qs("#bd-release", overlay)?.hidden) {
        const description = qs("#buddy-sub", overlay);
        const saveButton = qs("#bd-save", overlay);
        if (description) description.textContent = `Your first tank mate for ${current.petName || "Gillie"} is included with Plus.`;
        if (saveButton) saveButton.textContent = "Adopt — included with Plus";
      }
    }

    function adoptIncludedBuddy() {
      const current = getState?.();
      if (!current?.premium) return false;
      const { welcome } = ensurePlusValue(current);
      const overlay = qs("#buddy-overlay");
      const release = qs("#bd-release", overlay);
      if (!overlay || overlay.hidden || !release?.hidden || welcome.buddyCredits < 1) return false;
      current.buddies ||= [];
      if (current.buddies.length >= 2) return false;
      const name = (qs("#bd-name", overlay)?.value.trim() || "Buddy").slice(0, 14);
      const skin = qs("#bd-skins .skin-swatch.on", overlay)?.dataset.skin || "pink";
      current.buddies.push({ name, skin });
      welcome.buddyCredits -= 1;
      persist();
      overlay.hidden = true;
      refreshApp();
      try { if (typeof axoCelebrate === "function") axoCelebrate(); } catch (_) {}
      notify("🐣", `${name} just moved in · first Plus adoption included`);
      track("plus_welcome_buddy_adopted", { skin, remainingCredits: welcome.buddyCredits });
      return true;
    }

    function handleCapture(event) {
      const target = event.target?.closest?.("button,[role='button']");
      if (!target) return;
      const current = getState?.();

      if (target.matches("[data-plus-weekly-unlock]")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        qs("#plus-open")?.click();
        return;
      }
      if (target.matches("[data-reef-daily-bonus]") && current?.premium) {
        event.preventDefault();
        event.stopImmediatePropagation();
        claimPlusDailyChest();
        return;
      }
      if (target.matches("[data-plus-perfect-care]")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        claimPerfectCare();
        return;
      }
      if (target.matches("#buddy-add") && current?.premium && ensurePlusValue(current).welcome.buddyCredits > 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        try { if (typeof openBuddyEditor === "function") openBuddyEditor(null); } catch (_) {}
        setTimeout(tuneBuddyCredit, 0);
        return;
      }
      if (target.matches("#bd-save") && adoptIncludedBuddy()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (target.matches("[data-plus-welcome-close]")) {
        event.preventDefault();
        closeWelcomeOverlay();
        return;
      }
      if (target.matches("[data-plus-welcome-explore]")) {
        event.preventDefault();
        closeWelcomeOverlay();
        const reefTab = qs('#tabs [data-view="reef"]');
        reefTab?.click();
        setTimeout(() => qs(".moonlit-seasonal-card,#v1-reef-vault")?.scrollIntoView({ behavior: "smooth", block: "start" }), 180);
      }
    }

    function applyPlusValue() {
      renderWeeklyReport();
      renderReefValue();
      tuneBuddyCredit();
      claimWelcomeIfNeeded();
      document.documentElement.dataset.plusValueEngine = ENGINE;
    }

    document.addEventListener("click", handleCapture, true);
    try {
      bridge()?.addListener?.("entitlementChanged", () => setTimeout(claimWelcomeIfNeeded, 80));
    } catch (_) {}
    afterRender(applyPlusValue);
    applyPlusValue();
    requestAnimationFrame(applyPlusValue);
    setTimeout(applyPlusValue, 180);
    track("plus_value_installed", { engine: ENGINE, weeklyDays: WEEKLY_REPORT_DAYS, reefTarget: DAILY_TARGET });
  });
})();
