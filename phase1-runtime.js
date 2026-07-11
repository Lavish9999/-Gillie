/* Gillie Phase 1 production runtime
 * Native notifications, local-date correctness, StoreKit hardening,
 * privacy-first event diagnostics, and production settings links.
 */
(() => {
  "use strict";

  const VERSION = "phase1-2026.07.10";
  const NOTIFICATION_IDS = {
    checkin: 810001,
    danger: 810002,
    inactivity: 810003,
    cravingFollowup: 810004,
    slipRecovery: 810005,
    milestoneBase: 811000,
  };
  const OFFLINE_ENTITLEMENT_GRACE_MS = 7 * 86400000;
  const CHECKIN_HOUR = 20;
  const CHECKIN_MINUTE = 30;

  const purchasePlugin = () => window.Capacitor?.Plugins?.GilliePurchases || null;
  const notificationPlugin = () => window.Capacitor?.Plugins?.LocalNotifications || null;
  const nativePlatform = () => window.Capacitor?.isNativePlatform?.() === true;
  const localKey = (time = Date.now()) => {
    const d = new Date(time);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  function safeProps(properties = {}) {
    const output = {};
    Object.entries(properties || {}).slice(0, 12).forEach(([key, value]) => {
      if (!/^[a-zA-Z0-9_.-]{1,40}$/.test(key)) return;
      if (["string", "number", "boolean"].includes(typeof value)) {
        output[key] = typeof value === "string" ? value.slice(0, 80) : value;
      }
    });
    return output;
  }

  function track(name, properties = {}) {
    if (!/^[a-z0-9_.-]{2,64}$/.test(name)) return;
    try {
      purchasePlugin()?.trackEvent?.({ name, properties: safeProps(properties) });
    } catch (_) {}
    try {
      const key = "gillie_phase1_events";
      const current = JSON.parse(localStorage.getItem(key) || "[]");
      current.push({ name, properties: safeProps(properties), at: Date.now() });
      localStorage.setItem(key, JSON.stringify(current.slice(-150)));
    } catch (_) {}
  }

  window.addEventListener("error", (event) => {
    track("client_error", {
      source: "window",
      message: String(event.message || "unknown").slice(0, 80),
      line: Number(event.lineno || 0),
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    track("client_error", {
      source: "promise",
      message: String(event.reason?.message || event.reason || "unknown").slice(0, 80),
    });
  });

  async function permissionState() {
    const plugin = notificationPlugin();
    if (!plugin?.checkPermissions) return "unavailable";
    try {
      return (await plugin.checkPermissions()).display || "prompt";
    } catch (_) {
      return "unavailable";
    }
  }

  async function ensureNotificationPermission({ ask = false } = {}) {
    const plugin = notificationPlugin();
    if (!plugin) return false;
    let status = await permissionState();
    if (ask && status === "prompt") {
      try {
        status = (await plugin.requestPermissions()).display || "denied";
        track("notification_permission", { result: status });
      } catch (_) {
        status = "denied";
      }
    }
    return status === "granted";
  }

  async function cancelNotificationIds(ids) {
    const plugin = notificationPlugin();
    if (!plugin?.cancel || !ids.length) return;
    try {
      await plugin.cancel({ notifications: ids.map((id) => ({ id })) });
    } catch (_) {}
  }

  async function scheduleCheckinReminder() {
    const plugin = notificationPlugin();
    if (!plugin || !state?.reminders?.checkin) {
      await cancelNotificationIds([NOTIFICATION_IDS.checkin]);
      return;
    }
    await cancelNotificationIds([NOTIFICATION_IDS.checkin]);
    await plugin.schedule({
      notifications: [{
        id: NOTIFICATION_IDS.checkin,
        title: `${state.petName || "Gillie"} is ready to check in`,
        body: "Thirty honest seconds helps tomorrow's plan get sharper.",
        schedule: { on: { hour: CHECKIN_HOUR, minute: CHECKIN_MINUTE }, repeats: true },
        extra: { route: "checkin" },
        threadIdentifier: "gillie-checkin",
      }],
    });
  }

  async function scheduleDangerReminder() {
    const plugin = notificationPlugin();
    await cancelNotificationIds([NOTIFICATION_IDS.danger]);
    if (!plugin || !state?.premium || !state?.reminders?.craving) return;
    const danger = typeof dangerWindow === "function" ? dangerWindow() : null;
    if (!danger) return;
    let minutes = danger.from * 60 - 30;
    if (minutes < 0) minutes += 24 * 60;
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    await plugin.schedule({
      notifications: [{
        id: NOTIFICATION_IDS.danger,
        title: "Your risk window is coming up",
        body: `Gillie noticed ${danger.label} has been difficult. Set up water, gum, movement, or distance now.`,
        schedule: { on: { hour, minute }, repeats: true },
        extra: { route: "plan" },
        threadIdentifier: "gillie-risk",
        relevanceScore: 0.8,
      }],
    });
  }

  async function scheduleMilestones() {
    const plugin = notificationPlugin();
    if (!plugin || !state?.quitAt || !Array.isArray(MILESTONES)) return;
    const ids = MILESTONES.map((_, index) => NOTIFICATION_IDS.milestoneBase + index);
    await cancelNotificationIds(ids);
    const upcoming = MILESTONES.map((milestone, index) => ({
      milestone,
      id: NOTIFICATION_IDS.milestoneBase + index,
      at: state.quitAt + milestone.mins * 60000,
    })).filter((entry) => entry.at > Date.now() + 30000);
    if (!upcoming.length) return;
    await plugin.schedule({
      notifications: upcoming.map(({ milestone, id, at }) => ({
        id,
        title: `${milestone.title} clean`,
        body: `${state.petName || "Gillie"}'s water just got clearer. Open Gillie to see the milestone.`,
        schedule: { at: new Date(at) },
        extra: { route: "progress" },
        threadIdentifier: "gillie-milestones",
      })),
    });
  }

  async function scheduleInactivityNudge() {
    const plugin = notificationPlugin();
    await cancelNotificationIds([NOTIFICATION_IDS.inactivity]);
    if (!plugin || !state?.reminders?.checkin) return;
    const at = new Date(Date.now() + 36 * 3600000);
    await plugin.schedule({
      notifications: [{
        id: NOTIFICATION_IDS.inactivity,
        title: `${state.petName || "Gillie"} saved your place`,
        body: "No guilt and no lecture. Come back when you need the next clean decision.",
        schedule: { at },
        extra: { route: "home" },
        threadIdentifier: "gillie-return",
      }],
    });
  }

  async function scheduleCravingFollowupAlert(at) {
    const plugin = notificationPlugin();
    await cancelNotificationIds([NOTIFICATION_IDS.cravingFollowup]);
    if (!plugin || !state?.reminders?.craving || !at || at <= Date.now()) return;
    await plugin.schedule({
      notifications: [{
        id: NOTIFICATION_IDS.cravingFollowup,
        title: "Did the craving pass?",
        body: "Open Gillie and finish the follow-up. Honest data makes the next plan stronger.",
        schedule: { at: new Date(at) },
        extra: { route: "craving-followup" },
        threadIdentifier: "gillie-craving",
        relevanceScore: 0.9,
      }],
    });
  }

  async function scheduleSlipRecovery() {
    const plugin = notificationPlugin();
    if (!plugin || !state?.reminders?.checkin) return;
    await cancelNotificationIds([NOTIFICATION_IDS.slipRecovery]);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    await plugin.schedule({
      notifications: [{
        id: NOTIFICATION_IDS.slipRecovery,
        title: "New morning. Same team.",
        body: "Yesterday was information, not a verdict. Gillie is ready for the next clean hour.",
        schedule: { at: tomorrow },
        extra: { route: "home" },
        threadIdentifier: "gillie-recovery",
      }],
    });
  }

  async function syncNotifications({ ask = false } = {}) {
    if (!state?.onboarded || !nativePlatform()) return false;
    const granted = await ensureNotificationPermission({ ask });
    if (!granted) {
      renderNotificationSettings();
      return false;
    }
    try {
      await scheduleCheckinReminder();
      await scheduleDangerReminder();
      await scheduleMilestones();
      await scheduleInactivityNudge();
      if (state.pendingFollowup?.dueAt) await scheduleCravingFollowupAlert(state.pendingFollowup.dueAt);
      renderNotificationSettings();
      return true;
    } catch (error) {
      track("notification_schedule_error", { message: String(error?.message || error).slice(0, 80) });
      return false;
    }
  }

  function selectView(view) {
    const tab = document.querySelector(`#tabs [data-view="${view}"]`);
    if (tab) tab.click();
  }

  async function wireNotificationActions() {
    const plugin = notificationPlugin();
    if (!plugin?.addListener) return;
    try {
      await plugin.addListener("localNotificationActionPerformed", (event) => {
        const route = event?.notification?.extra?.route || "home";
        track("notification_opened", { route });
        setTimeout(() => {
          if (route === "checkin") {
            selectView("home");
            document.querySelector("#checkin-open")?.click();
          } else if (route === "progress") {
            selectView("progress");
          } else if (route === "plan") {
            selectView("home");
            if (typeof openTodayPlan === "function") openTodayPlan();
          } else if (route === "craving-followup") {
            selectView("home");
            if (typeof checkFollowupDue === "function") checkFollowupDue();
          } else {
            selectView("home");
          }
        }, 250);
      });
    } catch (_) {}
  }

  function hasLocalCheckin() {
    return Array.isArray(state?.checkins) && state.checkins.some((entry) => entry.date === localKey());
  }

  function installLocalDateFixes() {
    if (typeof SPEECH === "object" && Array.isArray(SPEECH.late)) {
      SPEECH.late = SPEECH.late.map((line) => line.replace("Crystal clear in here. Your doing.", "Crystal clear in here. You’re doing."));
    }

    if (typeof renderCheckinCard === "function") {
      renderCheckinCard = function renderCheckinCardLocal() {
        const profile = activeSubstance();
        document.querySelector("#checkin-use-label").textContent = `Any ${profile.useLabel === "puffs" ? "puffs" : "use"} today?`;
        const today = state.checkins.find((entry) => entry.date === localKey());
        const card = document.querySelector("#checkin-card");
        card.style.display = "flex";
        if (today) {
          card.querySelector(".t").textContent = "Checked in today";
          document.querySelector("#checkin-sub").textContent = `${moodFace(today.mood)} ${today.clean ? "Clean day logged" : "Slip logged"} · ${cravingLabel(today.intensity)}`;
          document.querySelector("#checkin-open").textContent = "Done";
          document.querySelector("#checkin-open").disabled = true;
        } else {
          card.querySelector(".t").textContent = "Daily check-in";
          document.querySelector("#checkin-sub").textContent = "30 seconds. Your friend is waiting.";
          document.querySelector("#checkin-open").textContent = "Check in";
          document.querySelector("#checkin-open").disabled = false;
        }
      };
    }

    const openButton = document.querySelector("#checkin-open");
    if (openButton) {
      openButton.onclick = () => {
        if (hasLocalCheckin()) return;
        checkinMood = null;
        checkinClean = "clean";
        checkinIntensity = 0;
        document.querySelectorAll("#mood-row button").forEach((button) => button.classList.remove("on"));
        document.querySelectorAll("#checkin-clean button").forEach((button, index) => button.classList.toggle("on", index === 0));
        document.querySelectorAll("#checkin-intensity button").forEach((button, index) => button.classList.toggle("on", index === 0));
        document.querySelector("#checkin-note").value = "";
        document.querySelector("#checkin-save").disabled = true;
        document.querySelector("#checkin-overlay").hidden = false;
        track("checkin_started");
      };
    }

    const saveButton = document.querySelector("#checkin-save");
    if (saveButton) {
      saveButton.onclick = () => {
        const clean = checkinClean === "clean";
        const note = document.querySelector("#checkin-note").value.trim().slice(0, 180);
        state.checkins = state.checkins.filter((entry) => entry.date !== localKey());
        state.checkins.push({ date: localKey(), mood: checkinMood, clean, intensity: checkinIntensity, note });
        document.querySelector("#checkin-overlay").hidden = true;
        track("checkin_completed", { clean, intensity: checkinIntensity });
        if (clean) {
          const value = grant(CONFIG.rewards.checkin);
          save();
          toast("🫧", `Check-in done. +${value} pearls — ${state.petName} did a little spin.`);
          axoCelebrate();
          renderAll();
          maybeOfferNotificationsAfterCheckin();
        } else {
          save();
          openSlip();
        }
      };
    }

    if (typeof buildTodayPlanData === "function") {
      buildTodayPlanData = function buildTodayPlanDataLocal() {
        const danger = dangerWindow();
        const trigger = topTrigger();
        const today = state.checkins.find((entry) => entry.date === localKey());
        const days = Math.floor(currentStreakMs() / dayMs);
        const fallback = days < 3
          ? "Early quit days are loud. Keep the next hour simple and make the old habit harder to reach."
          : "Your streak is moving. Keep today focused on one clean decision at a time.";
        const forecast = danger
          ? `${danger.label} looks like your highest-risk window.`
          : trigger
            ? `${trigger} is the pattern Gillie is watching.`
            : today
              ? `${cravingLabel(today.intensity)} today.`
              : fallback;
        const quickMove = danger
          ? "Before that window, set up water, gum, distance, or a 5-minute walk."
          : trigger
            ? "Put one counter-move in place now so the trigger has less room later."
            : today
              ? today.clean
                ? "Protect the win: log one note tonight so tomorrow starts sharper."
                : "Reset the next hour: open SOS before the urge gets loud again."
              : days < 1
                ? "Start tiny: protect the next 20 minutes and let the timer do the counting."
                : "Check in tonight so Gillie can spot tomorrow's risk faster.";
        const logStep = today
          ? today.clean
            ? "You already checked in. Add cravings as they happen so the forecast gets smarter."
            : "You logged a slip. Use the next check-in to record what helped you restart."
          : "Do one honest check-in tonight: mood, clean status, craving level, and one note.";
        return { forecast, quickMove, logStep };
      };
    }

    if (typeof openTodayPlan === "function") {
      openTodayPlan = function openTodayPlanLocal() {
        const overlay = document.querySelector("#today-plan-overlay");
        if (!overlay) return;
        const { forecast, quickMove, logStep } = buildTodayPlanData();
        const checkedIn = hasLocalCheckin();
        document.querySelector("#today-plan-copy").textContent = state.premium
          ? "Your fast daily read. Coach is the deeper room when you need tools."
          : "Free gives you one clear next step. Plus builds the full plan around your patterns.";
        document.querySelector("#today-watch").textContent = forecast;
        document.querySelector("#today-move").textContent = quickMove;
        document.querySelector("#today-log").textContent = logStep;
        document.querySelector("#today-upgrade-note").textContent = state.premium
          ? "Plus active: open Coach when you need playbooks, missions, and review memory."
          : "Plus adds danger-hour planning, trigger playbooks, slip recovery, and Coach missions.";
        document.querySelector("#today-checkin-btn").textContent = checkedIn ? "Check-in done today" : "Do today's check-in";
        document.querySelector("#today-checkin-btn").disabled = checkedIn;
        document.querySelector("#today-coach-btn").textContent = state.premium ? "Open Gillie Coach" : "Unlock the full Plus plan";
        overlay.hidden = false;
        track("today_plan_opened", { premium: !!state.premium });
      };
    }

    if (typeof coachContext === "function") {
      coachContext = function coachContextLocal() {
        const profile = activeSubstance();
        const trigger = topTrigger();
        const danger = dangerWindow();
        const lesson = lastSlipLesson();
        const today = state.checkins.find((entry) => entry.date === localKey());
        const lastReview = [...(state.coach?.reviews || [])].reverse()[0];
        const verb = profile.slip === "vaped" ? "vape" : profile.slip === "smoked" ? "smoke" : "use";
        return { profile, trigger, danger, lesson, today, lastReview, verb };
      };
    }
  }

  async function refreshProducts() {
    const plugin = purchasePlugin();
    if (!plugin?.getProducts || !CONFIG?.plus?.products) return;
    try {
      const response = await plugin.getProducts();
      const products = response?.products || [];
      products.forEach((product) => {
        const entry = Object.values(CONFIG.plus.products).find((plan) => plan.id === product.id);
        if (!entry) return;
        entry.price = product.displayPrice || entry.price;
        if (product.periodUnit && product.periodValue) {
          const unit = product.periodValue === 1 ? product.periodUnit : `${product.periodValue} ${product.periodUnit}s`;
          entry.cadence = `/ ${unit}`;
        }
      });
      if (typeof renderPlusPlans === "function" && !document.querySelector("#plus-overlay")?.hidden) renderPlusPlans();
      track("store_products_loaded", { count: products.length });
    } catch (error) {
      track("store_products_error", { message: String(error?.message || error).slice(0, 80) });
    }
  }

  function restoreCachedEntitlement() {
    const cached = state?.premiumEntitlement;
    if (!cached?.active || !cached.checkedAt) return false;
    if (Date.now() - cached.checkedAt > OFFLINE_ENTITLEMENT_GRACE_MS) return false;
    state.premium = true;
    save();
    try { renderAll(); } catch (_) {}
    return true;
  }

  function installEntitlementHardening() {
    restoreCachedEntitlement();
    const plugin = purchasePlugin();
    if (plugin?.addListener) {
      plugin.addListener("entitlementChanged", (result) => {
        if (typeof applyEntitlementStatus === "function") applyEntitlementStatus(result || {});
        syncNotifications();
        track("entitlement_changed", { active: !!result?.active });
      }).catch?.(() => {});
    }
    refreshProducts();
  }

  function renderNotificationSettings() {
    const checkinValue = document.querySelector("#set-reminder-checkin-v");
    const cravingValue = document.querySelector("#set-reminder-craving-v");
    if (!checkinValue || !cravingValue) return;
    permissionState().then((status) => {
      const unavailable = status !== "granted";
      checkinValue.textContent = !state.reminders.checkin ? "Off" : unavailable ? "Set up" : "8:30 PM";
      cravingValue.textContent = !state.reminders.craving ? "Off" : unavailable ? "Set up" : "On";
    });
  }

  function installReminderControls() {
    const checkinButton = document.querySelector("#set-reminder-checkin");
    const cravingButton = document.querySelector("#set-reminder-craving");
    if (checkinButton) {
      checkinButton.onclick = async () => {
        if (state.reminders.checkin) {
          state.reminders.checkin = false;
          save();
          await cancelNotificationIds([NOTIFICATION_IDS.checkin, NOTIFICATION_IDS.inactivity, NOTIFICATION_IDS.slipRecovery]);
          toast("⏰", "Daily check-in reminders are off.");
        } else {
          state.reminders.checkin = true;
          save();
          const granted = await syncNotifications({ ask: true });
          toast("⏰", granted ? "Gillie will check in each evening at 8:30 PM." : "Notifications are off in iPhone Settings.");
        }
        renderNotificationSettings();
      };
    }
    if (cravingButton) {
      cravingButton.onclick = async () => {
        if (state.reminders.craving) {
          state.reminders.craving = false;
          save();
          await cancelNotificationIds([NOTIFICATION_IDS.danger, NOTIFICATION_IDS.cravingFollowup]);
          toast("⏰", "Craving and danger-window nudges are off.");
        } else {
          state.reminders.craving = true;
          save();
          const granted = await syncNotifications({ ask: true });
          toast("⏰", granted ? "Craving follow-ups and Plus risk-window nudges are on." : "Notifications are off in iPhone Settings.");
        }
        renderNotificationSettings();
      };
    }
  }

  let notificationOfferShown = false;
  async function maybeOfferNotificationsAfterCheckin() {
    if (notificationOfferShown || !nativePlatform()) return;
    if (await permissionState() !== "prompt") return;
    notificationOfferShown = true;
    setTimeout(() => {
      if (typeof openConfirmSheet !== "function") return;
      openConfirmSheet({
        icon: "⏰",
        title: "Let Gillie check in?",
        copy: "Gillie can remind you at 8:30 PM, follow up after cravings, and warn Plus members before their hardest window. No ads and no tracking.",
        actionText: "Allow reminders",
        danger: false,
        onConfirm: () => syncNotifications({ ask: true }).then((granted) => {
          toast("⏰", granted ? "Gillie reminders are ready." : "You can enable notifications later in iPhone Settings.");
        }),
      });
    }, 500);
  }

  function wrapBehaviorEvents() {
    const hatch = document.querySelector("#ob-hatch");
    hatch?.addEventListener("click", () => {
      setTimeout(() => {
        track("onboarding_completed");
        syncNotifications();
      }, 150);
    });

    document.querySelector("#sos-fab")?.addEventListener("click", () => track("sos_started"));
    document.querySelector("#sos-beat")?.addEventListener("click", () => track("sos_marked_passed"));
    document.querySelector("#sos-slipped")?.addEventListener("click", () => track("sos_marked_used"));
    document.querySelector("#slip-confirm")?.addEventListener("click", () => {
      setTimeout(() => {
        track("slip_logged");
        scheduleSlipRecovery();
        syncNotifications();
      }, 100);
    });

    document.addEventListener("click", (event) => {
      const target = event.target.closest("button");
      if (!target) return;
      if (["plus-open", "set-plus"].includes(target.id) || target.dataset.act === "plus") {
        track("paywall_viewed", { source: target.id || "reef" });
      }
      if (target.id === "plus-purchase" || target.id === "plus-yearly" || target.id === "plus-monthly") {
        track("purchase_started", { source: "paywall" });
      }
      if (target.id === "plus-restore") track("restore_started");
      if (target.dataset.view) track("tab_viewed", { tab: target.dataset.view });
    }, true);

    if (typeof window.scheduleCravingFollowup === "function") {
      const original = window.scheduleCravingFollowup;
      window.scheduleCravingFollowup = function phase1ScheduleCravingFollowup(...args) {
        const result = original.apply(this, args);
        setTimeout(() => {
          if (state.pendingFollowup?.dueAt) scheduleCravingFollowupNotification(state.pendingFollowup.dueAt);
        }, 50);
        return result;
      };
    }
  }

  async function scheduleCravingFollowupNotification(at) {
    if (!await ensureNotificationPermission()) return;
    await scheduleCravingFollowupAlert(at);
  }

  function addProductionSettings() {
    const view = document.querySelector("#view-you");
    if (!view || document.querySelector("#phase1-settings")) return;
    const group = document.createElement("div");
    group.className = "set-group";
    group.id = "phase1-settings";
    group.innerHTML = `
      <button class="set-row" id="set-manage-subscription"><span class="t">Manage subscription</span><span class="v">Apple ↗</span></button>
      <button class="set-row" id="set-export-diagnostics"><span class="t">Export diagnostics</span><span class="v">Private</span></button>
      <button class="set-row" id="set-privacy-policy"><span class="t">Privacy Policy</span><span class="v">View</span></button>
      <button class="set-row" id="set-terms"><span class="t">Terms of Use</span><span class="v">View</span></button>
      <button class="set-row" id="set-support"><span class="t">Support</span><span class="v">Contact</span></button>
      <div class="set-row" aria-label="App version"><span class="t">Gillie version</span><span class="v" id="phase1-version">${VERSION}</span></div>`;
    const disclaimer = [...view.children].find((child) => child.tagName === "P");
    view.insertBefore(group, disclaimer || null);

    document.querySelector("#set-manage-subscription").onclick = async () => {
      try {
        if (purchasePlugin()?.manageSubscriptions) await purchasePlugin().manageSubscriptions();
        else window.location.href = "https://apps.apple.com/account/subscriptions";
      } catch (_) {
        window.location.href = "https://apps.apple.com/account/subscriptions";
      }
      track("manage_subscription_opened");
    };
    document.querySelector("#set-privacy-policy").onclick = () => { window.location.href = "./privacy.html"; };
    document.querySelector("#set-terms").onclick = () => { window.location.href = "./terms.html"; };
    document.querySelector("#set-support").onclick = () => { window.location.href = "./support.html"; };
    document.querySelector("#set-export-diagnostics").onclick = exportDiagnostics;
  }

  async function exportDiagnostics() {
    const localEvents = (() => {
      try { return JSON.parse(localStorage.getItem("gillie_phase1_events") || "[]"); } catch (_) { return []; }
    })();
    let native = {};
    try { native = await purchasePlugin()?.getDiagnostics?.() || {}; } catch (_) {}
    const payload = {
      generatedAt: new Date().toISOString(),
      phase: VERSION,
      app: native.app || {},
      events: native.events || localEvents,
      metricPayloads: native.metricPayloads || [],
      notificationPermission: await permissionState(),
      stateSummary: {
        onboarded: !!state?.onboarded,
        premium: !!state?.premium,
        checkins: state?.checkins?.length || 0,
        cravings: state?.cravings?.length || 0,
        slips: state?.slips?.length || 0,
      },
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      if (navigator.share) await navigator.share({ title: "Gillie diagnostics", text });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast("📋", "Diagnostics copied. No journal notes or pet name were included.");
      } else {
        throw new Error("Share unavailable");
      }
      track("diagnostics_exported");
    } catch (error) {
      if (String(error?.name || "").includes("Abort")) return;
      toast("📋", "Could not open the share sheet. Try again from the newest TestFlight build.");
    }
  }

  function enhancePaywallLegal() {
    const legal = document.querySelector("#plus-legal");
    if (!legal) return;
    legal.innerHTML = `Subscriptions renew automatically unless cancelled at least 24 hours before the current period ends. Manage or cancel in Apple subscriptions. <button type="button" id="plus-terms-link" style="text-decoration:underline;font-weight:800">Terms</button> · <button type="button" id="plus-privacy-link" style="text-decoration:underline;font-weight:800">Privacy</button>`;
    document.querySelector("#plus-terms-link")?.addEventListener("click", (event) => {
      event.stopPropagation();
      window.location.href = "./terms.html";
    });
    document.querySelector("#plus-privacy-link")?.addEventListener("click", (event) => {
      event.stopPropagation();
      window.location.href = "./privacy.html";
    });
  }

  function observePaywall() {
    const overlay = document.querySelector("#plus-overlay");
    if (!overlay) return;
    const observer = new MutationObserver(() => {
      if (!overlay.hidden) {
        enhancePaywallLegal();
        refreshProducts();
        track("paywall_presented");
      }
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ["hidden"] });
  }

  async function boot() {
    try {
      installLocalDateFixes();
      installEntitlementHardening();
      installReminderControls();
      wrapBehaviorEvents();
      addProductionSettings();
      enhancePaywallLegal();
      observePaywall();
      wireNotificationActions();
      renderNotificationSettings();
      if (state?.onboarded) {
        track("session_started", { premium: !!state.premium });
        await syncNotifications();
      } else {
        track("onboarding_started");
      }
      try { renderAll(); } catch (_) {}
    } catch (error) {
      track("phase1_boot_error", { message: String(error?.message || error).slice(0, 80) });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state?.onboarded) {
      restoreCachedEntitlement();
      refreshProducts();
      syncNotifications();
      track("session_resumed");
    }
  });
})();
