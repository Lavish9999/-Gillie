/* Gillie V1 backup — portable recovery history without importing paid entitlement. */
(() => {
  "use strict";

  window.GillieV1?.register("backup", ({ qs, getState, notify, track }) => {
    const view = qs("#view-you");
    if (!view || qs("#v1-backup-settings", view)) return;

    const allowedKeys = [
      "onboarded", "petName", "skin", "hat", "ownedItems", "equippedDecor", "pearls",
      "reasons", "quitAt", "originalQuitAt", "bankedCleanMs", "slips", "cravings",
      "pendingFollowup", "sosRewards", "checkins", "milestonesSeen", "milestonesRewarded",
      "growthSeen", "cost", "goal", "theme", "buddies", "coach", "reminders", "justSlippedAt",
      "reefProgress", "moonlitReef",
    ];

    const group = document.createElement("div");
    group.className = "set-group v1-backup-settings";
    group.id = "v1-backup-settings";
    group.innerHTML = `
      <button class="set-row" id="v1-export-backup"><span class="t">Export Gillie backup</span><span class="v">Save file</span></button>
      <button class="set-row" id="v1-import-backup"><span class="t">Import Gillie backup</span><span class="v">Restore</span></button>
      <div class="v1-backup-note">Includes streak history, check-ins, cravings, Reef progression, collection items, and preferences. Gillie Plus is always re-verified by Apple.</div>`;

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

    function sanitizeImported(source) {
      if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("Backup state is invalid.");
      const base = typeof defaultState === "function" ? defaultState() : {};
      const next = { ...base };
      allowedKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(source, key)) next[key] = source[key];
      });

      ["ownedItems", "equippedDecor", "reasons", "slips", "cravings", "sosRewards", "checkins", "milestonesSeen", "milestonesRewarded", "growthSeen", "buddies"].forEach((key) => {
        if (!Array.isArray(next[key])) next[key] = [];
      });
      if (!next.cost || typeof next.cost !== "object" || Array.isArray(next.cost)) next.cost = base.cost || {};
      if (!next.coach || typeof next.coach !== "object" || Array.isArray(next.coach)) next.coach = base.coach || { missionDate: null, completed: {}, reviews: [] };
      if (!next.reminders || typeof next.reminders !== "object" || Array.isArray(next.reminders)) next.reminders = base.reminders || { checkin: true, craving: true };
      if (!next.reefProgress || typeof next.reefProgress !== "object" || Array.isArray(next.reefProgress)) {
        next.reefProgress = { bonusXp: 0, claims: {}, dailyBonusClaims: {}, lastSeenLevel: 1 };
      }
      next.reefProgress.bonusXp = Math.max(0, Number(next.reefProgress.bonusXp || 0));
      next.reefProgress.claims = next.reefProgress.claims && typeof next.reefProgress.claims === "object" && !Array.isArray(next.reefProgress.claims) ? next.reefProgress.claims : {};
      next.reefProgress.dailyBonusClaims = next.reefProgress.dailyBonusClaims && typeof next.reefProgress.dailyBonusClaims === "object" && !Array.isArray(next.reefProgress.dailyBonusClaims) ? next.reefProgress.dailyBonusClaims : {};
      next.reefProgress.lastSeenLevel = Math.max(1, Number(next.reefProgress.lastSeenLevel || 1));
      if (!next.moonlitReef || typeof next.moonlitReef !== "object" || Array.isArray(next.moonlitReef)) {
        next.moonlitReef = {
          ambienceEquipped: false,
          jellyEquipped: false,
          crescentEquipped: false,
          starCoralEquipped: false,
          previewedAt: 0,
          equippedAt: 0,
        };
      }

      next.premium = false;
      next.premiumEntitlement = { active: false, checkedAt: 0, source: "restore-pending-apple" };
      return next;
    }

    async function importFile(file) {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (payload?.format !== "gillie-backup" || payload?.schemaVersion !== 1 || !payload?.state) {
        throw new Error("This is not a supported Gillie backup.");
      }
      const next = sanitizeImported(payload.state);
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
