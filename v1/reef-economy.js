/* Gillie Reef Economy — paced clarity, guaranteed clean-time gifts, and expanded collection. */
(() => {
  "use strict";

  if (window.__gillieReefEconomyInstalled) return;
  window.__gillieReefEconomyInstalled = true;

  const ENGINE = "reef-economy-v1-paced-clarity-guaranteed-gifts";
  const DAY_MS = 86400000;
  const CLARITY_CURVE = Object.freeze([
    { days: 0, percent: 25 },
    { days: 1, percent: 27 },
    { days: 3, percent: 31 },
    { days: 7, percent: 37 },
    { days: 14, percent: 45 },
    { days: 30, percent: 56 },
    { days: 60, percent: 67 },
    { days: 90, percent: 75 },
    { days: 180, percent: 88 },
    { days: 365, percent: 100 },
  ]);

  const CLEAN_GIFTS = Object.freeze([
    { days: 1, itemId: "sprout", name: "Sprout Hat" },
    { days: 3, itemId: "kelp", name: "Kelp Sprout" },
    { days: 7, itemId: "leaf", name: "Leaf Hat" },
    { days: 14, itemId: "coral", name: "Glow Coral" },
    { days: 30, itemId: "clam", name: "Pearl Clam" },
    { days: 60, itemId: "seaglass", name: "Sea Glass Stack" },
    { days: 90, itemId: "crystalcave", name: "Crystal Cave" },
    { days: 180, itemId: "lunararch", name: "Lunar Arch" },
    { days: 365, itemId: "reefbeacon", name: "Year One Beacon" },
  ]);

  const EXTRA_ITEMS = Object.freeze([
    { id: "driftwood", name: "Mossy Driftwood", type: "decor", price: 65, bondDays: 2, premium: false },
    { id: "anemone", name: "Bubble Anemone", type: "decor", price: 105, bondDays: 5, premium: false },
    { id: "moonshell", name: "Moon Shell", type: "decor", price: 140, bondDays: 10, premium: false },
    { id: "coralarch", name: "Coral Arch", type: "decor", price: 210, bondDays: 21, premium: false },
    { id: "seaglass", name: "Sea Glass Stack", type: "decor", price: 260, bondDays: 60, premium: false },
    { id: "crystalcave", name: "Crystal Cave", type: "decor", price: 420, bondDays: 90, premium: false },
    { id: "lunararch", name: "Lunar Arch", type: "decor", price: 520, bondDays: 180, premium: false },
    { id: "reefbeacon", name: "Year One Beacon", type: "decor", price: 700, bondDays: 365, premium: false },
  ]);

  const EXTRA_ART = Object.freeze({
    driftwood: `<svg width="82" height="46" viewBox="0 0 82 46"><path d="M7 35 C19 21 32 36 44 21 C55 8 68 16 76 7" fill="none" stroke="#87684D" stroke-width="10" stroke-linecap="round"/><path d="M19 31 q7 -11 14 -3 M49 21 q7 -11 14 -4" fill="none" stroke="#4F8D69" stroke-width="5" stroke-linecap="round"/><circle cx="20" cy="33" r="3" fill="#73A780"/><circle cx="55" cy="18" r="3" fill="#73A780"/></svg>`,
    anemone: `<svg width="62" height="62" viewBox="0 0 62 62"><ellipse cx="31" cy="53" rx="19" ry="7" fill="#B78A73"/><g fill="none" stroke-linecap="round"><path d="M31 50 Q18 34 14 17" stroke="#F2708A" stroke-width="6"/><path d="M31 50 Q27 30 31 9" stroke="#FFAEBB" stroke-width="7"/><path d="M31 50 Q42 32 49 15" stroke="#F3A7C7" stroke-width="6"/><path d="M31 50 Q37 33 39 20" stroke="#C9B8F0" stroke-width="5"/></g><circle cx="14" cy="16" r="4" fill="#FFD6DD"/><circle cx="31" cy="8" r="4" fill="#FFD6DD"/><circle cx="49" cy="14" r="4" fill="#E7DFFB"/></svg>`,
    moonshell: `<svg width="62" height="50" viewBox="0 0 62 50"><path d="M8 42 C7 18 22 4 39 8 C54 12 58 29 48 40 Z" fill="#D8CFF3" stroke="#9F86E0" stroke-width="3"/><path d="M19 38 C14 24 22 13 34 14 C44 15 49 25 44 34 C39 42 27 43 22 35 C18 29 21 22 28 20 C34 18 39 22 39 27" fill="none" stroke="#FFF5FD" stroke-width="4" stroke-linecap="round"/></svg>`,
    coralarch: `<svg width="88" height="72" viewBox="0 0 88 72"><path d="M12 70 V44 C12 19 27 7 44 7 C61 7 76 19 76 44 V70" fill="none" stroke="#F2708A" stroke-width="10" stroke-linecap="round"/><path d="M25 70 V48 C25 33 33 23 44 23 C55 23 63 33 63 48 V70" fill="none" stroke="#FFAEBB" stroke-width="6" stroke-linecap="round"/><circle cx="16" cy="34" r="5" fill="#FFD6DD"/><circle cx="72" cy="34" r="5" fill="#FFD6DD"/></svg>`,
    seaglass: `<svg width="66" height="52" viewBox="0 0 66 52"><path d="M7 45 L18 25 L31 45 Z" fill="#75CBB8" opacity=".9"/><path d="M23 45 L37 12 L52 45 Z" fill="#9EDCCE" opacity=".9"/><path d="M41 45 L52 26 L61 45 Z" fill="#7EB9D2" opacity=".9"/><path d="M4 46 H62" stroke="#E8D7B4" stroke-width="5" stroke-linecap="round"/></svg>`,
    crystalcave: `<svg width="90" height="72" viewBox="0 0 90 72"><path d="M6 70 C8 28 24 8 45 8 C67 8 83 29 84 70 Z" fill="#334B63"/><path d="M20 69 C22 40 31 25 45 25 C59 25 68 40 70 69 Z" fill="#142A38"/><path d="M18 52 L27 24 L35 54 Z" fill="#8EE4D0" opacity=".9"/><path d="M56 55 L64 20 L74 57 Z" fill="#B7F5E7" opacity=".85"/><path d="M38 42 L45 12 L52 45 Z" fill="#C9B8F0" opacity=".9"/></svg>`,
    lunararch: `<svg width="90" height="78" viewBox="0 0 90 78"><path d="M10 76 V48 C10 20 26 7 45 7 C64 7 80 20 80 48 V76" fill="none" stroke="#596A91" stroke-width="11" stroke-linecap="round"/><path d="M24 76 V50 C24 31 33 22 45 22 C57 22 66 31 66 50 V76" fill="none" stroke="#A8B3D9" stroke-width="5" stroke-linecap="round"/><circle cx="45" cy="8" r="6" fill="#FFF0AD"/><circle cx="16" cy="38" r="2.5" fill="#D9FFF6"/><circle cx="74" cy="34" r="2.5" fill="#D9FFF6"/></svg>`,
    reefbeacon: `<svg width="68" height="86" viewBox="0 0 68 86"><path d="M25 82 L30 28 H38 L43 82 Z" fill="#6E756F"/><path d="M18 82 H50" stroke="#B9AA96" stroke-width="7" stroke-linecap="round"/><rect x="19" y="16" width="30" height="24" rx="10" fill="#DFFCF4" stroke="#8FCFBE" stroke-width="4"/><circle cx="34" cy="28" r="8" fill="#FFE9A8"/><circle cx="34" cy="28" r="17" fill="#FFE9A8" opacity=".2" class="coral-glow"/><path d="M34 13 V4" stroke="#DFAE3F" stroke-width="4" stroke-linecap="round"/></svg>`,
  });

  const EXTRA_POSITIONS = Object.freeze({
    driftwood: "left:8%;bottom:10%",
    anemone: "right:10%;bottom:10%",
    moonshell: "left:55%;bottom:9%",
    coralarch: "left:35%;bottom:8%",
    seaglass: "right:28%;bottom:9%",
    crystalcave: "left:2%;bottom:8%",
    lunararch: "right:4%;bottom:8%",
    reefbeacon: "left:43%;bottom:8%",
  });

  let reconciling = false;
  let rerenderQueued = false;

  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const $$ = (selector, root = document) => Array.from(root?.querySelectorAll?.(selector) || []);

  function currentState() {
    try { return typeof state !== "undefined" && state ? state : null; } catch (_) { return null; }
  }

  function track(name, properties = {}) {
    try { window.Capacitor?.Plugins?.GilliePurchases?.trackEvent?.({ name, properties: { engine: ENGINE, ...properties } }); } catch (_) {}
  }

  function notify(icon, message) {
    try {
      if (typeof toast === "function") toast(icon, message);
      else window.GillieV1?.announce?.(message);
    } catch (_) {}
  }

  function persist() {
    try { if (typeof save === "function") save(); } catch (_) {}
  }

  function currentStreakDays(current = currentState()) {
    if (!current?.quitAt) return 0;
    return Math.max(0, Date.now() - Number(current.quitAt)) / DAY_MS;
  }

  function lifetimeCleanDays(current = currentState()) {
    if (!current) return 0;
    const currentMs = current.quitAt ? Math.max(0, Date.now() - Number(current.quitAt)) : 0;
    return (Math.max(0, Number(current.bankedCleanMs || 0)) + currentMs) / DAY_MS;
  }

  function interpolatedClarity(days) {
    const safeDays = Math.max(0, Number(days || 0));
    const last = CLARITY_CURVE[CLARITY_CURVE.length - 1];
    if (safeDays >= last.days) return last.percent;
    for (let index = 1; index < CLARITY_CURVE.length; index += 1) {
      const next = CLARITY_CURVE[index];
      if (safeDays > next.days) continue;
      const previous = CLARITY_CURVE[index - 1];
      const ratio = (safeDays - previous.days) / Math.max(1, next.days - previous.days);
      return Math.round(previous.percent + (next.percent - previous.percent) * ratio);
    }
    return CLARITY_CURVE[0].percent;
  }

  function retuneTankStages() {
    try {
      if (!Array.isArray(STAGES)) return;
      if (!STAGES.some((stage) => Number(stage?.days) === 180)) {
        STAGES.push({ days: 180, name: "Deep Current", murk: 0.12, w1: "#B2E6D8", w2: "#83C6B5", plants: 3, sunny: true, glow: true, sparkles: 7 });
      }
      STAGES.sort((a, b) => Number(a.days || 0) - Number(b.days || 0));
      STAGES.forEach((stage) => {
        const percent = interpolatedClarity(Number(stage.days || 0));
        stage.murk = Number((1 - percent / 100).toFixed(3));
      });
    } catch (_) {}
  }

  function installCollection() {
    try {
      if (Array.isArray(SHOP_ITEMS)) {
        const byId = new Map(SHOP_ITEMS.map((item) => [item.id, item]));
        EXTRA_ITEMS.forEach((item) => {
          if (!byId.has(item.id)) SHOP_ITEMS.push({ ...item });
        });
        CLEAN_GIFTS.forEach((gift) => {
          const item = SHOP_ITEMS.find((entry) => entry.id === gift.itemId);
          if (item) item.bondDays = gift.days;
        });
      }
      if (typeof DECOR_SVGS === "object" && DECOR_SVGS) Object.assign(DECOR_SVGS, EXTRA_ART);
      if (typeof DECOR_POS === "object" && DECOR_POS) Object.assign(DECOR_POS, EXTRA_POSITIONS);
    } catch (_) {}
  }

  function ensureGiftClaims(current) {
    current.reefProgress = current.reefProgress && typeof current.reefProgress === "object" ? current.reefProgress : {};
    current.reefProgress.cleanGiftClaims = current.reefProgress.cleanGiftClaims && typeof current.reefProgress.cleanGiftClaims === "object"
      ? current.reefProgress.cleanGiftClaims
      : {};
    current.ownedItems = Array.isArray(current.ownedItems) ? current.ownedItems : [];
    return current.reefProgress.cleanGiftClaims;
  }

  function queueRerender() {
    if (rerenderQueued) return;
    rerenderQueued = true;
    setTimeout(() => {
      rerenderQueued = false;
      try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
    }, 0);
  }

  function reconcileCleanGifts(reason = "render") {
    if (reconciling) return [];
    const current = currentState();
    if (!current?.onboarded) return [];

    reconciling = true;
    try {
      const claims = ensureGiftClaims(current);
      const days = Math.floor(lifetimeCleanDays(current));
      const newlyAdded = [];
      let changed = false;

      CLEAN_GIFTS.forEach((gift) => {
        if (days < gift.days || claims[gift.itemId]) return;
        const alreadyOwned = current.ownedItems.includes(gift.itemId);
        if (!alreadyOwned) {
          current.ownedItems.push(gift.itemId);
          newlyAdded.push(gift);
        }
        claims[gift.itemId] = { earnedAt: Date.now(), days: gift.days };
        changed = true;
        track("reef_clean_gift_granted", { item: gift.itemId, days: gift.days, retroactive: alreadyOwned, reason });
      });

      if (!changed) return [];
      persist();
      if (newlyAdded.length === 1) {
        const gift = newlyAdded[0];
        notify("🎁", `${gift.days}-day Reef gift unlocked · ${gift.name} added to your collection`);
      } else if (newlyAdded.length > 1) {
        notify("🎁", `${newlyAdded.length} clean-time Reef gifts recovered and added to your collection`);
      }
      queueRerender();
      return newlyAdded.map((gift) => gift.itemId);
    } finally {
      reconciling = false;
    }
  }

  function giftStatus(current = currentState()) {
    if (!current) return { earned: 0, next: CLEAN_GIFTS[0], days: 0 };
    const claims = ensureGiftClaims(current);
    const days = Math.floor(lifetimeCleanDays(current));
    const earned = CLEAN_GIFTS.filter((gift) => Boolean(claims[gift.itemId]) || current.ownedItems.includes(gift.itemId) && days >= gift.days).length;
    const next = CLEAN_GIFTS.find((gift) => days < gift.days || !claims[gift.itemId]) || null;
    return { earned, next, days };
  }

  function updateDashboard() {
    const current = currentState();
    const dashboard = $("#v1-reef-dashboard");
    if (!current || !dashboard) return;

    const metrics = $$(".v1-reef-metrics > div", dashboard);
    const clarityCard = metrics[0];
    if (clarityCard) {
      const clarity = interpolatedClarity(currentStreakDays(current));
      const label = $("span", clarityCard);
      const value = $("b", clarityCard);
      const bar = $("i", clarityCard);
      if (label) label.textContent = "Water clarity";
      if (value) value.textContent = `${clarity}%`;
      if (bar) bar.style.setProperty("--metric", `${clarity}%`);
      let hint = $("small", clarityCard);
      if (!hint) {
        hint = document.createElement("small");
        clarityCard.appendChild(hint);
      }
      hint.textContent = "Slow build · crystal clear at 1 year";
    }

    const giftCard = metrics[2];
    if (giftCard) {
      const status = giftStatus(current);
      const label = $("span", giftCard);
      const value = $("b", giftCard);
      let detail = $("small", giftCard);
      if (!detail) {
        detail = document.createElement("small");
        giftCard.appendChild(detail);
      }
      if (label) label.textContent = "Next Reef gift";
      if (status.next) {
        const remaining = Math.max(1, status.next.days - status.days);
        if (value) value.textContent = status.next.name;
        detail.textContent = `${remaining} lifetime clean day${remaining === 1 ? "" : "s"} away · added free`;
      } else {
        if (value) value.textContent = "All gifts earned";
        detail.textContent = `${CLEAN_GIFTS.length}/${CLEAN_GIFTS.length} milestone gifts collected`;
      }
    }
  }

  function itemIdForCard(card) {
    const explicit = $("[data-id]", card)?.dataset?.id;
    if (explicit) return explicit;
    const name = $(".t", card)?.textContent?.trim();
    if (!name) return null;
    try { return SHOP_ITEMS.find((item) => item.name === name)?.id || null; } catch (_) { return null; }
  }

  function decorateShop() {
    const current = currentState();
    const grid = $("#shop-grid");
    if (!current || !grid) return;
    const giftsById = new Map(CLEAN_GIFTS.map((gift) => [gift.itemId, gift]));

    $$(".shop-card", grid).forEach((card) => {
      const itemId = itemIdForCard(card);
      const gift = giftsById.get(itemId);
      if (!gift) return;
      card.classList.add("v1-clean-gift-card");
      let badge = $(".v1-clean-gift-badge", card);
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "v1-clean-gift-badge";
        card.appendChild(badge);
      }
      badge.textContent = `GIFT · DAY ${gift.days}`;
      const owned = current.ownedItems.includes(gift.itemId);
      const price = $(".price", card);
      if (price && !owned) price.textContent = "Milestone gift";
      const button = $("button", card);
      if (button && !owned) {
        button.disabled = true;
        button.removeAttribute("data-act");
        button.textContent = `Earn at ${gift.days} day${gift.days === 1 ? "" : "s"}`;
      }
    });
  }

  function updateIntro() {
    const intro = $("#v1-reef-intro");
    const paragraph = $("p", intro);
    if (paragraph) paragraph.textContent = "Earn pearls through real recovery actions. Milestone gifts and a growing collection give your reef room to evolve for the long haul.";
  }

  function ensureStyles() {
    if ($("#v1-reef-economy-styles")) return;
    const style = document.createElement("style");
    style.id = "v1-reef-economy-styles";
    style.textContent = `
      #view-reef .v1-reef-metrics>div:first-child small{margin-top:6px;font-size:8.5px;line-height:1.15;color:rgba(255,255,255,.48)}
      #view-reef .v1-clean-gift-card{position:relative;border-color:rgba(57,123,105,.22)!important;background:linear-gradient(145deg,rgba(255,255,255,.95),rgba(237,248,244,.95))!important}
      #view-reef .v1-clean-gift-badge{position:absolute;left:10px;top:10px;z-index:4;padding:5px 7px;border-radius:999px;background:#dff3eb;color:#286f5c;font-size:8px;font-weight:900;letter-spacing:.08em}
      #view-reef .v1-clean-gift-card .price{color:#397b69;font-size:10px;font-weight:850}
      #view-reef .v1-clean-gift-card button:disabled{opacity:1;color:#55716a;background:#e5efec}
    `;
    document.head.appendChild(style);
  }

  function render(reason = "render") {
    installCollection();
    retuneTankStages();
    window.GillieThemeEngine?.reconcileRewards?.(`reef-economy:${reason}`);
    reconcileCleanGifts(reason);
    updateDashboard();
    decorateShop();
    updateIntro();
  }

  function install() {
    ensureStyles();
    installCollection();
    retuneTankStages();
    window.GillieV1?.afterRender?.(() => render("after-render"));
    document.addEventListener?.("visibilitychange", () => {
      if (!document.hidden) setTimeout(() => render("foreground"), 40);
    });
    render("install");
    requestAnimationFrame(() => render("install-frame"));
    setTimeout(() => {
      render("install-settled");
      try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
    }, 120);

    window.GillieReefEconomy = Object.freeze({
      engine: ENGINE,
      clarity: (days = currentStreakDays()) => interpolatedClarity(days),
      gifts: CLEAN_GIFTS,
      reconcile: reconcileCleanGifts,
      status: giftStatus,
      installCollection,
    });
    track("reef_economy_loaded", { itemsAdded: EXTRA_ITEMS.length, gifts: CLEAN_GIFTS.length });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
