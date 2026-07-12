/* Gillie V1 Reef — fewer, better items with a consistent aquarium collection. */
(() => {
  "use strict";

  window.GillieV1?.register("reef", ({ qs, qsa, afterRender, track }) => {
    const view = qs("#view-reef");
    if (!view) return;

    const archivedNames = new Set([
      "No-Vaping Sign",
      "Party Hat",
      "Tiny Crown",
      "Treasure Chest",
      "Wizard Hat",
      "Mini Moai",
      "Sand Castle",
      "Sunken Ship",
      "Jellyfish Pal",
      "Bubble Volcano",
    ]);

    function cardName(card) {
      const named = qs(".name, .t, b, strong", card)?.textContent?.trim();
      if (named) return named;
      const text = card.textContent.replace(/Owned|Equipped|Wearing|Plus|Pearls|\d+/gi, " ").replace(/\s+/g, " ").trim();
      return [...archivedNames].find((name) => text.includes(name)) || text;
    }

    function namespacePreviewSvgIds(svg) {
      const prefix = `reef-preview-${Date.now().toString(36)}`;
      const nodes = Array.from(svg.querySelectorAll("[id]"));
      const idMap = new Map(nodes.map((node) => [node.id, `${prefix}-${node.id}`]));

      nodes.forEach((node) => {
        const original = node.id;
        node.id = idMap.get(original);
      });

      [svg, ...svg.querySelectorAll("*")].forEach((node) => {
        Array.from(node.attributes || []).forEach((attribute) => {
          let next = attribute.value;
          idMap.forEach((replacement, original) => {
            next = next.split(`#${original}`).join(`#${replacement}`);
          });
          if (next !== attribute.value) node.setAttribute(attribute.name, next);
        });
      });
    }

    function createPreviewCharacter() {
      const sourceSvg = qs("#axo-svg");
      if (!sourceSvg) return null;

      const previewSvg = sourceSvg.cloneNode(true);
      previewSvg.removeAttribute("id");
      previewSvg.classList.remove("flip", "swim", "celebrate", "tapjoy");
      previewSvg.classList.add("v1-preview-axo-svg");
      previewSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      previewSvg.setAttribute("aria-hidden", "true");
      namespacePreviewSvgIds(previewSvg);

      const previewWrap = document.createElement("div");
      previewWrap.className = "v1-preview-axo-wrap";
      previewWrap.setAttribute("aria-hidden", "true");
      previewWrap.appendChild(previewSvg);
      return previewWrap;
    }

    function repairTankPreview() {
      const overlay = qs("#phase2-tank-preview");
      const frame = overlay && qs(".phase2-preview-frame", overlay);
      const tank = frame && qs(".phase2-tank-clone", frame);
      if (!tank || tank.dataset.v1PreviewRepaired === "true") return;

      tank.classList.add("v1-tank-preview");
      tank.setAttribute("aria-hidden", "true");
      tank.querySelectorAll(".bubble, .mote, .phase2-tank-heart, .phase2-food, .phase2-celebration").forEach((node) => node.remove());

      const clonedSvg = tank.querySelector("svg[data-growth]");
      const clonedWrap = clonedSvg?.parentElement;
      const previewWrap = createPreviewCharacter();
      if (!clonedSvg || !clonedWrap || !previewWrap) return;

      clonedWrap.replaceWith(previewWrap);
      tank.dataset.v1PreviewRepaired = "true";
    }

    function decorate() {
      let intro = qs("#v1-reef-intro", view);
      if (!intro) {
        intro = document.createElement("section");
        intro.id = "v1-reef-intro";
        intro.className = "v1-reef-intro";
        intro.innerHTML = `<span class="v1-kicker">Curated aquarium collection</span><h2>Make the tank feel more like yours.</h2><p>Earn pearls through real recovery actions. Gillie keeps the collection intentionally small and calm.</p>`;
        qs(".topbar", view)?.insertAdjacentElement("afterend", intro);
      }

      const decorHeading = qsa(".section-h", view).find((node) => /decor/i.test(node.textContent));
      if (decorHeading) decorHeading.textContent = "Reef collection";

      qsa("#shop-grid > *", view).forEach((card) => {
        const name = cardName(card);
        const text = card.textContent.toLowerCase();
        const owned = card.classList.contains("owned") || card.classList.contains("equipped") || /owned|equipped|wearing/.test(text);
        const archived = archivedNames.has(name);
        card.hidden = archived && !owned;
        card.classList.toggle("v1-reef-archived-owned", archived && owned);
        card.classList.add("v1-reef-card");
      });

      qsa("#theme-row > *, #buddy-grid > *", view).forEach((card) => card.classList.add("v1-reef-card"));
    }

    afterRender(decorate);
    decorate();
    qs('#tabs [data-view="reef"]')?.addEventListener("click", () => {
      setTimeout(decorate, 40);
      setTimeout(decorate, 180);
      track("reef_opened_curated");
    });

    const previewButton = qs("#phase2-preview-tank");
    if (previewButton && previewButton.dataset.v1PreviewRepair !== "true") {
      previewButton.dataset.v1PreviewRepair = "true";
      previewButton.addEventListener("click", () => {
        requestAnimationFrame(repairTankPreview);
        setTimeout(repairTankPreview, 40);
      });
    }
  });
})();
