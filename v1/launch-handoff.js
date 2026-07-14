/* Gillie V1 Launch Handoff — release the first-paint veil only after the animated intro owns the screen. */
(() => {
  "use strict";

  if (window.__gillieLaunchHandoffInstalled) return;
  window.__gillieLaunchHandoffInstalled = true;
  const ENGINE = "launch-handoff-v1-single-intro";
  const HATCH_HANDOFF_ENGINE = "post-hatch-handoff-v1";
  let hatchWatchFrame = 0;

  function storedOnboarded() {
    try {
      if (typeof state !== "undefined" && state) return Boolean(state.onboarded);
      return Boolean(JSON.parse(localStorage.getItem("gillie_v1") || "null")?.onboarded);
    } catch (_) {
      return false;
    }
  }

  function restoreShell() {
    const main = document.getElementById("main");
    const onboarding = document.getElementById("onboarding");
    const onboarded = storedOnboarded();

    if (onboarded) {
      if (onboarding) onboarding.hidden = true;
      if (main) main.hidden = false;
      try { if (typeof window.enterMain === "function") window.enterMain(); } catch (_) {}
      return;
    }

    if (main?.hidden !== false && onboarding) onboarding.hidden = false;
    try { if (typeof window.obRender === "function") window.obRender(); } catch (_) {}
  }

  function release(reason = "intro-mounted") {
    const splash = document.getElementById("splash");
    const intro = splash?.classList?.contains("gillie-launch-intro") ? splash : null;
    const bootstrap = splash?.classList?.contains("gillie-launch-bootstrap") ? splash : null;
    const isFallback = reason.startsWith("fallback") || reason.startsWith("emergency");

    if (!intro && !isFallback) return false;
    if (isFallback && bootstrap) bootstrap.remove();

    document.documentElement.classList.remove("gillie-boot-pending");
    document.documentElement.dataset.launchHandoffEngine = ENGINE;
    if (isFallback) restoreShell();

    try {
      window.Capacitor?.Plugins?.GilliePurchases?.trackEvent?.({
        name: "launch_handoff_released",
        properties: { engine: ENGINE, reason },
      });
    } catch (_) {}
    return true;
  }

  function emergencyRelease(reason) {
    release(reason);
    const bootstrap = document.querySelector("#splash.gillie-launch-bootstrap");
    if (bootstrap) bootstrap.remove();
    document.documentElement.classList.remove("gillie-boot-pending");
    restoreShell();
  }

  function ensureHatchHandoffStyle() {
    if (document.getElementById("gillie-hatch-handoff-style")) return;
    const style = document.createElement("style");
    style.id = "gillie-hatch-handoff-style";
    style.textContent = `
      html.gillie-hatch-handoff-active #phase2-hatch-cinematic.phase2-hatch-finish {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
      #gillie-hatch-handoff-shield {
        position: fixed;
        inset: 0;
        z-index: 219;
        pointer-events: none;
        opacity: 0;
        background: radial-gradient(circle at 50% 36%, #effffa, #98d8cc 40%, #144e49 100%);
        transition: opacity .24s ease;
      }
      #gillie-hatch-handoff-shield.gillie-hatch-shield-active { opacity: 1; }
      #gillie-hatch-handoff-shield.gillie-hatch-shield-out { opacity: 0; }
      @media (prefers-reduced-motion: reduce) {
        #gillie-hatch-handoff-shield { transition-duration: .01ms; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureHatchShield() {
    let shield = document.getElementById("gillie-hatch-handoff-shield");
    if (shield) return shield;
    shield = document.createElement("div");
    shield.id = "gillie-hatch-handoff-shield";
    shield.setAttribute("aria-hidden", "true");
    document.body.appendChild(shield);
    return shield;
  }

  function trackHatchHandoff(name, properties = {}) {
    try {
      window.Capacitor?.Plugins?.GilliePurchases?.trackEvent?.({
        name,
        properties: { engine: HATCH_HANDOFF_ENGINE, ...properties },
      });
    } catch (_) {}
  }

  function finishHatchHandoff(reason = "main-ready") {
    cancelAnimationFrame(hatchWatchFrame);
    hatchWatchFrame = 0;
    const shield = document.getElementById("gillie-hatch-handoff-shield");
    document.documentElement.classList.remove("gillie-hatch-handoff-active");
    if (!shield) return;
    requestAnimationFrame(() => {
      shield.classList.add("gillie-hatch-shield-out");
      setTimeout(() => {
        shield.classList.remove("gillie-hatch-shield-active", "gillie-hatch-shield-out");
      }, 280);
    });
    trackHatchHandoff("post_hatch_handoff_completed", { reason });
  }

  function watchHatchHandoff(startedAt) {
    const main = document.getElementById("main");
    const cinematic = document.getElementById("phase2-hatch-cinematic");
    const cinematicRunning = Boolean(cinematic?.classList?.contains("phase2-hatch-run"));
    const mainReady = Boolean(main && main.hidden === false);

    if (mainReady && !cinematicRunning) {
      finishHatchHandoff("main-ready");
      return;
    }
    if (Date.now() - startedAt > 10000) {
      finishHatchHandoff("safety-timeout");
      return;
    }
    hatchWatchFrame = requestAnimationFrame(() => watchHatchHandoff(startedAt));
  }

  function beginHatchHandoff() {
    cancelAnimationFrame(hatchWatchFrame);
    ensureHatchHandoffStyle();
    const shield = ensureHatchShield();
    shield.classList.remove("gillie-hatch-shield-out");
    shield.classList.add("gillie-hatch-shield-active");
    document.documentElement.classList.add("gillie-hatch-handoff-active");
    document.documentElement.dataset.hatchHandoffEngine = HATCH_HANDOFF_ENGINE;
    trackHatchHandoff("post_hatch_handoff_started");
    hatchWatchFrame = requestAnimationFrame(() => watchHatchHandoff(Date.now()));
  }

  function installHatchHandoff() {
    ensureHatchHandoffStyle();
    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.("#ob-hatch");
      if (!button || button.disabled) return;
      beginHatchHandoff();
    }, true);
  }

  function install() {
    requestAnimationFrame(() => {
      if (!release("intro-mounted")) {
        requestAnimationFrame(() => release("intro-second-frame"));
      }
    });
    document.addEventListener("gillie:launch-intro-complete", () => release("intro-complete"), { once: true });
    installHatchHandoff();

    // Never leave a user on the blank launch surface. These fallbacks are
    // intentionally independent of the animation, StoreKit, and the paywall.
    setTimeout(() => emergencyRelease("fallback-1200ms"), 1200);
    setTimeout(() => emergencyRelease("emergency-3000ms"), 3000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
