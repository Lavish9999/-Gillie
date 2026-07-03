import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let appBackground = UIColor(red: 232.0 / 255.0, green: 242.0 / 255.0, blue: 239.0 / 255.0, alpha: 1.0)
        window?.backgroundColor = appBackground

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

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart tasks that were paused or not yet started while the application was inactive. If the application was previously in the background, optionally refresh the interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the app is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking url opens, keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
