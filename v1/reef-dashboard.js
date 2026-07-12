/* Gillie V1 Reef Dashboard — progression, daily care, and Plus collection value. */
(() => {
  "use strict";

  window.GillieV1?.register("reef-dashboard", ({ qs, qsa, afterRender, track, getState, notify }) => {
    const view = qs("#view-reef");
    if (!view) return;

    const DASHBOARD_ENGINE = "reef-progression-v1";
    const DAY_MS = 86400000;
    const HOUR_MS = 3600000;
    const LEVELS = [
      { level: 1, name: "Fresh Start", xp: 0 },
      { level: 2, name: "Ripple Keeper", xp: 120 },
      { level: 3, name: "Kelp Keeper", xp: 300 },
      { level: 4, name: "Coral Tender", xp: 600 },
      { level: 5, name: "Tide Builder", xp: 1000 },
      { level: 6, name: "Glowkeeper", xp: 1500 },
      { level: 7, name: "Reef Guardian", xp: 2200 },
      { level: 8, name: "Crystal Current", xp: 3200 },
    ];

    const TASKS = [
      {
        id: "visit",
        title: "Check on your reef",
        copy: "Open the Reef and see what your clean time changed.",
        xp: 6,
        pearls: 2,
        action: "reef",
        complete: () => true,
      },
      {
        id: "checkin",
        title: "Complete today’s check-in",
        copy: "Give Gillie one honest snapshot of how today feels.",
        xp: 16,
        pearls: 5,
        action: "checkin",
        complete: (current, day) => (current.checkins || []).some((entry) => entry?.date === day),
      },
      {
        id: "clean-hour",
        title: "Protect one clean hour",
        copy: "Keep the current streak alive for at least one hour today.",
        xp: 18,
        pearls: 5,
        action: "timer",
        complete: (current) => cleanTimeToday(current) >= HOUR_MS,
      },
      {
        id: "craving",
        title: "Handle an urge",
        copy: "Log a craving or use SOS when a wave shows up.",
        xp: 22,
        pearls: 8,
        action: "sos",
        complete: (current, day) => (current.cravings || []).some((entry) => dayKey(entry?.at) === day),
      },
      {
        id: "coach",
        title: "Finish a Coach mission",
        copy: "Plus turns your real patterns into one focused daily move.",
        xp: 28,
        pearls: 10,
        action: "coach",
        plus: true,
        complete: (current, day) => current.coach?.missionDate === day && Object.values(current.coach?.completed || {}).some(Boolean),
      },
    ];

    function dayKey(time = Date.now()) {
      try {
        if (typeof localDayKey === "function") return localDayKey(time);
      } catch (_) {}
      const date = new Date(time || Date.now());
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function startOfToday() {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    }

    function currentStreak(current) {
      return current?.quitAt ? Math.max(0, Date.now() - Number(current.quitAt)) : 0;
    }

    function lifetimeClean(current) {
      return Math.max(0, Number(current?.bankedCleanMs || 0)) + currentStreak(current);
    }

    function cleanTimeToday(current) {
      if (!current?.quitAt) return 0;
      const start = Math.max(Number(current.quitAt), startOfToday());
      return Math.max(0, Date.now() - start);
    }

    function ensureProgress(current) {
      const existing = current.reefProgress && typeof current.reefProgress === "object" ? current.reefProgress : {};
      current.reefProgress = {
        bonusXp: Math.max(0, Number(existing.bonusXp || 0)),
        claims: existing.claims && typeof existing.claims === "object" ? existing.claims : {},
        dailyBonusClaims: existing.dailyBonusClaims && typeof existing.dailyBonusClaims === "object" ? existing.dailyBonusClaims : {},
        lastSeenLevel: Math.max(1, Number(existing.lastSeenLevel || 1)),
      };

      const cutoff = Date.now() - 21 * DAY_MS;
      for (const key of Object.keys(current.reefProgress.claims)) {
        const time = new Date(`${key}T12:00:00`).getTime();
        if (!Number.isFinite(time) || time < cutoff) delete current.reefProgress.claims[key];
      }
      for (const key of Object.keys(current.reefProgress.dailyBonusClaims)) {
        const time = new Date(`${key}T12:00:00`).getTime();
        if (!Number.isFinite(time) || time < cutoff) delete current.reefProgress.dailyBonusClaims[key];
      }
      return current.reefProgress;
    }

    function persist() {
      try { if (typeof save === "function") save(); } catch (_) {}
    }

    function refreshApp() {
      try {
        if (typeof renderAll === "function") renderAll();
        else renderDashboard();
      } catch (_) {
        renderDashboard();
      }
    }

    function awardPearls(base) {
      try {
        if (typeof grant === "function") return grant(base);
      } catch (_) {}
      const current = getState?.();
      if (!current) return 0;
      const value = base * (current.premium ? 2 : 1);
      current.pearls = Math.max(0, Number(current.pearls || 0)) + value;
      return value;
    }

    function reefXp(current) {
      const progress = ensureProgress(current);
      const cleanHours = Math.floor(lifetimeClean(current) / HOUR_MS);
      const checkinXp = (current.checkins || []).length * 15;
      const cravingXp = (current.cravings || []).filter((entry) => entry?.resisted).length * 20;
      const milestoneXp = (current.milestonesRewarded || current.milestonesSeen || []).length * 35;
      return Math.max(0, cleanHours * 2 + checkinXp + cravingXp + milestoneXp + progress.bonusXp);
    }

    function levelStatus(xp) {
      let current = LEVELS[0];
      for (const level of LEVELS) if (xp >= level.xp) current = level;
      const next = LEVELS.find((level) => level.xp > xp) || null;
      const span = next ? Math.max(1, next.xp - current.xp) : 1;
      const progress = next ? Math.max(0, Math.min(1, (xp - current.xp) / span)) : 1;
      return { current, next, progress };
    }

    function clarityPercent(current) {
      try {
        if (typeof stageFor === "function") {
          const stage = stageFor(currentStreak(current));
          return Math.round(Math.max(0, Math.min(1, 1 - Number(stage?.murk || 0))) * 100);
        }
      } catch (_) {}
      const days = currentStreak(current) / DAY_MS;
      return Math.round(Math.max(35, Math.min(100, 35 + days * 4)));
    }

    function nextUnlock(current, status) {
      try {
        const owned = new Set(current.ownedItems || []);
        const days = Math.floor(lifetimeClean(current) / DAY_MS);
        if (Array.isArray(SHOP_ITEMS)) {
          const next = SHOP_ITEMS
            .filter((item) => !owned.has(item.id) && Number(item.bondDays || 0) > days)
            .sort((a, b) => Number(a.bondDays || 0) - Number(b.bondDays || 0) || Number(a.price || 0) - Number(b.price || 0))[0];
          if (next) {
            const remaining = Math.max(1, Number(next.bondDays || 0) - days);
            return {
              name: next.name,
              detail: `${remaining} clean day${remaining === 1 ? "" : "s"} away`,
              premium: Boolean(next.premium),
            };
          }
        }
      } catch (_) {}

      if (status.next) return { name: status.next.name, detail: `${Math.max(0, status.next.xp - reefXp(current))} XP away`, premium: false };
      return { name: "Crystal Reef complete", detail: "Keep building your collection", premium: false };
    }

    function claimedTasks(current, day) {
      const progress = ensureProgress(current);
      return new Set(Array.isArray(progress.claims[day]) ? progress.claims[day] : []);
    }

    function taskState(task, current, day, claimed) {
      const locked = Boolean(task.plus && !current.premium);
      const complete = !locked && Boolean(task.complete(current, day));
      return { locked, complete, claimed: claimed.has(task.id) };
    }

    function dailyTarget(current) {
      return current.premium ? 4 : 3;
    }

    function claimTask(taskId) {
      const current = getState?.();
      if (!current) return;
      const day = dayKey();
      const task = TASKS.find((entry) => entry.id === taskId);
      if (!task) return;
      const progress = ensureProgress(current);
      const claimed = claimedTasks(current, day);
      const stateForTask = taskState(task, current, day, claimed);
      if (stateForTask.locked) {
        openPlus();
        return;
      }
      if (!stateForTask.complete || stateForTask.claimed) return;

      claimed.add(task.id);
      progress.claims[day] = Array.from(claimed);
      progress.bonusXp += task.xp;
      const pearls = awardPearls(task.pearls);
      persist();
      notify("🫧", `${task.title} complete · +${task.xp} Reef XP · +${pearls} pearls`);
      track("reef_daily_task_claimed", { task: task.id, xp: task.xp, pearls, premium: Boolean(current.premium) });
      refreshApp();
    }

    function claimDailyBonus() {
      const current = getState?.();
      if (!current) return;
      const day = dayKey();
      const progress = ensureProgress(current);
      if (progress.dailyBonusClaims[day]) return;
      const claimed = claimedTasks(current, day);
      const target = dailyTarget(current);
      if (claimed.size < target) return;

      const xp = current.premium ? 35 : 20;
      const basePearls = current.premium ? 15 : 10;
      progress.dailyBonusClaims[day] = true;
      progress.bonusXp += xp;
      const pearls = awardPearls(basePearls);
      persist();
      notify("🎁", `Daily Reef Care complete · +${xp} XP · +${pearls} pearls`);
      track("reef_daily_bonus_claimed", { xp, pearls, premium: Boolean(current.premium) });
      refreshApp();
    }

    function openPlus() {
      const button = qs("#plus-open");
      if (button) button.click();
      else qs("#set-plus")?.click();
    }

    function runTaskAction(taskId) {
      const current = getState?.();
      const task = TASKS.find((entry) => entry.id === taskId);
      if (!current || !task) return;
      if (task.plus && !current.premium) {
        openPlus();
        return;
      }

      if (task.action === "checkin") qs("#checkin-open")?.click();
      else if (task.action === "sos") {
        const sos = qs("#sos-fab") || qs("#sos-open") || qs('[data-open-sos="true"]');
        if (sos) sos.click();
        else notify("🌊", "Use Craving SOS the next time an urge shows up.");
      } else if (task.action === "coach") {
        const coach = qs("#coach-card");
        if (coach) coach.click();
        else notify("👑", "Open Gillie Coach from Home to finish today’s mission.");
      } else if (task.action === "timer") {
        const remaining = Math.max(0, HOUR_MS - cleanTimeToday(current));
        const mins = Math.max(1, Math.ceil(remaining / 60000));
        notify("⏱️", remaining ? `${mins} clean minute${mins === 1 ? "" : "s"} until this care task is ready.` : "Your clean-hour task is ready to claim.");
      } else {
        notify("🫧", "You checked on your reef. This care task is ready to claim.");
      }
    }

    function taskMarkup(task, current, day, claimed) {
      const stateForTask = taskState(task, current, day, claimed);
      const multiplier = current.premium ? 2 : 1;
      const reward = task.pearls * multiplier;
      let button = "";
      if (stateForTask.locked) {
        button = `<button type="button" data-reef-task-action="${task.id}" class="v1-reef-task-button locked">Plus</button>`;
      } else if (stateForTask.claimed) {
        button = `<span class="v1-reef-task-done">Done</span>`;
      } else if (stateForTask.complete) {
        button = `<button type="button" data-reef-task-claim="${task.id}" class="v1-reef-task-button claim">Claim +${reward}</button>`;
      } else {
        button = `<button type="button" data-reef-task-action="${task.id}" class="v1-reef-task-button">${task.action === "timer" ? "View" : "Open"}</button>`;
      }

      return `<article class="v1-reef-task ${stateForTask.complete ? "complete" : ""} ${stateForTask.claimed ? "claimed" : ""} ${stateForTask.locked ? "locked" : ""}">
        <div class="v1-reef-task-check" aria-hidden="true">${stateForTask.claimed ? "✓" : stateForTask.complete ? "•" : task.plus ? "✦" : ""}</div>
        <div class="v1-reef-task-copy"><b>${task.title}</b><span>${task.copy}</span><small>+${task.xp} XP · +${reward} pearls${task.plus ? " · Plus" : ""}</small></div>
        ${button}
      </article>`;
    }

    function dashboardMarkup(current) {
      const xp = reefXp(current);
      const status = levelStatus(xp);
      const clarity = clarityPercent(current);
      const cleanDays = Math.floor(lifetimeClean(current) / DAY_MS);
      const unlock = nextUnlock(current, status);
      const nextXp = status.next ? status.next.xp : xp;
      const progressWidth = Math.round(status.progress * 100);

      return `<section id="v1-reef-dashboard" class="v1-reef-dashboard" data-engine="${DASHBOARD_ENGINE}">
        <div class="v1-reef-dashboard-top">
          <div><span class="v1-kicker">Your living reef</span><h2>Level ${status.current.level} · ${status.current.name}</h2></div>
          <div class="v1-reef-level-orb"><strong>${status.current.level}</strong><span>LEVEL</span></div>
        </div>
        <div class="v1-reef-xp-row"><b>${xp.toLocaleString()} XP</b><span>${status.next ? `${nextXp.toLocaleString()} XP to ${status.next.name}` : "Highest Reef level reached"}</span></div>
        <div class="v1-reef-xp-bar"><i style="width:${progressWidth}%"></i></div>
        <div class="v1-reef-metrics">
          <div><span>Water clarity</span><b>${clarity}%</b><i style="--metric:${clarity}%"></i></div>
          <div><span>Clean days banked</span><b>${cleanDays}</b><small>Lifetime progress</small></div>
          <div><span>Next unlock</span><b>${unlock.name}</b><small>${unlock.detail}${unlock.premium ? " · Plus" : ""}</small></div>
        </div>
        <div class="v1-reef-dashboard-actions">
          <button type="button" data-reef-dashboard-action="preview">View full reef</button>
          <button type="button" data-reef-dashboard-action="customize">Customize</button>
        </div>
      </section>`;
    }

    function careMarkup(current) {
      const day = dayKey();
      const claimed = claimedTasks(current, day);
      const target = dailyTarget(current);
      const progress = ensureProgress(current);
      const bonusClaimed = Boolean(progress.dailyBonusClaims[day]);
      const ready = claimed.size >= target;
      const bonusXp = current.premium ? 35 : 20;
      const bonusPearls = (current.premium ? 15 : 10) * (current.premium ? 2 : 1);

      return `<section id="v1-reef-care" class="v1-reef-care">
        <div class="v1-reef-section-heading"><div><span class="v1-kicker">Daily Reef Care</span><h2>Recovery actions feed the reef.</h2></div><strong>${Math.min(claimed.size, target)}/${target}</strong></div>
        <p class="v1-reef-care-intro">Claim any ${target} care actions today. Gillie Plus adds the Coach mission, a larger completion bonus, and doubled pearl rewards.</p>
        <div class="v1-reef-task-list">${TASKS.map((task) => taskMarkup(task, current, day, claimed)).join("")}</div>
        <div class="v1-reef-daily-bonus ${ready ? "ready" : ""} ${bonusClaimed ? "claimed" : ""}">
          <div><span>${current.premium ? "Plus completion chest" : "Daily completion chest"}</span><b>${bonusClaimed ? "Collected for today" : ready ? "Your chest is ready" : `${Math.max(0, target - claimed.size)} care action${target - claimed.size === 1 ? "" : "s"} left`}</b><small>+${bonusXp} XP · +${bonusPearls} pearls</small></div>
          ${bonusClaimed ? `<span class="v1-reef-bonus-done">✓</span>` : `<button type="button" data-reef-daily-bonus ${ready ? "" : "disabled"}>${ready ? "Open chest" : "Keep caring"}</button>`}
        </div>
      </section>`;
    }

    function vaultMarkup(current) {
      const active = Boolean(current.premium);
      return `<section id="v1-reef-vault" class="v1-reef-vault ${active ? "active" : ""}">
        <div class="v1-reef-vault-copy"><span class="v1-kicker">Gillie Plus collection vault</span><h2>${active ? "Your premium reef is active." : "Make the reef feel completely yours."}</h2><p>Animated environments are next. Today, Plus already unlocks premium themes, rare Gillie colors, tank mates, exclusive items, Coach care, and 2× pearls.</p></div>
        <div class="v1-reef-vault-chips"><span>Sunset Lagoon</span><span>Abyss</span><span>Sakura</span><span>Rare skins</span><span>Tank mates</span><span>2× pearls</span></div>
        <button type="button" data-reef-vault-action>${active ? "Browse premium collection" : "See everything in Plus"}</button>
      </section>`;
    }

    function renderDashboard() {
      const current = getState?.();
      if (!current || !current.onboarded) return;
      ensureProgress(current);

      let shell = qs("#v1-reef-progression-shell", view);
      if (!shell) {
        shell = document.createElement("div");
        shell.id = "v1-reef-progression-shell";
        shell.className = "v1-reef-progression-shell";
        const intro = qs("#v1-reef-intro", view);
        if (intro) intro.insertAdjacentElement("afterend", shell);
        else qs(".topbar", view)?.insertAdjacentElement("afterend", shell);
      }

      shell.innerHTML = `${dashboardMarkup(current)}${careMarkup(current)}${vaultMarkup(current)}`;
      qs("#plus-banner", view)?.setAttribute("hidden", "");

      const status = levelStatus(reefXp(current));
      const progress = ensureProgress(current);
      if (status.current.level > progress.lastSeenLevel) {
        progress.lastSeenLevel = status.current.level;
        persist();
        notify("🌊", `Reef Level ${status.current.level} reached · ${status.current.name}`);
        track("reef_level_reached", { level: status.current.level, name: status.current.name });
      }
    }

    view.addEventListener("click", (event) => {
      const claim = event.target.closest?.("[data-reef-task-claim]");
      if (claim) {
        claimTask(claim.dataset.reefTaskClaim);
        return;
      }

      const taskAction = event.target.closest?.("[data-reef-task-action]");
      if (taskAction) {
        runTaskAction(taskAction.dataset.reefTaskAction);
        return;
      }

      if (event.target.closest?.("[data-reef-daily-bonus]")) {
        claimDailyBonus();
        return;
      }

      const dashboardAction = event.target.closest?.("[data-reef-dashboard-action]")?.dataset.reefDashboardAction;
      if (dashboardAction === "preview") {
        const preview = qs("#phase2-preview-tank");
        if (preview) preview.click();
        else notify("🫧", "Your full Reef preview is getting ready.");
      } else if (dashboardAction === "customize") {
        qs("#theme-row", view)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      if (event.target.closest?.("[data-reef-vault-action]")) {
        const current = getState?.();
        if (current?.premium) qs("#theme-row", view)?.scrollIntoView({ behavior: "smooth", block: "start" });
        else openPlus();
      }
    });

    afterRender(renderDashboard);
    renderDashboard();
    track("reef_progression_installed", { engine: DASHBOARD_ENGINE });
  });
})();
