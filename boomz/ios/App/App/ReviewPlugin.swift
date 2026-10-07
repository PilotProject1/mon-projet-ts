import Capacitor
import StoreKit
import UIKit

/// Demande de note sur l'App Store, avec la fenêtre officielle d'Apple (on note
/// sans quitter le jeu). iOS décide seul de l'afficher ou non : au plus trois
/// fois par an, et jamais pour qui a déjà noté cette version.
@objc(ReviewPlugin)
public class ReviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ReviewPlugin"
    public let jsName = "BoomzReview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
    ]

    @objc func request(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let scene = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first { $0.activationState == .foregroundActive }
            if let scene {
                SKStoreReviewController.requestReview(in: scene)
            }
            call.resolve()
        }
    }
}
