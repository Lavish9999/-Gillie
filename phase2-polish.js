/* Gillie Phase 2 premium polish
 * Living companion motion, contextual home actions, immersive SOS,
 * cinematic hatch, richer progress/reef views, accessibility, and delight.
 */
(() => {
  "use strict";

  const VERSION = "phase2-2026.07.10";
  const STORAGE = {
    preferences: "gillie_phase2_preferences",
    review: "gillie_phase2_review",
    hatchSeen: "gillie_phase2_hatch_seen",
    lastSos: "gillie_phase2_last_sos",
  };
  const DEFAULT_PREFS = {
    sound: true,
    haptics: true,
    reducedMotion: false,
    textScale: 1,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const now = () => Date.now();
  const appState = () => (typeof state !== "undefined" ? state : null);
  const nativeBridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;
  const isNative = () => window.Capacitor?.isNativePlatform?.() === true;
  const localDayKey = (time = Date.now()) => {
    const date = new Date(time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const escapeText = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function readPreferences() {
    try {
      return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(STORAGE.preferences) || "{}") };
    } catch (_) {
      return { ...DEFAULT_PREFS };
    }
  }

  let preferences = readPreferences();
  let audioContext = null;
  let sosTimer = null;
  let sosStartedAt = 0;
  let sosSelectedTrigger = "Stress";
  let sosSelectedIntensity = 7;
  let lastPearls = null;
  let hatchRunning = false;
  let primaryRefreshTimer = null;
  let aliveTimer = null;

  function savePreferences() {
    try { localStorage.setItem(STORAGE.preferences, JSON.stringify(preferences)); } catch (_) {}
    applyPreferences();
  }

  function applyPreferences() {
    const root = document.documentElement;
    root.classList.toggle("phase2-reduced-motion", Boolean(preferences.reducedMotion));
    root.style.setProperty("--phase2-text-scale", String(Math.max(0.9, Math.min(1.2, Number(preferences.textScale) || 1))));
    root.dataset.phase2Sound = preferences.sound ? "on" : "off";
    root.dataset.phase2Haptics = preferences.haptics ? "on" : "off";
  }

  function track(name, properties = {}) {
    try { nativeBridge()?.trackEvent?.({ name, properties }); } catch (_) {}
    try {
      const key = "gillie_phase2_events";
      const events = JSON.parse(localStorage.getItem(key) || "[]");
      events.push({ name, properties, at: now() });
      localStorage.setItem(key, JSON.stringify(events.slice(-200)));
    } catch (_) {}
  }

  async function haptic(style = "light") {
    if (!preferences.haptics) return;
    try {
      if (nativeBridge()?.haptic) {
        await nativeBridge().haptic({ style });
        return;
      }
    } catch (_) {}
    try {
      const duration = style === "success" ? [14, 45, 18] : style === "heavy" ? 24 : style === "medium" ? 16 : 10;
      navigator.vibrate?.(duration);
    } catch (_) {}
  }

  function tone(kind = "tap") {
    if (!preferences.sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const frequencies = { tap: 520, pearl: 720, success: 620, bubble: 440, hatch: 330 };
      oscillator.type = kind === "success" ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequencies[kind] || 520, audioContext.currentTime);
      if (kind === "success") oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.16);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(kind === "tap" ? 0.022 : 0.045, audioContext.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + (kind === "success" ? 0.24 : 0.12));
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.28);
    } catch (_) {}
  }

  function announce(message) {
    const region = $("#phase2-live-region");
    if (!region) return;
    region.textContent = "";
    setTimeout(() => { region.textContent = message; }, 20);
  }

  function callSaveAndRender() {
    try { if (typeof save === "function") save(); } catch (_) {}
    try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
    setTimeout(() => {
      refreshPrimaryAction();
      renderProgressPolish();
      decorateReefCards();
    }, 60);
  }

  function streakMs() {
    try { if (typeof currentStreakMs === "function") return Math.max(0, currentStreakMs()); } catch (_) {}
    const current = appState();
    return current?.quitAt ? Math.max(0, now() - current.quitAt) : 0;
  }

  function dangerData() {
    try { if (typeof dangerWindow === "function") return dangerWindow(); } catch (_) {}
    return null;
  }

  function topTriggerValue() {
    try { if (typeof topTrigger === "function") return topTrigger(); } catch (_) {}
    const cravings = appState()?.cravings || [];
    const counts = {};
    cravings.forEach((item) => {
      const trigger = item?.trigger || item?.reason;
      if (trigger) counts[trigger] = (counts[trigger] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  function formatHour(hour) {
    const normalized = ((Number(hour) || 0) + 24) % 24;
    return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(new Date(2026, 0, 1, normalized));
  }

  function installBaseInfrastructure() {
    if (!$("#phase2-live-region")) {
      const live = document.createElement("div");
      live.id = "phase2-live-region";
      live.className = "phase2-sr-only";
      live.setAttribute("aria-live", "polite");
      live.setAttribute("aria-atomic", "true");
      document.body.appendChild(live);
    }

    if (!$("#phase2-offline-banner")) {
      const banner = document.createElement("div");
      banner.id = "phase2-offline-banner";
      banner.setAttribute("role", "status");
      banner.innerHTML = "<strong>Offline mode</strong><span>Your streak and check-ins still save on this device.</span>";
      document.body.appendChild(banner);
    }

    const setOnlineState = () => {
      document.documentElement.classList.toggle("phase2-offline", !navigator.onLine);
      if (!navigator.onLine) announce("Gillie is offline. Your core tracking still works on this device.");
    };
    window.addEventListener("online", setOnlineState);
    window.addEventListener("offline", setOnlineState);
    setOnlineState();

    window.visualViewport?.addEventListener("resize", () => {
      document.documentElement.style.setProperty("--phase2-viewport-height", `${window.visualViewport.height}px`);
    });
    document.addEventListener("focusin", (event) => {
      if (event.target.matches("input, textarea, select")) {
        setTimeout(() => event.target.scrollIntoView({ behavior: preferences.reducedMotion ? "auto" : "smooth", block: "center" }), 180);
      }
    });

    applyPreferences();
  }

  function installAccessibility() {
    const overlayLabels = {
      "sos-overlay": "Craving SOS",
      "trigger-overlay": "Craving trigger",
      "followup-overlay": "Craving follow-up",
      "coach-overlay": "Gillie Coach",
      "today-plan-overlay": "Today’s quit plan",
      "checkin-overlay": "Daily check-in",
      "slip-overlay": "Slip recovery",
      "plus-overlay": "Gillie Plus subscription",
      "skin-overlay": "Gillie color",
      "buddy-overlay": "Tank mate",
      "goal-overlay": "Savings goal",
      "cost-overlay": "Cost and usage",
      "text-overlay": "Edit value",
      "confirm-overlay": "Confirmation",
      "growth-overlay": "Growth celebration",
    };
    Object.entries(overlayLabels).forEach(([id, label]) => {
      const overlay = document.getElementById(id);
      if (!overlay) return;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", label);
    });

    const tabs = $("#tabs");
    if (tabs) {
      tabs.setAttribute("role", "tablist");
      $$("button[data-view]", tabs).forEach((button) => {
        button.setAttribute("role", "tab");
        button.setAttribute("aria-controls", `view-${button.dataset.view}`);
        button.setAttribute("aria-label", `${button.textContent.trim()} tab`);
      });
    }

    const tank = $("#tank");
    if (tank) {
      tank.setAttribute("role", "button");
      tank.setAttribute("tabindex", "0");
      tank.setAttribute("aria-label", "Gillie’s interactive aquarium. Tap to greet Gillie.");
      tank.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          reactToTankTap();
        }
      });
    }

    $$("svg:not([aria-label])").forEach((svg) => svg.setAttribute("aria-hidden", "true"));
    $$("button:not([aria-label])").forEach((button) => {
      const text = button.textContent.trim().replace(/\s+/g, " ");
      if (text) button.setAttribute("aria-label", text);
    });
  }

  function installFeedback() {
    document.addEventListener("pointerdown", (event) => {
      const button = event.target.closest("button, [role='button']");
      if (!button || button.disabled) return;
      haptic(button.classList.contains("danger") ? "heavy" : "light");
      if (!button.closest("#sos-overlay")) tone("tap");
    }, { passive: true });

    const pearl = $("#pearl-balance");
    if (pearl) {
      lastPearls = Number(pearl.textContent) || 0;
      new MutationObserver(() => {
        const next = Number(pearl.textContent) || 0;
        if (next > lastPearls) animatePearlGain(next - lastPearls);
        lastPearls = next;
      }).observe(pearl, { childList: true, characterData: true, subtree: true });
    }

    const growth = $("#growth-overlay");
    if (growth) {
      new MutationObserver(() => {
        if (!growth.hidden) {
          celebrationBurst($(".growth-celebrate", growth) || growth, "growth");
          haptic("success");
          tone("success");
        }
      }).observe(growth, { attributes: true, attributeFilter: ["hidden"] });
      $("#growth-close")?.addEventListener("click", maybeRequestReview);
    }
  }

  function animatePearlGain(amount) {
    const chip = $(".pearl-chip");
    if (!chip) return;
    chip.classList.remove("phase2-pearl-pop");
    void chip.offsetWidth;
    chip.classList.add("phase2-pearl-pop");
    const fly = document.createElement("div");
    fly.className = "phase2-pearl-fly";
    fly.innerHTML = `<span class="pearl-dot"></span><b>+${Math.max(1, amount)}</b>`;
    const rect = chip.getBoundingClientRect();
    fly.style.left = `${rect.left + rect.width / 2}px`;
    fly.style.top = `${rect.top + rect.height / 2}px`;
    document.body.appendChild(fly);
    setTimeout(() => fly.remove(), 1100);
    haptic("success");
    tone("pearl");
    announce(`${amount} pearls earned`);
  }

  function celebrationBurst(target, kind = "success") {
    if (!target || preferences.reducedMotion) return;
    const layer = document.createElement("div");
    layer.className = `phase2-celebration phase2-celebration-${kind}`;
    for (let index = 0; index < 22; index += 1) {
      const bubble = document.createElement("i");
      bubble.style.setProperty("--x", `${8 + Math.random() * 84}%`);
      bubble.style.setProperty("--delay", `${Math.random() * 0.35}s`);
      bubble.style.setProperty("--size", `${5 + Math.random() * 11}px`);
      layer.appendChild(bubble);
    }
    target.appendChild(layer);
    setTimeout(() => layer.remove(), 1900);
  }

  function installGillieAlive() {
    const tank = $("#tank");
    const wrap = $("#axo-wrap");
    if (!tank || !wrap) return;
    wrap.classList.add("phase2-alive");

    tank.addEventListener("pointermove", (event) => {
      if (preferences.reducedMotion) return;
      const rect = tank.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      tank.style.setProperty("--phase2-look-x", x.toFixed(3));
      tank.style.setProperty("--phase2-look-y", y.toFixed(3));
      wrap.classList.add("phase2-following");
      clearTimeout(tank.__phase2FollowTimer);
      tank.__phase2FollowTimer = setTimeout(() => wrap.classList.remove("phase2-following"), 750);
    }, { passive: true });

    tank.addEventListener("pointerleave", () => wrap.classList.remove("phase2-following"));
    tank.addEventListener("click", reactToTankTap);

    clearInterval(aliveTimer);
    aliveTimer = setInterval(() => {
      if (document.hidden || preferences.reducedMotion || $("#main")?.hidden) return;
      const moods = ["phase2-curious", "phase2-snoozy", "phase2-playful", "phase2-proud"];
      wrap.classList.remove(...moods);
      const current = appState();
      const recentSlip = current?.justSlippedAt && now() - current.justSlippedAt < 6 * 3600000;
      const mood = recentSlip ? "phase2-snoozy" : moods[Math.floor(Math.random() * moods.length)];
      wrap.classList.add(mood);
      setTimeout(() => wrap.classList.remove(mood), 3800);
    }, 7800);
  }

  function reactToTankTap() {
    const wrap = $("#axo-wrap");
    const speech = $("#speech");
    if (!wrap || !speech) return;
    const lines = [
      "I’m here, team.",
      "One clean decision at a time.",
      "That tap counts as checking in on me.",
      "The water remembers every hour you protected.",
      "You handle the urge. I’ll handle the bubbles.",
    ];
    wrap.classList.remove("phase2-petted");
    void wrap.offsetWidth;
    wrap.classList.add("phase2-petted");
    speech.textContent = lines[Math.floor(Math.random() * lines.length)];
    speech.classList.add("phase2-speech-pop");
    setTimeout(() => speech.classList.remove("phase2-speech-pop"), 900);
    haptic("medium");
    tone("bubble");
    spawnTankHearts();
    track("tank_gillie_tapped");
  }

  function spawnTankHearts() {
    const tank = $("#tank");
    if (!tank || preferences.reducedMotion) return;
    for (let index = 0; index < 5; index += 1) {
      const heart = document.createElement("i");
      heart.className = "phase2-tank-heart";
      heart.textContent = index % 2 ? "♡" : "○";
      heart.style.left = `${42 + Math.random() * 20}%`;
      heart.style.top = `${42 + Math.random() * 16}%`;
      heart.style.animationDelay = `${index * 0.08}s`;
      tank.appendChild(heart);
      setTimeout(() => heart.remove(), 1500);
    }
  }

  function feedGillie() {
    const tank = $("#tank");
    const wrap = $("#axo-wrap");
    if (!tank || !wrap) return;
    const food = document.createElement("div");
    food.className = "phase2-food";
    food.innerHTML = "<i></i><i></i><i></i>";
    tank.appendChild(food);
    wrap.classList.add("phase2-feeding");
    setTimeout(() => wrap.classList.remove("phase2-feeding"), 1700);
    setTimeout(() => food.remove(), 1800);
  }

  function installHomeHierarchy() {
    const view = $("#view-home");
    const streak = $(".streak-block", view);
    if (!view || !streak) return;

    if (!$("#phase2-primary-action")) {
      const primary = document.createElement("button");
      primary.id = "phase2-primary-action";
      primary.className = "phase2-primary-action";
      primary.innerHTML = `<span class="phase2-primary-icon">◌</span><span class="phase2-primary-copy"><small>Next best move</small><b>Check in with Gillie</b><em>Thirty seconds sharpens tomorrow.</em></span><span class="phase2-primary-arrow">›</span>`;
      streak.insertAdjacentElement("afterend", primary);
      primary.addEventListener("click", runPrimaryAction);
    }

    if (!$("#phase2-home-carousel")) {
      const carousel = document.createElement("div");
      carousel.id = "phase2-home-carousel";
      carousel.className = "phase2-home-carousel";
      carousel.setAttribute("aria-label", "Gillie highlights");
      carousel.setAttribute("role", "region");
      const cards = ["growth-card", "plan-preview", "goal-card", "coach-card", "checkin-card", "next-milestone"]
        .map((id) => document.getElementById(id)).filter(Boolean);
      cards.forEach((card) => {
        card.classList.add("phase2-carousel-card");
        carousel.appendChild(card);
      });
      $("#phase2-primary-action")?.insertAdjacentElement("afterend", carousel);
      const hint = document.createElement("div");
      hint.className = "phase2-swipe-hint";
      hint.textContent = "Swipe for growth, plan, check-in and milestones";
      carousel.insertAdjacentElement("afterend", hint);
    }

    refreshPrimaryAction();
    clearInterval(primaryRefreshTimer);
    primaryRefreshTimer = setInterval(refreshPrimaryAction, 60000);
  }

  function primaryActionData() {
    const current = appState();
    const hour = new Date().getHours();
    const checkedIn = current?.checkins?.some((entry) => entry.date === localDayKey());
    const pending = current?.pendingFollowup?.dueAt && current.pendingFollowup.dueAt <= now();
    const danger = dangerData();
    if (pending) return { type: "followup", eyebrow: "Gillie is checking back", title: "Did the craving pass?", detail: "Finish the follow-up while the moment is fresh.", icon: "↺" };
    if (!checkedIn && hour >= 18) return { type: "checkin", eyebrow: "Close the loop", title: "Check in with Gillie", detail: "Thirty seconds sharpens tomorrow’s plan.", icon: "✓" };
    if (danger) return { type: "plan", eyebrow: "Risk window ahead", title: `Prepare for ${danger.label || "your risky hour"}`, detail: "Set up water, gum, movement or distance now.", icon: "⌁" };
    if (hour < 12) return { type: "plan", eyebrow: "Start protected", title: "See today’s clean plan", detail: "One simple move before the day gets noisy.", icon: "☀" };
    if (!checkedIn) return { type: "checkin", eyebrow: "Keep the pattern visible", title: "Log how today feels", detail: "A quick check-in makes Gillie smarter.", icon: "◉" };
    return { type: "sos", eyebrow: "Always ready", title: "Get through the next 60 seconds", detail: "Open Craving SOS before the urge gets louder.", icon: "≈" };
  }

  function refreshPrimaryAction() {
    const button = $("#phase2-primary-action");
    if (!button) return;
    const data = primaryActionData();
    button.dataset.action = data.type;
    $("small", button).textContent = data.eyebrow;
    $("b", button).textContent = data.title;
    $("em", button).textContent = data.detail;
    $(".phase2-primary-icon", button).textContent = data.icon;
  }

  function runPrimaryAction() {
    const action = $("#phase2-primary-action")?.dataset.action;
    if (action === "followup") {
      const overlay = $("#followup-overlay");
      if (overlay) overlay.hidden = false;
    } else if (action === "checkin") {
      $("#checkin-open")?.click();
    } else if (action === "plan") {
      try {
        if (typeof openTodayPlan === "function") openTodayPlan();
        else $("#plan-preview")?.click();
      } catch (_) { $("#plan-preview")?.click(); }
    } else {
      $("#sos-fab")?.click();
    }
    track("primary_action_opened", { action: action || "unknown" });
  }

  function installSosPolish() {
    const overlay = $("#sos-overlay");
    const box = $(".sos-box", overlay);
    if (!overlay || !box) return;

    if (!$("#phase2-sos-status")) {
      const status = document.createElement("div");
      status.id = "phase2-sos-status";
      status.className = "phase2-sos-status";
      status.innerHTML = `<span>60-second reset</span><b id="phase2-sos-seconds">60</b>`;
      box.prepend(status);
    }

    if (!$("#phase2-sos-progress")) {
      const progress = document.createElement("div");
      progress.id = "phase2-sos-progress";
      progress.className = "phase2-sos-progress";
      progress.innerHTML = "<i></i>";
      $("#breath-count")?.insertAdjacentElement("afterend", progress);
    }

    if (!$("#phase2-sos-data")) {
      const data = document.createElement("div");
      data.id = "phase2-sos-data";
      data.className = "phase2-sos-data";
      data.innerHTML = `
        <div class="phase2-sos-intensity-row"><span>Urge right now</span><output id="phase2-sos-intensity-value">7/10</output></div>
        <input id="phase2-sos-intensity" type="range" min="1" max="10" step="1" value="7" aria-label="Current craving intensity">
        <div class="phase2-sos-triggers" aria-label="Likely trigger">
          ${["Stress", "After eating", "Driving", "Boredom", "Social", "Habit"].map((item) => `<button type="button" data-trigger="${item}">${item}</button>`).join("")}
        </div>`;
      $(".sos-actions", box)?.insertAdjacentElement("beforebegin", data);
      const slider = $("#phase2-sos-intensity");
      slider.addEventListener("input", () => {
        sosSelectedIntensity = Number(slider.value);
        $("#phase2-sos-intensity-value").textContent = `${slider.value}/10`;
      });
      $$("button[data-trigger]", data).forEach((button, index) => {
        if (index === 0) button.classList.add("on");
        button.addEventListener("click", () => {
          $$("button[data-trigger]", data).forEach((item) => item.classList.remove("on"));
          button.classList.add("on");
          sosSelectedTrigger = button.dataset.trigger;
          haptic("light");
        });
      });
    }

    const phase = $("#breath-phase");
    if (phase) {
      new MutationObserver(() => {
        const text = phase.textContent.toLowerCase();
        if (overlay.hidden) return;
        if (text.includes("in")) haptic("light");
        else if (text.includes("hold")) haptic("medium");
        else if (text.includes("out")) haptic("heavy");
      }).observe(phase, { childList: true, characterData: true, subtree: true });
    }

    new MutationObserver(() => {
      if (!overlay.hidden) startSosSession();
      else stopSosSession();
    }).observe(overlay, { attributes: true, attributeFilter: ["hidden"] });

    $("#sos-beat")?.addEventListener("click", () => {
      persistSosMetadata(true);
      overlay.classList.add("phase2-sos-success");
      celebrationBurst(box, "sos");
      haptic("success");
      tone("success");
      setTimeout(() => overlay.classList.remove("phase2-sos-success"), 1200);
    }, { capture: true });
    $("#sos-slipped")?.addEventListener("click", () => persistSosMetadata(false), { capture: true });
    $("#sos-close")?.addEventListener("click", stopSosSession);
  }

  function startSosSession() {
    clearInterval(sosTimer);
    sosStartedAt = now();
    const current = appState();
    const petName = current?.petName || "Gillie";
    const heading = $("#sos-overlay h2");
    if (heading) heading.innerHTML = `Get through the next minute with <span id="sos-pet-name">${escapeText(petName)}</span>.`;
    const reasons = (current?.reasons || []).slice(0, 3);
    const reasonsNode = $("#sos-reasons");
    if (reasonsNode) {
      reasonsNode.innerHTML = reasons.length
        ? `<small>You chose this for</small>${reasons.map((reason) => `<b>${escapeText(reason)}</b>`).join("<span>·</span>")}`
        : "The urge is temporary. Your next clean minute is permanent.";
    }
    updateSosClock();
    sosTimer = setInterval(updateSosClock, 250);
    track("phase2_sos_started", { intensity: sosSelectedIntensity, trigger: sosSelectedTrigger });
  }

  function updateSosClock() {
    const elapsed = Math.min(60000, now() - sosStartedAt);
    const remaining = Math.max(0, Math.ceil((60000 - elapsed) / 1000));
    const seconds = $("#phase2-sos-seconds");
    const bar = $("#phase2-sos-progress i");
    if (seconds) seconds.textContent = String(remaining);
    if (bar) bar.style.width = `${Math.min(100, (elapsed / 60000) * 100)}%`;
    if (remaining === 0) {
      clearInterval(sosTimer);
      const phase = $("#breath-phase");
      if (phase) phase.textContent = "You stayed with it";
      announce("The sixty-second reset is complete.");
      haptic("success");
    }
  }

  function stopSosSession() {
    clearInterval(sosTimer);
    sosTimer = null;
  }

  function persistSosMetadata(resisted) {
    const payload = {
      at: now(),
      durationSeconds: Math.max(1, Math.round((now() - sosStartedAt) / 1000)),
      intensity: sosSelectedIntensity,
      trigger: sosSelectedTrigger,
      resisted,
    };
    try { localStorage.setItem(STORAGE.lastSos, JSON.stringify(payload)); } catch (_) {}
    setTimeout(() => {
      const current = appState();
      const cravings = current?.cravings;
      if (!Array.isArray(cravings) || !cravings.length) return;
      const recent = cravings[cravings.length - 1];
      if (Math.abs((recent.at || recent.createdAt || now()) - now()) < 30 * 60000) {
        recent.intensity = recent.intensity || payload.intensity;
        recent.trigger = recent.trigger || payload.trigger;
        recent.durationSeconds = payload.durationSeconds;
        callSaveAndRender();
      }
    }, 500);
    track("phase2_sos_completed", payload);
  }

  function installCinematicHatch() {
    const button = $("#ob-hatch");
    if (!button || button.__phase2Wrapped) return;
    const original = button.onclick;
    button.onclick = async (event) => {
      event?.preventDefault?.();
      if (hatchRunning) return;
      hatchRunning = true;
      await playHatchSequence();
      hatchRunning = false;
      try { original?.call(button, event); } catch (_) {}
    };
    button.__phase2Wrapped = true;
  }

  function playHatchSequence() {
    return new Promise((resolve) => {
      if (preferences.reducedMotion) { resolve(); return; }
      let overlay = $("#phase2-hatch-cinematic");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "phase2-hatch-cinematic";
        overlay.innerHTML = `
          <div class="phase2-hatch-rays"></div>
          <div class="phase2-hatch-bubbles"></div>
          <button type="button" class="phase2-hatch-skip">Skip</button>
          <div class="phase2-hatch-stage">
            <div class="phase2-hatch-egg"><i></i><i></i><i></i></div>
            <div class="phase2-hatch-pet"><svg viewBox="0 0 200 160"></svg></div>
            <div class="phase2-hatch-copy"><small>Your clean story begins</small><b></b><span>The timer starts now.</span></div>
          </div>`;
        document.body.appendChild(overlay);
      }
      const petName = $("#ob-name")?.value.trim() || "Gillie";
      $(".phase2-hatch-copy b", overlay).textContent = `${petName} hatched.`;
      try {
        if (typeof axoSVG === "function") $(".phase2-hatch-pet svg", overlay).innerHTML = axoSVG(typeof ob !== "undefined" ? ob.skin : "pink", null, "happy", "phase2-hatch");
      } catch (_) {}
      overlay.classList.remove("phase2-hatch-run");
      void overlay.offsetWidth;
      overlay.classList.add("phase2-hatch-run");
      tone("hatch");
      haptic("medium");
      setTimeout(() => haptic("heavy"), 950);
      setTimeout(() => { tone("success"); haptic("success"); }, 1700);
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        overlay.classList.add("phase2-hatch-finish");
        setTimeout(() => {
          overlay.classList.remove("phase2-hatch-run", "phase2-hatch-finish");
          resolve();
        }, 320);
      };
      $(".phase2-hatch-skip", overlay).onclick = finish;
      setTimeout(finish, 3400);
      track("cinematic_hatch_started");
    });
  }

  function installProgressPolish() {
    const view = $("#view-progress");
    if (!view) return;
    if (!$("#phase2-progress-range")) {
      const controls = document.createElement("div");
      controls.id = "phase2-progress-range";
      controls.className = "phase2-progress-range";
      controls.setAttribute("role", "group");
      controls.setAttribute("aria-label", "Progress time range");
      controls.innerHTML = `<button data-days="7" class="on">7 days</button><button data-days="30">30 days</button><button data-days="0">All</button>`;
      $(".topbar", view)?.insertAdjacentElement("afterend", controls);
      controls.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-days]");
        if (!button) return;
        $$("button", controls).forEach((item) => item.classList.toggle("on", item === button));
        controls.dataset.days = button.dataset.days;
        renderProgressPolish();
      });
    }

    if (!$("#phase2-progress-dashboard")) {
      const dashboard = document.createElement("section");
      dashboard.id = "phase2-progress-dashboard";
      dashboard.className = "phase2-progress-dashboard";
      dashboard.innerHTML = `
        <article class="phase2-progress-summary"><div class="eyebrow">Pattern read</div><h3>Gillie is learning your rhythm.</h3><p></p></article>
        <article class="phase2-chart-card"><div class="phase2-card-head"><div><small>Cravings by hour</small><b>Your risk clock</b></div><span id="phase2-peak-hour">—</span></div><div id="phase2-hour-chart" class="phase2-hour-chart"></div></article>
        <article class="phase2-chart-card"><div class="phase2-card-head"><div><small>Clean-day calendar</small><b>Last five weeks</b></div><span id="phase2-clean-rate">—</span></div><div id="phase2-clean-calendar" class="phase2-clean-calendar"></div></article>
        <article class="phase2-comparison"><small>Compared with your first week</small><b id="phase2-comparison-title">Keep logging to unlock a comparison.</b><p id="phase2-comparison-copy">Seven check-ins gives Gillie enough signal to compare patterns.</p></article>
        <button id="phase2-share-progress" class="phase2-share-progress" type="button"><span>Share a milestone</span><b>Create progress card</b><i>↗</i></button>`;
      $(".stat-row", view)?.insertAdjacentElement("afterend", dashboard);
      $("#phase2-share-progress")?.addEventListener("click", shareProgress);
    }

    $("#checkin-log")?.addEventListener("click", openCheckinDetail);
    renderProgressPolish();
  }

  function filteredData(items, days) {
    if (!days) return items;
    const cutoff = now() - days * 86400000;
    return items.filter((item) => {
      const timestamp = item.at || item.createdAt || item.timestamp || (item.date ? new Date(`${item.date}T12:00:00`).getTime() : 0);
      return timestamp >= cutoff;
    });
  }

  function renderProgressPolish() {
    const dashboard = $("#phase2-progress-dashboard");
    if (!dashboard) return;
    const current = appState() || {};
    const days = Number($("#phase2-progress-range")?.dataset.days || 7);
    const checkins = filteredData(Array.isArray(current.checkins) ? current.checkins : [], days);
    const cravings = filteredData(Array.isArray(current.cravings) ? current.cravings : [], days);
    const resisted = cravings.filter((item) => item.resisted !== false).length;
    const avgIntensity = checkins.length ? checkins.reduce((sum, item) => sum + Number(item.intensity || 0), 0) / checkins.length : 0;
    const trigger = topTriggerValue();
    const danger = dangerData();
    const summary = $(".phase2-progress-summary p", dashboard);
    if (summary) {
      summary.textContent = checkins.length || cravings.length
        ? `${resisted} craving${resisted === 1 ? "" : "s"} beaten${trigger ? ` · ${trigger} appears most often` : ""}${danger?.label ? ` · ${danger.label} is your current risk window` : ""}.`
        : "Log a check-in or complete Craving SOS and Gillie will turn the pattern into something useful.";
    }
    const summaryTitle = $(".phase2-progress-summary h3", dashboard);
    if (summaryTitle) summaryTitle.textContent = avgIntensity > 2 ? "The urges have been loud. Your wins still count." : checkins.length ? "Your pattern is becoming clearer." : "Gillie is ready for your first signal.";
    renderHourChart(cravings);
    renderCleanCalendar(current.checkins || []);
    renderWeekComparison(current.checkins || []);
    makeCheckinsInteractive();
  }

  function renderHourChart(cravings) {
    const chart = $("#phase2-hour-chart");
    if (!chart) return;
    const buckets = Array.from({ length: 12 }, () => 0);
    cravings.forEach((item) => {
      const timestamp = item.at || item.createdAt || item.timestamp;
      if (!timestamp) return;
      const hour = new Date(timestamp).getHours();
      buckets[Math.floor(hour / 2)] += 1;
    });
    const max = Math.max(1, ...buckets);
    const peakIndex = buckets.indexOf(Math.max(...buckets));
    chart.innerHTML = buckets.map((value, index) => `<div title="${formatHour(index * 2)}: ${value} craving${value === 1 ? "" : "s"}"><i style="height:${Math.max(8, (value / max) * 100)}%"></i><span>${index % 2 === 0 ? formatHour(index * 2).replace(/\s/g, "") : ""}</span></div>`).join("");
    const peak = $("#phase2-peak-hour");
    peak.textContent = cravings.length ? `${formatHour(peakIndex * 2)} peak` : "No data yet";
  }

  function renderCleanCalendar(checkins) {
    const calendar = $("#phase2-clean-calendar");
    if (!calendar) return;
    const byDate = new Map(checkins.map((item) => [item.date, item]));
    const cells = [];
    let cleanCount = 0;
    let loggedCount = 0;
    for (let offset = 34; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      const key = localDayKey(date.getTime());
      const entry = byDate.get(key);
      if (entry) {
        loggedCount += 1;
        if (entry.clean) cleanCount += 1;
      }
      const status = !entry ? "empty" : entry.clean ? "clean" : "slip";
      cells.push(`<button type="button" class="${status}" data-date="${key}" aria-label="${key}: ${status === "empty" ? "no check-in" : status === "clean" ? "clean day" : "slip logged"}"><span>${date.getDate()}</span></button>`);
    }
    calendar.innerHTML = cells.join("");
    const rate = $("#phase2-clean-rate");
    rate.textContent = loggedCount ? `${Math.round((cleanCount / loggedCount) * 100)}% clean` : "Start logging";
    $$("button[data-date]", calendar).forEach((button) => button.addEventListener("click", () => {
      const entry = byDate.get(button.dataset.date);
      if (entry) showCheckinDetail(entry);
    }));
  }

  function renderWeekComparison(checkins) {
    const sorted = [...checkins].filter((item) => item.date).sort((a, b) => a.date.localeCompare(b.date));
    const title = $("#phase2-comparison-title");
    const copy = $("#phase2-comparison-copy");
    if (!title || !copy) return;
    if (sorted.length < 7) {
      title.textContent = `${7 - sorted.length} more check-in${7 - sorted.length === 1 ? "" : "s"} needed.`;
      copy.textContent = "Once Gillie has a week, this card will compare cravings and clean days over time.";
      return;
    }
    const first = sorted.slice(0, 7);
    const recent = sorted.slice(-7);
    const avg = (list) => list.reduce((sum, item) => sum + Number(item.intensity || 0), 0) / Math.max(1, list.length);
    const firstAvg = avg(first);
    const recentAvg = avg(recent);
    const delta = firstAvg - recentAvg;
    const recentClean = recent.filter((item) => item.clean).length;
    title.textContent = delta > 0.25 ? `Craving intensity is down ${Math.round((delta / Math.max(1, firstAvg)) * 100)}%.` : delta < -0.25 ? "This week has been harder than your first." : "Craving intensity is holding steady.";
    copy.textContent = `${recentClean} of your latest ${recent.length} check-ins were clean. ${delta < -0.25 ? "Use the harder-week signal to add more protection, not judgment." : "Keep logging the small wins—the trend gets more useful with time."}`;
  }

  function makeCheckinsInteractive() {
    const log = $("#checkin-log");
    if (!log) return;
    Array.from(log.children).forEach((child, index) => {
      child.setAttribute("role", "button");
      child.setAttribute("tabindex", "0");
      child.dataset.phase2CheckinIndex = String(index);
      child.setAttribute("aria-label", `${child.textContent.trim()}. Open check-in details.`);
      child.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          child.click();
        }
      };
    });
  }

  function openCheckinDetail(event) {
    const row = event.target.closest("[data-phase2-checkin-index]");
    if (!row) return;
    const checkins = [...(appState()?.checkins || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const entry = checkins[Number(row.dataset.phase2CheckinIndex)];
    if (entry) showCheckinDetail(entry);
  }

  function showCheckinDetail(entry) {
    let overlay = $("#phase2-checkin-detail");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "phase2-checkin-detail";
      overlay.className = "overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.innerHTML = `<div class="sheet phase2-detail-sheet"><div class="grab"></div><button class="sheet-close" type="button" aria-label="Close">×</button><div class="eyebrow">Check-in detail</div><h2></h2><div class="phase2-detail-grid"></div><p class="phase2-detail-note"></p></div>`;
      document.body.appendChild(overlay);
      $(".sheet-close", overlay).onclick = () => { overlay.hidden = true; };
      overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.hidden = true; });
    }
    $("h2", overlay).textContent = entry.date || "Saved check-in";
    $(".phase2-detail-grid", overlay).innerHTML = `
      <div><span>Mood</span><b>${["—", "😖", "😕", "😐", "🙂", "😄"][Number(entry.mood)] || "—"}</b></div>
      <div><span>Status</span><b>${entry.clean ? "Clean" : "Slip logged"}</b></div>
      <div><span>Craving</span><b>${["None", "Low", "Medium", "High"][Number(entry.intensity)] || "—"}</b></div>`;
    $(".phase2-detail-note", overlay).textContent = entry.note || "No private note was added.";
    overlay.hidden = false;
  }

  async function shareProgress() {
    const current = appState() || {};
    const days = Math.floor(streakMs() / 86400000);
    const money = $("#stat-money")?.textContent || "$0";
    const cravings = (current.cravings || []).filter((item) => item.resisted !== false).length;
    const text = `${days} day${days === 1 ? "" : "s"} clean with Gillie · ${money} saved · ${cravings} cravings beaten.`;
    try {
      if (navigator.share) await navigator.share({ title: "My Gillie progress", text });
      else {
        await navigator.clipboard.writeText(text);
        announce("Progress summary copied.");
        if (typeof toast === "function") toast("↗", "Progress summary copied.");
      }
      track("progress_shared", { days, cravings });
    } catch (_) {}
  }

  function installReefPolish() {
    const view = $("#view-reef");
    if (!view) return;
    if (!$("#phase2-reef-tools")) {
      const tools = document.createElement("section");
      tools.id = "phase2-reef-tools";
      tools.className = "phase2-reef-tools";
      tools.innerHTML = `
        <div class="phase2-seasonal"><small>Seasonal current</small><b>Moonlit Reef</b><span>A calm collection for late-night wins.</span></div>
        <div class="phase2-reef-actions"><button id="phase2-preview-tank" type="button">Preview tank</button><button id="phase2-randomize-tank" type="button">Surprise me</button></div>
        <div class="phase2-reef-filters" role="group" aria-label="Reef filters"><button class="on" data-filter="all">All</button><button data-filter="owned">Owned</button><button data-filter="plus">Plus</button></div>`;
      $(".plus-banner", view)?.insertAdjacentElement("beforebegin", tools);
      $("#phase2-preview-tank").onclick = openTankPreview;
      $("#phase2-randomize-tank").onclick = randomizeTank;
      $(".phase2-reef-filters").addEventListener("click", (event) => {
        const button = event.target.closest("button[data-filter]");
        if (!button) return;
        $$("button", event.currentTarget).forEach((item) => item.classList.toggle("on", item === button));
        filterReef(button.dataset.filter);
      });
    }
    const observer = new MutationObserver(decorateReefCards);
    [$("#theme-row"), $("#buddy-grid"), $("#shop-grid")].filter(Boolean).forEach((node) => observer.observe(node, { childList: true, subtree: true, attributes: true }));
    view.addEventListener("click", (event) => {
      const card = event.target.closest(".theme-card, .shop-card, .buddy-card");
      if (!card) return;
      $("#axo-wrap")?.classList.add("phase2-playful");
      setTimeout(() => $("#axo-wrap")?.classList.remove("phase2-playful"), 1100);
      setTimeout(decorateReefCards, 80);
    });
    decorateReefCards();
  }

  function decorateReefCards() {
    $$("#view-reef .theme-card, #view-reef .shop-card, #view-reef .buddy-card").forEach((card) => {
      const text = card.textContent.toLowerCase();
      const owned = card.classList.contains("owned") || card.classList.contains("equipped") || /owned|equipped|wearing|active/.test(text);
      const plus = /plus|locked/.test(text) || card.classList.contains("locked");
      card.dataset.phase2Owned = owned ? "true" : "false";
      card.dataset.phase2Plus = plus ? "true" : "false";
      if (!$(".phase2-card-badge", card)) {
        const badge = document.createElement("span");
        badge.className = "phase2-card-badge";
        badge.textContent = owned ? (card.classList.contains("equipped") ? "Equipped" : "Owned") : plus ? "Plus" : "Pearls";
        card.appendChild(badge);
      } else {
        $(".phase2-card-badge", card).textContent = owned ? (card.classList.contains("equipped") ? "Equipped" : "Owned") : plus ? "Plus" : "Pearls";
      }
      card.setAttribute("aria-description", plus && !appState()?.premium ? "Gillie Plus item. Tap to see how to unlock it." : owned ? "Owned item." : "Available Reef item.");
    });
  }

  function filterReef(filter) {
    $$("#view-reef .theme-card, #view-reef .shop-card, #view-reef .buddy-card").forEach((card) => {
      const show = filter === "all" || (filter === "owned" && card.dataset.phase2Owned === "true") || (filter === "plus" && card.dataset.phase2Plus === "true");
      card.classList.toggle("phase2-filtered-out", !show);
    });
  }

  function openTankPreview() {
    let overlay = $("#phase2-tank-preview");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "phase2-tank-preview";
      overlay.className = "overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", "Tank preview");
      overlay.innerHTML = `<div class="sheet phase2-preview-sheet"><div class="grab"></div><button class="sheet-close" type="button">×</button><div class="eyebrow">Live preview</div><h2>Your reef, full size.</h2><div class="phase2-preview-frame"></div><p>Everything shown here is already equipped in your tank.</p><button class="btn" type="button">Looks good</button></div>`;
      document.body.appendChild(overlay);
      $$(".sheet-close, .btn", overlay).forEach((button) => button.onclick = () => { overlay.hidden = true; });
    }
    const source = $("#tank");
    const frame = $(".phase2-preview-frame", overlay);
    frame.innerHTML = "";
    if (source) {
      const clone = source.cloneNode(true);
      clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      clone.removeAttribute("id");
      clone.classList.add("phase2-tank-clone");
      frame.appendChild(clone);
    }
    overlay.hidden = false;
    track("reef_tank_preview_opened");
  }

  function randomizeTank() {
    const current = appState();
    if (!current) return;
    try {
      if (typeof THEMES !== "undefined" && Array.isArray(THEMES)) {
        const allowed = THEMES.filter((theme) => !theme.premium || current.premium);
        const pick = allowed[Math.floor(Math.random() * allowed.length)];
        if (pick) current.theme = pick.id;
      }
      if (typeof SKINS !== "undefined" && Array.isArray(SKINS)) {
        const allowed = SKINS.filter((skin) => !skin.premium || current.premium);
        const pick = allowed[Math.floor(Math.random() * allowed.length)];
        if (pick) current.skin = pick.id;
      }
      callSaveAndRender();
      reactToTankTap();
      if (typeof toast === "function") toast("✨", "Gillie remixed the tank.");
      track("reef_randomized");
    } catch (_) {}
  }

  function installPaywallPolish() {
    const overlay = $("#plus-overlay");
    if (!overlay) return;
    if (!$("#phase2-plus-free-note")) {
      const note = document.createElement("div");
      note.id = "phase2-plus-free-note";
      note.className = "phase2-plus-free-note";
      note.innerHTML = "<b>Core quitting tools stay free.</b><span>SOS, streaks, check-ins and the tank are never held hostage.</span>";
      $("#plus-purchase")?.insertAdjacentElement("afterend", note);
    }
    new MutationObserver(() => {
      if (!overlay.hidden) refreshPaywallPersonalization();
    }).observe(overlay, { attributes: true, attributeFilter: ["hidden"] });

    const purchase = $("#plus-purchase");
    const restore = $("#plus-restore");
    [purchase, restore].filter(Boolean).forEach((button) => button.addEventListener("click", () => {
      button.classList.add("phase2-loading");
      button.setAttribute("aria-busy", "true");
      setTimeout(() => {
        button.classList.remove("phase2-loading");
        button.removeAttribute("aria-busy");
      }, 10000);
    }, { capture: true }));

    const legal = $("#plus-legal");
    if (legal) new MutationObserver(() => {
      const text = legal.textContent.toLowerCase();
      if (/active|restored|unlocked/.test(text)) purchaseSuccess();
      if (!/opening|checking|pending/.test(text)) {
        [purchase, restore].filter(Boolean).forEach((button) => {
          button.classList.remove("phase2-loading");
          button.removeAttribute("aria-busy");
        });
      }
    }).observe(legal, { childList: true, characterData: true, subtree: true });
  }

  function refreshPaywallPersonalization() {
    const current = appState() || {};
    const danger = dangerData();
    const trigger = topTriggerValue();
    const nowBox = $("#plus-now");
    if (nowBox) {
      const signal1 = danger?.label ? `<strong>${escapeText(danger.label)}</strong> is currently your highest-risk window.` : "Gillie needs a few more check-ins to identify your danger window.";
      const signal2 = trigger ? `<strong>${escapeText(trigger)}</strong> appears most often in your craving history.` : "Complete Craving SOS and Gillie will learn which triggers need a playbook.";
      const signal3 = current.pendingFollowup ? "Your next plan can use the craving you are actively working through." : "Tomorrow’s plan updates from tonight’s check-in.";
      nowBox.innerHTML = `<div>${signal1}</div><div>${signal2}</div><div><strong>What Plus does next:</strong> ${signal3}</div>`;
    }
    const subtitle = $("#plus-subtitle");
    if (subtitle) subtitle.textContent = danger?.label ? `Protect ${danger.label} before the urge gets loud.` : trigger ? `Build a plan around ${trigger}, not generic motivation.` : "Unlock the quit plan that watches your patterns before the urge gets loud.";
  }

  function purchaseSuccess() {
    const current = appState();
    if (!current?.premium) return;
    const tank = $("#tank");
    if (tank) celebrationBurst(tank, "plus");
    feedGillie();
    haptic("success");
    tone("success");
    announce("Gillie Plus is active.");
  }

  function installQualitySettings() {
    const view = $("#view-you");
    if (!view || $("#phase2-quality-settings")) return;
    const group = document.createElement("div");
    group.id = "phase2-quality-settings";
    group.className = "set-group";
    group.innerHTML = `
      <button class="set-row" id="phase2-set-sound" type="button"><span class="t">Sound effects</span><span class="v"></span></button>
      <button class="set-row" id="phase2-set-haptics" type="button"><span class="t">Haptic feedback</span><span class="v"></span></button>
      <button class="set-row" id="phase2-set-motion" type="button"><span class="t">Reduce motion</span><span class="v"></span></button>
      <button class="set-row" id="phase2-set-text" type="button"><span class="t">Text size</span><span class="v"></span></button>`;
    const first = $(".set-group", view);
    first?.insertAdjacentElement("afterend", group);
    $("#phase2-set-sound").onclick = () => { preferences.sound = !preferences.sound; savePreferences(); renderQualitySettings(); };
    $("#phase2-set-haptics").onclick = () => { preferences.haptics = !preferences.haptics; savePreferences(); renderQualitySettings(); };
    $("#phase2-set-motion").onclick = () => { preferences.reducedMotion = !preferences.reducedMotion; savePreferences(); renderQualitySettings(); };
    $("#phase2-set-text").onclick = () => {
      const values = [0.95, 1, 1.1, 1.18];
      const index = values.findIndex((value) => Math.abs(value - preferences.textScale) < 0.01);
      preferences.textScale = values[(index + 1) % values.length];
      savePreferences();
      renderQualitySettings();
    };
    renderQualitySettings();
  }

  function renderQualitySettings() {
    const set = (id, value) => { const node = $(`${id} .v`); if (node) node.textContent = value; };
    set("#phase2-set-sound", preferences.sound ? "On" : "Off");
    set("#phase2-set-haptics", preferences.haptics ? "On" : "Off");
    set("#phase2-set-motion", preferences.reducedMotion ? "On" : "Off");
    const labels = { "0.95": "Compact", "1": "Default", "1.1": "Large", "1.18": "Extra large" };
    set("#phase2-set-text", labels[String(preferences.textScale)] || "Default");
  }

  async function maybeRequestReview() {
    if (!isNative() || streakMs() < 3 * 86400000) return;
    let previous = 0;
    try { previous = Number(localStorage.getItem(STORAGE.review) || 0); } catch (_) {}
    if (now() - previous < 120 * 86400000) return;
    try {
      await nativeBridge()?.requestReview?.();
      localStorage.setItem(STORAGE.review, String(now()));
      track("review_prompt_requested", { streakDays: Math.floor(streakMs() / 86400000) });
    } catch (_) {}
  }

  function installRefreshHooks() {
    $("#tabs")?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-view]");
      if (!button) return;
      setTimeout(() => {
        refreshPrimaryAction();
        if (button.dataset.view === "progress") renderProgressPolish();
        if (button.dataset.view === "reef") decorateReefCards();
        if (button.dataset.view === "you") renderQualitySettings();
        $$("#tabs button[data-view]").forEach((item) => item.setAttribute("aria-selected", String(item.classList.contains("on"))));
      }, 50);
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        refreshPrimaryAction();
        renderProgressPolish();
      }
    });
  }

  function install() {
    if (window.__gilliePhase2Installed) return;
    window.__gilliePhase2Installed = true;
    installBaseInfrastructure();
    installAccessibility();
    installFeedback();
    installGillieAlive();
    installHomeHierarchy();
    installSosPolish();
    installCinematicHatch();
    installProgressPolish();
    installReefPolish();
    installPaywallPolish();
    installQualitySettings();
    installRefreshHooks();
    setTimeout(() => {
      refreshPrimaryAction();
      renderProgressPolish();
      decorateReefCards();
      installAccessibility();
    }, 350);
    track("phase2_polish_loaded", { version: VERSION });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
