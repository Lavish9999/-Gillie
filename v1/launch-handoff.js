/* Gillie V1 Launch Handoff — release the first-paint veil only after the animated intro owns the screen. */
(() => {
  "use strict";

  if (window.__gillieLaunchHandoffInstalled) return;
  window.__gillieLaunchHandoffInstalled = true;
  const ENGINE = "launch-handoff-v1-single-intro";

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

  function install() {
    requestAnimationFrame(() => {
      if (!release("intro-mounted")) {
        requestAnimationFrame(() => release("intro-second-frame"));
      }
    });
    document.addEventListener("gillie:launch-intro-complete", () => release("intro-complete"), { once: true });

    // Never leave a user on the blank launch surface. These fallbacks are
    // intentionally independent of the animation, StoreKit, and the paywall.
    setTimeout(() => emergencyRelease("fallback-1200ms"), 1200);
    setTimeout(() => emergencyRelease("emergency-3000ms"), 3000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
