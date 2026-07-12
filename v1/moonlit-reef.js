/* Gillie V1 Moonlit Reef — previewable premium collection and one-tap full-set equip. */
(() => {
  "use strict";

  window.GillieV1?.register("moonlit-reef", ({ qs, afterRender, notify, track, getState }) => {
    const view = qs("#view-reef");
    if (!view) return;

    const COLLECTION_ENGINE = "moonlit-reef-v1";
    const THEME_ID = "moonlit";
    const SKIN_ID = "moonpearl";
    const TOTAL_PIECES = 6;
    let lockedView = null;
    let lockedScrollTop = 0;
    let catalogTriggeredRender = false;

    const MOONLIT_THEME = {
      id: THEME_ID,
      name: "Moonlit Reef",
      tint: "linear-gradient(180deg, rgba(79,91,154,.34), rgba(16,25,67,.64))",
      blend: "multiply",
      sand: "#9296AC",
      premium: true,
    };

    const MOON_PEARL_SKIN = {
      id: SKIN_ID,
      name: "Moon Pearl",
      body: "#B9C9FF",
      belly: "#EEF2FF",
      gill: "#C0A7F1",
      shade: "#8598D2",
      gillDeep: "#7763B5",
      premium: true,
    };

    const CRESCENT_ARCH_SVG = `<svg viewBox="0 0 92 104" aria-hidden="true"><path d="M66 9c-20 5-34 24-31 45 2 17 14 30 30 35-8 6-18 9-29 8C14 95-2 75 1 51 4 27 25 10 49 10c6 0 12 1 17 3z" fill="#DCE5FF" opacity=".92"/><path d="M21 96h58" stroke="#817AA8" stroke-width="7" stroke-linecap="round"/><circle cx="70" cy="26" r="3" fill="#FFF5C8"/><circle cx="78" cy="42" r="2" fill="#FFF5C8"/></svg>`;
    const STAR_CORAL_SVG = `<svg viewBox="0 0 92 88" aria-hidden="true"><path d="M46 85V41M46 58L28 39M46 51l18-21M46 68l24-12M46 63L21 58" stroke="#AFA2EE" stroke-width="8" stroke-linecap="round"/><circle cx="46" cy="37" r="10" fill="#DDD5FF"/><circle cx="27" cy="37" r="8" fill="#C9BDF8"/><circle cx="66" cy="28" r="8" fill="#C9BDF8"/><circle cx="72" cy="55" r="8" fill="#DDD5FF"/><circle cx="20" cy="58" r="7" fill="#DDD5FF"/><circle cx="46" cy="37" r="3" fill="#FFF6C9"/><circle cx="27" cy="37" r="2.5" fill="#FFF6C9"/><circle cx="66" cy="28" r="2.5" fill="#FFF6C9"/></svg>`;
    const MOON_JELLY_SVG = `<svg viewBox="0 0 86 112" aria-hidden="true"><path d="M10 49C10 25 24 8 43 8s33 17 33 41c0 8-5 12-13 12H23c-8 0-13-4-13-12z" fill="#D8E2FF" opacity=".92"/><ellipse cx="31" cy="31" rx="9" ry="14" fill="#F6F8FF" opacity=".72"/><circle cx="34" cy="47" r="3" fill="#263657"/><circle cx="53" cy="47" r="3" fill="#263657"/><path d="M37 54q6 6 12 0" fill="none" stroke="#5E6A94" stroke-width="3" stroke-linecap="round"/><path d="M24 61c-8 17 6 25-1 43M39 61c7 18-6 28 2 46M55 61c-8 17 7 25-1 42M68 59c6 15-4 24 2 37" fill="none" stroke="#AFA7E8" stroke-width="5" stroke-linecap="round"/></svg>`;

    function currentState() {
      return getState?.();
    }

    function ensureCollectionState(current) {
      const existing = current.moonlitReef && typeof current.moonlitReef === "object" ? current.moonlitReef : {};
      current.moonlitReef = {
        ambienceEquipped: Boolean(existing.ambienceEquipped),
        jellyEquipped: Boolean(existing.jellyEquipped),
        crescentEquipped: Boolean(existing.crescentEquipped),
        starCoralEquipped: Boolean(existing.starCoralEquipped),
        previewedAt: Math.max(0, Number(existing.previewedAt || 0)),
        equippedAt: Math.max(0, Number(existing.equippedAt || 0)),
      };
      return current.moonlitReef;
    }

    function persist() {
      try { if (typeof save === "function") save(); } catch (_) {}
    }

    function installCatalog() {
      let changed = false;
      try {
        if (typeof THEMES !== "undefined" && Array.isArray(THEMES) && !THEMES.some((theme) => theme.id === THEME_ID)) {
          THEMES.push(MOONLIT_THEME);
          changed = true;
        }
        if (typeof SKINS !== "undefined" && Array.isArray(SKINS) && !SKINS.some((skin) => skin.id === SKIN_ID)) {
          SKINS.push(MOON_PEARL_SKIN);
          changed = true;
        }
        if (typeof CONFIG !== "undefined" && Array.isArray(CONFIG.plus?.valueCards)) {
          const value = "Animated Moonlit Reef, rare Gillie colors, tank mates, exclusive items, and 2x pearls";
          if (!CONFIG.plus.valueCards.some((card) => /Moonlit Reef/i.test(card))) {
            CONFIG.plus.valueCards = CONFIG.plus.valueCards.map((card, index) => index === CONFIG.plus.valueCards.length - 1 ? value : card);
          }
        }
      } catch (_) {}
      return changed;
    }

    function collectionStatus(current) {
      const collection = ensureCollectionState(current);
      const active = Boolean(current.premium);
      const checks = [
        active && current.theme === THEME_ID,
        active && current.skin === SKIN_ID,
        active && current.theme === THEME_ID && collection.ambienceEquipped,
        active && collection.jellyEquipped,
        active && collection.crescentEquipped,
        active && collection.starCoralEquipped,
      ];
      return { count: checks.filter(Boolean).length, complete: checks.every(Boolean), checks };
    }

    function openPlus() {
      const button = qs("#plus-open") || qs("#set-plus");
      if (button) button.click();
      else notify("👑", "Gillie Plus is available from the You tab.");
    }

    function refreshApp() {
      try {
        if (typeof renderAxo === "function") renderAxo();
        if (typeof renderAll === "function") renderAll();
        else renderMoonlit();
      } catch (_) {
        renderMoonlit();
      }
    }

    function equipFullCollection() {
      const current = currentState();
      if (!current) return;
      if (!current.premium) {
        closePreview();
        requestAnimationFrame(openPlus);
        track("moonlit_equip_gated", { engine: COLLECTION_ENGINE });
        return;
      }

      const collection = ensureCollectionState(current);
      current.theme = THEME_ID;
      current.skin = SKIN_ID;
      collection.ambienceEquipped = true;
      collection.jellyEquipped = true;
      collection.crescentEquipped = true;
      collection.starCoralEquipped = true;
      collection.equippedAt = Date.now();
      persist();
      closePreview();
      refreshApp();
      notify("🌙", "Moonlit Reef equipped · full collection active");
      track("moonlit_collection_equipped", { pieces: TOTAL_PIECES, engine: COLLECTION_ENGINE });
    }

    function moonJellyMarkup(className = "moonlit-jelly") {
      return `<div class="${className}">${MOON_JELLY_SVG}</div>`;
    }

    function renderLiveTank(current) {
      const tank = qs("#tank");
      if (!tank) return;
      const collection = ensureCollectionState(current);
      const activeTheme = Boolean(current.premium && current.theme === THEME_ID);
      if (activeTheme && !collection.ambienceEquipped) {
        collection.ambienceEquipped = true;
        persist();
      }
      tank.classList.toggle("moonlit-reef-live", activeTheme && collection.ambienceEquipped);

      let light = qs("#moonlit-light-layer", tank);
      if (activeTheme && collection.ambienceEquipped) {
        if (!light) {
          light = document.createElement("div");
          light.id = "moonlit-light-layer";
          light.innerHTML = `<i class="moonlit-moon"></i><i class="moonlit-ray r1"></i><i class="moonlit-ray r2"></i><span class="moonlit-live-particles">${Array.from({ length: 13 }, (_, index) => `<b style="--i:${index};--x:${7 + ((index * 17) % 84)}%;--y:${14 + ((index * 23) % 58)}%"></b>`).join("")}</span>`;
          tank.appendChild(light);
        }
      } else {
        light?.remove();
      }

      const decorLayer = qs("#decor-layer", tank);
      if (decorLayer) {
        qs("#moonlit-crescent-live", decorLayer)?.remove();
        qs("#moonlit-star-coral-live", decorLayer)?.remove();
        if (activeTheme && collection.crescentEquipped) {
          const crescent = document.createElement("div");
          crescent.id = "moonlit-crescent-live";
          crescent.className = "moonlit-live-decor moonlit-crescent-live";
          crescent.innerHTML = CRESCENT_ARCH_SVG;
          decorLayer.appendChild(crescent);
        }
        if (activeTheme && collection.starCoralEquipped) {
          const coral = document.createElement("div");
          coral.id = "moonlit-star-coral-live";
          coral.className = "moonlit-live-decor moonlit-star-coral-live";
          coral.innerHTML = STAR_CORAL_SVG;
          decorLayer.appendChild(coral);
        }
      }

      const buddyLayer = qs("#buddy-layer", tank);
      if (buddyLayer) {
        qs("#moonlit-jelly-live", buddyLayer)?.remove();
        if (activeTheme && collection.jellyEquipped) {
          const jelly = document.createElement("div");
          jelly.id = "moonlit-jelly-live";
          jelly.className = "moonlit-jelly-live";
          jelly.innerHTML = MOON_JELLY_SVG;
          buddyLayer.appendChild(jelly);
        }
      }
    }

    function renderSeasonalCard(current) {
      const seasonal = qs(".phase2-seasonal", view);
      if (!seasonal) return;
      const status = collectionStatus(current);
      seasonal.classList.add("moonlit-seasonal-card");
      seasonal.dataset.collectionEngine = COLLECTION_ENGINE;
      seasonal.innerHTML = `
        <div class="moonlit-seasonal-head"><div><small>Seasonal current · Gillie Plus</small><b>Moonlit Reef</b><span>A living night-water collection for the wins nobody else sees.</span></div><i aria-hidden="true">☾</i></div>
        <div class="moonlit-seasonal-progress"><span><i style="width:${Math.round((status.count / TOTAL_PIECES) * 100)}%"></i></span><b>${status.count}/${TOTAL_PIECES} equipped</b></div>
        <div class="moonlit-seasonal-actions"><button type="button" data-moonlit-preview>Preview free</button><button type="button" data-moonlit-equip>${!current.premium ? "Equip with Plus" : status.complete ? "Equipped ✓" : "Equip full set"}</button></div>`;
    }

    function updateVault(current) {
      const vault = qs("#v1-reef-vault", view);
      if (!vault) return;
      const paragraph = qs("p", vault);
      if (paragraph) paragraph.textContent = "Moonlit Reef is live now with animated moonlight, the Moon Pearl skin, a moon-jelly tank mate, and matching décor. Plus also includes Coach care and 2× pearls.";
      const chips = qs(".v1-reef-vault-chips", vault);
      if (chips && !qs('[data-moonlit-chip="true"]', chips)) {
        const chip = document.createElement("span");
        chip.dataset.moonlitChip = "true";
        chip.textContent = "Moonlit Reef";
        chips.prepend(chip);
      }
      const button = qs("[data-reef-vault-action]", vault);
      if (button && current.premium) button.textContent = "Browse premium collection";
    }

    function lockPreviewBackground() {
      lockedView = qs("#main .view:not([hidden])");
      lockedScrollTop = lockedView?.scrollTop || 0;
      if (lockedView) {
        lockedView.dataset.moonlitPreviousOverflow = lockedView.style.overflow || "";
        lockedView.dataset.moonlitPreviousTouchAction = lockedView.style.touchAction || "";
        lockedView.style.overflow = "hidden";
        lockedView.style.touchAction = "none";
      }
      document.body.classList.add("sheet-open", "moonlit-preview-open");
    }

    function unlockPreviewBackground() {
      if (lockedView) {
        lockedView.style.overflow = lockedView.dataset.moonlitPreviousOverflow || "";
        lockedView.style.touchAction = lockedView.dataset.moonlitPreviousTouchAction || "";
        lockedView.scrollTop = lockedScrollTop;
        delete lockedView.dataset.moonlitPreviousOverflow;
        delete lockedView.dataset.moonlitPreviousTouchAction;
      }
      lockedView = null;
      document.body.classList.remove("sheet-open", "moonlit-preview-open");
    }

    function previewGillieMarkup() {
      try {
        if (typeof axoSVG === "function") return axoSVG(SKIN_ID, null, "happy", `moonlit-preview-${Date.now()}`);
      } catch (_) {}
      return "";
    }

    function ensurePreview() {
      let overlay = qs("#moonlit-reef-preview");
      if (overlay) return overlay;
      overlay = document.createElement("div");
      overlay.id = "moonlit-reef-preview";
      overlay.hidden = true;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", "Moonlit Reef collection preview");
      overlay.innerHTML = `
        <div class="moonlit-preview-scroll">
          <button type="button" class="moonlit-preview-close" data-moonlit-close aria-label="Close Moonlit Reef preview">×</button>
          <div class="moonlit-preview-copy"><span>Gillie Plus seasonal collection</span><h2>Moonlit Reef</h2><p>A quiet, animated reef built for late-night wins and the moments you chose yourself.</p></div>
          <div class="moonlit-preview-tank">
            <div class="moonlit-preview-moon"></div><div class="moonlit-preview-rays"></div>
            <div class="moonlit-preview-stars">${Array.from({ length: 16 }, (_, index) => `<i style="--i:${index};--x:${6 + ((index * 13) % 86)}%;--y:${13 + ((index * 19) % 59)}%"></i>`).join("")}</div>
            <div class="moonlit-preview-crescent">${CRESCENT_ARCH_SVG}</div>
            <div class="moonlit-preview-coral">${STAR_CORAL_SVG}</div>
            ${moonJellyMarkup("moonlit-preview-jelly")}
            <div class="moonlit-preview-gillie"><svg viewBox="0 0 200 160"></svg></div>
            <div class="moonlit-preview-sand"></div>
          </div>
          <div class="moonlit-preview-items">
            <div><i>☾</i><span><b>Animated moonlight</b><small>Moving rays and drifting night particles</small></span></div>
            <div><i>◐</i><span><b>Moonlit Reef theme</b><small>Deep indigo water and silver sand</small></span></div>
            <div><i>✦</i><span><b>Moon Pearl Gillie</b><small>An exclusive lavender-blue shimmer</small></span></div>
            <div><i>◌</i><span><b>Moon-jelly tank mate</b><small>A softly glowing companion</small></span></div>
            <div><i>☽</i><span><b>Crescent Arch</b><small>A silver moon resting on the reef floor</small></span></div>
            <div><i>✧</i><span><b>Star Coral</b><small>Matching luminous coral</small></span></div>
          </div>
          <button type="button" class="moonlit-preview-cta" data-moonlit-preview-cta></button>
          <p class="moonlit-preview-note">Preview is free. Gillie Plus is only required when you equip the collection.</p>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", (event) => {
        if (event.target.closest("[data-moonlit-close]")) closePreview();
        if (event.target.closest("[data-moonlit-preview-cta]")) equipFullCollection();
      });
      return overlay;
    }

    function openPreview() {
      const current = currentState();
      if (!current) return;
      const collection = ensureCollectionState(current);
      const status = collectionStatus(current);
      const overlay = ensurePreview();
      const svg = qs(".moonlit-preview-gillie svg", overlay);
      if (svg) svg.innerHTML = previewGillieMarkup();
      const cta = qs("[data-moonlit-preview-cta]", overlay);
      if (cta) cta.textContent = !current.premium ? "Unlock Gillie Plus to equip" : status.complete ? "Moonlit Reef is equipped" : "Equip full collection";
      collection.previewedAt = Date.now();
      persist();
      overlay.hidden = false;
      lockPreviewBackground();
      track("moonlit_collection_previewed", { premium: Boolean(current.premium), engine: COLLECTION_ENGINE });
    }

    function closePreview() {
      const overlay = qs("#moonlit-reef-preview");
      if (overlay) overlay.hidden = true;
      unlockPreviewBackground();
    }

    function renderMoonlit() {
      const current = currentState();
      if (!current || !current.onboarded) return;
      ensureCollectionState(current);
      renderLiveTank(current);
      renderSeasonalCard(current);
      updateVault(current);
    }

    view.addEventListener("click", (event) => {
      if (event.target.closest("[data-moonlit-preview]")) {
        openPreview();
        return;
      }
      if (event.target.closest("[data-moonlit-equip]")) equipFullCollection();
    });

    const catalogChanged = installCatalog();
    afterRender(renderMoonlit);
    renderMoonlit();
    requestAnimationFrame(renderMoonlit);
    if (catalogChanged && !catalogTriggeredRender) {
      catalogTriggeredRender = true;
      requestAnimationFrame(() => {
        try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
      });
    }
    track("moonlit_collection_installed", { engine: COLLECTION_ENGINE, pieces: TOTAL_PIECES });
  });
})();
