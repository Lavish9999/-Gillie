/* Gillie V1 SOS — regulate first, reflect after the moment has eased. */
(() => {
  "use strict";

  window.GillieV1?.register("sos", ({ qs, track }) => {
    const overlay = qs("#sos-overlay");
    const fab = qs("#sos-fab");
    const beat = qs("#sos-beat");
    const slipped = qs("#sos-slipped");
    if (!overlay || !fab || !beat) return;

    const intro = qs(".sos-box > p", overlay);
    if (intro) intro.textContent = "Cravings often rise and ease. Start with one slow breath and stay with this moment — you do not have to decide anything yet.";
    if (slipped) slipped.textContent = "I used — help me reset";

    const refineActionCopy = () => {
      if (overlay.hidden) return;
      if (!beat.disabled) beat.textContent = "I made it through this moment";
    };

    fab.addEventListener("click", () => {
      overlay.classList.remove("v1-sos-reflect");
      setTimeout(refineActionCopy, 0);
      let seconds = 12;
      try {
        if (typeof CONFIG !== "undefined") seconds = Number(CONFIG?.sos?.minBreathSecs) || seconds;
      } catch (_) {}
      setTimeout(refineActionCopy, seconds * 1000 + 80);
      track("sos_relief_started");
    }, true);

    beat.addEventListener("click", () => {
      overlay.classList.add("v1-sos-reflect");
      track("sos_relief_completed");
    }, true);

    slipped?.addEventListener("click", () => track("sos_reset_requested"), true);
  });
})();
