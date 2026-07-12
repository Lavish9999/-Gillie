/* Gillie V1 Reef — fewer, better items with a consistent aquarium collection. */
(() => {
  "use strict";

  window.GillieV1?.register("reef", ({ qs, qsa, afterRender, track, getState }) => {
    const view = qs("#view-reef");
    if (!view) return;

    const PREVIEW_OPEN_CLASS = "v1-reef-preview-open";
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

    let previewScrollY = 0;
    let previewView = null;
    let previewViewScrollTop = 0;
    let previewAppWasInert = false;
    let previewTouchY = 0;

    function cardName(card) {
      const named = qs(".name, .t, b, strong", card)?.textContent?.trim();
      if (named) return named;
      const text = card.textContent.replace(/Owned|Equipped|Wearing|Plus|Pearls|\d+/gi, " ").replace(/\s+/g, " ").trim();
      return [...archivedNames].find((name) => text.includes(name)) || text;
    }

    function flattenPreviewPaint(svg, current, namespace) {
      const fallback = {
        body: "#FFAEBB",
        belly: "#FFD6DD",
        shade: "#E98A9D",
        gill: "#F2708A",
        gillDeep: "#E2536F",
      };
      let skin = fallback;
      try {
        if (typeof skinOf === "function") skin = { ...fallback, ...skinOf(current.skin) };
      } catch (_) {}

      const paint = new Map([
        [`url(#${namespace}-body)`, skin.body || fallback.body],
        [`url(#${namespace}-gill)`, skin.gill || fallback.gill],
        [`url(#${namespace}-fin)`, skin.gill || fallback.gill],
      ]);

      svg.querySelectorAll("[fill]").forEach((node) => {
        const replacement = paint.get(node.getAttribute("fill"));
        if (replacement) node.setAttribute("fill", replacement);
      });
      svg.querySelector("defs")?.remove();
    }

    function createPreviewCharacter() {
      const current = getState?.();
      if (!current || typeof axoSVG !== "function") return null;

      const previewSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      previewSvg.setAttribute("viewBox", "0 0 200 160");
      previewSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      previewSvg.setAttribute("aria-hidden", "true");
      previewSvg.classList.add("v1-preview-axo-svg");

      const sourceGrowth = qs("#axo-svg")?.dataset.growth;
      if (sourceGrowth) previewSvg.dataset.growth = sourceGrowth;

      const recentlySlipped = Date.now() - Number(current.justSlippedAt || 0) < 6 * 60 * 60 * 1000;
      const namespace = `reefpreview-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      previewSvg.innerHTML = axoSVG(current.skin, current.hat, recentlySlipped ? "sad" : "happy", namespace);
      flattenPreviewPaint(previewSvg, current, namespace);

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

      const brokenSvg = tank.querySelector("svg[data-growth]");
      const brokenWrap = brokenSvg?.parentElement;
      const previewWrap = createPreviewCharacter();
      if (!brokenSvg || !brokenWrap || !previewWrap) return;

      brokenWrap.replaceWith(previewWrap);
      tank.dataset.v1PreviewRepaired = "true";
    }

    function lockPreviewScroll() {
      if (document.body.classList.contains(PREVIEW_OPEN_CLASS)) return;

      previewScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      previewView = qs("#main .view:not([hidden])");
      previewViewScrollTop = previewView?.scrollTop || 0;

      const app = qs("#app");
      previewAppWasInert = Boolean(app?.hasAttribute("inert"));
      if (app && !previewAppWasInert) app.setAttribute("inert", "");

      document.documentElement.classList.add(PREVIEW_OPEN_CLASS);
      document.body.classList.add(PREVIEW_OPEN_CLASS);
      document.body.style.top = `-${previewScrollY}px`;

      if (previewView) {
        previewView.dataset.v1PreviewLocked = "true";
        previewView.style.setProperty("overflow", "hidden", "important");
        previewView.style.setProperty("touch-action", "none", "important");
        previewView.style.setProperty("overscroll-behavior", "none", "important");
      }
    }

    function unlockPreviewScroll() {
      if (!document.body.classList.contains(PREVIEW_OPEN_CLASS)) return;

      const app = qs("#app");
      if (app && !previewAppWasInert) app.removeAttribute("inert");

      if (previewView) {
        previewView.style.removeProperty("overflow");
        previewView.style.removeProperty("touch-action");
        previewView.style.removeProperty("overscroll-behavior");
        delete previewView.dataset.v1PreviewLocked;
        previewView.scrollTop = previewViewScrollTop;
      }

      document.documentElement.classList.remove(PREVIEW_OPEN_CLASS);
      document.body.classList.remove(PREVIEW_OPEN_CLASS);
      document.body.style.top = "";
      requestAnimationFrame(() => window.scrollTo(0, previewScrollY));

      previewView = null;
      previewAppWasInert = false;
    }

    function handlePreviewTouchStart(event) {
      if (!document.body.classList.contains(PREVIEW_OPEN_CLASS)) return;
      previewTouchY = event.touches?.[0]?.clientY || 0;
    }

    function handlePreviewTouchMove(event) {
      if (!document.body.classList.contains(PREVIEW_OPEN_CLASS)) return;

      const sheet = event.target.closest?.("#phase2-tank-preview .phase2-preview-sheet");
      if (!sheet) {
        event.preventDefault();
        return;
      }

      const nextY = event.touches?.[0]?.clientY || previewTouchY;
      const deltaY = nextY - previewTouchY;
      previewTouchY = nextY;
      const atTop = sheet.scrollTop <= 0;
      const atBottom = Math.ceil(sheet.scrollTop + sheet.clientHeight) >= sheet.scrollHeight;
      const cannotScroll = sheet.scrollHeight <= sheet.clientHeight + 1;
      if (cannotScroll || (atTop && deltaY > 0) || (atBottom && deltaY < 0)) event.preventDefault();
    }

    function bindPreviewLifecycle(overlay) {
      if (!overlay || overlay.dataset.v1PreviewLifecycle === "true") return;
      overlay.dataset.v1PreviewLifecycle = "true";

      overlay.addEventListener("click", (event) => {
        if (!event.target.closest(".sheet-close, .phase2-preview-sheet > .btn")) return;
        requestAnimationFrame(unlockPreviewScroll);
      }, true);
    }

    function openPreviewRepair() {
      const overlay = qs("#phase2-tank-preview");
      if (!overlay || overlay.hidden) return;
      bindPreviewLifecycle(overlay);
      lockPreviewScroll();
      repairTankPreview();
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

    document.addEventListener("touchstart", handlePreviewTouchStart, { capture: true, passive: true });
    document.addEventListener("touchmove", handlePreviewTouchMove, { capture: true, passive: false });

    const previewButton = qs("#phase2-preview-tank");
    if (previewButton && previewButton.dataset.v1PreviewRepair !== "true") {
      previewButton.dataset.v1PreviewRepair = "true";
      previewButton.addEventListener("click", () => {
        lockPreviewScroll();
        requestAnimationFrame(openPreviewRepair);
        setTimeout(() => {
          const overlay = qs("#phase2-tank-preview");
          if (!overlay || overlay.hidden) unlockPreviewScroll();
          else openPreviewRepair();
        }, 60);
      }, true);
    }

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const overlay = qs("#phase2-tank-preview");
      if (!overlay || overlay.hidden) return;
      overlay.hidden = true;
      unlockPreviewScroll();
    });

    window.addEventListener("pagehide", unlockPreviewScroll);
  });
})();
