/* Gillie V1 visual integrity — removes template-like status UI and guards human layout. */
(() => {
  "use strict";

  window.GillieV1?.register("visual-integrity", ({ qs, qsa, afterRender, track, getState }) => {
    const ENGINE = "visual-integrity-v1.1";
    const main = qs("#main");
    if (!main) return;

    function integrateAccessLabel(card, label) {
      if (!card) return;
      const eyebrow = qs(".eyebrow", card);
      if (eyebrow && !eyebrow.textContent.includes(label)) {
        eyebrow.textContent = `${eyebrow.textContent.trim()} · ${label}`;
      }
    }

    function removeTemplateBadges() {
      const plan = qs("#plan-preview");
      const planTag = qs(".tag", plan);
      if (planTag) {
        const text = planTag.textContent.trim().toUpperCase();
        if (text === "FREE") integrateAccessLabel(plan, "Free");
        if (["LIVE", "FREE"].includes(text)) planTag.remove();
      }

      const coach = qs("#coach-card");
      const coachTag = qs(".tag", coach);
      if (coachTag?.textContent.trim().toUpperCase() === "PLUS") {
        integrateAccessLabel(coach, "Plus");
        coachTag.remove();
      }

      qsa(".locked-teaser", main).forEach((card) => {
        const tag = qs(".tag", card);
        if (tag?.textContent.trim().toUpperCase() !== "PLUS") return;
        const title = qs(".t", card);
        if (title && !title.textContent.includes("Plus")) title.textContent = `${title.textContent.trim()} · Plus`;
        tag.remove();
      });

      qsa(".tag,.badge,[class*='status'],[class*='pill']", main).forEach((element) => {
        if (element.closest("[aria-live]")) return;
        const text = element.textContent.trim().toUpperCase();
        if (["LIVE", "BETA", "NEW"].includes(text)) element.remove();
      });
    }

    function normalizeDisplayTracking() {
      qsa("#main *").forEach((element) => {
        if (element.closest("svg") || element.classList.contains("phase2-sr-only")) return;
        const style = getComputedStyle(element);
        const fontSize = parseFloat(style.fontSize) || 0;
        const spacing = parseFloat(style.letterSpacing);
        if (fontSize >= 14 && Number.isFinite(spacing) && spacing > 1.4) {
          element.dataset.visualNormalTracking = "true";
        } else {
          delete element.dataset.visualNormalTracking;
        }
      });
    }

    function removeDecorativeAccentStripes() {
      qsa("[class*='card'],[class*='banner'],[class*='hero']", main).forEach((element) => {
        if (element.matches(".tank,[class*='preview-tank'],[class*='art']")) return;
        const style = getComputedStyle(element);
        const left = parseFloat(style.borderLeftWidth) || 0;
        const right = parseFloat(style.borderRightWidth) || 0;
        if (Math.max(left, right) >= 4) element.dataset.visualHeavyAccent = "true";
        else delete element.dataset.visualHeavyAccent;
      });
    }

    function compactOversizedStatusPills() {
      qsa(".tag,.badge,[class*='status'],[class*='pill']", main).forEach((element) => {
        if (element.matches("button,.btn") || element.closest("button")) return;
        const style = getComputedStyle(element);
        const height = element.getBoundingClientRect().height;
        const fontSize = parseFloat(style.fontSize) || 0;
        if (height > 50 || fontSize > 17) element.dataset.visualCompactStatus = "true";
        else delete element.dataset.visualCompactStatus;
      });
    }

    function collapseEmptyOversizedSurfaces() {
      qsa("[class*='card'],[class*='banner'],[class*='hero']", main).forEach((element) => {
        if (element.hidden || element.offsetParent === null) return;
        if (element.matches(".tank,[class*='preview'],[class*='art'],[class*='chart'],[class*='overlay'],[class*='sheet']")) return;
        const text = element.textContent.replace(/\s+/g, " ").trim();
        const hasMeaningfulMedia = Boolean(qs("img,svg,canvas,video,input,textarea,select", element));
        const height = element.getBoundingClientRect().height;
        if (height >= 220 && text.length < 32 && !hasMeaningfulMedia) element.dataset.visualEmptySurface = "true";
        else delete element.dataset.visualEmptySurface;
      });
    }

    function ensurePaywallDisclosure() {
      const overlay = qs("#plus-overlay");
      const footer = qs(".gp-footer", overlay);
      if (!overlay || !footer) return;

      let disclosure = qs("#v1-renewal-disclosure", footer);
      if (!disclosure) {
        disclosure = document.createElement("p");
        disclosure.id = "v1-renewal-disclosure";
        disclosure.className = "v1-renewal-disclosure";
        disclosure.textContent = "Payment is charged to your Apple ID at confirmation. Subscription renews automatically unless cancelled at least 24 hours before the current period ends. Manage or cancel in Apple Subscriptions.";
        footer.appendChild(disclosure);
      }

      const caption = qs(".gp-cta-caption", overlay);
      if (caption) caption.textContent = "Apple billing · Manage or cancel in Settings";

      qsa('[data-plus-plan="yearly"] .badge', overlay).forEach((badge) => {
        if (/save\s*\d/i.test(badge.textContent || "")) badge.remove();
      });

      const current = getState?.();
      const purchase = qs("#plus-purchase", overlay);
      const dock = qs("#gp-purchase-dock", overlay);
      let activeNote = qs("#v1-active-subscription", overlay);
      if (current?.premium) {
        overlay.classList.add("v1-plus-active");
        if (!activeNote && dock?.parentNode) {
          activeNote = document.createElement("div");
          activeNote.id = "v1-active-subscription";
          activeNote.className = "v1-active-subscription";
          activeNote.setAttribute("role", "status");
          activeNote.textContent = "Gillie Plus is active on this Apple ID. Manage or change your plan through Apple.";
          dock.parentNode.insertBefore(activeNote, dock);
        }
        if (purchase) {
          purchase.textContent = "Manage subscription";
          purchase.dataset.v1ManageSubscription = "true";
        }
      } else {
        overlay.classList.remove("v1-plus-active");
        activeNote?.remove();
        if (purchase?.dataset.v1ManageSubscription === "true") {
          delete purchase.dataset.v1ManageSubscription;
          purchase.textContent = "Start Gillie Plus";
        }
      }
    }

    async function openAppleSubscriptionManagement() {
      try {
        const plugin = window.Capacitor?.Plugins?.GilliePurchases;
        if (plugin?.manageSubscriptions) {
          await plugin.manageSubscriptions();
          return;
        }
      } catch (_) {}
      window.location.href = "https://apps.apple.com/account/subscriptions";
    }

    function schedulePaywallIntegrity() {
      [0, 120, 360].forEach((delay) => setTimeout(ensurePaywallDisclosure, delay));
    }

    function cleanVersionLabel() {
      const label = qs("#phase1-version");
      if (!label || label.dataset.v1VersionResolved === "true") return;
      label.dataset.v1VersionResolved = "true";
      label.textContent = "1.0";
      try {
        const request = window.Capacitor?.Plugins?.GilliePurchases?.getDiagnostics?.();
        request?.then?.((result) => {
          const version = String(result?.app?.version || "").trim();
          const build = String(result?.app?.build || "").trim();
          if (version) label.textContent = build ? `${version} (${build})` : version;
        }).catch?.(() => {});
      } catch (_) {}
    }

    function installPaywallCapture() {
      if (document.documentElement.dataset.v1PaywallIntegrity === "true") return;
      document.documentElement.dataset.v1PaywallIntegrity = "true";
      document.addEventListener("click", (event) => {
        const purchase = event.target?.closest?.("#plus-purchase");
        if (purchase?.dataset.v1ManageSubscription === "true") {
          event.preventDefault?.();
          event.stopImmediatePropagation?.();
          openAppleSubscriptionManagement();
          return;
        }
        const opener = event.target?.closest?.("#plus-open,#set-plus,[data-act='plus'],#ship-premium-teaser,[data-reef-vault-action],[data-moonlit-equip]");
        if (opener) schedulePaywallIntegrity();
      }, true);
    }

    function applyVisualIntegrity() {
      removeTemplateBadges();
      normalizeDisplayTracking();
      removeDecorativeAccentStripes();
      compactOversizedStatusPills();
      collapseEmptyOversizedSurfaces();
      ensurePaywallDisclosure();
      cleanVersionLabel();
      document.documentElement.dataset.visualIntegrity = ENGINE;
    }

    installPaywallCapture();
    afterRender(applyVisualIntegrity);
    applyVisualIntegrity();
    requestAnimationFrame(applyVisualIntegrity);
    setTimeout(applyVisualIntegrity, 140);
    schedulePaywallIntegrity();
    track("visual_integrity_installed", { engine: ENGINE });
  });
})();
