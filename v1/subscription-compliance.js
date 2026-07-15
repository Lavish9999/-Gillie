/* Gillie subscription compliance — explicit, functional legal links and renewal disclosure for App Review. */
(() => {
  "use strict";

  if (window.__gillieSubscriptionComplianceInstalled) return;
  window.__gillieSubscriptionComplianceInstalled = true;

  const ENGINE = "subscription-compliance-v1";
  const TERMS_URL = "https://lavish9999.github.io/-Gillie/terms.html";
  const PRIVACY_URL = "https://lavish9999.github.io/-Gillie/privacy.html";
  const APPLE_EULA_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
  const DISCLOSURE_TEXT = "Gillie Plus Monthly renews monthly and Gillie Plus Yearly renews yearly. The selected Apple price is shown above. Payment is charged to your Apple ID at confirmation and renews automatically until cancelled in Apple subscription settings.";
  let observer = null;
  let refreshTimer = 0;
  let readyTracked = false;

  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const bridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;

  function track(name, properties = {}) {
    try { bridge()?.trackEvent?.({ name, properties: { engine: ENGINE, ...properties } }); }
    catch (_) {}
  }

  function ensureStyles() {
    if (document.getElementById("gillie-subscription-compliance-style")) return;
    const style = document.createElement("style");
    style.id = "gillie-subscription-compliance-style";
    style.textContent = `
      .gp-subscription-disclosure {
        margin: 12px auto 4px;
        max-width: 560px;
        color: var(--ink-faint, #6f8580);
        font-size: 11px;
        font-weight: 650;
        line-height: 1.45;
        text-align: center;
      }
      .gp-legal-links {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 2px 8px;
        margin-top: 2px;
      }
      .gp-legal-links a {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 4px 2px;
        color: var(--ink-soft, #49635e);
        font-size: 11px;
        font-weight: 800;
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .gp-legal-links .gp-legal-separator {
        color: var(--ink-faint, #839893);
        font-size: 10px;
      }
    `;
    document.head.appendChild(style);
  }

  function linkHtml(url, label, key) {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer external" data-subscription-compliance-link="${key}">${label}</a>`;
  }

  function expectedLinksHtml() {
    return [
      linkHtml(TERMS_URL, "Terms of Use (EULA)", "terms"),
      '<span class="gp-legal-separator" aria-hidden="true">·</span>',
      linkHtml(PRIVACY_URL, "Privacy Policy", "privacy"),
      '<span class="gp-legal-separator" aria-hidden="true">·</span>',
      linkHtml(APPLE_EULA_URL, "Apple Standard EULA", "apple-eula"),
    ].join("");
  }

  function ensureComplianceContent() {
    ensureStyles();
    const overlay = $("#plus-overlay");
    if (!overlay) return false;
    const footer = $(".gp-footer", overlay) || $("#plus-legal", overlay)?.parentElement;
    if (!footer) return false;

    let disclosure = $("#gp-subscription-disclosure", footer);
    if (!disclosure) {
      disclosure = document.createElement("p");
      disclosure.id = "gp-subscription-disclosure";
      disclosure.className = "gp-subscription-disclosure";
      const legalSource = $("#plus-legal", footer);
      footer.insertBefore(disclosure, legalSource || null);
    }
    if (disclosure.textContent !== DISCLOSURE_TEXT) disclosure.textContent = DISCLOSURE_TEXT;

    let links = $(".gp-legal-links", footer);
    if (!links) {
      links = document.createElement("div");
      links.className = "gp-legal-links";
      const legalSource = $("#plus-legal", footer);
      footer.insertBefore(links, legalSource || null);
    }
    const expected = expectedLinksHtml();
    if (links.innerHTML !== expected) links.innerHTML = expected;

    if (overlay.dataset.subscriptionCompliance !== ENGINE) overlay.dataset.subscriptionCompliance = ENGINE;
    return true;
  }

  function scheduleRefresh(delay = 0) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (!ensureComplianceContent() || readyTracked) return;
      readyTracked = true;
      track("subscription_compliance_ready");
    }, delay);
  }

  function installObserver() {
    const root = document.body;
    if (!root || observer) return;
    observer = new MutationObserver(() => scheduleRefresh(20));
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  }

  document.addEventListener("click", async (event) => {
    const link = event.target?.closest?.("[data-subscription-compliance-link]");
    if (!link) {
      if (event.target?.closest?.("#plus-open,#set-plus,[data-act='plus'],#ship-premium-teaser")) scheduleRefresh(20);
      return;
    }

    const url = String(link.href || "");
    const key = String(link.dataset.subscriptionComplianceLink || "unknown");
    track("subscription_legal_link_opened", { key });

    const browser = window.Capacitor?.Plugins?.Browser;
    if (!browser?.open) return;
    event.preventDefault();
    try { await browser.open({ url }); }
    catch (_) { window.open(url, "_blank", "noopener,noreferrer"); }
  }, true);

  function boot(attempt = 0) {
    installObserver();
    if (ensureComplianceContent()) {
      readyTracked = true;
      track("subscription_compliance_installed", {
        terms: TERMS_URL,
        privacy: PRIVACY_URL,
        appleEula: APPLE_EULA_URL,
      });
      window.GillieSubscriptionCompliance = Object.freeze({
        engine: ENGINE,
        refresh: ensureComplianceContent,
        termsUrl: TERMS_URL,
        privacyUrl: PRIVACY_URL,
        appleEulaUrl: APPLE_EULA_URL,
      });
      return;
    }
    if (attempt < 160) setTimeout(() => boot(attempt + 1), 50);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => boot(), { once: true });
  else boot();
})();
