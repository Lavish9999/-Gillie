/* Gillie V1 Coach — choose one need first, reveal the deeper library second. */
(() => {
  "use strict";

  window.GillieV1?.register("coach", ({ qs, qsa, track }) => {
    const room = qs("#coach-overlay .coach-room");
    if (!room || room.dataset.v1Ready === "1") return;
    room.dataset.v1Ready = "1";

    const hero = qs(".coach-hero", room);
    const title = qs("h2", hero);
    const copy = qs("#coach-hero-copy", room);
    const actions = qs(".coach-actions", room);
    if (title) title.textContent = "What do you need right now?";
    if (copy) copy.textContent = "Choose the closest situation. Gillie will give you one focused move before showing anything else.";

    if (actions && hero) hero.insertAdjacentElement("afterend", actions);

    const details = document.createElement("details");
    details.id = "v1-coach-library";
    details.className = "v1-coach-library";
    details.innerHTML = `<summary><span><b>Today’s plan and deeper tools</b><small>Missions, playbooks, and review</small></span><i aria-hidden="true"></i></summary>`;

    const response = qs("#coach-response", room);
    if (response) details.appendChild(response);

    const moveSection = (label, content) => {
      const heading = qsa(".sub-h", room).find((node) => node.textContent.trim() === label);
      if (heading) details.appendChild(heading);
      if (content) details.appendChild(content);
    };

    moveSection("Today’s missions", qs("#coach-missions", room));
    moveSection("Trigger playbooks", qs("#coach-playbooks", room));
    moveSection("Review loop", qs(".coach-review", room));
    room.appendChild(details);

    qsa("[data-coach-action]", actions).forEach((button) => {
      button.addEventListener("click", () => {
        details.open = true;
        details.scrollIntoView({ behavior: "smooth", block: "nearest" });
        track("coach_intervention_selected", { action: button.dataset.coachAction || "unknown" });
      });
    });

    details.addEventListener("toggle", () => track("coach_library_toggled", { open: details.open }));
  });
})();
