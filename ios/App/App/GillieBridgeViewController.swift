import Capacitor
import Security
import UIKit

@objc(GillieBridgeViewController)
class GillieBridgeViewController: CAPBridgeViewController {
    private var startupWatchdog: DispatchWorkItem?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(GilliePurchasesPlugin())
        bridge?.registerPluginInstance(GillieWelcomeRecoveryPlugin())
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
            panel.querySelector('#gillie-native-reset').onclick = async () => {
              if (!confirm('Start fresh? This permanently deletes Gillie progress, preferences, and local diagnostics stored on this device.')) return;
              try { await window.Capacitor?.Plugins?.GilliePurchases?.clearDiagnostics?.(); } catch (_) {}
              try { localStorage.clear(); } catch (_) {}
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

@objc(GillieWelcomeRecoveryPlugin)
public class GillieWelcomeRecoveryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GillieWelcomeRecoveryPlugin"
    public let jsName = "GillieWelcomeRecovery"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recoverWelcomeBundle", returnType: CAPPluginReturnPromise)
    ]

    private struct RecoveryRecord: Codable {
        var version: Int
        var originalInstallId: String
        var recoveryUsed: Bool
        var recoveryInstallId: String?
        var establishedAt: Double
        var recoveredAt: Double?
    }

    private let defaults = UserDefaults.standard
    private let recoveryService = "com.gillie.plus.welcome.recovery"
    private let recoveryAccount = "bundle.v1"
    private let originalClaimService = "com.gillie.plus.welcome"
    private let originalClaimAccount = "bundle.v1"
    private let originalClaimFallbackKey = "gillie.plus.welcome.claimed.v1"
    private let welcomeInstallIDKey = "gillie.plus.welcome.installID"
    private let eventLogKey = "gillie.diagnostics.events"

    @objc func recoverWelcomeBundle(_ call: CAPPluginCall) {
        let localClaimedAt = max(0, call.getDouble("localClaimedAt") ?? 0)
        let localBonusPearlsGranted = max(0, call.getInt("localBonusPearlsGranted") ?? 0)
        let localBuddyCredits = max(0, call.getInt("localBuddyCredits") ?? 0)

        guard hasOriginalWelcomeClaim() else {
            call.resolve([
                "recovered": false,
                "settled": false,
                "reason": "claim-not-ready"
            ])
            return
        }

        let installID = ensureWelcomeInstallID()
        let now = Date().timeIntervalSince1970 * 1000

        if var record = readRecoveryRecord() {
            if record.originalInstallId == installID || record.recoveryInstallId == installID {
                call.resolve([
                    "recovered": false,
                    "settled": true,
                    "reason": "current-install"
                ])
                return
            }

            guard record.recoveryUsed == false else {
                call.resolve([
                    "recovered": false,
                    "settled": true,
                    "reason": "recovery-already-used"
                ])
                return
            }

            record.recoveryUsed = true
            record.recoveryInstallId = installID
            record.recoveredAt = now
            guard writeRecoveryRecord(record) else {
                call.reject("Gillie could not secure the welcome-bundle recovery.")
                return
            }

            recordEvent(name: "plus_welcome_recovery_granted_native", properties: ["source": "new-install"])
            call.resolve([
                "recovered": true,
                "settled": true,
                "bonusPearls": 250,
                "buddyCredits": 1,
                "claimedAt": max(localClaimedAt, record.establishedAt),
                "source": "keychain-recovery"
            ])
            return
        }

        if localBonusPearlsGranted > 0 || localBuddyCredits > 0 {
            let record = RecoveryRecord(
                version: 1,
                originalInstallId: installID,
                recoveryUsed: false,
                recoveryInstallId: nil,
                establishedAt: localClaimedAt > 0 ? localClaimedAt : now,
                recoveredAt: nil
            )
            guard writeRecoveryRecord(record) else {
                call.reject("Gillie could not secure the welcome-bundle recovery record.")
                return
            }
            recordEvent(name: "plus_welcome_recovery_established_native", properties: ["source": "local-reward-present"])
            call.resolve([
                "recovered": false,
                "settled": true,
                "reason": "original-install-established"
            ])
            return
        }

        guard localClaimedAt > 0 else {
            call.resolve([
                "recovered": false,
                "settled": false,
                "reason": "local-claim-not-ready"
            ])
            return
        }

        let migrated = RecoveryRecord(
            version: 1,
            originalInstallId: "legacy-existing-claim",
            recoveryUsed: true,
            recoveryInstallId: installID,
            establishedAt: localClaimedAt,
            recoveredAt: now
        )
        guard writeRecoveryRecord(migrated) else {
            call.reject("Gillie could not secure the migrated welcome-bundle recovery.")
            return
        }

        recordEvent(name: "plus_welcome_recovery_granted_native", properties: ["source": "legacy-missing-local-reward"])
        call.resolve([
            "recovered": true,
            "settled": true,
            "bonusPearls": 250,
            "buddyCredits": 1,
            "claimedAt": localClaimedAt,
            "source": "keychain-recovery"
        ])
    }

    private func ensureWelcomeInstallID() -> String {
        if let existing = defaults.string(forKey: welcomeInstallIDKey), !existing.isEmpty {
            return existing
        }
        let created = UUID().uuidString.lowercased()
        defaults.set(created, forKey: welcomeInstallIDKey)
        return created
    }

    private func hasOriginalWelcomeClaim() -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: originalClaimService,
            kSecAttrAccount as String: originalClaimAccount,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: false
        ]
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        if status == errSecSuccess { return true }
        return defaults.bool(forKey: originalClaimFallbackKey)
    }

    private func readRecoveryRecord() -> RecoveryRecord? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: recoveryService,
            kSecAttrAccount as String: recoveryAccount,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: true
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else {
            return nil
        }
        return try? JSONDecoder().decode(RecoveryRecord.self, from: data)
    }

    private func writeRecoveryRecord(_ record: RecoveryRecord) -> Bool {
        guard let data = try? JSONEncoder().encode(record) else { return false }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: recoveryService,
            kSecAttrAccount as String: recoveryAccount
        ]
        let update: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        let updateStatus = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if updateStatus == errSecSuccess { return true }
        guard updateStatus == errSecItemNotFound else { return false }

        let add = query.merging(update) { _, new in new }
        return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
    }

    private func recordEvent(name: String, properties: [String: Any]) {
        var events = defaults.array(forKey: eventLogKey) as? [[String: Any]] ?? []
        events.append([
            "name": name,
            "properties": properties,
            "at": Date().timeIntervalSince1970 * 1000
        ])
        defaults.set(Array(events.suffix(250)), forKey: eventLogKey)
    }
}
