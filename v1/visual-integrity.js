/* Gillie V1 visual integrity — removes template-like status UI and guards human layout. */
(() => {
  "use strict";

  window.GillieV1?.register("visual-integrity", ({ qs, qsa, afterRender, track }) => {
    const ENGINE = "visual-integrity-v1";
    const main = qs("#main");
    if (!main) return;

    function integrateAccessLabel(card, label) {
      if (!card) return;
      const eyebrow = qs(".eyebrow", card);
      if (eyebrow && !eyebrow.textContent.includes(label)) {
        eyebrow.textContent = `${eyebrow.textContent.trim()} · ${label}`;
      }
    }

    function removeTemplateBadges() {
      const plan = qs("#plan-preview");
      const planTag = qs(".tag", plan);
      if (planTag) {
        const text = planTag.textContent.trim().toUpperCase();
        if (text === "FREE") integrateAccessLabel(plan, "Free");
        if (["LIVE", "FREE"].includes(text)) planTag.remove();
      }

      const coach = qs("#coach-card");
      const coachTag = qs(".tag", coach);
      if (coachTag?.textContent.trim().toUpperCase() === "PLUS") {
        integrateAccessLabel(coach, "Plus");
        coachTag.remove();
      }

      qsa(".locked-teaser", main).forEach((card) => {
        const tag = qs(".tag", card);
        if (tag?.textContent.trim().toUpperCase() !== "PLUS") return;
        const title = qs(".t", card);
        if (title && !title.textContent.includes("Plus")) title.textContent = `${title.textContent.trim()} · Plus`;
        tag.remove();
      });

      qsa(".tag,.badge,[class*='status'],[class*='pill']", main).forEach((element) => {
        if (element.closest("[aria-live]")) return;
        const text = element.textContent.trim().toUpperCase();
        if (["LIVE", "BETA", "NEW"].includes(text)) element.remove();
      });
    }

    function normalizeDisplayTracking() {
      qsa("#main *").forEach((element) => {
        if (element.closest("svg") || element.classList.contains("phase2-sr-only")) return;
        const style = getComputedStyle(element);
        const fontSize = parseFloat(style.fontSize) || 0;
        const spacing = parseFloat(style.letterSpacing);
        if (fontSize >= 14 && Number.isFinite(spacing) && spacing > 1.4) {
          element.dataset.visualNormalTracking = "true";
        } else {
          delete element.dataset.visualNormalTracking;
        }
      });
    }

    function removeDecorativeAccentStripes() {
      qsa("[class*='card'],[class*='banner'],[class*='hero']", main).forEach((element) => {
        if (element.matches(".tank,[class*='preview-tank'],[class*='art']")) return;
        const style = getComputedStyle(element);
        const left = parseFloat(style.borderLeftWidth) || 0;
        const right = parseFloat(style.borderRightWidth) || 0;
        if (Math.max(left, right) >= 4) element.dataset.visualHeavyAccent = "true";
        else delete element.dataset.visualHeavyAccent;
      });
    }

    function compactOversizedStatusPills() {
      qsa(".tag,.badge,[class*='status'],[class*='pill']", main).forEach((element) => {
        if (element.matches("button,.btn") || element.closest("button")) return;
        const style = getComputedStyle(element);
        const height = element.getBoundingClientRect().height;
        const fontSize = parseFloat(style.fontSize) || 0;
        if (height > 50 || fontSize > 17) element.dataset.visualCompactStatus = "true";
        else delete element.dataset.visualCompactStatus;
      });
    }

    function collapseEmptyOversizedSurfaces() {
      qsa("[class*='card'],[class*='banner'],[class*='hero']", main).forEach((element) => {
        if (element.hidden || element.offsetParent === null) return;
        if (element.matches(".tank,[class*='preview'],[class*='art'],[class*='chart'],[class*='overlay'],[class*='sheet']")) return;
        const text = element.textContent.replace(/\s+/g, " ").trim();
        const hasMeaningfulMedia = Boolean(qs("img,svg,canvas,video,input,textarea,select", element));
        const height = element.getBoundingClientRect().height;
        if (height >= 220 && text.length < 32 && !hasMeaningfulMedia) element.dataset.visualEmptySurface = "true";
        else delete element.dataset.visualEmptySurface;
      });
    }

    function applyVisualIntegrity() {
      removeTemplateBadges();
      normalizeDisplayTracking();
      removeDecorativeAccentStripes();
      compactOversizedStatusPills();
      collapseEmptyOversizedSurfaces();
      document.documentElement.dataset.visualIntegrity = ENGINE;
    }

    afterRender(applyVisualIntegrity);
    applyVisualIntegrity();
    requestAnimationFrame(applyVisualIntegrity);
    setTimeout(applyVisualIntegrity, 140);
    track("visual_integrity_installed", { engine: ENGINE });
  });
})();
