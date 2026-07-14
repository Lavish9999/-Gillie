/* Gillie V1 Launch Handoff — release the first-paint veil only after the animated intro owns the screen. */
(() => {
  "use strict";

  if (window.__gillieLaunchHandoffInstalled) return;
  window.__gillieLaunchHandoffInstalled = true;
  const ENGINE = "launch-handoff-v1-single-intro";

  function release(reason = "intro-mounted") {
    const intro = document.querySelector("#splash.gillie-launch-intro");
    if (!intro && reason !== "fallback") return false;
    document.documentElement.classList.remove("gillie-boot-pending");
    document.documentElement.dataset.launchHandoffEngine = ENGINE;
    try {
      window.Capacitor?.Plugins?.GilliePurchases?.trackEvent?.({
        name: "launch_handoff_released",
        properties: { engine: ENGINE, reason },
      });
    } catch (_) {}
    return true;
  }

  function install() {
    requestAnimationFrame(() => {
      if (!release("intro-mounted")) {
        requestAnimationFrame(() => release("intro-second-frame"));
      }
    });
    document.addEventListener("gillie:launch-intro-complete", () => release("intro-complete"), { once: true });
    setTimeout(() => release("fallback"), 1200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
