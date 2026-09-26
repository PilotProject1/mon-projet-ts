import { Bonus } from '../game/types';
import type { SoundEvent } from './events';

/**
 * Sons et musiques, entièrement synthétisés avec Web Audio : aucun fichier à
 * télécharger (rien à charger sur réseau mobile) et aucune question de droits.
 */

type Wave = OscillatorType;

interface ToneOptions {
  type?: Wave;
  /** Fréquence d'arrivée (glissando), en Hz. */
  to?: number;
  volume?: number;
  attack?: number;
  /** Décalage de départ, en secondes. */
  delay?: number;
  destination?: AudioNode;
}

interface NoiseOptions {
  filter?: BiquadFilterType;
  from?: number;
  to?: number;
  q?: number;
  volume?: number;
  delay?: number;
}

const SFX_VOLUME = 0.55;
const MUSIC_VOLUME = 0.22;
const SETTINGS_KEY = 'boomz.audio';

// Notes (Hz) utilisées par les jingles et les musiques.
const NOTE: Record<string, number> = {
  A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, C6: 1046.5,
};

type Track = 'menu' | 'game';

interface MusicPattern {
  bpm: number;
  /** Basse, une note par temps (4 temps par mesure), `''` = silence. */
  bass: string[];
  /** Mélodie en doubles croches (4 par temps). */
  lead: string[];
  drums: boolean;
  leadWave: Wave;
}

// Progression la–fa–do–sol, entraînante pour la partie, plus posée pour le menu.
const PATTERNS: Record<Track, MusicPattern> = {
  game: {
    bpm: 132,
    bass: ['A2', 'A2', 'A3', 'A2', 'F3', 'F3', 'F3', 'F3', 'C3', 'C3', 'C3', 'C3', 'G3', 'G3', 'G3', 'D3'],
    lead: [
      'A4', '', 'C5', '', 'E5', '', 'C5', '', 'A4', '', 'E5', '', 'D5', 'C5', 'B4', '',
      'F4', '', 'A4', '', 'C5', '', 'A4', '', 'F4', '', 'C5', '', 'A4', '', 'G4', '',
      'E4', '', 'G4', '', 'C5', '', 'G4', '', 'E5', '', 'D5', '', 'C5', '', 'G4', '',
      'G4', '', 'B4', '', 'D5', '', 'B4', '', 'G5', '', 'F5', '', 'E5', '', 'D5', '',
    ],
    drums: true,
    leadWave: 'square',
  },
  menu: {
    bpm: 96,
    bass: ['A2', '', 'A2', '', 'F3', '', 'F3', '', 'C3', '', 'C3', '', 'G3', '', 'G3', ''],
    lead: [
      'E5', '', '', '', 'C5', '', '', '', 'A4', '', '', '', 'C5', '', 'B4', '',
      'A4', '', '', '', 'F4', '', '', '', 'A4', '', '', '', 'C5', '', '', '',
      'G4', '', '', '', 'E4', '', '', '', 'G4', '', '', '', 'C5', '', 'E5', '',
      'D5', '', '', '', 'B4', '', '', '', 'G4', '', '', '', 'B4', '', 'D5', '',
    ],
    drums: false,
    leadWave: 'triangle',
  },
};

