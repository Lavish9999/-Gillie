/* Gillie V1 Progress — basic personal recovery data stays free. */
(() => {
  "use strict";

  window.GillieV1?.register("progress", ({ qs, qsa, getState, afterRender, track }) => {
    const view = qs("#view-progress");
    if (!view) return;

    function safeHTML(value) {
      try {
        if (typeof escapeHTML === "function") return escapeHTML(value);
      } catch (_) {}
      return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[character]));
    }

    function topTrigger(cravings) {
      const counts = {};
      cravings.forEach((entry) => {
        if (!entry?.trigger) return;
        counts[entry.trigger] = (counts[entry.trigger] || 0) + 1;
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || null;
    }

    function currentDays() {
      try {
        return typeof currentStreakMs === "function" ? Math.floor(currentStreakMs() / 86400000) : 0;
      } catch (_) { return 0; }
    }

    function localDayKey(time = Date.now()) {
      const date = new Date(time);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function sectionHeading(text) {
      return qsa(".section-h", view).find((node) => node.textContent.trim().toLowerCase() === text.toLowerCase()) || null;
    }

    function ensureStyles() {
      if (document.getElementById("v1-progress-cleanup-styles")) return;
      const style = document.createElement("style");
      style.id = "v1-progress-cleanup-styles";
      style.textContent = `
        #ship-progress-activation,#progress-rescue-actions{display:none!important}
        #view-progress .v1-basic-insights{margin:12px 0 16px;padding:17px;border:1px solid rgba(17,51,47,.08);border-radius:22px;background:rgba(255,255,255,.92);box-shadow:0 10px 28px rgba(17,51,47,.07)}
        #view-progress .v1-progress-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
        #view-progress .v1-progress-heading small{color:#397b69;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.1em}
        #view-progress .v1-progress-title{margin:8px 0 0;color:var(--ink);font:800 21px/1.08 var(--font-display);letter-spacing:-.015em}
        #view-progress .v1-basic-insights>p{margin:13px 1px 0;color:var(--ink-soft);font-size:12.5px;line-height:1.45;font-weight:600}
        #view-progress .v1-signal-list{display:grid;gap:10px;margin-top:15px}
        #view-progress .v1-signal-list>div{padding:12px;border:1px solid rgba(17,51,47,.07);border-radius:15px;background:#f4f8f6}
        #view-progress .v1-signal-list>div>span{display:flex;align-items:center;justify-content:space-between;gap:12px}
        #view-progress .v1-signal-list b{font-size:12px;color:var(--ink)}
        #view-progress .v1-signal-list small{font-size:11px;font-weight:800;color:var(--ink-faint)}
        #view-progress .v1-signal-list i{display:block;height:5px;margin-top:9px;overflow:hidden;border-radius:99px;background:rgba(17,51,47,.09)}
        #view-progress .v1-signal-list em{display:block;height:100%;border-radius:inherit;background:#397b69;transition:width .25s ease}
        #view-progress .v1-signal-list .done{background:#eef8f3}
        #view-progress .v1-signal-list .done small{color:#2f8d6f}
        #view-progress .v1-progress-checkin{width:100%;min-height:46px;margin-top:14px;border-radius:15px;background:var(--ink);color:#fff;font-size:13px;font-weight:850}
        #view-progress .v1-progress-checkin:active{transform:scale(.985)}
        #view-progress .v1-progress-status{display:flex;align-items:center;gap:8px;margin-top:14px;padding:10px 12px;border-radius:14px;background:#eef8f3;color:#2f7e66}
        #view-progress .v1-progress-status span{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#d7f0e5;font-size:11px;font-weight:900}
        #view-progress .v1-progress-status b{font-size:11.5px;font-weight:800}
        #view-progress .v1-insight-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}
        #view-progress .v1-insight-grid>div{min-width:0;padding:12px 9px;border-radius:15px;background:#f4f8f6;border:1px solid rgba(17,51,47,.06)}
        #view-progress .v1-insight-grid b{display:block;overflow:hidden;color:var(--ink);font:800 20px/1 var(--font-display);text-overflow:ellipsis;white-space:nowrap}
        #view-progress .v1-insight-grid .v1-insight-word{font-size:15px;line-height:1.08}
        #view-progress .v1-insight-grid span{display:block;margin-top:6px;color:var(--ink-faint);font-size:10px;line-height:1.2;font-weight:650}
        @media(max-width:370px){#view-progress .v1-basic-insights{padding:15px}#view-progress .v1-insight-grid{gap:6px}#view-progress .v1-insight-grid>div{padding:10px 7px}}
      `;
      document.head.appendChild(style);
    }

    function unlockProgressInteractions() {
      const surfaces = [view, ...qsa("[inert]", view)];
      surfaces.forEach((surface) => {
        try { surface.inert = false; } catch (_) {}
        surface.removeAttribute?.("inert");
      });
      view.style?.setProperty?.("pointer-events", "auto", "important");
      view.dataset.v1ProgressInteractive = "true";
    }

    function openCheckin() {
      qs("#checkin-open")?.click();
      track("progress_checkin_opened_v1");
    }

    function learningCopy({ checkinsNeeded, sosNeeded, checkedInToday }) {
      if (checkinsNeeded === 3 && sosNeeded === 1) {
        return "Start with one quick check-in. Gillie will use it to track how cravings and clean days change.";
      }
      if (checkinsNeeded > 0 && sosNeeded > 0) {
        const checkinLabel = `${checkinsNeeded} more daily check-in${checkinsNeeded === 1 ? "" : "s"}`;
        return `${checkinLabel} will strengthen the trend. Use the pink SOS button only when a real craving happens.`;
      }
      if (checkinsNeeded > 0) {
        return `${checkinsNeeded} more check-in${checkinsNeeded === 1 ? "" : "s"} will unlock your first useful pattern.`;
      }
      if (sosNeeded > 0) {
        return "Your check-ins are ready. Use the pink SOS button during your next craving to reveal what repeats.";
      }
      return checkedInToday ? "Today’s check-in is complete." : "Gillie has enough signal to begin showing your patterns.";
    }

    function render() {
      unlockProgressInteractions();
      const current = getState();
      if (!current) return;

      const checkins = Array.isArray(current.checkins) ? current.checkins : [];
      const cravings = Array.isArray(current.cravings) ? current.cravings : [];
      const slips = Array.isArray(current.slips) ? current.slips : [];
      const sosSessions = Math.max(cravings.length, Array.isArray(current.sosRewards) ? current.sosRewards.length : 0);
      const cleanCheckins = checkins.filter((entry) => entry?.clean).length;
      const resisted = cravings.filter((entry) => entry?.resisted !== false).length;
      const common = topTrigger(cravings);
      const checkinsNeeded = Math.max(0, 3 - checkins.length);
      const sosNeeded = Math.max(0, 1 - sosSessions);
      const ready = checkinsNeeded === 0 && sosNeeded === 0;
      const checkedInToday = checkins.some((entry) => entry?.date === localDayKey());

      qs("#ship-progress-activation", view)?.setAttribute("hidden", "");
      qs("#progress-rescue-actions", view)?.remove();

      let summary = qs("#v1-basic-insights", view);
      if (!summary) {
        summary = document.createElement("section");
        summary.id = "v1-basic-insights";
        summary.className = "v1-basic-insights";
        summary.addEventListener("click", (event) => {
          const action = event.target.closest("[data-v1-progress]")?.dataset.v1Progress;
          if (action === "checkin") openCheckin();
        });
      }

      const statRow = qs(".stat-row", view);
      statRow?.insertAdjacentElement("afterend", summary);

      const dashboard = qs("#phase2-progress-dashboard", view);
      if (dashboard) dashboard.hidden = !ready;

      if (!ready) {
        const checkinProgress = Math.min(100, Math.round((Math.min(3, checkins.length) / 3) * 100));
        const sosProgress = sosNeeded === 0 ? 100 : 0;
        summary.className = "v1-basic-insights v1-progress-learning";
        summary.innerHTML = `
          <div class="v1-progress-heading"><span class="v1-kicker">Your patterns</span><small>Always free</small></div>
          <h2 class="v1-progress-title">Gillie is learning what helps.</h2>
          <div class="v1-signal-list">
            <div class="${checkinsNeeded === 0 ? "done" : ""}">
              <span><b>Daily check-ins</b><small>${Math.min(3, checkins.length)}/3</small></span>
              <i><em style="width:${checkinProgress}%"></em></i>
            </div>
            <div class="${sosNeeded === 0 ? "done" : ""}">
              <span><b>Craving reflection</b><small>${Math.min(1, sosSessions)}/1</small></span>
              <i><em style="width:${sosProgress}%"></em></i>
            </div>
          </div>
          <p>${learningCopy({ checkinsNeeded, sosNeeded, checkedInToday })}</p>
          ${checkinsNeeded > 0 && !checkedInToday
            ? '<button class="v1-progress-checkin" type="button" data-v1-progress="checkin">Check in now</button>'
            : checkedInToday
              ? '<div class="v1-progress-status"><span>✓</span><b>Today’s check-in is complete</b></div>'
              : '<div class="v1-progress-status"><span>✓</span><b>Check-in signal complete</b></div>'}`;
      } else {
        const commonTrigger = common ? safeHTML(common[0]) : "Learning";
        summary.className = "v1-basic-insights";
        summary.innerHTML = `
          <div class="v1-progress-heading"><span class="v1-kicker">Your patterns</span><small>Always free</small></div>
          <h2 class="v1-progress-title">What keeps repeating</h2>
          <div class="v1-insight-grid">
            <div><b class="v1-insight-word">${commonTrigger}</b><span>most common trigger</span></div>
            <div><b>${cleanCheckins}/${checkins.length}</b><span>clean check-ins</span></div>
            <div><b>${resisted}</b><span>urges managed</span></div>
          </div>
          <p>${common ? `<strong>${commonTrigger}</strong> appears most often in your craving logs.` : `${currentDays()} clean day${currentDays() === 1 ? "" : "s"} and ${slips.length} slip reflection${slips.length === 1 ? "" : "s"} are shaping your trend.`}</p>
          ${checkedInToday
            ? '<div class="v1-progress-status"><span>✓</span><b>Today’s check-in is complete</b></div>'
            : '<button class="v1-progress-checkin" type="button" data-v1-progress="checkin">Add today’s check-in</button>'}`;
      }

      const recovery = qs("#ship-recovery-details", view);
      if (ready && dashboard) {
        summary.insertAdjacentElement("afterend", dashboard);
        if (recovery) dashboard.insertAdjacentElement("afterend", recovery);
      } else if (recovery) {
        summary.insertAdjacentElement("afterend", recovery);
      }

      const legacyHeading = sectionHeading("Your insights");
      const legacyBox = qs("#insights-box", view);
      const premium = Boolean(current.premium);
      if (legacyHeading) {
        legacyHeading.textContent = "Advanced patterns and planning";
        legacyHeading.hidden = !premium;
      }
      if (legacyBox) legacyBox.hidden = !premium;

      sectionHeading("Recent check-ins")?.removeAttribute("hidden");
      qs("#checkin-log", view)?.removeAttribute("hidden");
      unlockProgressInteractions();
    }

    ensureStyles();
    afterRender(render);
    render();
    qs('#tabs [data-view="progress"]')?.addEventListener("click", () => {
      unlockProgressInteractions();
      setTimeout(() => {
        unlockProgressInteractions();
        render();
      }, 40);
      setTimeout(() => {
        unlockProgressInteractions();
        render();
      }, 220);
      track("progress_opened_v1");
    });
  });
})();
