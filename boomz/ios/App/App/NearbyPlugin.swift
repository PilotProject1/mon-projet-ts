import Capacitor
import MultipeerConnectivity

/// Parties sans internet entre iPhone proches : Multipeer Connectivity relie
/// les téléphones en Bluetooth et en Wi-Fi direct (sans box ni réseau mobile).
///
/// Le téléphone hôte annonce son salon et accepte les invités ; il fait
/// tourner la partie (côté JavaScript) et envoie l'état aux autres. Ce module
/// ne fait que transporter les messages texte du jeu, compressés.
@objc(NearbyPlugin)
public class NearbyPlugin: CAPPlugin, CAPBridgedPlugin, MCSessionDelegate, MCNearbyServiceAdvertiserDelegate,
    MCNearbyServiceBrowserDelegate {
    public let identifier = "NearbyPlugin"
    public let jsName = "Nearby"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startHosting", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startBrowsing", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "join", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    /// Nom du service annoncé (aussi déclaré dans Info.plist, NSBonjourServices).
    private static let serviceType = "boomz-jeu"
    /// Invités acceptés au plus : 6 joueurs avec l'hôte.
    private static let maxGuests = 5

    private let me = MCPeerID(displayName: String(UUID().uuidString.prefix(8)))
    private var session: MCSession?
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?
    /// Identifiants donnés aux autres téléphones, pour le JavaScript.
    private var ids: [MCPeerID: String] = [:]
    private var peers: [String: MCPeerID] = [:]
    private let lock = NSLock()

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    @objc func startHosting(_ call: CAPPluginCall) {
        let room = call.getString("room") ?? ""
        let name = call.getString("name") ?? ""
        reset()
        let session = newSession()
        let advertiser = MCNearbyServiceAdvertiser(
            peer: me, discoveryInfo: ["room": room, "name": String(name.prefix(16))], serviceType: Self.serviceType)
        advertiser.delegate = self
        self.advertiser = advertiser
        self.session = session
        advertiser.startAdvertisingPeer()
        call.resolve()
    }

    @objc func startBrowsing(_ call: CAPPluginCall) {
        reset()
        session = newSession()
        let browser = MCNearbyServiceBrowser(peer: me, serviceType: Self.serviceType)
        browser.delegate = self
        self.browser = browser
        browser.startBrowsingForPeers()
        call.resolve()
    }

    @objc func join(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let peer = peer(for: id), let browser, let session else {
            call.reject("Salon introuvable")
            return
        }
        browser.invitePeer(peer, to: session, withContext: nil, timeout: 15)
        call.resolve()
    }

    @objc func send(_ call: CAPPluginCall) {
        guard let id = call.getString("to"), let text = call.getString("data"), let peer = peer(for: id), let session
        else {
            call.resolve()
            return
        }
        do {
            let data = try (Data(text.utf8) as NSData).compressed(using: .zlib) as Data
            try session.send(data, toPeers: [peer], with: .reliable)
            call.resolve()
        } catch {
            // Téléphone parti entre-temps : sa déconnexion est signalée à part.
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        reset()
        call.resolve()
    }

    private func newSession() -> MCSession {
        let session = MCSession(peer: me, securityIdentity: nil, encryptionPreference: .required)
        session.delegate = self
        return session
    }

    private func reset() {
        advertiser?.stopAdvertisingPeer()
        advertiser?.delegate = nil
        browser?.stopBrowsingForPeers()
        browser?.delegate = nil
        session?.delegate = nil
        session?.disconnect()
        advertiser = nil
        browser = nil
        session = nil
        lock.lock()
        ids.removeAll()
        peers.removeAll()
        lock.unlock()
    }

    private func id(for peer: MCPeerID) -> String {
        lock.lock()
        defer { lock.unlock() }
        if let id = ids[peer] { return id }
        let id = UUID().uuidString
        ids[peer] = id
        peers[id] = peer
        return id
    }

    private func peer(for id: String) -> MCPeerID? {
        lock.lock()
        defer { lock.unlock() }
        return peers[id]
    }

    private func emit(_ event: String, _ data: [String: Any]) {
        DispatchQueue.main.async { self.notifyListeners(event, data: data) }
    }

    // MARK: Hôte : invitations reçues

    public func advertiser(
        _ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?,
        invitationHandler: @escaping (Bool, MCSession?) -> Void
    ) {
        guard let session, advertiser === self.advertiser else {
            invitationHandler(false, nil)
            return
        }
        invitationHandler(session.connectedPeers.count < Self.maxGuests, session)
    }

    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        emit("error", ["message": error.localizedDescription])
    }

    // MARK: Invité : salons à proximité

    public func browser(
        _ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?
    ) {
        guard browser === self.browser, let room = info?["room"] else { return }
        emit("hostFound", ["id": id(for: peerID), "room": room, "name": info?["name"] ?? ""])
    }

    public func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        guard browser === self.browser else { return }
        emit("hostLost", ["id": id(for: peerID)])
    }

    public func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        emit("error", ["message": error.localizedDescription])
    }

    // MARK: Session : connexions et messages

    public func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        guard session === self.session else { return }
        switch state {
        case .connected:
            emit("peerConnected", ["id": id(for: peerID)])
        case .notConnected:
            emit("peerDisconnected", ["id": id(for: peerID)])
        default:
            break
        }
    }

    public func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        guard session === self.session,
            let raw = try? (data as NSData).decompressed(using: .zlib) as Data,
            let text = String(data: raw, encoding: .utf8)
        else { return }
        emit("message", ["from": id(for: peerID), "data": text])
    }

    public func session(
        _ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID
    ) {}

    public func session(
        _ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID,
        with progress: Progress
    ) {}

    public func session(
        _ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID,
        at localURL: URL?, withError error: Error?
    ) {}
}
