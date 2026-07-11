import Capacitor
import UIKit

@objc(GillieBridgeViewController)
class GillieBridgeViewController: CAPBridgeViewController {
    private var startupWatchdog: DispatchWorkItem?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(GilliePurchasesPlugin())
        scheduleStartupWatchdog()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        scheduleStartupWatchdog()
    }

    deinit {
        startupWatchdog?.cancel()
    }

    private func scheduleStartupWatchdog() {
        startupWatchdog?.cancel()
        let work = DispatchWorkItem { [weak self] in
            self?.runStartupRecovery(attempt: 0)
        }
        startupWatchdog = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.2, execute: work)
    }

    private func runStartupRecovery(attempt: Int) {
        guard let webView else {
            retryStartupRecovery(after: 0.5, attempt: attempt)
            return
        }

        let recoveryScript = #"""
        (() => {
          const isVisible = (node) => {
            if (!node || node.hidden) return false;
            const style = window.getComputedStyle(node);
            return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
          };

          const removeSplash = () => {
            const splash = document.getElementById('splash');
            if (!splash) return;
            splash.classList.add('hide');
            splash.style.pointerEvents = 'none';
            splash.style.display = 'none';
            splash.remove();
          };

          const showRecovery = (message) => {
            removeSplash();
            if (document.getElementById('gillie-native-startup-recovery')) return;
            const panel = document.createElement('div');
            panel.id = 'gillie-native-startup-recovery';
            panel.setAttribute('role', 'alert');
            panel.style.cssText = "position:fixed;inset:0;z-index:1000;background:linear-gradient(180deg,#e8f2ef,#dceae6);display:grid;place-items:center;padding:24px;color:#11332f;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif";
            panel.innerHTML = `
              <div style="width:min(390px,100%);background:#fff;border-radius:26px;padding:24px;box-shadow:0 18px 48px rgba(17,51,47,.16);text-align:center">
                <div style="font-size:38px;margin-bottom:10px">🫧</div>
                <h1 style="font-size:25px;line-height:1.1;margin:0 0 10px">Gillie needs a quick restart.</h1>
                <p style="font-size:15px;line-height:1.45;color:#48645e;margin:0 0 18px">Your progress is still stored on this device.</p>
                <button id="gillie-native-retry" style="width:100%;min-height:50px;border:0;border-radius:999px;background:#11332f;color:#fff;font-weight:800;font-size:16px">Try again</button>
                <button id="gillie-native-reset" style="width:100%;min-height:46px;border:0;background:transparent;color:#7e958f;font-weight:700;margin-top:8px">Start fresh on this device</button>
                <small style="display:block;margin-top:12px;color:#9aaca7">${String(message || 'Startup did not finish.').replace(/[<>]/g, '').slice(0, 120)}</small>
              </div>`;
            document.body.appendChild(panel);
            panel.querySelector('#gillie-native-retry').onclick = () => location.reload();
            panel.querySelector('#gillie-native-reset').onclick = () => {
              if (!confirm('Start fresh? This permanently deletes Gillie progress stored on this device.')) return;
              try { localStorage.removeItem('gillie_v1'); } catch (_) {}
              location.reload();
            };
          };

          try {
            const main = document.getElementById('main');
            const onboarding = document.getElementById('onboarding');

            if (isVisible(main) || isVisible(onboarding)) {
              removeSplash();
              return { status: 'already-ready' };
            }

            let stored = null;
            try { stored = JSON.parse(localStorage.getItem('gillie_v1') || 'null'); } catch (_) {}

            if (stored && stored.onboarded) {
              try { if (typeof window.enterMain === 'function') window.enterMain(); } catch (_) {}
              if (onboarding) onboarding.hidden = true;
              if (main) main.hidden = false;
            } else {
              try { if (typeof window.obRender === 'function') window.obRender(); } catch (_) {}
              if (main) main.hidden = true;
              if (onboarding) onboarding.hidden = false;
            }

            removeSplash();

            if (!isVisible(main) && !isVisible(onboarding)) {
              showRecovery('The app shell did not become visible.');
              return { status: 'recovery-shown' };
            }

            return { status: 'recovered' };
          } catch (error) {
            showRecovery(error && error.message ? error.message : 'Native startup recovery failed.');
            return { status: 'recovery-shown' };
          }
        })();
        """#

        webView.evaluateJavaScript(recoveryScript) { [weak self] _, error in
            guard error != nil else { return }
            self?.retryStartupRecovery(after: 0.75, attempt: attempt)
        }
    }

    private func retryStartupRecovery(after delay: TimeInterval, attempt: Int) {
        guard attempt < 6 else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            self?.runStartupRecovery(attempt: attempt + 1)
        }
    }
}
