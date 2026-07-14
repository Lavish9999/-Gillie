/* Gillie V1 Launch Experience — cinematic intro and respectful first-setup review invitation. */
(() => {
  "use strict";

  if (window.__gillieLaunchExperienceInstalled) return;
  window.__gillieLaunchExperienceInstalled = true;

  const ENGINE = "launch-experience-v1";
  const LAUNCH_SEEN_KEY = "gillie.launch.intro.seen.v1";
  const RATING_STATE_KEY = "gillie.first.rating.prompt.v1";
  const LEGACY_REVIEW_KEY = "gillie_phase2_review";
  const FIRST_DURATION = 3050;
  const RETURN_DURATION = 2150;
  const REDUCED_DURATION = 700;
  const SETUP_WATCH_LIMIT_MS = 12 * 60 * 1000;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const nativeBridge = () => window.Capacitor?.Plugins?.GilliePurchases || null;

  let launchComplete = false;
  let launchFinishedAt = 0;
  let ratingScheduled = false;
  let ratingOverlay = null;
  let ratingPreviousFocus = null;
  let ratingKeyHandler = null;
  let onboardingObserver = null;
  let onboardingPoll = 0;

  function currentState() {
    try { return typeof state !== "undefined" && state ? state : null; } catch (_) { return null; }
  }

  function track(name, properties = {}) {
    try {
      nativeBridge()?.trackEvent?.({ name, properties: { engine: ENGINE, ...properties } });
    } catch (_) {}
  }

  function safeRead(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function safeWrite(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
  }

  function reducedMotion() {
    try {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return true;
      const prefs = JSON.parse(safeRead("gillie_phase2_preferences") || "{}");
      return Boolean(prefs.reducedMotion);
    } catch (_) {
      return false;
    }
  }

  function launchPetSvg() {
    return `<svg viewBox="0 0 220 170" role="img" aria-label="Gillie swimming into view">
      <defs>
        <radialGradient id="launch-body" cx="35%" cy="27%" r="85%"><stop offset="0" stop-color="#FFE3E8"/><stop offset=".55" stop-color="#FFAEBB"/><stop offset="1" stop-color="#E8899B"/></radialGradient>
        <linearGradient id="launch-tail" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F78DA4"/><stop offset="1" stop-color="#D85E79"/></linearGradient>
      </defs>
      <g data-launch-gill="left">
        <path d="M57 54C41 38 27 32 14 36c-7 2-8 9-4 14 10 12 27 14 46 11z" fill="#F2708A"/>
        <path d="M52 72C34 62 19 62 9 69c-6 5-3 12 3 15 14 7 30 1 45-7z" fill="#E86580"/>
        <path d="M58 91C43 93 31 103 27 116c-2 7 5 11 11 8 12-6 20-18 26-29z" fill="#F2708A"/>
      </g>
      <g data-launch-gill="right">
        <path d="M113 54c16-16 30-22 43-18 7 2 8 9 4 14-10 12-27 14-46 11z" fill="#F2708A"/>
        <path d="M118 72c18-10 33-10 43-3 6 5 3 12-3 15-14 7-30 1-45-7z" fill="#E86580"/>
        <path d="M112 91c15 2 27 12 31 25 2 7-5 11-11 8-12-6-20-18-26-29z" fill="#F2708A"/>
      </g>
      <g data-launch-tail>
        <path d="M147 102c27-30 54-27 68-16-4 14-15 26-30 32 15 5 21 15 15 27-24 4-44-6-59-25z" fill="url(#launch-tail)"/>
        <path d="M145 106c25-8 44-14 63-18-7 18-22 31-42 37-10 2-18-2-27-9z" fill="url(#launch-body)" opacity=".94"/>
      </g>
      <ellipse cx="137" cy="112" rx="51" ry="32" fill="url(#launch-body)"/>
      <ellipse cx="132" cy="121" rx="31" ry="15" fill="#FFD5DC" opacity=".88"/>
      <ellipse cx="84" cy="78" rx="46" ry="44" fill="url(#launch-body)"/>
      <ellipse cx="67" cy="58" rx="18" ry="10" fill="#fff" opacity=".26"/>
      <circle cx="61" cy="76" r="7.4" fill="#183B37"/><circle cx="63.5" cy="73" r="2.4" fill="#fff"/>
      <circle cx="103" cy="76" r="7.4" fill="#183B37"/><circle cx="105.5" cy="73" r="2.4" fill="#fff"/>
      <path d="M71 96q12 9 25 0" fill="none" stroke="#A94E63" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="58" cy="91" r="7" fill="#F2708A" opacity=".3"/><circle cx="108" cy="91" r="7" fill="#F2708A" opacity=".3"/>
      <ellipse cx="104" cy="145" rx="36" ry="7" fill="#15584F" opacity=".14"/>
    </svg>`;
  }

  function ratingPetSvg() {
    return `<svg viewBox="0 0 160 128" aria-hidden="true">
      <defs><radialGradient id="rating-body" cx="36%" cy="28%" r="84%"><stop offset="0" stop-color="#FFE2E8"/><stop offset=".58" stop-color="#FFAEBB"/><stop offset="1" stop-color="#E8899B"/></radialGradient></defs>
      <path d="M102 74c20-21 40-19 52-11-4 10-12 18-23 23 11 4 15 11 11 20-17 2-32-5-43-18z" fill="#F2708A"/>
      <ellipse cx="98" cy="82" rx="35" ry="22" fill="url(#rating-body)"/>
      <ellipse cx="61" cy="57" rx="33" ry="32" fill="url(#rating-body)"/>
      <path d="M39 43C28 32 17 29 9 34c8 11 18 14 31 13M37 57c-14-7-25-5-31 3 10 8 21 7 33 2M40 71c-12 2-19 9-21 18 12 1 20-5 26-14" fill="#F2708A"/>
      <path d="M83 43c11-11 22-14 30-9-8 11-18 14-31 13M85 57c14-7 25-5 31 3-10 8-21 7-33 2M82 71c12 2 19 9 21 18-12 1-20-5-26-14" fill="#F2708A"/>
      <circle cx="48" cy="57" r="5.5" fill="#173B37"/><circle cx="50" cy="55" r="1.8" fill="#fff"/>
      <circle cx="74" cy="57" r="5.5" fill="#173B37"/><circle cx="76" cy="55" r="1.8" fill="#fff"/>
      <path d="M52 72q9 7 18 0" fill="none" stroke="#A94E63" stroke-width="2.8" stroke-linecap="round"/>
    </svg>`;
  }

  function buildLaunchIntro() {
    const intro = document.createElement("div");
    intro.id = "splash";
    intro.className = "gillie-launch-intro";
    intro.setAttribute("aria-hidden", "true");
    intro.dataset.launchEngine = ENGINE;
    const bubbles = Array.from({ length: 14 }, (_, index) => {
      const size = 5 + ((index * 7) % 13);
      const x = 5 + ((index * 17) % 91);
      const duration = 3.3 + ((index * 11) % 22) / 10;
      const delay = -((index * 13) % 30) / 10;
      const drift = -18 + ((index * 19) % 37);
      return `<i style="--s:${size}px;--x:${x}%;--d:${duration}s;--delay:${delay}s;--drift:${drift}px"></i>`;
    }).join("");
    intro.innerHTML = `<div class="gillie-launch-bubbles">${bubbles}</div>
      <div class="gillie-launch-stage">
        <div class="gillie-launch-halo"></div>
        <div class="gillie-launch-pet">${launchPetSvg()}</div>
        <div class="gillie-launch-ripple"></div>
        <div class="gillie-launch-copy"><span class="gillie-launch-wordmark">Gillie</span><span class="gillie-launch-tagline">Stay clean · Keep the water clear</span></div>
      </div>
      <button type="button" class="gillie-launch-skip" aria-label="Skip animated intro">Tap to continue</button>`;
    return intro;
  }

  function finishLaunch(intro, reason = "complete") {
    if (launchComplete) return;
    launchComplete = true;
    launchFinishedAt = Date.now();
    safeWrite(LAUNCH_SEEN_KEY, String(launchFinishedAt));
    intro.classList.add("gillie-launch-out");
    document.documentElement.classList.remove("gillie-launch-active");
    setTimeout(() => intro.remove(), reducedMotion() ? 80 : 520);
    document.dispatchEvent(new CustomEvent("gillie:launch-intro-complete", { detail: { reason } }));
    track("launch_intro_completed", { reason, first: !safeRead(LAUNCH_SEEN_KEY) });
    tryScheduleRatingPrompt();
  }

  function showLaunchIntro() {
    const previousSeen = Boolean(safeRead(LAUNCH_SEEN_KEY));
    const previousSplash = document.getElementById("splash");
    const intro = buildLaunchIntro();
    if (previousSplash) previousSplash.replaceWith(intro);
    else document.body.prepend(intro);

    document.documentElement.classList.add("gillie-launch-active");
    requestAnimationFrame(() => intro.classList.add("gillie-launch-run"));

    const duration = reducedMotion() ? REDUCED_DURATION : previousSeen ? RETURN_DURATION : FIRST_DURATION;
    let canSkip = false;
    setTimeout(() => { canSkip = true; }, reducedMotion() ? 0 : 650);
    const finishTimer = setTimeout(() => finishLaunch(intro, "timer"), duration);
    const skip = () => {
      if (!canSkip || launchComplete) return;
      clearTimeout(finishTimer);
      finishLaunch(intro, "tap");
    };
    intro.addEventListener("click", skip);
    $(".gillie-launch-skip", intro)?.addEventListener("click", (event) => {
      event.stopPropagation();
      skip();
    });
    track("launch_intro_started", { first: !previousSeen, reducedMotion: reducedMotion() });
  }

  function ratingState() {
    const raw = safeRead(RATING_STATE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return { status: raw }; }
  }

  function saveRatingState(status, extra = {}) {
    safeWrite(RATING_STATE_KEY, JSON.stringify({ status, at: Date.now(), ...extra }));
  }

  function onboardingComplete() {
    const current = currentState();
    if (!current?.onboarded) return false;
    const onboarding = $("#onboarding");
    const main = $("#main");
    const onboardingHidden = !onboarding || onboarding.hidden || getComputedStyle(onboarding).display === "none" || onboarding.getAttribute("aria-hidden") === "true";
    const mainVisible = !main || (!main.hidden && getComputedStyle(main).display !== "none");
    return onboardingHidden && mainVisible;
  }

  function hasBlockingSheet() {
    const hatch = $("#phase2-hatch-cinematic.phase2-hatch-run");
    const openOverlay = $$(".overlay, [role='dialog']").some((node) => {
      if (node === ratingOverlay || node.hidden) return false;
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden";
    });
    return Boolean(hatch || openOverlay);
  }

  function tryScheduleRatingPrompt() {
    if (ratingScheduled || ratingState() || !onboardingComplete()) return;
    if (!launchComplete || Date.now() - launchFinishedAt < 650 || hasBlockingSheet()) {
      setTimeout(tryScheduleRatingPrompt, 450);
      return;
    }
    ratingScheduled = true;
    setTimeout(() => {
      if (hasBlockingSheet()) {
        ratingScheduled = false;
        tryScheduleRatingPrompt();
        return;
      }
      openRatingPrompt();
    }, 1050);
  }

  function closeRatingPrompt(reason = "dismissed") {
    if (!ratingOverlay) return;
    const overlay = ratingOverlay;
    overlay.classList.remove("gillie-rating-show");
    document.body.classList.remove("gillie-rating-open");
    if (ratingKeyHandler) document.removeEventListener("keydown", ratingKeyHandler, true);
    ratingKeyHandler = null;
    ratingOverlay = null;
    setTimeout(() => overlay.remove(), 280);
    setTimeout(() => ratingPreviousFocus?.focus?.({ preventScroll: true }), 320);
    track("first_setup_rating_prompt_closed", { reason });
  }

  function installRatingFocusTrap(overlay) {
    ratingKeyHandler = (event) => {
      if (!ratingOverlay) return;
      if (event.key === "Escape") {
        event.preventDefault();
        saveRatingState("later", { source: "escape" });
        closeRatingPrompt("escape");
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = $$("button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])", overlay);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", ratingKeyHandler, true);
  }

  async function requestNativeReview() {
    const plugin = nativeBridge();
    if (!plugin?.requestReview) {
      try { if (typeof toast === "function") toast("⭐", "Ratings are available in the iOS App Store build."); } catch (_) {}
      track("first_setup_rating_native_unavailable");
      return;
    }
    try {
      await plugin.requestReview();
      track("first_setup_rating_native_requested");
    } catch (error) {
      track("first_setup_rating_native_failed", { message: String(error?.message || error).slice(0, 100) });
    }
  }

  function openRatingPrompt() {
    if (ratingOverlay || ratingState()) return;
    const current = currentState();
    const petName = String(current?.petName || "Gillie").slice(0, 24);
    ratingPreviousFocus = document.activeElement;

    const overlay = document.createElement("div");
    overlay.id = "gillie-first-rating";
    overlay.className = "gillie-rating-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "gillie-rating-title");
    overlay.setAttribute("aria-describedby", "gillie-rating-copy");
    overlay.dataset.ratingEngine = ENGINE;
    overlay.innerHTML = `<div class="gillie-rating-card">
      <div class="gillie-rating-pet">${ratingPetSvg()}</div>
      <div class="gillie-rating-stars" aria-hidden="true">${Array.from({ length: 5 }, (_, index) => `<span style="--delay:${.1 + index * .08}s">★</span>`).join("")}</div>
      <h2 id="gillie-rating-title">${petName} is all set.</h2>
      <p id="gillie-rating-copy">Would you take a moment to rate Gillie? It helps more people find a calmer way through cravings.</p>
      <div class="gillie-rating-actions">
        <button type="button" class="gillie-rating-primary">Rate Gillie</button>
        <button type="button" class="gillie-rating-later">Maybe later</button>
      </div>
    </div>`;

    ratingOverlay = overlay;
    document.body.appendChild(overlay);
    document.body.classList.add("gillie-rating-open");
    installRatingFocusTrap(overlay);
    requestAnimationFrame(() => overlay.classList.add("gillie-rating-show"));

    $(".gillie-rating-primary", overlay)?.addEventListener("click", () => {
      saveRatingState("requested", { source: "first_setup" });
      safeWrite(LEGACY_REVIEW_KEY, String(Date.now()));
      closeRatingPrompt("rate");
      setTimeout(requestNativeReview, 360);
    });
    $(".gillie-rating-later", overlay)?.addEventListener("click", () => {
      saveRatingState("later", { source: "first_setup" });
      closeRatingPrompt("later");
    });
    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      saveRatingState("later", { source: "backdrop" });
      closeRatingPrompt("backdrop");
    });

    setTimeout(() => $(".gillie-rating-primary", overlay)?.focus({ preventScroll: true }), 380);
    track("first_setup_rating_prompt_shown", { petNameLength: petName.length });
  }

  function watchForFirstSetup(wasOnboardedAtBoot) {
    if (wasOnboardedAtBoot || ratingState()) return;
    const started = Date.now();
    const check = () => {
      if (ratingState() || Date.now() - started > SETUP_WATCH_LIMIT_MS) {
        onboardingObserver?.disconnect();
        onboardingObserver = null;
        clearInterval(onboardingPoll);
        onboardingPoll = 0;
        return;
      }
      if (onboardingComplete()) tryScheduleRatingPrompt();
    };
    onboardingObserver = new MutationObserver(check);
    onboardingObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "style", "aria-hidden"] });
    onboardingPoll = window.setInterval(check, 350);
    document.addEventListener("gillie:launch-intro-complete", check);
    check();
  }

  function install() {
    const wasOnboardedAtBoot = Boolean(currentState()?.onboarded);
    showLaunchIntro();
    watchForFirstSetup(wasOnboardedAtBoot);
    window.GillieLaunchExperience = Object.freeze({
      showRatingPrompt: openRatingPrompt,
      requestReview: requestNativeReview,
      engine: ENGINE,
    });
    track("launch_experience_loaded", { onboardedAtBoot: wasOnboardedAtBoot });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
