import Capacitor
import UIKit
import WebKit

/// Vue principale de l'application : celle de Capacitor, plus les modules
/// natifs propres au jeu.
class BoomzViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NearbyPlugin())
        bridge?.registerPluginInstance(HapticsPlugin())
    }

    /// La musique du menu démarre dès l'ouverture, sans attendre un premier toucher.
    override open func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.mediaTypesRequiringUserActionForPlayback = []
        return configuration
    }
}
