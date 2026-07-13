/* Gillie V1 Moonlit Reef — previewable premium collection and one-tap full-set equip. */
(() => {
  "use strict";

  window.GillieV1?.register("moonlit-reef", ({ qs, afterRender, notify, track, getState }) => {
    const view = qs("#view-reef");
    if (!view) return;

    const COLLECTION_ENGINE = "moonlit-reef-v1";
    const PREVIEW_ART_ENGINE = "standalone-svg-v4";
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

    const CRESCENT_ARCH_SVG = `<svg viewBox="0 0 120 112" aria-hidden="true">
      <ellipse cx="60" cy="101" rx="47" ry="8" fill="#303653" opacity=".24"/>
      <path d="M15 96V57C15 29 35 8 60 8s45 21 45 49v39H88V58c0-18-12-32-28-32S32 40 32 58v38z" fill="#DCE5FF" opacity=".96"/>
      <path d="M62 18c-10 4-17 14-17 25 0 14 11 25 25 25 5 0 10-2 14-5-5 10-14 16-25 16-17 0-31-14-31-31 0-16 13-29 29-31 2 0 4 0 5 1z" fill="#9F91DD" opacity=".82"/>
      <rect x="9" y="92" width="102" height="13" rx="6.5" fill="#756D9F"/>
      <ellipse cx="28" cy="98" rx="14" ry="7" fill="#8A82B2"/>
      <ellipse cx="92" cy="98" rx="14" ry="7" fill="#8A82B2"/>
      <circle cx="45" cy="39" r="3" fill="#FFF4BD"/>
      <circle cx="75" cy="34" r="2.5" fill="#FFF4BD"/>
      <circle cx="81" cy="51" r="2" fill="#FFF4BD"/>
    </svg>`;

    const STAR_CORAL_SVG = `<svg viewBox="0 0 92 88" aria-hidden="true"><path d="M46 85V41M46 58L28 39M46 51l18-21M46 68l24-12M46 63L21 58" stroke="#AFA2EE" stroke-width="8" stroke-linecap="round"/><circle cx="46" cy="37" r="10" fill="#DDD5FF"/><circle cx="27" cy="37" r="8" fill="#C9BDF8"/><circle cx="66" cy="28" r="8" fill="#C9BDF8"/><circle cx="72" cy="55" r="8" fill="#DDD5FF"/><circle cx="20" cy="58" r="7" fill="#DDD5FF"/><circle cx="46" cy="37" r="3" fill="#FFF6C9"/><circle cx="27" cy="37" r="2.5" fill="#FFF6C9"/><circle cx="66" cy="28" r="2.5" fill="#FFF6C9"/></svg>`;

    const MOON_JELLY_SVG = `<svg viewBox="0 0 86 112" aria-hidden="true"><path d="M10 49C10 25 24 8 43 8s33 17 33 41c0 8-5 12-13 12H23c-8 0-13-4-13-12z" fill="#D8E2FF" opacity=".92"/><ellipse cx="31" cy="31" rx="9" ry="14" fill="#F6F8FF" opacity=".72"/><circle cx="34" cy="47" r="3" fill="#263657"/><circle cx="53" cy="47" r="3" fill="#263657"/><path d="M37 54q6 6 12 0" fill="none" stroke="#5E6A94" stroke-width="3" stroke-linecap="round"/><path d="M24 61c-8 17 6 25-1 43M39 61c7 18-6 28 2 46M55 61c-8 17 7 25-1 42M68 59c6 15-4 24 2 37" fill="none" stroke="#AFA7E8" stroke-width="5" stroke-linecap="round"/></svg>`;

    /*
     * Dedicated preview art. This does not call axoSVG() and intentionally has
     * no .gill/.axo-* classes or transformed gill groups. The six gills are
     * authored directly in final coordinates, so app-wide SVG animation rules
     * cannot detach or scatter them in WebKit.
     */
    const STANDALONE_MOON_PEARL_SVG = `<svg class="moonlit-preview-character-svg" viewBox="0 0 220 170" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-preview-character="standalone-v4">
      <defs>
        <radialGradient id="moonPearlBodyV4" cx="36%" cy="28%" r="86%">
          <stop offset="0%" stop-color="#F7F9FF"/>
          <stop offset="48%" stop-color="#C6D2FF"/>
          <stop offset="100%" stop-color="#8799D3"/>
        </radialGradient>
        <linearGradient id="moonPearlGillV4" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#D6C7FF"/>
          <stop offset="100%" stop-color="#7B68B8"/>
        </linearGradient>
        <linearGradient id="moonPearlFinV4" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#BBA9F0"/>
          <stop offset="100%" stop-color="#7261AA"/>
        </linearGradient>
      </defs>

      <path data-moonlit-gill="left-upper" d="M48 49 C37 40 25 34 15 35 C9 36 7 42 10 47 C17 56 31 58 47 55 Z" fill="url(#moonPearlGillV4)"/>
      <path d="M42 48 C33 43 24 41 16 43" fill="none" stroke="#F3EEFF" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>
      <path data-moonlit-gill="left-middle" d="M38 68 C25 62 13 62 6 68 C2 72 4 78 9 81 C19 86 31 81 41 75 Z" fill="url(#moonPearlGillV4)"/>
      <path d="M34 68 C24 66 16 68 10 72" fill="none" stroke="#F3EEFF" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>
      <path data-moonlit-gill="left-lower" d="M45 88 C33 91 23 99 20 108 C18 114 23 118 29 117 C40 114 47 104 52 94 Z" fill="url(#moonPearlGillV4)"/>
      <path d="M43 92 C34 97 29 103 27 110" fill="none" stroke="#F3EEFF" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>

      <path data-moonlit-gill="right-upper" d="M108 48 C120 39 133 33 143 35 C149 36 151 42 148 47 C141 56 126 58 110 55 Z" fill="url(#moonPearlGillV4)"/>
      <path d="M114 48 C123 43 133 41 141 43" fill="none" stroke="#F3EEFF" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>
      <path data-moonlit-gill="right-middle" d="M117 68 C130 62 142 62 149 68 C153 72 151 78 146 81 C136 86 124 81 114 75 Z" fill="url(#moonPearlGillV4)"/>
      <path d="M121 68 C131 66 139 68 145 72" fill="none" stroke="#F3EEFF" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>
      <path data-moonlit-gill="right-lower" d="M111 88 C123 91 133 99 136 108 C138 114 133 118 127 117 C116 114 109 104 104 94 Z" fill="url(#moonPearlGillV4)"/>
      <path d="M113 92 C122 97 127 103 129 110" fill="none" stroke="#F3EEFF" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>

      <path d="M139 95 C165 69 192 70 210 78 C205 91 195 102 181 108 C197 111 202 121 195 132 C174 137 153 129 137 114 Z" fill="url(#moonPearlFinV4)" opacity=".95"/>
      <path d="M141 99 C165 93 183 85 202 80 C197 98 184 112 164 119 C153 121 145 117 137 112 Z" fill="url(#moonPearlBodyV4)"/>
      <path d="M151 105 C169 101 184 95 194 88" fill="none" stroke="#F2F5FF" stroke-width="4" stroke-linecap="round" opacity=".55"/>

      <ellipse cx="119" cy="108" rx="50" ry="32" fill="url(#moonPearlBodyV4)"/>
      <ellipse cx="117" cy="118" rx="31" ry="15" fill="#EEF2FF" opacity=".9"/>
      <ellipse cx="137" cy="132" rx="10" ry="7" fill="url(#moonPearlBodyV4)"/>
      <ellipse cx="102" cy="135" rx="11" ry="7" fill="url(#moonPearlBodyV4)"/>
      <circle cx="96" cy="137" r="1.7" fill="#8799D3"/>
      <circle cx="102" cy="139" r="1.7" fill="#8799D3"/>

      <ellipse cx="78" cy="75" rx="45" ry="43" fill="url(#moonPearlBodyV4)"/>
      <ellipse cx="62" cy="56" rx="17" ry="9" fill="#FFFFFF" opacity=".30"/>
      <circle cx="55" cy="84" r="7" fill="#C0A7F1" opacity=".28"/>
      <circle cx="101" cy="84" r="7" fill="#C0A7F1" opacity=".28"/>
      <ellipse cx="59" cy="69" rx="7" ry="8.5" fill="#173330"/>
      <circle cx="61.5" cy="65.5" r="2.3" fill="#fff"/>
      <circle cx="57" cy="72" r="1.2" fill="#fff" opacity=".72"/>
      <ellipse cx="96" cy="69" rx="7" ry="8.5" fill="#173330"/>
      <circle cx="98.5" cy="65.5" r="2.3" fill="#fff"/>
      <circle cx="94" cy="72" r="1.2" fill="#fff" opacity=".72"/>
      <path d="M66 93 Q78 101 91 93" fill="none" stroke="#7E4C59" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>
      <ellipse cx="78" cy="144" rx="30" ry="6" fill="#1A2342" opacity=".18"/>
    </svg>`;

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
          <div class="moonlit-preview-tank" data-preview-art="${PREVIEW_ART_ENGINE}">
            <div class="moonlit-preview-moon"></div><div class="moonlit-preview-rays"></div>
            <div class="moonlit-preview-stars">${Array.from({ length: 16 }, (_, index) => `<i style="--i:${index};--x:${6 + ((index * 13) % 86)}%;--y:${13 + ((index * 19) % 59)}%"></i>`).join("")}</div>
            <div class="moonlit-preview-crescent">${CRESCENT_ARCH_SVG}</div>
            <div class="moonlit-preview-coral">${STAR_CORAL_SVG}</div>
            ${moonJellyMarkup("moonlit-preview-jelly")}
            <div class="moonlit-preview-gillie">${STANDALONE_MOON_PEARL_SVG}</div>
            <div class="moonlit-preview-sand"></div>
          </div>
          <div class="moonlit-preview-items">
            <div><i>☾</i><span><b>Animated moonlight</b><small>Moving rays and drifting night particles</small></span></div>
            <div><i>◐</i><span><b>Moonlit Reef theme</b><small>Deep indigo water and silver sand</small></span></div>
            <div><i>✦</i><span><b>Moon Pearl Gillie</b><small>An exclusive lavender-blue shimmer</small></span></div>
            <div><i>◌</i><span><b>Moon-jelly tank mate</b><small>A softly glowing companion</small></span></div>
            <div><i>☽</i><span><b>Crescent Arch</b><small>A grounded lunar arch for the reef floor</small></span></div>
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
      const cta = qs("[data-moonlit-preview-cta]", overlay);
      if (cta) cta.textContent = !current.premium ? "Unlock Gillie Plus to equip" : status.complete ? "Moonlit Reef is equipped" : "Equip full collection";
      collection.previewedAt = Date.now();
      persist();
      overlay.hidden = false;
      lockPreviewBackground();
      track("moonlit_collection_previewed", { premium: Boolean(current.premium), engine: COLLECTION_ENGINE, art: PREVIEW_ART_ENGINE, gills: 6 });
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
    track("moonlit_collection_installed", { engine: COLLECTION_ENGINE, pieces: TOTAL_PIECES, art: PREVIEW_ART_ENGINE });
  });
})();
