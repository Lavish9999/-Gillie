# Gillie startup freeze root cause

The Phase 2 Reef card observer watched `childList`, `subtree`, and every attribute. Its callback (`decorateReefCards`) then rewrote observed `data-*`, `aria-description`, and badge text values on every callback. Those writes generated more observed mutations, creating a self-sustaining microtask loop.

Because MutationObserver callbacks run before timers and queued WebKit evaluation work, the loop starved:

- the normal splash-removal timers,
- the JavaScript recovery timer,
- the native WKWebView `evaluateJavaScript` watchdog.

The production fix makes Reef decoration idempotent and limits attribute observation to `class`, the only card attribute needed to detect ownership/equipped state changes. The generated Capacitor asset is syntax-checked before iOS sync.
