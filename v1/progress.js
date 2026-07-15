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

    function sectionHeading(text) {
      return qsa(".section-h", view).find((node) => node.textContent.trim().toLowerCase() === text.toLowerCase()) || null;
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

    function render() {
      unlockProgressInteractions();
      const current = getState();
      if (!current) return;

      const checkins = Array.isArray(current.checkins) ? current.checkins : [];
      const cravings = Array.isArray(current.cravings) ? current.cravings : [];
      const slips = Array.isArray(current.slips) ? current.slips : [];
      const cleanCheckins = checkins.filter((entry) => entry?.clean).length;
      const resisted = cravings.filter((entry) => entry?.resisted).length;
      const common = topTrigger(cravings);
      const hasSignals = checkins.length > 0 || cravings.length > 0 || slips.length > 0;

      qs("#ship-progress-activation", view)?.setAttribute("hidden", "");

      let summary = qs("#v1-basic-insights", view);
      if (!summary) {
        summary = document.createElement("section");
        summary.id = "v1-basic-insights";
        summary.className = "v1-basic-insights";
        const statRow = qs(".stat-row", view);
        statRow?.insertAdjacentElement("afterend", summary);
        summary.addEventListener("click", (event) => {
          const action = event.target.closest("[data-v1-progress]")?.dataset.v1Progress;
          if (action === "checkin") qs("#checkin-open")?.click();
          if (action === "sos") qs("#sos-fab")?.click();
        });
      }

      if (!hasSignals) {
        summary.className = "v1-basic-insights v1-progress-empty";
        summary.innerHTML = `
          <span class="v1-kicker">Build your first pattern</span>
          <h2>Give Gillie one honest signal.</h2>
          <p>Your streak is already counting. A check-in or SOS session gives Progress something personal to show.</p>
          <div class="v1-progress-actions">
            <button type="button" data-v1-progress="checkin">Check in</button>
            <button type="button" data-v1-progress="sos">Open SOS</button>
          </div>`;
      } else {
        const commonTrigger = common ? safeHTML(common[0]) : "";
        summary.className = "v1-basic-insights";
        summary.innerHTML = `
          <div class="v1-progress-heading"><span class="v1-kicker">Your patterns</span><small>Always free</small></div>
          <div class="v1-insight-grid">
            <div><b>${currentDays()}</b><span>current clean days</span></div>
            <div><b>${cleanCheckins}/${checkins.length}</b><span>clean check-ins</span></div>
            <div><b>${resisted}</b><span>urges made it through</span></div>
          </div>
          <p>${common ? `<strong>${commonTrigger}</strong> is your most logged trigger so far.` : "Log a trigger after SOS and Gillie will begin showing what repeats."}</p>`;
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
