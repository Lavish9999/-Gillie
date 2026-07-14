/* Gillie V1 Welcome Recovery — one reinstall safety net for the Plus welcome bundle on this device. */
(() => {
  "use strict";

  window.GillieV1?.register("welcome-recovery", ({ qs, getState, afterRender, notify, track }) => {
    const ENGINE = "welcome-recovery-v1";
    const DEFAULT_PEARLS = 250;
    const DEFAULT_BUDDY_CREDITS = 1;
    let inFlight = false;
    let completed = false;
    let attemptTimer = 0;

    const recoveryBridge = () => window.Capacitor?.Plugins?.GillieWelcomeRecovery || null;

    function persist() {
      try { if (typeof save === "function") save(); } catch (_) {}
    }

    function refresh() {
      try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
    }

    function closeRecoveryOverlay() {
      const overlay = qs("#v1-welcome-recovery-overlay");
      if (overlay) overlay.hidden = true;
      document.body.classList.remove("v1-welcome-recovery-open");
      if (!qs(".overlay:not([hidden]),#moonlit-reef-preview:not([hidden]),#phase2-tank-preview:not([hidden])")) {
        document.body.classList.remove("sheet-open");
      }
    }

    function showRecoveryOverlay(pearls, buddyCredits) {
      let overlay = qs("#v1-welcome-recovery-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "v1-welcome-recovery-overlay";
        overlay.className = "overlay";
        overlay.hidden = true;
        overlay.innerHTML = `
          <div class="sheet">
            <button type="button" class="sheet-close" data-welcome-recovery-close data-dialog-close aria-label="Close restored benefits">×</button>
            <div class="confirm-icon" aria-hidden="true">✦</div>
            <div class="eyebrow">GILLIE PLUS RESTORED</div>
            <h2>Your welcome benefits are back.</h2>
            <p class="sub" data-welcome-recovery-copy></p>
            <div class="sheet-actions">
              <button type="button" class="btn" data-welcome-recovery-reef>Explore the Reef</button>
              <button type="button" class="btn ghost" data-welcome-recovery-close data-dialog-close>Not now</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener("click", (event) => {
          if (event.target.closest("[data-welcome-recovery-close]")) {
            closeRecoveryOverlay();
            return;
          }
          if (event.target.closest("[data-welcome-recovery-reef]")) {
            closeRecoveryOverlay();
            qs('#tabs [data-view="reef"]')?.click();
          }
        });
      }
      const copy = qs("[data-welcome-recovery-copy]", overlay);
      if (copy) {
        copy.textContent = `${pearls} welcome pearls and ${buddyCredits === 1 ? "your included first tank mate" : `${buddyCredits} tank-mate credits`} were replaced after reinstall. This recovery can only happen once on this device.`;
      }
      overlay.hidden = false;
      document.body.classList.add("sheet-open", "v1-welcome-recovery-open");
    }

    function scheduleAttempt(delay = 900) {
      clearTimeout(attemptTimer);
      attemptTimer = setTimeout(attemptRecovery, delay);
    }

    async function attemptRecovery() {
      if (completed || inFlight) return;
      const current = getState?.();
      if (!current?.premium) return;

      const welcome = current.plusWelcome && typeof current.plusWelcome === "object" ? current.plusWelcome : null;
      if (!welcome?.claimedAt) {
        scheduleAttempt(1200);
        return;
      }

      const native = recoveryBridge();
      if (!native?.recoverWelcomeBundle) {
        completed = true;
        track("plus_welcome_recovery_unavailable", { engine: ENGINE });
        return;
      }

      inFlight = true;
      try {
        const result = await native.recoverWelcomeBundle({
          localClaimedAt: Math.max(0, Number(welcome.claimedAt || 0)),
          localBonusPearlsGranted: Math.max(0, Number(welcome.bonusPearlsGranted || 0)),
          localBuddyCredits: Math.max(0, Number(welcome.buddyCredits || 0)),
        });

        if (!result?.recovered) {
          completed = Boolean(result?.settled !== false);
          track("plus_welcome_recovery_checked", {
            recovered: false,
            reason: String(result?.reason || "not-eligible").slice(0, 48),
            engine: ENGINE,
          });
          return;
        }

        const pearls = Math.max(0, Number(result.bonusPearls || DEFAULT_PEARLS));
        const buddyCredits = Math.max(0, Number(result.buddyCredits || DEFAULT_BUDDY_CREDITS));
        current.plusWelcome ||= {
          version: 1,
          claimedAt: Date.now(),
          bonusPearlsGranted: 0,
          buddyCredits: 0,
          nativeCheckedAt: Date.now(),
        };
        current.pearls = Math.max(0, Number(current.pearls || 0)) + pearls;
        current.plusWelcome.bonusPearlsGranted = Math.max(
          Math.max(0, Number(current.plusWelcome.bonusPearlsGranted || 0)),
          pearls,
        );
        current.plusWelcome.buddyCredits = Math.max(0, Number(current.plusWelcome.buddyCredits || 0)) + buddyCredits;
        current.plusWelcome.nativeCheckedAt = Date.now();
        persist();
        refresh();
        notify("✦", `Gillie Plus restored · +${pearls} pearls and first tank mate included`);
        setTimeout(() => showRecoveryOverlay(pearls, buddyCredits), 220);
        track("plus_welcome_bundle_recovered", { pearls, buddyCredits, engine: ENGINE });
        completed = true;
      } catch (error) {
        track("plus_welcome_recovery_failed", {
          message: String(error?.message || error).slice(0, 80),
          engine: ENGINE,
        });
        scheduleAttempt(2500);
      } finally {
        inFlight = false;
      }
    }

    try {
      window.Capacitor?.Plugins?.GilliePurchases?.addListener?.("entitlementChanged", () => scheduleAttempt(500));
    } catch (_) {}

    afterRender(() => scheduleAttempt(900));
    scheduleAttempt(1200);
    document.documentElement.dataset.welcomeRecoveryEngine = ENGINE;
    track("plus_welcome_recovery_installed", { engine: ENGINE });
  });
})();