export interface AudioSettings {
  sound: boolean;
  music: boolean;
}

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioSettings>;
      return { sound: parsed.sound !== false, music: parsed.music !== false };
    }
  } catch {
    // Stockage indisponible : réglages par défaut.
  }
  return { sound: true, music: true };
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  readonly settings: AudioSettings = loadSettings();
  private track: Track | null = null;
  private step = 0;
  private nextStepTime = 0;
  private scheduler: number | null = null;
  private lastPlayed = new Map<string, number>();

  constructor() {
    // Les navigateurs mobiles n'autorisent le son qu'après un geste de l'utilisateur.
    const unlock = () => {
      this.ensureContext();
      void this.ctx?.resume();
      if (this.ctx?.state === 'running') {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      // Téléphone verrouillé ou onglet caché : on coupe tout, pour la batterie.
      if (document.hidden) void this.ctx?.suspend();
      else void this.ctx?.resume();
    });
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;
    const ctx = new Context();
    const master = ctx.createDynamicsCompressor();
    master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.settings.sound ? SFX_VOLUME : 0;
    this.sfx.connect(master);
    this.music = ctx.createGain();
    this.music.gain.value = this.settings.music ? MUSIC_VOLUME : 0;
    this.music.connect(master);
    // Une seconde de bruit blanc, réutilisée par toutes les explosions.
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    this.ctx = ctx;
    if (this.track) this.startScheduler();
    return ctx;
  }

  setSound(on: boolean): void {
    this.settings.sound = on;
    this.saveSettings();
    if (this.ctx && this.sfx) this.sfx.gain.setTargetAtTime(on ? SFX_VOLUME : 0, this.ctx.currentTime, 0.05);
  }

  setMusic(on: boolean): void {
    this.settings.music = on;
    this.saveSettings();
    if (this.ctx && this.music) this.music.gain.setTargetAtTime(on ? MUSIC_VOLUME : 0, this.ctx.currentTime, 0.1);
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // Réglage non mémorisé : il vaudra pour cette visite seulement.
    }
  }

  // ---- Briques de synthèse ----

  private tone(frequency: number, duration: number, options: ToneOptions = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfx) return;
    const start = ctx.currentTime + (options.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(frequency, start);
    if (options.to) osc.frequency.exponentialRampToValueAtTime(options.to, start + duration);
    const volume = options.volume ?? 0.3;
    const attack = options.attack ?? 0.005;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(options.destination ?? this.sfx);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noise(duration: number, options: NoiseOptions = {}, destination?: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfx || !this.noiseBuffer) return;
    const start = ctx.currentTime + (options.delay ?? 0);
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = options.filter ?? 'lowpass';
    filter.frequency.setValueAtTime(options.from ?? 2000, start);
    if (options.to) filter.frequency.exponentialRampToValueAtTime(options.to, start + duration);
    filter.Q.value = options.q ?? 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(options.volume ?? 0.4, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(destination ?? this.sfx);
    source.start(start, Math.random() * 0.4);
    source.stop(start + duration + 0.02);
  }

  private notes(sequence: string[], spacing: number, duration: number, options: ToneOptions = {}): void {
    sequence.forEach((note, index) => {
      if (note) this.tone(NOTE[note], duration, { ...options, delay: (options.delay ?? 0) + index * spacing });
    });
  }

  /** Évite l'empilement d'un même son déclenché plusieurs fois dans le même instant. */
  private throttle(key: string, seconds: number): boolean {
    const now = this.ctx?.currentTime ?? 0;
    const last = this.lastPlayed.get(key) ?? -Infinity;
    if (now - last < seconds) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  // ---- Bruitages ----

  play(event: SoundEvent): void {
    if (!this.ctx || !this.settings.sound || this.ctx.state !== 'running') return;
    switch (event.kind) {
      case 'countdown':
        this.tone(660, 0.14, { type: 'square', volume: 0.18 });
        break;
      case 'go':
        this.tone(990, 0.35, { type: 'square', volume: 0.2 });
        this.tone(1320, 0.35, { type: 'triangle', volume: 0.12 });
        break;
      case 'bombPlaced':
        // « Plop » de la bombe posée ; plus discret pour celles des autres.
        this.tone(420, 0.1, { to: 180, volume: event.mine ? 0.3 : 0.12 });
        this.noise(0.04, { filter: 'highpass', from: 3000, volume: event.mine ? 0.12 : 0.05 });
        break;
      case 'explosion': {
        if (!this.throttle('explosion', 0.06)) break;
        const power = Math.min(1, 0.6 + event.count * 0.2);
        this.noise(0.7, { filter: 'lowpass', from: 2400, to: 160, volume: 0.55 * power });
        this.tone(95, 0.45, { to: 38, volume: 0.6 * power, type: 'sine' });
        this.noise(0.25, { filter: 'bandpass', from: 900, to: 300, q: 1.2, volume: 0.25 * power, delay: 0.03 });
        break;
      }
      case 'crate':
        if (!this.throttle('crate', 0.05)) break;
        this.noise(0.16, { filter: 'bandpass', from: 1200, to: 500, q: 2, volume: 0.35 });
        this.tone(180, 0.08, { type: 'triangle', to: 120, volume: 0.2 });
        break;
      case 'kick':
        this.tone(160, 0.12, { to: 55, volume: 0.5 });
        this.noise(0.06, { filter: 'highpass', from: 2500, volume: 0.15 });
        this.tone(500, 0.25, { to: 1100, type: 'triangle', volume: 0.08, delay: 0.05 });
        break;
      case 'teleport': {
        // Aspiration puis réapparition : glissando montant scintillant.
        const volume = event.mine ? 1 : 0.4;
        this.tone(260, 0.4, { to: 1600, type: 'sine', volume: 0.22 * volume });
        this.tone(390, 0.4, { to: 2400, type: 'triangle', volume: 0.1 * volume, delay: 0.02 });
        this.noise(0.35, { filter: 'bandpass', from: 600, to: 5000, q: 4, volume: 0.12 * volume });
        this.tone(1760, 0.25, { type: 'sine', volume: 0.08 * volume, delay: 0.32 });
        break;
      }
      case 'collapse':
        if (!this.throttle('collapse', 0.2)) break;
        this.noise(0.8, { filter: 'lowpass', from: 500, to: 80, volume: 0.35 });
        this.noise(0.3, { filter: 'highpass', from: 2500, to: 5000, volume: 0.1, delay: 0.25 });
        break;
      case 'bonus':
        this.playBonus(event.bonus);
        break;
      case 'vestLost':
        this.noise(0.25, { filter: 'highpass', from: 4000, to: 1500, volume: event.mine ? 0.3 : 0.1 });
        this.tone(880, 0.3, { to: 330, type: 'triangle', volume: event.mine ? 0.2 : 0.08 });
        break;
      case 'death':
        // « Wah-wah » descendant : fort pour soi, discret pour les autres.
        this.tone(440, 0.55, { to: 110, type: 'square', volume: event.mine ? 0.2 : 0.07 });
        this.tone(330, 0.55, { to: 82, type: 'triangle', volume: event.mine ? 0.15 : 0.05, delay: 0.05 });
        break;
      case 'suddenDeath':
        for (let i = 0; i < 3; i++) {
          this.tone(880, 0.18, { type: 'square', volume: 0.12, delay: i * 0.4 });
          this.tone(660, 0.18, { type: 'square', volume: 0.12, delay: i * 0.4 + 0.2 });
        }
        break;
      case 'roundWin':
        this.notes(['C5', 'E5', 'G5', 'C6'], 0.1, 0.25, { type: 'square', volume: 0.14 });
        break;
      case 'roundLose':
        this.notes(['G4', 'E4', 'C4'], 0.16, 0.35, { type: 'triangle', volume: 0.2 });
        break;
      case 'matchWin':
        this.notes(['C5', 'C5', 'G5', 'E5', 'C6', '', 'G5', 'C6'], 0.12, 0.3, { type: 'square', volume: 0.14 });
        this.notes(['C3', '', 'G3', '', 'C4'], 0.24, 0.5, { type: 'triangle', volume: 0.2 });
        break;
      case 'matchLose':
        this.notes(['E4', 'D4', 'C4', 'A3'], 0.22, 0.45, { type: 'triangle', volume: 0.2 });
        break;
    }
  }

  /** Un son différent pour chaque bonus ramassé. */
  private playBonus(bonus: Exclude<Bonus, 0>): void {
    switch (bonus) {
      case Bonus.Flame:
        // Souffle qui s'embrase.
        this.noise(0.45, { filter: 'bandpass', from: 400, to: 3000, q: 1.5, volume: 0.3 });
        this.tone(500, 0.35, { to: 1000, type: 'sawtooth', volume: 0.08 });
        break;
      case Bonus.Bomb:
        // Deux « bloups » ronds.
        this.tone(330, 0.12, { to: 220, volume: 0.35 });
        this.tone(440, 0.14, { to: 300, volume: 0.35, delay: 0.12 });
        break;
      case Bonus.Speed:
        // Arpège très rapide qui monte.
        this.notes(['C5', 'E5', 'G5', 'C6', 'E5', 'C6'], 0.035, 0.08, { type: 'square', volume: 0.12 });
        break;
      case Bonus.Vest:
        // Bouclier qui s'active : tintement métallique qui résonne.
        this.tone(880, 0.7, { type: 'triangle', volume: 0.2 });
        this.tone(1320, 0.7, { type: 'sine', volume: 0.12, delay: 0.02 });
        this.tone(1760, 0.5, { type: 'sine', volume: 0.06, delay: 0.04 });
        break;
      case Bonus.Detonator:
        // Bip-bip électronique et déclic.
        this.tone(1200, 0.07, { type: 'square', volume: 0.12 });
        this.tone(1200, 0.07, { type: 'square', volume: 0.12, delay: 0.11 });
        this.tone(1600, 0.12, { type: 'square', volume: 0.1, delay: 0.22 });
        this.noise(0.03, { filter: 'highpass', from: 4000, volume: 0.2, delay: 0.22 });
        break;
      case Bonus.WallPass:
        // Fantôme : son qui descend en ondulant.
        for (let i = 0; i < 4; i++) {
          this.tone(700 - i * 90, 0.18, { to: 650 - i * 90, type: 'sine', volume: 0.16, delay: i * 0.08 });
        }
        break;
      case Bonus.BombPass:
        // « Boing » élastique.
        this.tone(180, 0.18, { to: 620, volume: 0.3 });
        this.tone(620, 0.22, { to: 260, volume: 0.25, delay: 0.16 });
        break;
      case Bonus.Kick:
        // Coup de pied : impact sourd puis sifflement.
        this.tone(150, 0.15, { to: 50, volume: 0.5 });
        this.tone(700, 0.2, { to: 1400, type: 'triangle', volume: 0.1, delay: 0.08 });
        break;
    }
  }

  /** Commande du Détonateur, jouée tout de suite au toucher (sans attendre le serveur). */
  playDetonateClick(): void {
    if (!this.ctx || !this.settings.sound) return;
    this.noise(0.03, { filter: 'highpass', from: 3500, volume: 0.25 });
    this.tone(1400, 0.08, { type: 'square', volume: 0.1 });
  }

  /** Petit clic des boutons de l'interface. */
  playClick(): void {
    if (!this.ctx || !this.settings.sound || this.ctx.state !== 'running') return;
    this.tone(700, 0.06, { to: 900, type: 'triangle', volume: 0.12 });
  }

  // ---- Musique ----

  playMusic(track: Track | null): void {
    if (this.track === track) return;
    this.track = track;
    this.step = 0;
    if (track && this.ctx) this.startScheduler();
    if (!track && this.scheduler !== null) {
      window.clearInterval(this.scheduler);
      this.scheduler = null;
    }
  }

  private startScheduler(): void {
    if (!this.ctx) return;
    this.nextStepTime = this.ctx.currentTime + 0.1;
    if (this.scheduler !== null) return;
    // Planification à l'avance (100 ms) : la musique ne dépend pas de la fluidité de l'affichage.
    this.scheduler = window.setInterval(() => this.scheduleMusic(), 25);
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.track || !this.music) return;
    const pattern = PATTERNS[this.track];
    const sixteenth = 60 / pattern.bpm / 4;
    while (this.nextStepTime < ctx.currentTime + 0.1) {
      const time = this.nextStepTime - ctx.currentTime;
      const step = this.step % pattern.lead.length;
      if (this.settings.music && ctx.state === 'running') {
        const lead = pattern.lead[step];
        if (lead) this.tone(NOTE[lead], sixteenth * 1.8, { type: pattern.leadWave, volume: 0.1, delay: time, destination: this.music });
        if (step % 4 === 0) {
          const bass = pattern.bass[(step / 4) % pattern.bass.length];
          if (bass) this.tone(NOTE[bass], sixteenth * 3.5, { type: 'triangle', volume: 0.32, delay: time, destination: this.music });
        }
        if (pattern.drums) {
          if (step % 8 === 0) this.tone(120, 0.12, { to: 45, volume: 0.45, delay: time, destination: this.music });
          if (step % 8 === 4) this.noise(0.12, { filter: 'bandpass', from: 1800, q: 0.8, volume: 0.22, delay: time }, this.music);
          if (step % 2 === 1) this.noise(0.03, { filter: 'highpass', from: 7000, volume: 0.07, delay: time }, this.music);
        }
      }
      this.step++;
      this.nextStepTime += sixteenth;
    }
  }
}
