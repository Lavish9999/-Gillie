/* Gillie V1 onboarding — faster nicotine-focused setup with optional estimate details. */
(() => {
  "use strict";

  window.GillieV1?.register("onboarding", ({ qs, qsa, track }) => {
    const onboarding = qs("#onboarding");
    const usageStep = qs('#onboarding .ob-step[data-step="1"]');
    if (!onboarding || !usageStep || usageStep.dataset.v1Ready === "1") return;
    usageStep.dataset.v1Ready = "1";

    document.body.dataset.gillieFocus = "nicotine";

    const title = qs(".ob-title", usageStep);
    const subtitle = qs(".ob-sub", usageStep);
    if (title) title.textContent = "What nicotine are you quitting?";
    if (subtitle) subtitle.textContent = "Choose the closest match. Gillie can fine-tune savings later, after your first clean moment has started.";

    const habitLabel = qs(".field label", usageStep);
    if (habitLabel) habitLabel.textContent = "Primary nicotine habit";

    qsa('#ob-substance [data-v="weed"], #ob-substance [data-v="other"]', usageStep).forEach((button) => {
      button.hidden = true;
      button.disabled = true;
      button.setAttribute("aria-hidden", "true");
    });

    const fields = qsa(":scope > .ob-body > .field", usageStep);
    if (fields.length > 1) {
      const details = document.createElement("details");
      details.className = "v1-onboarding-details";
      details.innerHTML = `<summary><span><b>Fine-tune your savings estimate</b><small>Optional — defaults are ready</small></span><i aria-hidden="true"></i></summary>`;
      fields[0].insertAdjacentElement("afterend", details);
      fields.slice(1).forEach((field) => details.appendChild(field));
      details.addEventListener("toggle", () => track("onboarding_estimate_details", { open: details.open }));
    }

    const firstStep = qs('#onboarding .ob-step[data-step="0"]');
    const firstButton = qs("[data-next]", firstStep);
    if (firstButton) firstButton.textContent = "Meet Gillie";

    const reasonStep = qs('#onboarding .ob-step[data-step="2"]');
    const reasonSubtitle = qs(".ob-sub", reasonStep);
    if (reasonSubtitle) reasonSubtitle.textContent = "Pick what matters most. Gillie will bring it back when a nicotine urge tries to narrow your focus.";

    const nameStep = qs('#onboarding .ob-step[data-step="3"]');
    const nameTitle = qs(".ob-title", nameStep);
    if (nameTitle) nameTitle.textContent = "Make Gillie yours.";

    const costSetting = qs("#set-cost-label");
    if (costSetting) costSetting.textContent = "Nicotine & savings estimate";
  });
})();
