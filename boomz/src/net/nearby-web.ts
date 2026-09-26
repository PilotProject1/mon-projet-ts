import { WebPlugin } from '@capacitor/core';
import type { NearbyPlugin } from './nearby';

type Signal =
  | { kind: 'discover'; from: string }
  | { kind: 'advert'; from: string; room: string; name: string }
  | { kind: 'invite'; from: string; to: string }
  | { kind: 'accepted'; from: string; to: string }
  | { kind: 'data'; from: string; to: string; data: string }
  | { kind: 'bye'; from: string };

/**
 * Simulation du module sans internet dans le navigateur, pour le
 * développement : les onglets d'un même navigateur jouent le rôle de
 * téléphones proches (BroadcastChannel). Jamais proposée en production.
 */
export class NearbyWeb extends WebPlugin implements Omit<NearbyPlugin, 'addListener'> {
  private readonly me = Math.random().toString(36).slice(2, 10);
  private readonly channel = new BroadcastChannel('boomz-nearby');
  private hosting: { room: string; name: string } | null = null;
  private browsing = false;
  private readonly connected = new Set<string>();

  constructor() {
    super();
    this.channel.onmessage = (event: MessageEvent<Signal>) => this.receive(event.data);
    window.addEventListener('pagehide', () => this.post({ kind: 'bye', from: this.me }));
  }

  async isAvailable(): Promise<{ available: boolean }> {
    return { available: true };
  }

  async startHosting(options: { room: string; name: string }): Promise<void> {
    this.reset();
    this.hosting = options;
    this.post({ kind: 'advert', from: this.me, ...options });
  }

  async startBrowsing(): Promise<void> {
    this.reset();
    this.browsing = true;
    this.post({ kind: 'discover', from: this.me });
  }

  async join(options: { id: string }): Promise<void> {
    this.post({ kind: 'invite', from: this.me, to: options.id });
  }

  async send(options: { to: string; data: string }): Promise<void> {
    if (this.connected.has(options.to)) this.post({ kind: 'data', from: this.me, to: options.to, data: options.data });
  }

  async stop(): Promise<void> {
    this.reset();
  }

  private reset(): void {
    if (this.hosting || this.connected.size > 0) this.post({ kind: 'bye', from: this.me });
    this.hosting = null;
    this.browsing = false;
    this.connected.clear();
  }

  private post(signal: Signal): void {
    this.channel.postMessage(signal);
  }

  private receive(signal: Signal): void {
    if ('to' in signal && signal.to !== this.me) return;
    switch (signal.kind) {
      case 'discover':
        if (this.hosting) this.post({ kind: 'advert', from: this.me, ...this.hosting });
        return;
      case 'advert':
        if (this.browsing) this.notifyListeners('hostFound', { id: signal.from, room: signal.room, name: signal.name });
        return;
      case 'invite':
        if (!this.hosting) return;
        this.connected.add(signal.from);
        this.post({ kind: 'accepted', from: this.me, to: signal.from });
        this.notifyListeners('peerConnected', { id: signal.from });
        return;
      case 'accepted':
        this.connected.add(signal.from);
        this.notifyListeners('peerConnected', { id: signal.from });
        return;
      case 'data':
        if (this.connected.has(signal.from)) this.notifyListeners('message', { from: signal.from, data: signal.data });
        return;
      case 'bye':
        if (this.browsing) this.notifyListeners('hostLost', { id: signal.from });
        if (this.connected.delete(signal.from)) this.notifyListeners('peerDisconnected', { id: signal.from });
        return;
    }
  }
}
