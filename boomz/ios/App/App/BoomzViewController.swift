import Capacitor
import UIKit

/// Vue principale de l'application : celle de Capacitor, plus les modules
/// natifs propres au jeu.
class BoomzViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NearbyPlugin())
    }
}
