/* Gillie V1 Moonlit preview art isolation — preserve authored SVG transforms without global animation collisions. */
(() => {
  "use strict";

  window.GillieV1?.register("moonlit-preview-art", ({ qs, qsa, afterRender, track }) => {
    const ART_ENGINE = "class-isolated-v3";
    const view = qs("#view-reef");
    if (!view) return;

    let lastSanitizedSvg = null;

    function sanitizePreviewSvg() {
      const svg = qs(".moonlit-preview-gillie-svg");
      if (!svg || svg === lastSanitizedSvg) return Boolean(svg);

      const gills = qsa("g.gill[transform]", svg);
      if (gills.length !== 6) {
        svg.dataset.moonlitArtEngine = "invalid-gill-count";
        svg.dataset.moonlitGillCount = String(gills.length);
        console.warn(`Moonlit Gillie expected 6 transformed gills, found ${gills.length}.`);
        return false;
      }

      // axoSVG() uses semantic animation classes such as .gill, .axo-core,
      // and .axo-tail. Those classes are correct in the live tank, but the
      // app-wide CSS rules override each group's SVG transform in a standalone
      // preview. Removing only descendant classes preserves the authored
      // translate/rotate attributes and permanently keeps every gill attached.
      for (const node of qsa("[class]", svg)) {
        node.removeAttribute("class");
        node.style?.removeProperty?.("animation");
        node.style?.removeProperty?.("transform");
        node.style?.removeProperty?.("transform-origin");
      }

      svg.dataset.moonlitArtEngine = ART_ENGINE;
      svg.dataset.moonlitGillCount = "6";
      lastSanitizedSvg = svg;
      track("moonlit_preview_art_sanitized", { engine: ART_ENGINE, gills: 6 });
      return true;
    }

    function scheduleSanitize() {
      // The capture listener runs before Moonlit's normal click handler. These
      // callbacks run after openPreview() injects the SVG but before/at paint.
      queueMicrotask(sanitizePreviewSvg);
      requestAnimationFrame(sanitizePreviewSvg);
    }

    view.addEventListener("click", (event) => {
      if (event.target?.closest?.("[data-moonlit-preview]")) {
        lastSanitizedSvg = null;
        scheduleSanitize();
      }
    }, true);

    afterRender(() => {
      const overlay = qs("#moonlit-reef-preview");
      if (overlay && !overlay.hidden) {
        lastSanitizedSvg = null;
        scheduleSanitize();
      }
    });

    scheduleSanitize();
  });
})();
