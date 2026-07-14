/* Gillie V1 backup — portable recovery history without importing paid entitlement. */
(() => {
  "use strict";

  const BACKUP_LIMITS = Object.freeze({
    maxFileBytes: 2 * 1024 * 1024,
    maxReasons: 8,
    maxOwnedItems: 200,
    maxEquippedDecor: 100,
    maxSlips: 2000,
    maxCravings: 4000,
    maxSosRewards: 1000,
    maxCheckins: 3000,
    maxMilestones: 200,
    maxBuddies: 4,
    maxCoachReviews: 1000,
    maxRecordEntries: 500,
    maxPearls: 1000000,
    maxMoney: 1000000,
    maxCleanMs: 100 * 365 * 86400000,
  });

  const TRIGGERS = new Set(["Stress", "Boredom", "Social", "After eating", "Drinking", "Phone scrolling", "Other"]);
  const SUBSTANCES = new Set(["vape", "cigarettes", "weed", "other"]);
  const REVIEW_RESULTS = new Set(["worked", "adjust"]);

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function finiteNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function integer(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
    return Math.round(finiteNumber(value, fallback, min, max));
  }

  function cleanText(value, maxLength, fallback = "") {
    if (typeof value !== "string") return fallback;
    return value
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  }

  function cleanId(value, fallback = "") {
    const text = cleanText(value, 48, fallback).toLowerCase();
    return /^[a-z0-9_-]{1,48}$/.test(text) ? text : fallback;
  }

  function cleanGeneratedId(value, prefix = "item") {
    const text = cleanText(value, 80, "");
    return /^[a-zA-Z0-9_-]{1,80}$/.test(text) ? text : `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function cleanTimestamp(value, fallback = 0) {
    const futureLimit = Date.now() + 366 * 86400000;
    return integer(value, fallback, 0, futureLimit);
  }

  function cleanDateKey(value, fallback = "") {
    const text = cleanText(value, 10, fallback);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return fallback;
    const parsed = new Date(`${text}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? fallback : text;
  }

  function cleanTextArray(value, limit, maxLength) {
    if (!Array.isArray(value)) return [];
    return value
      .slice(0, limit)
      .map((entry) => cleanText(entry, maxLength, ""))
      .filter(Boolean);
  }

  function cleanIdArray(value, limit) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.slice(0, limit).map((entry) => cleanId(entry, "")).filter(Boolean))];
  }

  function cleanRecord(value, limit = BACKUP_LIMITS.maxRecordEntries) {
    if (!isPlainObject(value)) return {};
    const out = {};
    Object.entries(value).slice(0, limit).forEach(([rawKey, rawValue]) => {
      const key = cleanId(rawKey, "");
      if (!key) return;
      if (typeof rawValue === "boolean") out[key] = rawValue;
      else if (Number.isFinite(Number(rawValue))) out[key] = finiteNumber(rawValue, 0, 0, BACKUP_LIMITS.maxCleanMs);
      else if (typeof rawValue === "string") out[key] = cleanText(rawValue, 80, "");
    });
    return out;
  }

  function sanitizeImported(source, baseState = {}) {
    if (!isPlainObject(source)) throw new Error("Backup state is invalid.");
    const base = isPlainObject(baseState) ? baseState : {};
    const next = { ...base };

    next.onboarded = Boolean(source.onboarded);
    next.petName = cleanText(source.petName, 14, cleanText(base.petName, 14, "Gillie")) || "Gillie";
    next.skin = cleanId(source.skin, cleanId(base.skin, "pink")) || "pink";
    next.hat = source.hat == null ? null : cleanId(source.hat, null);
    next.ownedItems = cleanIdArray(source.ownedItems, BACKUP_LIMITS.maxOwnedItems);
    next.equippedDecor = cleanIdArray(source.equippedDecor, BACKUP_LIMITS.maxEquippedDecor);
    next.pearls = integer(source.pearls, 0, 0, BACKUP_LIMITS.maxPearls);
    next.reasons = cleanTextArray(source.reasons, BACKUP_LIMITS.maxReasons, 80);

    next.quitAt = source.quitAt == null ? null : cleanTimestamp(source.quitAt, 0) || null;
    next.originalQuitAt = source.originalQuitAt == null ? null : cleanTimestamp(source.originalQuitAt, 0) || null;
    next.bankedCleanMs = finiteNumber(source.bankedCleanMs, 0, 0, BACKUP_LIMITS.maxCleanMs);

    next.slips = Array.isArray(source.slips) ? source.slips.slice(0, BACKUP_LIMITS.maxSlips).map((entry) => {
      const item = isPlainObject(entry) ? entry : {};
      return {
        at: cleanTimestamp(item.at, 0),
        streakMs: finiteNumber(item.streakMs, 0, 0, BACKUP_LIMITS.maxCleanMs),
        trigger: TRIGGERS.has(item.trigger) ? item.trigger : "Other",
        place: cleanText(item.place, 36, ""),
        plan: cleanText(item.plan, 180, ""),
      };
    }) : [];

    next.cravings = Array.isArray(source.cravings) ? source.cravings.slice(0, BACKUP_LIMITS.maxCravings).map((entry) => {
      const item = isPlainObject(entry) ? entry : {};
      return {
        id: cleanGeneratedId(item.id, "craving"),
        at: cleanTimestamp(item.at, 0),
        trigger: TRIGGERS.has(item.trigger) ? item.trigger : "Other",
        resisted: Boolean(item.resisted),
        pending: Boolean(item.pending),
        slip: Boolean(item.slip),
        followedUpAt: item.followedUpAt == null ? undefined : cleanTimestamp(item.followedUpAt, 0),
      };
    }) : [];

    if (isPlainObject(source.pendingFollowup)) {
      next.pendingFollowup = {
        cravingId: cleanGeneratedId(source.pendingFollowup.cravingId, "craving"),
        dueAt: cleanTimestamp(source.pendingFollowup.dueAt, 0),
        trigger: TRIGGERS.has(source.pendingFollowup.trigger) ? source.pendingFollowup.trigger : "Other",
      };
    } else next.pendingFollowup = null;

    next.sosRewards = Array.isArray(source.sosRewards) ? source.sosRewards.slice(0, BACKUP_LIMITS.maxSosRewards).map((entry) => {
      const item = isPlainObject(entry) ? entry : {};
      return { at: cleanTimestamp(item.at, 0), resisted: Boolean(item.resisted) };
    }) : [];

    next.checkins = Array.isArray(source.checkins) ? source.checkins.slice(0, BACKUP_LIMITS.maxCheckins).map((entry) => {
      const item = isPlainObject(entry) ? entry : {};
      return {
        date: cleanDateKey(item.date, ""),
        mood: integer(item.mood, 3, 1, 5),
        clean: Boolean(item.clean),
        intensity: integer(item.intensity, 0, 0, 3),
        note: cleanText(item.note, 180, ""),
      };
    }).filter((entry) => entry.date) : [];

    next.milestonesSeen = cleanIdArray(source.milestonesSeen, BACKUP_LIMITS.maxMilestones);
    next.milestonesRewarded = cleanIdArray(source.milestonesRewarded, BACKUP_LIMITS.maxMilestones);
    next.growthSeen = cleanIdArray(source.growthSeen, BACKUP_LIMITS.maxMilestones);

    const sourceCost = isPlainObject(source.cost) ? source.cost : {};
    const baseCost = isPlainObject(base.cost) ? base.cost : {};
    next.cost = {
      substance: SUBSTANCES.has(sourceCost.substance) ? sourceCost.substance : (SUBSTANCES.has(baseCost.substance) ? baseCost.substance : "vape"),
      style: cleanId(sourceCost.style, cleanId(baseCost.style, "disposables")) || "disposables",
      unitsPerWeek: finiteNumber(sourceCost.unitsPerWeek, finiteNumber(baseCost.unitsPerWeek, 2, 0.1, 1000), 0.1, 1000),
      costPerUnit: finiteNumber(sourceCost.costPerUnit, finiteNumber(baseCost.costPerUnit, 15, 0.5, BACKUP_LIMITS.maxMoney), 0.5, BACKUP_LIMITS.maxMoney),
      puffsPerDay: integer(sourceCost.puffsPerDay, integer(baseCost.puffsPerDay, 200, 1, 100000), 1, 100000),
    };

    if (isPlainObject(source.goal)) {
      const name = cleanText(source.goal.name, 30, "");
      const price = finiteNumber(source.goal.price, 0, 1, BACKUP_LIMITS.maxMoney);
      next.goal = name && price ? { name, price } : null;
    } else next.goal = null;

    next.theme = cleanId(source.theme, cleanId(base.theme, "clear")) || "clear";
    next.buddies = Array.isArray(source.buddies) ? source.buddies.slice(0, BACKUP_LIMITS.maxBuddies).map((entry) => {
      const item = isPlainObject(entry) ? entry : {};
      return {
        name: cleanText(item.name, 14, "Buddy") || "Buddy",
        skin: cleanId(item.skin, "pink") || "pink",
      };
    }) : [];

    const sourceCoach = isPlainObject(source.coach) ? source.coach : {};
    next.coach = {
      missionDate: cleanDateKey(sourceCoach.missionDate, null),
      completed: cleanRecord(sourceCoach.completed),
      reviews: Array.isArray(sourceCoach.reviews) ? sourceCoach.reviews.slice(0, BACKUP_LIMITS.maxCoachReviews).map((entry) => {
        const item = isPlainObject(entry) ? entry : {};
        return {
          date: cleanDateKey(item.date, ""),
          result: REVIEW_RESULTS.has(item.result) ? item.result : "adjust",
          note: cleanText(item.note, 160, ""),
          at: cleanTimestamp(item.at, 0),
        };
      }).filter((entry) => entry.date) : [],
    };

    const sourceReminders = isPlainObject(source.reminders) ? source.reminders : {};
    next.reminders = {
      checkin: typeof sourceReminders.checkin === "boolean" ? sourceReminders.checkin : true,
      craving: typeof sourceReminders.craving === "boolean" ? sourceReminders.craving : true,
    };
    next.justSlippedAt = cleanTimestamp(source.justSlippedAt, 0);

    const reef = isPlainObject(source.reefProgress) ? source.reefProgress : {};
    next.reefProgress = {
      bonusXp: finiteNumber(reef.bonusXp, 0, 0, BACKUP_LIMITS.maxPearls),
      claims: cleanRecord(reef.claims),
      dailyBonusClaims: cleanRecord(reef.dailyBonusClaims),
      lastSeenLevel: integer(reef.lastSeenLevel, 1, 1, 1000),
    };

    const moonlit = isPlainObject(source.moonlitReef) ? source.moonlitReef : {};
    next.moonlitReef = {
      ambienceEquipped: Boolean(moonlit.ambienceEquipped),
      jellyEquipped: Boolean(moonlit.jellyEquipped),
      crescentEquipped: Boolean(moonlit.crescentEquipped),
      starCoralEquipped: Boolean(moonlit.starCoralEquipped),
      previewedAt: cleanTimestamp(moonlit.previewedAt, 0),
      equippedAt: cleanTimestamp(moonlit.equippedAt, 0),
    };

    const plusValue = isPlainObject(source.plusValue) ? source.plusValue : {};
    next.plusValue = { perfectCareClaims: cleanRecord(plusValue.perfectCareClaims) };

    const plusWelcome = isPlainObject(source.plusWelcome) ? source.plusWelcome : {};
    next.plusWelcome = {
      version: 1,
      claimedAt: cleanTimestamp(plusWelcome.claimedAt, 0),
      bonusPearlsGranted: integer(plusWelcome.bonusPearlsGranted, 0, 0, 250),
      buddyCredits: integer(plusWelcome.buddyCredits, 0, 0, 1),
      nativeCheckedAt: cleanTimestamp(plusWelcome.nativeCheckedAt, 0),
    };

    next.premium = false;
    next.premiumEntitlement = { active: false, checkedAt: 0, source: "restore-pending-apple" };
    return next;
  }

  window.GillieBackupSafety = Object.freeze({
    limits: BACKUP_LIMITS,
    sanitizeImported,
    cleanText,
    cleanId,
  });

  window.GillieV1?.register("backup", ({ qs, getState, notify, track }) => {
    const view = qs("#view-you");
    if (!view || qs("#v1-backup-settings", view)) return;

    const allowedKeys = [
      "onboarded", "petName", "skin", "hat", "ownedItems", "equippedDecor", "pearls",
      "reasons", "quitAt", "originalQuitAt", "bankedCleanMs", "slips", "cravings",
      "pendingFollowup", "sosRewards", "checkins", "milestonesSeen", "milestonesRewarded",
      "growthSeen", "cost", "goal", "theme", "buddies", "coach", "reminders", "justSlippedAt",
      "reefProgress", "moonlitReef", "plusValue", "plusWelcome",
    ];

    const group = document.createElement("div");
    group.className = "set-group v1-backup-settings";
    group.id = "v1-backup-settings";
    group.innerHTML = `
      <button class="set-row" id="v1-export-backup"><span class="t">Export Gillie backup</span><span class="v">Save file</span></button>
      <button class="set-row" id="v1-import-backup"><span class="t">Import Gillie backup</span><span class="v">Restore</span></button>
      <div class="v1-backup-note">Includes streak history, check-ins, cravings, Reef progression, collection items, Plus reward state, and preferences. Gillie Plus is always re-verified by Apple. Backup files are readable JSON, so store them privately.</div>`;

    const production = qs("#phase1-settings", view);
    const disclaimer = Array.from(view.children).find((node) => node.tagName === "P");
    if (production) production.insertAdjacentElement("beforebegin", group);
    else view.insertBefore(group, disclaimer || null);

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.id = "v1-backup-file";
    input.hidden = true;
    view.appendChild(input);

    function backupPayload() {
      const current = getState();
      if (!current) throw new Error("Gillie data is not ready.");
      const safeState = {};
      allowedKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(current, key)) safeState[key] = current[key];
      });
      return {
        format: "gillie-backup",
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        state: JSON.parse(JSON.stringify(safeState)),
      };
    }

    async function exportBackup() {
      const payload = backupPayload();
      const text = JSON.stringify(payload, null, 2);
      const date = new Date().toISOString().slice(0, 10);
      const filename = `gillie-backup-${date}.json`;
      const file = new File([text], filename, { type: "application/json" });

      try {
        if (navigator.canShare?.({ files: [file] }) && navigator.share) {
          await navigator.share({ title: "Gillie backup", text: "Your private Gillie recovery backup.", files: [file] });
          notify("✓", "Gillie backup is ready.");
        } else {
          const url = URL.createObjectURL(file);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          notify("✓", "Gillie backup saved.");
        }
        track("backup_exported");
      } catch (error) {
        if (String(error?.name || "").includes("Abort")) return;
        try {
          await navigator.clipboard.writeText(text);
          notify("✓", "Backup copied. Save it as a .json file.");
          track("backup_exported", { fallback: "clipboard" });
        } catch (_) {
          notify("!", "Gillie could not open the backup share sheet.");
        }
      }
    }

    async function importFile(file) {
      if (!file || Number(file.size || 0) > BACKUP_LIMITS.maxFileBytes) {
        throw new Error("This backup is too large. Gillie accepts files up to 2 MB.");
      }
      const text = await file.text();
      if (text.length > BACKUP_LIMITS.maxFileBytes) throw new Error("This backup is too large. Gillie accepts files up to 2 MB.");
      const payload = JSON.parse(text);
      if (payload?.format !== "gillie-backup" || payload?.schemaVersion !== 1 || !payload?.state) {
        throw new Error("This is not a supported Gillie backup.");
      }
      const base = typeof defaultState === "function" ? defaultState() : {};
      const next = sanitizeImported(payload.state, base);
      const accepted = window.confirm("Restore this Gillie backup? Your current on-device Gillie history will be replaced. Gillie Plus will be rechecked with Apple.");
      if (!accepted) return;

      state = next;
      try { if (typeof normalizeState === "function") normalizeState(); } catch (_) {}
      if (typeof save === "function") save();
      if (typeof renderAxo === "function") renderAxo();
      if (typeof renderAll === "function") renderAll();
      try { await refreshPlusEntitlement?.({ quiet: true }); } catch (_) {}
      notify("✓", "Gillie backup restored.");
      track("backup_imported", { checkins: next.checkins.length, cravings: next.cravings.length });
    }

    qs("#v1-export-backup", group)?.addEventListener("click", () => exportBackup());
    qs("#v1-import-backup", group)?.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      try { await importFile(file); }
      catch (error) { notify("!", error?.message || "Gillie could not restore that backup."); }
    });
  });
})();
