import Capacitor
import UIKit

/// Vibrations du jeu (moteur haptique de l'iPhone) : explosions proches,
/// élimination, victoire.
@objc(HapticsPlugin)
public class HapticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HapticsPlugin"
    public let jsName = "BoomzHaptics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "impact", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notify", returnType: CAPPluginReturnPromise),
    ]

    /// Choc bref : `light`, `medium` ou `heavy`, avec une intensité de 0 à 1.
    @objc func impact(_ call: CAPPluginCall) {
        let style: UIImpactFeedbackGenerator.FeedbackStyle
        switch call.getString("style") {
        case "light": style = .light
        case "heavy": style = .heavy
        default: style = .medium
        }
        let intensity = CGFloat(min(max(call.getDouble("intensity") ?? 1, 0), 1))
        DispatchQueue.main.async {
            UIImpactFeedbackGenerator(style: style).impactOccurred(intensity: intensity)
            call.resolve()
        }
    }

    /// Motif : `success`, `warning` ou `error`.
    @objc func notify(_ call: CAPPluginCall) {
        let type: UINotificationFeedbackGenerator.FeedbackType
        switch call.getString("type") {
        case "success": type = .success
        case "warning": type = .warning
        default: type = .error
        }
        DispatchQueue.main.async {
            UINotificationFeedbackGenerator().notificationOccurred(type)
            call.resolve()
        }
    }
}
