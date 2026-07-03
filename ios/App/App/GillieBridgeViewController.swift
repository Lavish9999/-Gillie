import Capacitor
import UIKit

@objc(GillieBridgeViewController)
class GillieBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(GilliePurchasesPlugin())
    }
}
