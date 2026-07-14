/* Gillie V1 Theme Engine — reliable multi-tank themes, persistence, and one-time Reef level rewards. */
(() => {
  "use strict";

  if (window.__gillieThemeEngineInstalled) return;
  window.__gillieThemeEngineInstalled = true;

  const ENGINE = "theme-engine-v1";
  const ENGINE_VERSION = "theme-engine-v2-multitank-level-rewards";
  const FALLBACK_THEMES = Object.freeze({
    clear: { id: "clear", name: "Clearwater", tint: "transparent", blend: "normal", sand: "#EDDDBC", premium: false },
    sunset: { id: "sunset", name: "Sunset Lagoon", tint: "linear-gradient(180deg, rgba(255,158,92,.64), rgba(242,112,138,.50))", blend: "soft-light", sand: "#F2D2A8", premium: true },
    abyss: { id: "abyss", name: "Abyss", tint: "linear-gradient(180deg, rgba(24,46,92,.58), rgba(10,22,54,.72))", blend: "multiply", sand: "#9AA4B8", premium: true },
    sakura: { id: "sakura", name: "Sakura", tint: "linear-gradient(180deg, rgba(255,190,214,.70), rgba(255,150,190,.48))", blend: "soft-light", sand: "#F6DCCB", premium: true },
    moonlit: { id: "moonlit", name: "Moonlit Reef", tint: "linear-gradient(180deg, rgba(79,91,154,.56), rgba(16,25,67,.78))", blend: "multiply", sand: "#9296AC", premium: true },
  });
  const REEF_LEVELS = Object.freeze([
    { level: 1, name: "Fresh Start", xp: 0, pearls: 0 },
    { level: 2, name: "Ripple Keeper", xp: 120, pearls: 25 },
    { level: 3, name: "Kelp Keeper", xp: 300, pearls: 40 },
    { level: 4, name: "Coral Tender", xp: 600, pearls: 60 },
    { level: 5, name: "Tide Builder", xp: 1000, pearls: 90 },
    { level: 6, name: "Glowkeeper", xp: 1500, pearls: 125 },
    { level: 7, name: "Reef Guardian", xp: 2200, pearls: 175 },
    { level: 8, name: "Crystal Current", xp: 3200, pearls: 250 },
  ]);
  const LEVEL_REWARD_PREFIX = "reef_level_reward_";
  const HOUR_MS = 3600000;

  let applying = false;
  let reconcilingRewards = false;
  let observer = null;
  let lastApplied = "";
  let rewardUiScheduled = false;

  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const $$ = (selector, root = document) => Array.from(root?.querySelectorAll?.(selector) || []);

  function currentState() {
    try { return typeof state !== "undefined" && state ? state : null; } catch (_) { return null; }
  }

  function track(name, properties = {}) {
    try {
      window.Capacitor?.Plugins?.GilliePurchases?.trackEvent?.({
        name,
        properties: { engine: ENGINE, version: ENGINE_VERSION, ...properties },
      });
    } catch (_) {}
  }

  function catalog() {
    const map = new Map(Object.entries(FALLBACK_THEMES));
    try {
      if (typeof THEMES !== "undefined" && Array.isArray(THEMES)) {
        THEMES.forEach((theme) => {
          if (!theme?.id) return;
          map.set(theme.id, { ...(map.get(theme.id) || {}), ...theme });
        });
      }
    } catch (_) {}
    return map;
  }

  function themeFor(id) {
    const themes = catalog();
    return themes.get(id) || themes.get("clear") || FALLBACK_THEMES.clear;
  }

  function activeTheme(current = currentState()) {
    if (!current?.premium) return themeFor("clear");
    return themeFor(current.theme || "clear");
  }

  function themeTanks() {
    const tanks = new Set();
    const primary = $("#tank");
    if (primary) tanks.add(primary);
    $$(".tank, .v1-tank-preview, .phase2-tank-clone").forEach((tank) => tanks.add(tank));
    return Array.from(tanks).filter((tank) => tank?.isConnected !== false);
  }

  function ensureTintLayer(tank) {
    let tint = $("[data-gillie-theme-layer='true']", tank) || $("#theme-tint", tank);
    if (!tint) {
      tint = document.createElement("div");
      tank.appendChild(tint);
    }

    if (tank.id === "tank") tint.id = "theme-tint";
    else if (tint.id === "theme-tint") tint.removeAttribute("id");

    tint.dataset.gillieThemeLayer = "true";
    tint.setAttribute("aria-hidden", "true");
    return tint;
  }

  function updateSelection(themeId, current = currentState()) {
    $$("#theme-row [data-theme]").forEach((button) => {
      const theme = themeFor(button.dataset.theme);
      const selected = button.dataset.theme === themeId;
      const locked = Boolean(theme.premium && !current?.premium);
      button.classList.toggle("on", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.dataset.themeActive = selected ? "true" : "false";
      button.dataset.themeLocked = locked ? "true" : "false";
      button.setAttribute("aria-label", `${theme.name || button.dataset.theme}${selected ? ", active" : locked ? ", Gillie Plus" : ""}`);
    });
  }

  function applyThemeToTank(tank, theme) {
    const tint = ensureTintLayer(tank);
    const isClear = theme.id === "clear";

    tank.dataset.gillieTheme = theme.id;
    tank.style.setProperty("--gillie-theme-tint", theme.tint || "transparent");
    tank.style.setProperty("--gillie-theme-sand", theme.sand || "#EDDDBC");
    tank.style.setProperty("isolation", "isolate");

    tint.style.setProperty("position", "absolute", "important");
    tint.style.setProperty("inset", "0", "important");
    tint.style.setProperty("z-index", "3", "important");
    tint.style.setProperty("pointer-events", "none", "important");
    tint.style.setProperty("border-radius", "inherit", "important");
    tint.style.setProperty("background", theme.tint || "transparent", "important");
    tint.style.setProperty("mix-blend-mode", theme.blend || "normal", "important");
    tint.style.setProperty("opacity", isClear ? "0" : "1", "important");
    tint.style.setProperty("visibility", "visible", "important");
    tint.style.setProperty("display", "block", "important");
    tint.style.setProperty("transition", "opacity .28s ease, background .28s ease", "important");
  }

  function applyThemeImmediately(reason = "render") {
    if (applying) return false;
    const current = currentState();
    const tanks = themeTanks();
    if (!current || !tanks.length) return false;

    applying = true;
    try {
      const theme = activeTheme(current);
      tanks.forEach((tank) => applyThemeToTank(tank, theme));
      document.documentElement?.style?.setProperty("--sand", theme.sand || "#EDDDBC");
      updateSelection(theme.id, current);

      const signature = `${theme.id}:${Boolean(current.premium)}:${tanks.length}`;
      if (signature !== lastApplied) {
        lastApplied = signature;
        track("reef_theme_applied", { theme: theme.id, premium: Boolean(current.premium), tanks: tanks.length, reason });
      }
      document.dispatchEvent?.(new CustomEvent("gillie:theme-applied", {
        detail: { theme: theme.id, reason, tanks: tanks.length },
      }));
      return true;
    } finally {
      applying = false;
    }
  }

  function persist() {
    try { if (typeof save === "function") save(); } catch (_) {}
  }

  function showPlus() {
    try {
      if (typeof openPlus === "function") {
        openPlus();
        return;
      }
    } catch (_) {}
    ($("#plus-open") || $("#set-plus") || $("[data-act='plus']"))?.click?.();
  }

  function notify(icon, message) {
    try {
      if (typeof toast === "function") toast(icon, message);
      else window.GillieV1?.announce?.(message);
    } catch (_) {}
  }

  function announceTheme(theme) {
    notify("🎨", `${currentState()?.petName || "Gillie"}'s tank is now ${theme.name}.`);
  }

  function selectTheme(themeId, { announceSelection = true, reason = "tap" } = {}) {
    const current = currentState();
    if (!current) return false;
    const theme = themeFor(themeId);

    if (theme.premium && !current.premium) {
      track("reef_theme_locked_tapped", { theme: theme.id });
      showPlus();
      return false;
    }

    current.theme = theme.id;
    persist();
    applyThemeImmediately(reason);
    try { if (typeof renderThemes === "function") renderThemes(); } catch (_) {}
    requestAnimationFrame(() => applyThemeImmediately(`${reason}:after-render`));
    setTimeout(() => applyThemeImmediately(`${reason}:settled`), 80);
    if (announceSelection) announceTheme(theme);
    track("reef_theme_selected", { theme: theme.id, premium: Boolean(current.premium), reason });
    return true;
  }

  function handleThemeClick(event) {
    const button = event.target?.closest?.("#theme-row [data-theme]");
    if (!button) return;
    const theme = themeFor(button.dataset.theme);
    const current = currentState();

    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    if (theme.premium && !current?.premium) {
      showPlus();
      track("reef_theme_locked_tapped", { theme: theme.id });
      return;
    }
    selectTheme(theme.id, { announceSelection: true, reason: "theme-card-tap" });
  }

  function currentStreakMs(current) {
    return current?.quitAt ? Math.max(0, Date.now() - Number(current.quitAt)) : 0;
  }

  function lifetimeCleanMs(current) {
    return Math.max(0, Number(current?.bankedCleanMs || 0)) + currentStreakMs(current);
  }

  function reefXp(current = currentState()) {
    if (!current) return 0;
    const progress = current.reefProgress && typeof current.reefProgress === "object" ? current.reefProgress : {};
    const cleanHours = Math.floor(lifetimeCleanMs(current) / HOUR_MS);
    const checkinXp = (current.checkins || []).length * 15;
    const cravingXp = (current.cravings || []).filter((entry) => entry?.resisted).length * 20;
    const milestoneXp = (current.milestonesRewarded || current.milestonesSeen || []).length * 35;
    return Math.max(0, cleanHours * 2 + checkinXp + cravingXp + milestoneXp + Math.max(0, Number(progress.bonusXp || 0)));
  }

  function reefLevelFor(xp = reefXp()) {
    let level = REEF_LEVELS[0];
    for (const candidate of REEF_LEVELS) if (xp >= candidate.xp) level = candidate;
    return level;
  }

  function rewardMarker(level) {
    return `${LEVEL_REWARD_PREFIX}${level}`;
  }

  function hasRewardMarker(current, level) {
    return Array.isArray(current?.ownedItems) && current.ownedItems.includes(rewardMarker(level));
  }

  function updatePearlDisplays(value) {
    const text = Math.max(0, Number(value || 0)).toLocaleString();
    const primary = $("#pearl-balance");
    if (primary) primary.textContent = text;
    $$(".pearl-balance2").forEach((node) => { node.textContent = text; });
  }

  function scheduleRewardStatus() {
    if (rewardUiScheduled) return;
    rewardUiScheduled = true;
    queueMicrotask(() => {
      rewardUiScheduled = false;
      decorateRewardStatus();
    });
  }

  function decorateRewardStatus() {
    const current = currentState();
    const dashboard = $("#v1-reef-dashboard");
    if (!current || !dashboard) return;

    const currentLevel = reefLevelFor(reefXp(current));
    const nextLevel = REEF_LEVELS.find((level) => level.level > currentLevel.level) || null;
    let row = $("#v1-reef-level-reward-status", dashboard);
    if (!row) {
      row = document.createElement("div");
      row.id = "v1-reef-level-reward-status";
      row.setAttribute("role", "status");
      const bar = $(".v1-reef-xp-bar", dashboard);
      if (bar?.insertAdjacentElement) bar.insertAdjacentElement("afterend", row);
      else dashboard.appendChild(row);
    }

    const collected = currentLevel.level > 1 && hasRewardMarker(current, currentLevel.level);
    const title = currentLevel.level === 1
      ? `Level 2 reward · +${REEF_LEVELS[1].pearls} pearls`
      : `Level ${currentLevel.level} reward · +${currentLevel.pearls} pearls ${collected ? "collected" : "pending"}`;
    const detail = nextLevel
      ? `Next level reward: +${nextLevel.pearls} pearls at Level ${nextLevel.level}`
      : "All Reef level rewards collected";

    row.innerHTML = `<span>LEVEL REWARD</span><b>${title}</b><small>${detail}</small>`;
    row.style.cssText = "display:grid;grid-template-columns:auto 1fr;gap:2px 12px;align-items:center;margin:14px 0 0;padding:12px 14px;border:1px solid rgba(135,190,177,.34);border-radius:16px;background:rgba(255,255,255,.08);color:#fff";
    const label = row.querySelector?.("span");
    const strong = row.querySelector?.("b");
    const small = row.querySelector?.("small");
    if (label) label.style.cssText = "grid-row:1 / span 2;font-size:10px;font-weight:800;letter-spacing:.12em;opacity:.64";
    if (strong) strong.style.cssText = "font-size:14px;line-height:1.2";
    if (small) small.style.cssText = "font-size:12px;line-height:1.25;opacity:.64";
  }

  function reconcileLevelRewards(reason = "render") {
    if (reconcilingRewards) return 0;
    const current = currentState();
    if (!current?.onboarded) {
      scheduleRewardStatus();
      return 0;
    }

    reconcilingRewards = true;
    try {
      current.ownedItems = Array.isArray(current.ownedItems) ? current.ownedItems : [];
      current.reefProgress = current.reefProgress && typeof current.reefProgress === "object" ? current.reefProgress : {};

      const level = reefLevelFor(reefXp(current));
      const missing = REEF_LEVELS.filter((reward) => reward.level > 1 && reward.level <= level.level && !hasRewardMarker(current, reward.level));
      if (!missing.length) {
        current.reefProgress.lastSeenLevel = Math.max(1, Number(current.reefProgress.lastSeenLevel || 1), level.level);
        scheduleRewardStatus();
        return 0;
      }

      // Level rewards are fixed one-time milestone grants. They intentionally do not
      // depend on temporary StoreKit refresh timing or the Plus pearl multiplier.
      const totalPearls = missing.reduce((sum, reward) => sum + reward.pearls, 0);
      missing.forEach((reward) => current.ownedItems.push(rewardMarker(reward.level)));
      current.pearls = Math.max(0, Number(current.pearls || 0)) + totalPearls;
      current.reefProgress.lastSeenLevel = Math.max(1, Number(current.reefProgress.lastSeenLevel || 1), level.level);
      persist();
      updatePearlDisplays(current.pearls);
      try { if (typeof sparkleBurst === "function") sparkleBurst(); } catch (_) {}

      if (missing.length === 1) {
        const reward = missing[0];
        notify("🌊", `Reef Level ${reward.level} reward · +${reward.pearls} pearls`);
      } else {
        notify("🌊", `Recovered ${missing.length} Reef level rewards · +${totalPearls} pearls`);
      }

      missing.forEach((reward) => track("reef_level_reward_granted", {
        level: reward.level,
        name: reward.name,
        pearls: reward.pearls,
        reason,
      }));
      track("reef_level_rewards_reconciled", {
        count: missing.length,
        pearls: totalPearls,
        currentLevel: level.level,
        reason,
      });
      scheduleRewardStatus();
      return totalPearls;
    } finally {
      reconcilingRewards = false;
    }
  }

  function mutationTouchesTheme(mutation) {
    const target = mutation.target;
    if (target?.id === "theme-row" || target?.id === "tank" || target?.closest?.("#theme-row, .tank")) return true;
    return Array.from(mutation.addedNodes || []).some((node) =>
      node?.matches?.("#theme-row, .tank, .v1-tank-preview, .phase2-tank-clone") ||
      node?.querySelector?.("#theme-row, .tank, .v1-tank-preview, .phase2-tank-clone")
    );
  }

  function installObserver() {
    if (observer || !document.body || typeof MutationObserver !== "function") return;
    observer = new MutationObserver((mutations) => {
      if (applying) return;
      if (mutations.some(mutationTouchesTheme)) {
        requestAnimationFrame(() => {
          applyThemeImmediately("dom-update");
          scheduleRewardStatus();
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function install() {
    document.addEventListener?.("click", handleThemeClick, true);
    document.addEventListener?.("gillie:purchase-flow-settled", () => setTimeout(() => {
      applyThemeImmediately("purchase-settled");
      reconcileLevelRewards("purchase-settled");
    }, 40));
    document.addEventListener?.("visibilitychange", () => {
      if (!document.hidden) setTimeout(() => {
        applyThemeImmediately("foreground");
        reconcileLevelRewards("foreground");
      }, 40);
    });

    window.GillieV1?.afterRender?.(() => {
      reconcileLevelRewards("render");
      requestAnimationFrame(() => {
        applyThemeImmediately("v1-render");
        decorateRewardStatus();
      });
    });

    installObserver();
    applyThemeImmediately("install");
    reconcileLevelRewards("install");
    requestAnimationFrame(() => {
      applyThemeImmediately("install-frame");
      decorateRewardStatus();
    });
    setTimeout(() => {
      applyThemeImmediately("install-settled");
      reconcileLevelRewards("install-settled");
    }, 180);

    window.GillieThemeEngine = Object.freeze({
      apply: applyThemeImmediately,
      select: selectTheme,
      active: () => activeTheme(currentState()),
      tanks: themeTanks,
      reefXp: () => reefXp(currentState()),
      reefLevel: () => reefLevelFor(reefXp(currentState())),
      reconcileRewards: reconcileLevelRewards,
    });
    track("reef_theme_engine_loaded", { engine: ENGINE, version: ENGINE_VERSION });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
