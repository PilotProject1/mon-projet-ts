import type { ClientMessage, IceServer, LobbyPlayer, VoiceSignal } from '../net/protocol';

/** Au-delà de ce niveau sonore (0 à 1), le joueur est considéré comme en train de parler. */
const SPEAKING_LEVEL = 0.035;
/** Fréquence de la mesure des niveaux (ms). */
const LEVEL_POLL_MS = 150;

interface PeerLink {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement | null;
  analyser: AnalyserNode | null;
  /** Candidats reçus avant la description distante, appliqués ensuite. */
  pendingCandidates: RTCIceCandidateInit[];
}

/**
 * Chat vocal des parties en ligne. La voix passe directement d'un téléphone à
 * l'autre (WebRTC) ; le serveur ne fait que relayer leur mise en relation. Un
 * lien par autre joueur présent dans le vocal (6 joueurs au plus).
 */
export class VoiceChat {
  /** Présent dans le vocal (micro ouvert, même coupé). */
  active = false;
  /** Son micro coupé : les autres ne l'entendent plus, lui les entend toujours. */
  micMuted = false;
  /** Joueurs présents dans le vocal que ce téléphone a choisi de ne plus entendre. */
  readonly mutedPlayers = new Set<string>();
  /** Joueurs en train de parler (dont soi-même). */
  readonly speaking = new Set<string>();

  private readonly send: (message: ClientMessage) => void;
  private readonly onChange: () => void;
  private me: string | null = null;
  private iceServers: IceServer[] = [];
  private stream: MediaStream | null = null;
  private readonly links = new Map<string, PeerLink>();
  private ctx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private poll: number | null = null;

  constructor(send: (message: ClientMessage) => void, onChange: () => void) {
    this.send = send;
    this.onChange = onChange;
  }

  static get supported(): boolean {
    return typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  /**
   * Test du micro, seul : enregistre trois secondes avec les mêmes réglages
   * que le chat vocal (anti-écho compris), puis les fait réécouter. Permet de
   * vérifier l'autorisation, la qualité, et le son du jeu micro ouvert.
   */
  static async testMicrophone(onStep: (step: 'recording' | 'playing') => void): Promise<string | null> {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'Test indisponible sur ce téléphone.';
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      return name === 'NotAllowedError' ? 'Micro refusé : autorisez-le dans Réglages › Boomz › Micro.' : 'Micro indisponible sur ce téléphone.';
    }
    try {
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
      onStep('recording');
      recorder.start();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      recorder.stop();
      await stopped;
      onStep('playing');
      // Le micro reste ouvert pendant la réécoute, comme pendant une partie avec le vocal.
      const url = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
      const audio = new Audio(url);
      audio.setAttribute('playsinline', '');
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
      return null;
    } catch {
      return 'Le test du micro a échoué.';
    } finally {
      for (const track of stream.getTracks()) track.stop();
    }
  }

  setIdentity(me: string, iceServers: IceServer[] | undefined): void {
    this.me = me;
    if (iceServers?.length) this.iceServers = iceServers;
  }

