/* Gillie V1 SOS Support — human help without interrupting the breathing-first flow. */
(() => {
  "use strict";

  window.GillieV1?.register("sos-support", ({ qs, notify, track }) => {
    const SOS_SUPPORT_ENGINE = "sos-support-v1";
    const QUITLINE_PHONE = "+18007848669";
    const QUITLINE_TEXT = "333888";
    const TRUSTED_MESSAGE = "I’m having a strong nicotine craving. Can you stay with me for a few minutes while it passes?";

    function ensureSupportOverlay() {
      let overlay = qs("#v1-sos-support-overlay");
      if (overlay) return overlay;

      overlay = document.createElement("div");
      overlay.id = "v1-sos-support-overlay";
      overlay.className = "overlay v1-sos-support-overlay";
      overlay.hidden = true;
      overlay.innerHTML = `
        <div class="sheet v1-sos-support-sheet">
          <button type="button" class="sheet-close v1-sos-support-close" data-dialog-close aria-label="Close human support">×</button>
          <span class="v1-sos-support-kicker">HUMAN SUPPORT</span>
          <h2>Bring another person into this moment.</h2>
          <p class="sub">Gillie can help you slow down. A trained counselor or someone you trust can help you stay with the decision.</p>
          <div class="v1-sos-support-actions">
            <a href="tel:${QUITLINE_PHONE}" data-sos-support-action="quitline-call">
              <span aria-hidden="true">☎</span>
              <span><b>Call 1-800-QUIT-NOW</b><small>Free U.S. state quitline counseling</small></span>
            </a>
            <a href="sms:${QUITLINE_TEXT}" data-sos-support-action="quitline-text">
              <span aria-hidden="true">✉</span>
              <span><b>Text QUITNOW to 333888</b><small>Opens Messages to the U.S. quitline service</small></span>
            </a>
            <button type="button" data-sos-support-action="trusted-person">
              <span aria-hidden="true">♥</span>
              <span><b>Message someone I trust</b><small>Share a ready-to-send craving support message</small></span>
            </button>
            <a href="https://smokefree.gov/tools-tips/get-extra-help/speak-to-an-expert" target="_blank" rel="noopener noreferrer" data-sos-support-action="smokefree">
              <span aria-hidden="true">↗</span>
              <span><b>Open Smokefree.gov support</b><small>Official U.S. quit counseling and LiveHelp information</small></span>
            </a>
          </div>
          <p class="v1-sos-support-region">These phone and text options are U.S. resources. Message and data rates may apply.</p>
          <p class="v1-sos-support-emergency"><b>Gillie is not emergency or medical care.</b> For severe symptoms or immediate danger, contact your local emergency services.</p>
          <button type="button" class="btn ghost" data-dialog-close>Back to breathing</button>
        </div>`;
      document.body.appendChild(overlay);

      overlay.addEventListener("click", async (event) => {
        const close = event.target.closest("[data-dialog-close]");
        if (close) {
          overlay.hidden = true;
          document.body.classList.remove("v1-sos-support-open");
          track("sos_human_support_closed");
          return;
        }

        const action = event.target.closest("[data-sos-support-action]")?.dataset.sosSupportAction;
        if (!action) return;
        track("sos_human_support_action", { action });

        if (action !== "trusted-person") return;
        event.preventDefault();
        try {
          if (navigator.share) {
            await navigator.share({
              title: "Stay with me through this craving",
              text: TRUSTED_MESSAGE,
            });
            notify("♥", "Support message ready.");
            return;
          }
          await navigator.clipboard.writeText(TRUSTED_MESSAGE);
          notify("♥", "Support message copied. Send it to someone you trust.");
        } catch (error) {
          if (String(error?.name || "").includes("Abort")) return;
          notify("!", "Gillie could not open sharing. Try calling or texting someone directly.");
        }
      });

      return overlay;
    }

    function openSupport() {
      const overlay = ensureSupportOverlay();
      overlay.hidden = false;
      document.body.classList.add("sheet-open", "v1-sos-support-open");
      track("sos_human_support_opened");
    }

    function installEntryPoint() {
      const actions = qs("#sos-overlay .sos-actions");
      if (!actions || qs("[data-open-sos-support]", actions)) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn ghost v1-sos-human-support";
      button.dataset.openSosSupport = "true";
      button.textContent = "Talk to a person";
      const close = qs("#sos-close", actions);
      actions.insertBefore(button, close || null);
      button.addEventListener("click", openSupport);
    }

    installEntryPoint();
    ensureSupportOverlay();
    document.documentElement.dataset.sosSupportEngine = SOS_SUPPORT_ENGINE;
    track("sos_human_support_installed", { engine: SOS_SUPPORT_ENGINE });
  });
})();