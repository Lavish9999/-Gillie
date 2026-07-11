import UIKit
import Capacitor
import MetricKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, MXMetricManagerSubscriber {

    var window: UIWindow?
    private let metricLogKey = "gillie.diagnostics.metricPayloads"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let appBackground = UIColor(red: 232.0 / 255.0, green: 242.0 / 255.0, blue: 239.0 / 255.0, alpha: 1.0)
        window?.backgroundColor = appBackground
        MXMetricManager.shared.add(self)

        DispatchQueue.main.async { [weak self] in
            self?.window?.backgroundColor = appBackground
            if let bridgeViewController = self?.window?.rootViewController as? CAPBridgeViewController {
                bridgeViewController.view.backgroundColor = appBackground
                bridgeViewController.webView?.backgroundColor = appBackground
                bridgeViewController.webView?.scrollView.backgroundColor = appBackground
                bridgeViewController.webView?.isOpaque = false
            }
        }
        return true
    }

    func applicationWillTerminate(_ application: UIApplication) {
        MXMetricManager.shared.remove(self)
    }

    func didReceive(_ payloads: [MXMetricPayload]) {
        persistMetricKitPayloads(payloads.map { ("metric", $0.jsonRepresentation()) })
    }

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        persistMetricKitPayloads(payloads.map { ("diagnostic", $0.jsonRepresentation()) })
    }

    private func persistMetricKitPayloads(_ payloads: [(String, Data)]) {
        guard !payloads.isEmpty else { return }
        let defaults = UserDefaults.standard
        var stored = defaults.stringArray(forKey: metricLogKey) ?? []
        for (kind, data) in payloads {
            guard let json = String(data: data, encoding: .utf8) else { continue }
            let wrapped = "{\"kind\":\"\(kind)\",\"receivedAt\":\(Date().timeIntervalSince1970 * 1000),\"payload\":\(json)}"
            stored.append(wrapped)
        }
        defaults.set(Array(stored.suffix(5)), forKey: metricLogKey)
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