  /** Ouvre le micro et entre dans le vocal. Renvoie un message d'erreur, ou `null`. */
  async join(): Promise<string | null> {
    if (this.active) return null;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      return name === 'NotAllowedError'
        ? 'Micro refusé : autorisez-le dans Réglages › Boomz › Micro.'
        : 'Micro indisponible sur ce téléphone.';
    }
    this.active = true;
    this.micMuted = false;
    this.startLevels();
    this.send({ type: 'voice', on: true });
    this.onChange();
    return null;
  }

  /** Quitte le vocal et coupe le micro. `notify` : prévenir le serveur (inutile si l'on quitte le salon). */
  leave(notify = true): void {
    if (!this.active) return;
    this.active = false;
    for (const id of [...this.links.keys()]) this.closeLink(id);
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.stopLevels();
    this.speaking.clear();
    if (notify) this.send({ type: 'voice', on: false });
    this.onChange();
  }

  toggleMic(): void {
    this.micMuted = !this.micMuted;
    for (const track of this.stream?.getAudioTracks() ?? []) track.enabled = !this.micMuted;
    this.onChange();
  }

  togglePlayer(id: string): void {
    if (this.mutedPlayers.has(id)) this.mutedPlayers.delete(id);
    else this.mutedPlayers.add(id);
    const audio = this.links.get(id)?.audio;
    if (audio) audio.muted = this.mutedPlayers.has(id);
    this.onChange();
  }

  /** Retour après une coupure : le serveur a sorti ce joueur du vocal, on y revient. */
  rejoin(): void {
    if (this.active) this.send({ type: 'voice', on: true });
  }

  /** Suit la liste des joueurs du salon : ouvre ou ferme les liens avec ceux du vocal. */
  sync(players: LobbyPlayer[]): void {
    if (!this.active || !this.me) return;
    const me = this.me;
    const wanted = new Set(players.filter((player) => player.voice && player.connected && player.id !== me).map((player) => player.id));
    for (const id of [...this.links.keys()]) if (!wanted.has(id)) this.closeLink(id);
    // Moi inclus dans le vocal côté serveur : sinon, attendre que ce soit le cas.
    if (!players.some((player) => player.id === me && player.voice)) return;
    for (const id of wanted) {
      const link = this.links.get(id);
      if (link && link.pc.connectionState === 'failed') this.closeLink(id);
      // Un seul des deux lance la mise en relation, pour éviter les offres croisées.
      if (!this.links.has(id) && me < id) void this.call(id);
    }
  }

  async onSignal(from: string, data: VoiceSignal): Promise<void> {
    if (!this.active) return;
    try {
      if (data.description) {
        let link = this.links.get(from);
        if (data.description.type === 'offer') {
          if (link && link.pc.signalingState !== 'stable') return;
          link ??= this.openLink(from);
          await link.pc.setRemoteDescription(data.description);
          await this.flushCandidates(link);
          await link.pc.setLocalDescription(await link.pc.createAnswer());
          this.signal(from, { description: describe(link.pc.localDescription!) });
        } else if (link && link.pc.signalingState === 'have-local-offer') {
          await link.pc.setRemoteDescription(data.description);
          await this.flushCandidates(link);
        }
      } else if (data.candidate) {
        const link = this.links.get(from);
        if (!link) return;
        if (link.pc.remoteDescription) await link.pc.addIceCandidate(data.candidate);
        else link.pendingCandidates.push(data.candidate);
      }
    } catch {
      // Mise en relation ratée : le lien sera recréé au prochain passage de `sync`.
      this.closeLink(from);
    }
  }

  private async call(id: string): Promise<void> {
    const link = this.openLink(id);
    try {
      await link.pc.setLocalDescription(await link.pc.createOffer());
      this.signal(id, { description: describe(link.pc.localDescription!) });
    } catch {
      this.closeLink(id);
    }
  }

  private openLink(id: string): PeerLink {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const link: PeerLink = { pc, audio: null, analyser: null, pendingCandidates: [] };
    this.links.set(id, link);
    for (const track of this.stream?.getAudioTracks() ?? []) pc.addTrack(track, this.stream!);
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const { candidate, sdpMid, sdpMLineIndex } = event.candidate;
        this.signal(id, { candidate: { candidate, sdpMid, sdpMLineIndex } });
      }
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      const audio = link.audio ?? document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', '');
      audio.muted = this.mutedPlayers.has(id);
      audio.srcObject = stream;
      if (!link.audio) {
        audio.hidden = true;
        document.body.append(audio);
        link.audio = audio;
      }
      void audio.play().catch(() => {});
      link.analyser = this.analyse(stream);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') this.onChange();
    };
    return link;
  }

  private closeLink(id: string): void {
    const link = this.links.get(id);
    if (!link) return;
    this.links.delete(id);
    link.pc.onicecandidate = null;
    link.pc.ontrack = null;
    link.pc.close();
    link.audio?.remove();
    link.analyser?.disconnect();
    this.speaking.delete(id);
  }

  private async flushCandidates(link: PeerLink): Promise<void> {
    for (const candidate of link.pendingCandidates.splice(0)) await link.pc.addIceCandidate(candidate);
  }

  private signal(to: string, data: VoiceSignal): void {
    this.send({ type: 'signal', to, data });
  }

  // ---- Qui parle ----

  private analyse(stream: MediaStream): AnalyserNode | null {
    if (!this.ctx) return null;
    try {
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 512;
      this.ctx.createMediaStreamSource(stream).connect(analyser);
      return analyser;
    } catch {
      return null;
    }
  }

  private startLevels(): void {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Context && this.stream) {
      this.ctx = new Context();
      void this.ctx.resume();
      this.localAnalyser = this.analyse(this.stream);
    }
    this.poll = window.setInterval(() => this.measure(), LEVEL_POLL_MS);
  }

  private stopLevels(): void {
    if (this.poll !== null) window.clearInterval(this.poll);
    this.poll = null;
    this.localAnalyser = null;
    void this.ctx?.close();
    this.ctx = null;
  }

  private measure(): void {
    const before = [...this.speaking].sort().join();
    this.speaking.clear();
    if (this.me && !this.micMuted && level(this.localAnalyser) > SPEAKING_LEVEL) this.speaking.add(this.me);
    for (const [id, link] of this.links) {
      if (!this.mutedPlayers.has(id) && level(link.analyser) > SPEAKING_LEVEL) this.speaking.add(id);
    }
    if ([...this.speaking].sort().join() !== before) this.onChange();
  }
}

function describe(description: RTCSessionDescription): { type: 'offer' | 'answer'; sdp: string } {
  return { type: description.type === 'offer' ? 'offer' : 'answer', sdp: description.sdp };
}

/** Niveau sonore efficace (0 à 1) d'un signal. */
function level(analyser: AnalyserNode | null): number {
  if (!analyser) return 0;
  const samples = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(samples);
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}
