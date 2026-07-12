/* Gillie V1 Reef Layout Fixes — accurate XP, in-flow SOS, and stable hierarchy. */
(() => {
  "use strict";

  window.GillieV1?.register("reef-layout-fixes", ({ qs, afterRender, notify, track }) => {
    const view = qs("#view-reef");
    if (!view) return;

    const FIX_ENGINE = "reef-layout-fixes-v1";
    const LEVEL_TARGETS = new Map([
      ["Ripple Keeper", 120],
      ["Kelp Keeper", 300],
      ["Coral Tender", 600],
      ["Tide Builder", 1000],
      ["Glowkeeper", 1500],
      ["Reef Guardian", 2200],
      ["Crystal Current", 3200],
    ]);

    function numberFrom(text) {
      const value = Number(String(text || "").replace(/[^0-9.-]/g, ""));
      return Number.isFinite(value) ? value : 0;
    }

    function correctRemainingXp() {
      const row = qs("#v1-reef-dashboard .v1-reef-xp-row", view);
      const currentNode = qs("b", row);
      const nextNode = qs("span", row);
      if (!currentNode || !nextNode) return;

      const match = nextNode.textContent.match(/XP to\s+(.+)$/i);
      if (!match) return;
      const nextName = match[1].trim();
      const target = LEVEL_TARGETS.get(nextName);
      if (!Number.isFinite(target)) return;

      const currentXp = numberFrom(currentNode.textContent);
      const remaining = Math.max(0, target - currentXp);
      nextNode.textContent = `${remaining.toLocaleString()} XP to ${nextName}`;
      nextNode.dataset.reefRemainingXp = String(remaining);
    }

    function openReefSos() {
      const trigger = qs("#sos-fab") || qs("#sos-open") || qs('[data-open-sos="true"]');
      if (trigger) {
        trigger.click();
        track("reef_inline_sos_opened", { engine: FIX_ENGINE });
      } else {
        notify("🌊", "Craving SOS is available from Home whenever a wave hits.");
      }
    }

    function installInlineSos() {
      const care = qs("#v1-reef-care", view);
      const taskList = qs(".v1-reef-task-list", care);
      if (!care || !taskList) return;

      let button = qs("#v1-reef-inline-sos", care);
      if (!button) {
        button = document.createElement("button");
        button.id = "v1-reef-inline-sos";
        button.className = "v1-reef-inline-sos";
        button.type = "button";
        button.innerHTML = `<span class="v1-reef-inline-sos-icon" aria-hidden="true">◯</span><span><small>Need help right now?</small><b>Open Craving SOS</b></span><i aria-hidden="true">›</i>`;
        taskList.insertAdjacentElement("beforebegin", button);
      }
      button.onclick = openReefSos;
    }

    function markHierarchy() {
      view.dataset.reefHierarchy = "seasonal-before-vault";
      const tools = qs("#phase2-reef-tools", view);
      if (tools) tools.dataset.reefContentRole = "seasonal-tools";
      const vault = qs("#v1-reef-vault", view);
      if (vault) vault.dataset.reefContentRole = "compact-vault";
    }

    function applyFixes() {
      correctRemainingXp();
      installInlineSos();
      markHierarchy();
    }

    afterRender(applyFixes);
    applyFixes();
    requestAnimationFrame(applyFixes);
    setTimeout(applyFixes, 120);
    track("reef_layout_fixes_installed", { engine: FIX_ENGINE });
  });
})();