import './online.css';
import { GameAudio } from './audio/audio';
import { soundEvents } from './audio/events';
import { hapticFor, Haptics, nearestNewFlame } from './audio/haptics';
import { composeFeedback, describeDevice, median, type FeedbackAnswers } from './feedback';
import { MenuDemo } from './menu/demo';
import { TaglineChase } from './menu/chase';
import { COUNTDOWN_TICKS, SUDDEN_DEATH_TICKS, TICK_RATE, WINS_TO_TAKE_MATCH } from './game/constants';
import { ARENA_NAMES } from './game/arena';
import { SKIN_COUNT, UNTIL_USED } from './game/constants';
import { wonBy, type ArenaChoice, type MatchState } from './game/match';
import { ARENA_IDS, Bonus, type Direction, type Player } from './game/types';
import { KeyboardInput } from './input/keyboard';
import { TouchPad } from './input/touch';
import { Connection, SnapshotBuffer } from './net/connection';
import { VoiceChat } from './voice/voice';
import { pickTaunt, VictoryDance } from './render/victory';
import { Tutorial } from './tutorial';
import { afterMatch, parseMemory, requestReview } from './review';
import {
  CHALLENGES,
  isUnlocked,
  parseProgress,
  recordStars,
  STAR_FAST,
  STAR_FLAWLESS,
  STAR_WIN,
  starsEarned,
  totalStars,
  type Challenge,
} from './game/challenges';
import { BotBrain, BOT_LEVEL_NAMES, BOT_LEVEL_SHORT, BOT_LEVELS, type BotLevel } from './game/bot';
import { nearbyAvailable, NearbyGuestLink, NearbyHostLink, NearbyScanner, type Link, type NearbyHost } from './net/nearby';
import { EMOTES, MAX_PLAYERS, MIN_PLAYERS, RECONNECT_GRACE_SECONDS, TEAM_COUNT, type GameMode, type LobbyPlayer, type ServerMessage } from './net/protocol';
import { BONUS_INFO, BONUS_ORDER, paintBonusCanvas } from './render/bonuses';
import { drawAvatar, HERO_COLORS, lookFor, SKIN_NAMES, TEAM_COLORS, TEAM_NAMES } from './render/characters';
import { CHARACTERS, defaultCharacter, isCharacter, POWER_START_TICKS } from './game/powers';
import { ACCESSORIES, accessoryUnlocked } from './game/accessories';
import { Renderer } from './render/renderer';
import { screenToGrid } from './render/view';
import { PUBLIC_ORIGIN } from './net/server';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// ---- Éléments de la page ----

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Élément introuvable : ${selector}`);
  return element;
}

function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

const screens = {
  home: required<HTMLElement>('#home'),
  lobby: required<HTMLElement>('#lobby'),
  game: required<HTMLElement>('#game'),
};
type Screen = keyof typeof screens;

const nameInput = required<HTMLInputElement>('#name');
const codeInput = required<HTMLInputElement>('#code');
const homeError = required<HTMLElement>('#home-error');
const roomCodeText = required<HTMLElement>('#room-code');
const inviteLinkText = required<HTMLElement>('#invite-link');
const shareButton = required<HTMLButtonElement>('#share-btn');
const playerList = required<HTMLUListElement>('#player-list');
const readyButton = required<HTMLButtonElement>('#ready-btn');
const startButton = required<HTMLButtonElement>('#start-btn');
const lobbyHint = required<HTMLElement>('#lobby-hint');
const lobbyError = required<HTMLElement>('#lobby-error');
const skinHint = required<HTMLElement>('#skin-hint');
const scoresList = required<HTMLUListElement>('#scores');
const timer = required<HTMLElement>('#timer');
const countdown = required<HTMLElement>('#countdown');
const countdownNumber = required<HTMLElement>('#countdown-number');
const countdownArena = required<HTMLElement>('#countdown-arena');
const arenaSelect = required<HTMLSelectElement>('#arena-select');
const arenaName = required<HTMLElement>('#arena-name');
const powers = required<HTMLElement>('#powers');
const detonateButton = required<HTMLButtonElement>('#detonate-btn');
const banner = required<HTMLElement>('#banner');
const bannerText = required<HTMLElement>('#banner-text');
const bannerSub = required<HTMLElement>('#banner-sub');
const backButton = required<HTMLButtonElement>('#back-btn');
const connectionBanner = required<HTMLElement>('#connection');
const connectionText = required<HTMLElement>('#connection-text');
const canvas = required<HTMLCanvasElement>('#arena');
const frame = required<HTMLElement>('#board-frame');

const renderer = new Renderer(canvas);
const audio = new GameAudio();
const haptics = new Haptics(() => audio.settings.sound);
const demo = new MenuDemo(required<HTMLCanvasElement>('#home-bg'));
const chase = new TaglineChase(required<HTMLCanvasElement>('#chase'), required<HTMLElement>('#tagline'));
const homeCard = required<HTMLElement>('#home-card');
const homeStatus = required<HTMLElement>('#home-status');
const helpDialog = required<HTMLDialogElement>('#help');
const soundButton = required<HTMLButtonElement>('#sound-btn');
const musicButton = required<HTMLButtonElement>('#music-btn');
const gameSoundButton = required<HTMLButtonElement>('#game-sound-btn');
const keyboard = new KeyboardInput(window);
const touch = new TouchPad(
  required('#stick-zone'),
  required('#stick-base'),
  required('#stick-knob'),
  required('#bomb-btn'),
);

// ---- Stockage local : pseudo et session en cours ----

const NAME_KEY = 'boomz.name';
const SESSION_KEY = 'boomz.session';
/** Tutoriel déjà fait (ou refusé) sur ce téléphone. */
const TUTORIAL_KEY = 'boomz.tutorial';

interface StoredSession {
  room: string;
  token: string;
}

function readStorage(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: () => Storage, key: string, value: string | null): void {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // Navigation privée ou stockage bloqué : on s'en passe.
  }
}

function storedSession(): StoredSession | null {
  const raw = readStorage(() => sessionStorage, SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    return typeof parsed.room === 'string' && typeof parsed.token === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

// ---- État du client ----

let connection: Link | null = null;
/** Fabrique la connexion : au serveur en ligne, ou à des téléphones proches (sans internet). */
type LinkFactory = (onMessage: (message: ServerMessage) => void, onClose: () => void) => Link;
const onlineLink: LinkFactory = (onMessage, onClose) => new Connection(onMessage, onClose);
let linkFactory: LinkFactory = onlineLink;
/** Partie seul contre des robots, simulée sur le téléphone (sans réseau). */
const soloLink: LinkFactory = (onMessage) => new NearbyHostLink('', onMessage, false);
/** Partie sans internet en cours (téléphones proches). */
let offline = false;
let solo = false;
/** Tutoriel en cours (première partie contre un robot). */
let tutorial: Tutorial | null = null;
/** Défi en cours (numéro dans `CHALLENGES`), ou `null`. */
let challenge: number | null = null;
let session: StoredSession | null = null;
let you: string | null = null;
let lobby: Extract<ServerMessage, { type: 'lobby' }> | null = null;
const snapshots = new SnapshotBuffer();
let screen: Screen = 'home';
/** Vrai une fois la partie terminée tant que le joueur regarde encore les résultats. */
let viewingResults = false;
let lastSentDirection: Direction | null = null;
let reconnectUntil = 0;
let reconnectTimer: number | null = null;
/** Développement seulement : états du serveur ignorés (voir `boomz.freeze`). */
let devFrozen = false;

function show(next: Screen): void {
  if (screen === next) return;
  screen = next;
  for (const [key, element] of Object.entries(screens)) element.hidden = key !== next;
  required<HTMLElement>('#emote-picker').hidden = true;
  applyScreenAmbience();
  // Un bouton resté sélectionné capterait Espace et Entrée pendant la partie.
  if (next === 'game' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

/** Musique et fond animé selon l'écran affiché. */
function applyScreenAmbience(): void {
  audio.playMusic(screen === 'game' ? 'game' : 'menu');
  if (screen === 'home') {
    demo.start();
    chase.start();
  } else {
    demo.stop();
    chase.stop();
  }
  void updateWakeLock();
}

// ---- Écran allumé pendant la partie ----

let wakeLock: WakeLockSentinel | null = null;

/** Empêche la mise en veille du téléphone pendant une partie, et seulement là. */
async function updateWakeLock(): Promise<void> {
  const wanted = screen === 'game' && !document.hidden;
  try {
    if (wanted && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } else if (!wanted && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    // Refusé (économie d'énergie, navigateur ancien) : le jeu fonctionne quand même.
  }
}
// Le verrou saute quand l'onglet passe en arrière-plan : on le reprend au retour.
document.addEventListener('visibilitychange', () => void updateWakeLock());

function mySeat(): number | null {
  if (!lobby || !you) return null;
  return lobby.seats[you] ?? null;
}

function inviteLink(room: string): string {
  return `${PUBLIC_ORIGIN}/?salon=${room}`;
}

// ---- Connexion ----

/** Au-delà de ce délai sans réponse, on indique que la connexion est en cours. */
const WAKE_HINT_MS = 2500;
let wakeHintTimer: number | null = null;

function clearWakeHint(): void {
  if (wakeHintTimer !== null) window.clearTimeout(wakeHintTimer);
  wakeHintTimer = null;
  setText(homeStatus, '');
}

function connect(first: () => void, factory: LinkFactory = linkFactory): void {
  connection?.close();
  clearWakeHint();
  linkFactory = factory;
  offline = factory !== onlineLink;
  solo = factory === soloLink;
  screens.lobby.classList.toggle('offline', offline);
  screens.lobby.classList.toggle('solo', solo);
  // Réseau lent : on montre que la connexion est en cours.
  if (!solo) wakeHintTimer = window.setTimeout(
    () => {
      setText(
        homeStatus,
        offline ? 'Recherche du salon à proximité…' : 'Connexion au serveur…',
      );
    },
    offline ? 0 : WAKE_HINT_MS,
  );
  const current = factory(
    (message) => {
      if (connection !== current) return;
      clearWakeHint();
      onMessage(message);
    },
    () => {
      if (connection === current) onConnectionLost();
    },
  );
  connection = current;
  first();
}

function onConnectionLost(): void {
  connection = null;
  if (!session) {
    // La connexion n'a jamais abouti (réseau coupé, serveur indisponible).
    clearWakeHint();
    if (screen === 'home') {
      setText(
        homeError,
        offline
          ? 'Salon introuvable à proximité. Rapprochez les téléphones, vérifiez que le Bluetooth et le Wi-Fi sont activés, puis réessayez.'
          : 'Impossible de joindre le serveur. Vérifiez la connexion et réessayez.',
      );
    }
    return;
  }
  // Le serveur garde la place quelques secondes : on tente de la reprendre.
  if (reconnectUntil === 0) reconnectUntil = Date.now() + (RECONNECT_GRACE_SECONDS + 2) * 1000;
  if (Date.now() > reconnectUntil) {
    giveUp('La connexion au salon a été perdue.');
    return;
  }
  connectionBanner.hidden = false;
  setText(connectionText, 'Connexion perdue, reconnexion…');
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    if (session) resume(session);
  }, 1000);
}

function resume(stored: StoredSession): void {
  connect(() => connection?.send({ type: 'resume', room: stored.room, token: stored.token }));
}

function giveUp(message: string): void {
  if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
  reconnectTimer = null;
  reconnectUntil = 0;
  connection?.close();
  connection = null;
  resetRoomState();
  connectionBanner.hidden = true;
  setText(homeError, message);
  show('home');
}

function resetRoomState(): void {
  voice.leave(false);
  paused = false;
  document.querySelector<HTMLDialogElement>('#pause-dialog')?.close();
  tutorial = null;
  document.getElementById('coach')?.setAttribute('hidden', '');
  session = null;
  you = null;
  lobby = null;
  viewingResults = false;
  snapshots.clear();
  writeStorage(() => sessionStorage, SESSION_KEY, null);
  history.replaceState(null, '', '/');
}

function onMessage(message: ServerMessage): void {
  switch (message.type) {
    case 'welcome':
      snapshots.restartSequence();
      you = message.you;
      session = { room: message.room, token: message.token };
      // Sans internet, le salon vit sur le téléphone hôte : rien à reprendre après un rechargement.
      if (!offline) {
        writeStorage(() => sessionStorage, SESSION_KEY, JSON.stringify(session));
        history.replaceState(null, '', `/?salon=${message.room}`);
      }
      reconnectUntil = 0;
      voice.setIdentity(message.you, message.iceServers);
      voice.rejoin();
      // Personnage choisi sur ce téléphone (annonce aussi que les pouvoirs sont connus).
      connection?.send({ type: 'character', character: myCharacter() });
      connection?.send({ type: 'features', teams: true });
      connection?.send({ type: 'accessory', accessory: myAccessory() });
      connection?.send({ type: 'skin', skin: mySkin() });
      connectionBanner.hidden = true;
      setText(homeError, '');
      setText(roomCodeText, message.room);
      setText(inviteLinkText, inviteLink(message.room));
      return;
    case 'lobby':
      lobby = message;
      renderLobby();
      renderRematch();
      voice.sync(message.players);
      decideScreen();
      return;
    case 'signal':
      void voice.onSignal(message.from, message.data);
      return;
    case 'snapshot': {
      // Vérifications automatisées : l'état peut être figé sur une scène injectée.
      if (import.meta.env.DEV && devFrozen) return;
      const previousState = snapshots.latest();
      if (screen === 'game') {
        const events = soundEvents(previousState, message.match, mySeat());
        for (const event of events) audio.play(event);
        if (events.length && previousState) haptics.play(hapticFor(events, nearestNewFlame(previousState, message.match, mySeat())));
        if (tutorial?.update(message.match, mySeat(), events, performance.now())) renderCoach();
      }
      snapshots.push(message.match, performance.now(), message.seq);
      decideScreen();
      return;
    }
    case 'emote':
      if (screen === 'game') renderer.showEmote(message.seat, EMOTES[message.emote] ?? '');
      return;
    case 'pong':
      latencies.push(performance.now() - message.sent);
      if (latencies.length > 20) latencies.shift();
      return;
    case 'error':
      if (message.code === 'closed') {
        giveUp(message.message);
        return;
      }
      if (message.code === 'resume-failed') {
        giveUp(session ? 'Votre place dans le salon a expiré.' : '');
        return;
      }
      if (screen === 'home') setText(homeError, message.message);
      else setText(lobbyError, message.message);
      if (!session) {
        connection?.close();
        connection = null;
      }
      return;
  }
}

function decideScreen(): void {
  const latest = snapshots.latest();
  const seated = mySeat() !== null;
  if (lobby?.inMatch && seated) {
    viewingResults = false;
    show('game');
  } else if (latest?.phase === 'matchOver' && seated && (screen === 'game' || viewingResults)) {
    viewingResults = true;
    show('game');
  } else if (session) {
    show('lobby');
  }
}

// ---- Salon ----

function renderLobby(): void {
  if (!lobby) return;
  const players = lobby.players;
  const isHost = lobby.host === you;
  const me = players.find((player) => player.id === you);

  playerList.replaceChildren(
    ...players.map((player, index) => lobbyRow(player, index, player.id === lobby?.host, player.id === you)),
  );

  arenaSelect.hidden = !isHost;
  arenaName.hidden = isHost;
  if (arenaSelect.value !== lobby.arena) arenaSelect.value = lobby.arena;
  setText(arenaName, arenaLabel(lobby.arena));
  const mode = lobbyMode();
  modeSelect.hidden = !isHost;
  modeName.hidden = isHost;
  if (modeSelect.value !== mode) modeSelect.value = mode;
  setText(modeName, mode === 'teams' ? 'En équipes : Rouge contre Bleue' : 'Chacun pour soi');

  const othersReady = players.filter((player) => player.id !== lobby?.host).every((player) => player.ready);
  const allHere = players.every((player) => player.connected);
  readyButton.hidden = isHost;
  readyButton.textContent = me?.ready ? 'Prêt ✓ (annuler)' : 'Je suis prêt';
  startButton.hidden = !isHost;
  startButton.disabled = players.length < MIN_PLAYERS || !othersReady || !allHere;

  let hint = '';
  if (solo) {
    hint = players.length < MIN_PLAYERS ? 'Ajoutez un ou plusieurs robots, puis lancez la partie.' : 'Choisissez l’arène, puis lancez la partie.';
  } else if (players.length < MIN_PLAYERS) {
    hint = offline
      ? 'Sur les autres téléphones : « Jouer en local », puis touchez ce salon. Ou ajoutez un robot.'
      : 'Partagez le lien, ou ajoutez un robot : il faut au moins 2 joueurs.';
  } else if (!allHere) hint = 'Un joueur se reconnecte…';
  else if (isHost && !othersReady) hint = 'En attente que tout le monde soit prêt.';
  else if (!isHost) hint = me?.ready ? 'L’hôte va lancer la partie.' : 'Appuyez sur « Je suis prêt ».';
  setText(lobbyHint, hint);
  botRow.hidden = !isHost || players.length >= MAX_PLAYERS;
  setText(
    skinHint,
    mode === 'teams' ? 'Touchez votre personnage pour en changer, et la pastille de couleur pour changer d’équipe.' : 'Touchez votre personnage pour en changer.',
  );
  // Joueurs avec une version plus ancienne (sans personnage choisi) : pas de pouvoirs ni de vocal pour eux.
  const outdated = players.filter((player) => !player.bot && player.id !== you && player.character === undefined && player.connected);
  const versionHint = required<HTMLElement>('#version-hint');
  versionHint.hidden = outdated.length === 0;
  setText(
    versionHint,
    outdated.length === 0
      ? ''
      : `${outdated.map((player) => player.name).join(', ')} ${outdated.length > 1 ? 'ont' : 'a'} une ancienne version de Boomz : les pouvoirs sont désactivés pour cette partie. Une mise à jour ${outdated.length > 1 ? 'leur' : 'lui'} est proposée.`,
  );
  setText(lobbyError, '');
  renderVoice();
}

const modeSelect = required<HTMLSelectElement>('#mode-select');
const modeName = required<HTMLElement>('#mode-name');

/** Mode du salon (un serveur plus ancien ne l'envoie pas : chacun pour soi). */
function lobbyMode(): GameMode {
  return lobby?.mode ?? 'ffa';
}

modeSelect.addEventListener('change', () => {
  const value = modeSelect.value;
  if (value === 'ffa' || value === 'teams') connection?.send({ type: 'mode', mode: value });
});

/** Pastille d'équipe d'un joueur du salon ; la toucher change d'équipe (soi, ou un robot pour l'hôte). */
function teamDot(player: LobbyPlayer, self: boolean): HTMLElement {
  const team = player.team ?? 0;
  const label = `Équipe ${TEAM_NAMES[team]}`;
  const canSwitch = self || (!!player.bot && lobby?.host === you);
  const dot = document.createElement(canSwitch ? 'button' : 'span');
  dot.className = 'team-dot';
  dot.style.setProperty('--team', TEAM_COLORS[team] ?? TEAM_COLORS[0]);
  dot.setAttribute('aria-label', canSwitch ? `${label} : toucher pour changer d’équipe` : label);
  dot.title = label;
  if (dot instanceof HTMLButtonElement) {
    dot.type = 'button';
    dot.addEventListener('click', () => {
      audio.playClick();
      const next = (team + 1) % TEAM_COUNT;
      connection?.send(self ? { type: 'team', team: next } : { type: 'team', team: next, id: player.id });
    });
  }
  return dot;
}

function arenaLabel(choice: ArenaChoice): string {
  return choice === 'rotation' ? 'Une différente à chaque manche' : ARENA_NAMES[choice];
}

function lobbyRow(player: LobbyPlayer, index: number, host: boolean, self: boolean): HTMLLIElement {
  const item = document.createElement('li');
  item.dataset.id = player.id;
  const avatar = document.createElement('canvas');
  avatar.className = 'avatar';
  const name = document.createElement('span');
  name.className = 'player-name';
  name.textContent = `${player.name}${self ? ' (vous)' : ''}`;
  const character = document.createElement('span');
  character.className = 'player-tag character-tag';
  const hero = player.character ?? defaultCharacter(index);
  character.textContent = `${CHARACTERS[hero].name} · ${CHARACTERS[hero].power}`;
  const status = document.createElement('span');
  status.className = 'player-tag';
  if (player.bot) {
    status.textContent = `🤖 ${BOT_LEVEL_SHORT[player.bot]}`;
    status.setAttribute('aria-label', `Robot ${BOT_LEVEL_NAMES[player.bot]}`);
    status.classList.add('bot');
  } else if (!player.connected) {
    status.textContent = 'reconnexion…';
    status.classList.add('away');
  } else if (host) {
    status.textContent = 'hôte';
  } else if (player.ready) {
    status.textContent = 'prêt ✓';
    status.classList.add('ready');
  } else {
    status.textContent = 'pas prêt';
  }
  if (lobbyMode() === 'teams') item.append(teamDot(player, self));
  if (self) {
    // Son propre personnage : le toucher ouvre le choix du personnage.
    const skinButton = document.createElement('button');
    skinButton.type = 'button';
    skinButton.className = 'avatar-btn';
    skinButton.setAttribute('aria-label', `Changer de personnage (actuel : ${CHARACTERS[hero].name})`);
    skinButton.append(avatar);
    skinButton.addEventListener('click', () => {
      audio.playClick();
      openCharacters(false);
    });
    item.append(skinButton, name, character, status);
  } else {
    item.append(avatar, name, character, status);
  }
  if (player.voice) item.append(voiceTag(player.id, self));
  if (!self && !player.bot) {
    const flag = document.createElement('button');
    flag.type = 'button';
    flag.className = 'row-action report-btn';
    flag.textContent = '⚑';
    flag.setAttribute('aria-label', `Signaler ${player.name}`);
    flag.title = 'Signaler';
    flag.addEventListener('click', () => openReport(player));
    item.append(flag);
  }
  if (player.bot && lobby?.host === you) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'bot-remove';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', `Retirer ${player.name}`);
    remove.addEventListener('click', () => connection?.send({ type: 'removeBot', id: player.id }));
    item.append(remove);
  }
  requestAnimationFrame(() => drawAvatar(avatar, hero, player.skin, player.accessory ?? 0));
  return item;
}

// ---- Signaler un joueur ----

const reportDialog = required<HTMLDialogElement>('#report');
const reportForm = required<HTMLFormElement>('#report-form');
const REPORT_ADDRESS = 'boomz-service@outlook.com';
let reported: LobbyPlayer | null = null;

function openReport(player: LobbyPlayer): void {
  reported = player;
  reportForm.reset();
  setText(required<HTMLElement>('#report-title'), `Signaler ${player.name}`);
  reportDialog.showModal();
}

/** E-mail de signalement : pseudo du joueur, salon et motif, rien d'autre. */
function reportMail(name: string, room: string, reason: string, details: string, date: Date): string {
  const body = [
    `Joueur signalé : ${name}`,
    `Salon : ${room}`,
    `Date : ${date.toLocaleString('fr-FR')}`,
    `Motif : ${reason}`,
    details ? `Précisions : ${details}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `mailto:${REPORT_ADDRESS}?subject=${encodeURIComponent(`Signalement d'un joueur (${name})`)}&body=${encodeURIComponent(body)}`;
}

required<HTMLButtonElement>('#report-send').addEventListener('click', () => {
  if (!reported) return;
  const data = new FormData(reportForm);
  if (data.get('mute') && !voice.mutedPlayers.has(reported.id)) voice.togglePlayer(reported.id);
  const link = document.createElement('a');
  link.href = reportMail(reported.name, session?.room ?? '', String(data.get('motif') ?? ''), String(data.get('details') ?? '').trim(), new Date());
  link.click();
  reportDialog.close();
  renderLobby();
  setText(lobbyHint, 'Merci, votre signalement va être examiné.');
});
required<HTMLButtonElement>('#report-close').addEventListener('click', () => reportDialog.close());

// ---- Robots (ajoutés par l'hôte pour compléter la partie) ----

const botRow = required<HTMLElement>('#bot-row');
const botLevelSelect = required<HTMLSelectElement>('#bot-level');
required<HTMLButtonElement>('#add-bot-btn').addEventListener('click', () => {
  const level = botLevelSelect.value;
  if ((BOT_LEVELS as readonly string[]).includes(level)) connection?.send({ type: 'addBot', level: level as BotLevel });
});

// ---- Chat vocal (parties en ligne) ----

const voiceRow = required<HTMLElement>('#voice-row');
const voiceButton = required<HTMLButtonElement>('#voice-btn');
const micButton = required<HTMLButtonElement>('#mic-btn');
const gameMicButton = required<HTMLButtonElement>('#game-mic-btn');
const voiceHint = required<HTMLElement>('#voice-hint');
const voice = new VoiceChat((message) => connection?.send(message), renderVoice);

/** Pastille vocale d'un joueur du salon : toucher celle d'un autre joueur le rend muet pour soi. */
function voiceTag(id: string, self: boolean): HTMLElement {
  const muted = voice.mutedPlayers.has(id);
  if (self || !voice.active) {
    const tag = document.createElement('span');
    tag.className = 'voice-tag';
    tag.textContent = self && voice.micMuted ? '🎙✕' : '🎙';
    tag.setAttribute('aria-label', 'Dans le vocal');
    return tag;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'voice-tag';
  button.textContent = muted ? '🔇' : '🔊';
  button.setAttribute('aria-label', muted ? 'Réentendre ce joueur' : 'Ne plus entendre ce joueur');
  button.addEventListener('click', () => {
    voice.togglePlayer(id);
    renderLobby();
  });
  return button;
}

/** Met à jour les boutons du vocal et les indicateurs « en train de parler ». */
function renderVoice(): void {
  voiceRow.hidden = offline || !VoiceChat.supported;
  voiceButton.textContent = voice.active ? 'Quitter le vocal' : '🎙 Rejoindre le vocal';
  micButton.hidden = !voice.active;
  micButton.textContent = voice.micMuted ? 'Réactiver mon micro' : 'Couper mon micro';
  gameMicButton.hidden = !voice.active;
  gameMicButton.setAttribute('aria-pressed', String(!voice.micMuted));
  for (const item of playerList.querySelectorAll<HTMLElement>('li[data-id]')) {
    item.classList.toggle('speaking', voice.speaking.has(item.dataset.id ?? ''));
  }
  const seats = lobby?.seats ?? {};
  const speakingSeats = new Set([...voice.speaking].map((id) => seats[id]).filter((seat) => seat !== undefined));
  for (const item of scoresList.querySelectorAll<HTMLElement>('li[data-seat]')) {
    item.classList.toggle('speaking', speakingSeats.has(Number(item.dataset.seat)));
  }
}

voiceButton.addEventListener('click', async () => {
  setText(voiceHint, '');
  if (voice.active) {
    voice.leave();
  } else {
    voiceButton.disabled = true;
    const error = await voice.join();
    voiceButton.disabled = false;
    if (error) setText(voiceHint, error);
    else if (lobby) voice.sync(lobby.players);
  }
  // Ouvrir ou fermer le micro peut interrompre le son du jeu sur iPhone.
  audio.wake();
  window.setTimeout(() => audio.wake(), 800);
  renderLobby();
});
micButton.addEventListener('click', () => {
  voice.toggleMic();
  renderLobby();
});
gameMicButton.addEventListener('click', () => voice.toggleMic());

const micTestButton = required<HTMLButtonElement>('#mic-test-btn');
micTestButton.addEventListener('click', async () => {
  micTestButton.disabled = true;
  const error = await VoiceChat.testMicrophone((step) => {
    setText(voiceHint, step === 'recording' ? 'Parlez… (3 secondes)' : 'Écoutez-vous…');
  });
  setText(voiceHint, error ?? 'Vous vous êtes entendu ? Le micro fonctionne.');
  micTestButton.disabled = false;
  // iPhone : le micro a mis la musique en pause.
  audio.wake();
  window.setTimeout(() => audio.wake(), 800);
});

// ---- Partie ----

let renderedScoresKey = '';

function renderScores(match: MatchState): void {
  if (!lobby) return;
  const seats = lobby.seats;
  const names = new Map<number, string>();
  for (const player of lobby.players) {
    const seat = seats[player.id];
    if (seat !== undefined) names.set(seat, player.name);
  }
  const me = mySeat();
  const key = JSON.stringify([match.scores, match.round.players.map((player) => player.alive), [...names], me, match.skins, match.teams]);
  if (key === renderedScoresKey) return;
  renderedScoresKey = key;
  scoresList.dataset.count = String(match.round.players.length);
  screens.game.dataset.crowd = String(match.round.players.length >= 3);
  scoresList.replaceChildren(
    ...match.round.players.map((player) => {
      const item = document.createElement('li');
      item.dataset.seat = String(player.id);
      if (player.id === me) item.classList.add('me');
      if (!player.alive) item.classList.add('out');
      const team = match.teams?.[player.id];
      if (team !== undefined) item.style.setProperty('--team', TEAM_COLORS[team] ?? TEAM_COLORS[0]);
      item.classList.toggle('teamed', team !== undefined);
      const avatar = document.createElement('canvas');
      avatar.className = 'avatar';
      const name = document.createElement('span');
      name.className = 'score-name';
      name.textContent = names.get(player.id) ?? 'Parti';
      const wins = document.createElement('span');
      wins.className = 'score-wins';
      const score = match.scores[player.id];
      wins.textContent = '●'.repeat(score) + '○'.repeat(Math.max(0, WINS_TO_TAKE_MATCH - score));
      // Version courte (un chiffre), affichée à la place des pastilles quand la place manque.
      const count = document.createElement('span');
      count.className = 'score-count';
      count.textContent = String(score);
      item.append(avatar, name, wins, count);
      requestAnimationFrame(() =>
        drawAvatar(avatar, seatCharacter(match, player.id), match.skins?.[player.id] ?? 0, match.accessories?.[player.id] ?? 0),
      );
      return item;
    }),
  );
}

function seatName(seat: number | null): string {
  if (seat === null || !lobby) return '';
  const player = lobby.players.find((candidate) => lobby?.seats[candidate.id] === seat);
  return player?.name ?? CHARACTERS[defaultCharacter(seat)].name;
}

/** Personnage d'un joueur de la partie (celui de sa place avec un serveur plus ancien). */
function seatCharacter(match: MatchState, seat: number): number {
  return match.characters?.[seat] ?? defaultCharacter(seat);
}

function teamName(team: number | null): string {
  return TEAM_NAMES[team ?? 0] ?? TEAM_NAMES[0];
}

/** Score du match : par joueur, ou par équipe (« Rouge 2 – 1 Bleue »). */
function scoresText(match: MatchState): string {
  const teams = match.teams;
  if (!teams) return match.scores.join(' – ');
  const teamScore = (team: number) => match.scores[teams.indexOf(team)] ?? 0;
  return `${TEAM_NAMES[0]} ${teamScore(0)} – ${teamScore(1)} ${TEAM_NAMES[1]}`;
}

function formatClock(ticks: number): string {
  const seconds = Math.ceil(ticks / TICK_RATE);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function updateGameHud(match: MatchState): void {
  renderScores(match);
  pauseButton.hidden = !solo || match.phase === 'matchOver';
  const me = mySeat();

  const showCountdown = match.phase === 'countdown' || (match.phase === 'playing' && match.phaseTick < 40);
  countdown.hidden = !showCountdown;
  if (showCountdown) {
    setText(
      countdownNumber,
      match.phase === 'countdown' ? String(Math.max(1, Math.ceil((COUNTDOWN_TICKS - match.phaseTick) / TICK_RATE))) : 'Go !',
    );
    setText(
      countdownArena,
      match.phase === 'countdown' ? `Manche ${match.roundNumber} · ${ARENA_NAMES[match.round.arena]}` : '',
    );
  }

  const mine = me === null ? undefined : match.round.players[me];
  renderPowers(mine, match.round.tick);
  renderPowerButton(match, mine);
  detonateButton.hidden = !(mine?.alive && mine.detonator && match.phase === 'playing');

  const remaining = SUDDEN_DEATH_TICKS - match.round.tick;
  setText(timer, remaining > 0 ? formatClock(remaining) : 'Le mur avance !');
  timer.classList.toggle('danger', remaining <= 10 * TICK_RATE);

  let title = '';
  let subtitle = '';
  if (match.phase === 'roundOver') {
    if (match.roundWinner === null) title = 'Égalité !';
    else if (match.teams) title = wonBy(match, me) ? 'Manche gagnée par votre équipe !' : `L’équipe ${teamName(match.winningTeam)} gagne la manche`;
    else title = match.roundWinner === me ? 'Manche gagnée !' : `${seatName(match.roundWinner)} gagne la manche`;
    subtitle = `Manche ${match.roundNumber} · ${scoresText(match)}`;
  } else if (match.phase === 'matchOver') {
    if (match.teams) title = wonBy(match, me, match.matchWinner) ? 'Victoire de votre équipe !' : `L’équipe ${teamName(match.winningTeam)} remporte le match`;
    else title = match.matchWinner === me ? 'Victoire !' : `${seatName(match.matchWinner)} remporte le match`;
    subtitle = scoresText(match);
  } else if (match.phase === 'playing' && me !== null && !match.round.players[me]?.alive) {
    title = 'Éliminé !';
    subtitle = 'Regardez la fin de la manche…';
  } else if (match.phase === 'countdown') {
    subtitle = `Manche ${match.roundNumber}`;
  }
  banner.hidden = title === '';
  // Pendant le compte à rebours, le numéro de manche s'affiche sous les chiffres.
  if (match.phase === 'countdown') banner.hidden = true;
  updateVictory(match, me);
  if (!victory.hidden) banner.hidden = true;
  setText(bannerText, title);
  setText(bannerSub, subtitle);
  backButton.hidden = match.phase !== 'matchOver';
  feedbackEndButton.hidden = match.phase !== 'matchOver';
}

// ---- Fin de match : danse du gagnant ----

const victory = required<HTMLElement>('#victory');
const victoryActions = required<HTMLElement>('#victory-actions');
const victoryDance = new VictoryDance(required<HTMLCanvasElement>('#victory-stage'), required<HTMLCanvasElement>('#victory-sky'));
/** Match déjà fêté (pour ne pas relancer l'animation à chaque image). */
let celebrated: MatchState | null = null;
let victoryActionsTimer: number | null = null;

function updateVictory(match: MatchState, me: number | null): void {
  const show = match.phase === 'matchOver' && match.matchWinner !== null && screen === 'game';
  if (!show) {
    if (!victory.hidden) {
      victory.hidden = true;
      victoryDance.stop();
    }
    if (match.phase !== 'matchOver') celebrated = null;
    return;
  }
  if (celebrated && celebrated.scores.join() === match.scores.join() && celebrated.roundNumber === match.roundNumber && !victory.hidden) return;
  if (celebrated && celebrated.scores.join() === match.scores.join() && celebrated.roundNumber === match.roundNumber) {
    // Retour sur les résultats : pas de nouvelle animation d'entrée.
    victory.hidden = false;
    renderRematch();
    return;
  }
  celebrated = match;
  const winner = match.matchWinner!;
  noteMatchForReview(wonBy(match, me, winner));
  const winnerId = lobby ? Object.entries(lobby.seats).find(([, seat]) => seat === winner)?.[0] : undefined;
  const winnerIsBot = !!lobby?.players.find((player) => player.id === winnerId)?.bot;
  const mine = wonBy(match, me, winner);
  setText(required<HTMLElement>('#victory-eyebrow'), mine ? 'Victoire !' : 'Fin du match');
  renderChallengeResult(match, me);
  const team = match.teams ? teamName(match.winningTeam) : null;
  setText(
    required<HTMLElement>('#victory-title'),
    team ? (mine ? `Bravo l’équipe ${team} !` : `L’équipe ${team} gagne`) : mine ? `Bravo ${seatName(winner)} !` : `${seatName(winner)} remporte le match`,
  );
  setText(required<HTMLElement>('#victory-taunt'), pickTaunt(winnerIsBot));
  setText(required<HTMLElement>('#victory-score'), match.teams ? scoresText(match) : [...match.scores].sort((a, b) => b - a).join(' – '));
  victory.classList.toggle('mine', mine);
  victory.hidden = false;
  document.getElementById('coach')?.setAttribute('hidden', '');
  renderRematch();
  victoryDance.play(lookFor(seatCharacter(match, winner), match.skins?.[winner] ?? 0, match.accessories?.[winner] ?? 0));
  // Les boutons arrivent après le spectacle.
  victoryActions.classList.remove('shown');
  if (victoryActionsTimer !== null) window.clearTimeout(victoryActionsTimer);
  victoryActionsTimer = window.setTimeout(() => victoryActions.classList.add('shown'), 2200);
}

// ---- Demande de note sur l'App Store ----

const REVIEW_KEY = 'boomz.review';

/** Fin d'un match joué : après une belle victoire, la fenêtre de note d'Apple (une fois par mois au plus). */
function noteMatchForReview(won: boolean): void {
  if (tutorial) return;
  const { memory, ask } = afterMatch(parseMemory(readStorage(() => localStorage, REVIEW_KEY)), won, Date.now());
  writeStorage(() => localStorage, REVIEW_KEY, JSON.stringify(memory));
  // Après la danse de victoire, quand les boutons sont apparus.
  if (ask) window.setTimeout(requestReview, 3500);
}

// ---- Revanche : on rejoue avec les mêmes joueurs sans repasser par le salon ----

const rematchButton = required<HTMLButtonElement>('#victory-rematch');
const rematchStatus = required<HTMLElement>('#victory-rematch-status');

/** Humains absents ou pas encore partants pour la revanche (hors hôte). */
function rematchWaitingFor(): LobbyPlayer[] {
  if (!lobby) return [];
  return lobby.players.filter((player) => player.id !== lobby?.host && (!player.ready || !player.connected));
}

function renderRematch(): void {
  if (!lobby || victory.hidden) return;
  const isHost = lobby.host === you;
  const me = lobby.players.find((player) => player.id === you);
  const waiting = rematchWaitingFor();
  const enough = lobby.players.length >= MIN_PLAYERS;
  let status = '';
  if (!enough) {
    status = 'Les autres joueurs sont partis.';
    rematchButton.disabled = true;
    rematchButton.textContent = 'Revanche !';
  } else if (isHost) {
    rematchButton.disabled = waiting.length > 0;
    rematchButton.textContent = challenge !== null ? 'Réessayer' : 'Revanche !';
    if (waiting.length > 0) status = `En attente de ${waiting.map((player) => player.name).join(', ')}…`;
  } else {
    rematchButton.disabled = false;
    rematchButton.textContent = me?.ready ? 'Partant ✓ (annuler)' : 'Revanche !';
    if (me?.ready) status = 'L’hôte va relancer la partie.';
    else if (lobby.players.some((player) => player.id !== you && !player.bot && player.ready)) status = 'D’autres joueurs veulent leur revanche !';
  }
  setText(rematchStatus, status);
}

rematchButton.addEventListener('click', () => {
  if (!lobby || !connection) return;
  if (lobby.host === you) {
    connection.send({ type: 'start' });
  } else {
    const me = lobby.players.find((player) => player.id === you);
    connection.send({ type: 'ready', ready: !me?.ready });
  }
});

required<HTMLButtonElement>('#victory-back').addEventListener('click', () => {
  victory.hidden = true;
  victoryDance.stop();
  // Défi : pas de salon, retour à la liste des défis.
  if (challenge !== null) leaveGame();
  else backButton.click();
});
required<HTMLButtonElement>('#victory-feedback').addEventListener('click', () => feedbackEndButton.click());

// ---- Émojis rapides ----

const emoteButton = required<HTMLButtonElement>('#emote-btn');
const emotePicker = required<HTMLElement>('#emote-picker');

function closeEmotes(): void {
  emotePicker.hidden = true;
  emoteButton.setAttribute('aria-expanded', 'false');
}

emotePicker.replaceChildren(
  ...EMOTES.map((emoji, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emote-choice';
    button.setAttribute('role', 'menuitem');
    button.textContent = emoji;
    button.addEventListener('click', () => {
      connection?.send({ type: 'emote', emote: index });
      closeEmotes();
      // Sinon la barre d'espace (bombe, au clavier) rouvrirait le choix.
      button.blur();
      emoteButton.blur();
    });
    return button;
  }),
);

emoteButton.addEventListener('click', () => {
  if (!emotePicker.hidden) {
    closeEmotes();
    return;
  }
  // Sous le bouton, ou à sa gauche quand le téléphone est couché (barre sur le côté).
  const rect = emoteButton.getBoundingClientRect();
  emotePicker.hidden = false;
  const width = emotePicker.offsetWidth;
  const height = emotePicker.offsetHeight;
  const landscape = window.innerWidth > window.innerHeight;
  const left = landscape ? rect.left - width - 8 : rect.right - width;
  const top = landscape ? rect.top : rect.bottom + 8;
  emotePicker.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`;
  emotePicker.style.top = `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`;
  emoteButton.setAttribute('aria-expanded', 'true');
});

document.addEventListener('pointerdown', (event) => {
  if (!emotePicker.hidden && event.target instanceof Node && !emotePicker.contains(event.target) && !emoteButton.contains(event.target)) {
    closeEmotes();
  }
});

let detonateRequested = false;
let powerRequested = false;
const powerButton = required<HTMLButtonElement>('#power-btn');
powerButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  powerRequested = true;
  powerButton.classList.add('pressed');
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
  powerButton.addEventListener(type, () => powerButton.classList.remove('pressed'));
}
let renderedPowerKey = '';


/** Bouton du pouvoir : nom du pouvoir quand il est prêt, secondes de recharge sinon. */
function renderPowerButton(match: MatchState, player: Player | undefined): void {
  const show = !!match.powers && !!player?.alive && match.phase !== 'matchOver';
  powerButton.hidden = !show;
  if (!show || !player) return;
  const info = CHARACTERS[player.character] ?? CHARACTERS[0];
  const tick = match.phase === 'playing' ? match.round.tick : 0;
  const left = Math.max(0, player.powerReadyAt - tick);
  const total = tick < player.powerReadyAt && player.powerReadyAt <= POWER_START_TICKS ? POWER_START_TICKS : info.cooldown;
  const active = player.effect !== -1 && player.effectUntil > tick;
  const key = `${player.character}:${Math.ceil(left / TICK_RATE)}:${active}:${Math.round((left / total) * 40)}`;
  if (key === renderedPowerKey) return;
  renderedPowerKey = key;
  powerButton.style.setProperty('--hero', HERO_COLORS[player.character] ?? HERO_COLORS[0]);
  powerButton.style.setProperty('--cd', String(Math.min(1, left / total)));
  powerButton.classList.toggle('charging', left > 0);
  powerButton.classList.toggle('active', active);
  const label = required<HTMLElement>('#power-label');
  // Mot trop long pour le bouton (Doppelbombe) : coupure possible au milieu, avec un trait d'union.
  const name = info.power.replace(/\S{10,}/g, (word) => `${word.slice(0, Math.ceil(word.length / 2))}\u00ad${word.slice(Math.ceil(word.length / 2))}`);
  setText(label, left > 0 ? String(Math.ceil(left / TICK_RATE)) : name);
  label.classList.toggle('long', left <= 0 && info.power.split(' ').some((word) => word.length >= 8));
  powerButton.setAttribute('aria-label', left > 0 ? `${info.power} : prêt dans ${Math.ceil(left / TICK_RATE)} s` : `Utiliser ${info.power}`);
}
/** Développement : robot aux commandes de ce téléphone. */
let devAutopilot: BotBrain | null = null;
detonateButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  detonateRequested = true;
  audio.playDetonateClick();
});

// ---- Bonus du joueur ----

let renderedPowersKey = '';

/** Rangée des bonus actifs de ce joueur, avec leur niveau et les secondes restantes. */
function renderPowers(player: Player | undefined, tick: number): void {
  const entries: Array<{ bonus: Exclude<Bonus, 0>; level: string; seconds: number | null }> = [];
  if (player) {
    for (const bonus of BONUS_ORDER) {
      const left = player.buffUntil[bonus] - tick;
      if (left <= 0) continue;
      const level = player.buffLevel[bonus];
      const stacked = bonus === Bonus.Flame || bonus === Bonus.Bomb || bonus === Bonus.Speed;
      // Le Gilet n'a pas de compte à rebours : il dure jusqu'à la prochaine explosion.
      const seconds = player.buffUntil[bonus] >= UNTIL_USED ? null : Math.ceil(left / TICK_RATE);
      entries.push({ bonus, level: stacked && level > 1 ? `×${level}` : '', seconds });
    }
  }
  const key = JSON.stringify(entries);
  if (key === renderedPowersKey) return;
  renderedPowersKey = key;
  powers.replaceChildren(
    ...entries.map(({ bonus, level, seconds }) => {
      const chip = document.createElement('span');
      chip.className = 'power';
      // Les 3 dernières secondes, la pastille clignote.
      chip.classList.toggle('ending', seconds !== null && seconds <= 3);
      chip.title = BONUS_INFO[bonus].name;
      const icon = document.createElement('canvas');
      icon.className = 'power-icon';
      chip.append(icon);
      const label = [level, seconds === null ? '' : `${seconds}s`].filter(Boolean).join(' ');
      if (label) {
        const text = document.createElement('span');
        text.textContent = label;
        chip.append(text);
      }
      requestAnimationFrame(() => paintBonusCanvas(icon, bonus));
      return chip;
    }),
  );
}

function sendInputs(match: MatchState | null): void {
  if (!connection) return;
  const touchBomb = touch.consumeBomb();
  const keyBomb = keyboard.consumeBomb();
  const detonate = keyboard.consumeDetonate() || detonateRequested;
  detonateRequested = false;
  let power = keyboard.consumePower() || powerRequested;
  powerRequested = false;
  const playing = screen === 'game' && match?.phase === 'playing';
  // Le joueur pousse selon ce qu'il voit : si l'arène est affichée pivotée,
  // la direction à l'écran est convertie en direction dans l'arène.
  const pushed = playing ? (touch.direction() ?? keyboard.direction()) : null;
  let direction = pushed && screenToGrid(pushed, renderer.rotated);
  // Développement : un robot joue à la place de ce téléphone (vidéos de présentation).
  let autoBomb = false;
  if (import.meta.env.DEV && devAutopilot && playing && match && mySeat() !== null) {
    const input = devAutopilot.decide(match.round, mySeat()!);
    direction = input.direction;
    autoBomb = input.bomb;
    power ||= !!input.power;
  }
  if (direction !== lastSentDirection) {
    connection.send({ type: 'input', direction });
    lastSentDirection = direction;
  }
  if (playing && (touchBomb || keyBomb || autoBomb)) connection.send({ type: 'bomb' });
  if (playing && detonate) connection.send({ type: 'detonate' });
  if (playing && power) connection.send({ type: 'power' });
}

function frameLoop(now: number): void {
  // Programmée d'abord : une erreur dans une image ne doit pas arrêter le jeu.
  requestAnimationFrame(frameLoop);
  const latest = snapshots.latest();
  // La zone du joystick n'écoute le doigt que pendant le jeu : hors jeu, elle
  // laisserait passer les touchers vers les boutons (« Retour au salon »).
  screens.game.classList.toggle('playing', screen === 'game' && latest?.phase === 'playing');
  sendInputs(latest);
  if (screen === 'game') {
    const view = snapshots.sample(now);
    if (view) {
      renderer.render(view, mySeat(), now);
      updateGameHud(latest ?? view);
    }
  }
}

new ResizeObserver(([entry]) => {
  const { width, height } = entry.contentRect;
  renderer.resize(width, height);
}).observe(frame);

// ---- Actions ----

function playerName(): string {
  const name = nameInput.value.trim();
  writeStorage(() => localStorage, NAME_KEY, name || null);
  return name;
}

required<HTMLButtonElement>('#create-btn').addEventListener('click', () => {
  setText(homeError, '');
  const name = playerName();
  connect(() => connection?.send({ type: 'create', name }), onlineLink);
});

required<HTMLFormElement>('#join-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const room = codeInput.value.trim().toUpperCase();
  if (!room) {
    setText(homeError, 'Entrez le code du salon.');
    return;
  }
  setText(homeError, '');
  const name = playerName();
  connect(() => connection?.send({ type: 'join', room, name }), onlineLink);
});

// ---- Sans internet : téléphones proches (Bluetooth et Wi-Fi direct) ----

const nearbyButton = required<HTMLButtonElement>('#nearby-btn');
const nearbyDialog = required<HTMLDialogElement>('#nearby');
const nearbyList = required<HTMLUListElement>('#nearby-list');
const nearbySearching = required<HTMLElement>('#nearby-searching');
let scanner: NearbyScanner | null = null;

/** Ferme la fenêtre ; `keepRadio` : une connexion va suivre et relancera le module elle-même. */
function closeNearby(keepRadio: boolean): void {
  scanner?.stop(keepRadio);
  scanner = null;
  if (nearbyDialog.open) nearbyDialog.close();
}

function renderNearbyHosts(hosts: NearbyHost[]): void {
  nearbySearching.hidden = hosts.length > 0;
  nearbyList.replaceChildren(
    ...hosts.map((host) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary-btn wide';
      button.textContent = `Rejoindre le salon de ${host.name || 'Joueur'}`;
      button.addEventListener('click', () => {
        closeNearby(true);
        setText(homeError, '');
        const name = playerName();
        connect(
          () => connection?.send({ type: 'join', room: host.room, name }),
          (onMessage, onClose) => new NearbyGuestLink(host.room, onMessage, onClose),
        );
      });
      item.append(button);
      return item;
    }),
  );
}

nearbyButton.addEventListener('click', () => {
  setText(homeError, '');
  renderNearbyHosts([]);
  scanner?.stop();
  scanner = new NearbyScanner(renderNearbyHosts);
  nearbyDialog.showModal();
});

nearbyDialog.addEventListener('close', () => closeNearby(false));
required<HTMLButtonElement>('#nearby-close').addEventListener('click', () => closeNearby(false));

required<HTMLButtonElement>('#nearby-host-btn').addEventListener('click', () => {
  closeNearby(true);
  setText(homeError, '');
  const name = playerName();
  connect(
    () => connection?.send({ type: 'create', name }),
    (onMessage) => new NearbyHostLink(name || 'Joueur', onMessage),
  );
});

void nearbyAvailable().then((available) => {
  nearbyButton.hidden = !available;
});

readyButton.addEventListener('click', () => {
  const me = lobby?.players.find((player) => player.id === you);
  connection?.send({ type: 'ready', ready: !me?.ready });
});

startButton.addEventListener('click', () => connection?.send({ type: 'start' }));

arenaSelect.addEventListener('change', () => {
  const value = arenaSelect.value;
  if (value === 'rotation' || (ARENA_IDS as readonly string[]).includes(value)) {
    connection?.send({ type: 'arena', arena: value as ArenaChoice });
  }
});

/** Remplit une légende des bonus ; les icônes sont peintes quand elle devient visible. */
function fillBonusLegend(list: HTMLUListElement): Array<() => void> {
  const painters: Array<() => void> = [];
  const items = BONUS_ORDER.map((bonus) => {
    const item = document.createElement('li');
    const icon = document.createElement('canvas');
    icon.className = 'bonus-icon';
    const text = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = BONUS_INFO[bonus].name;
    text.append(name, ` : ${BONUS_INFO[bonus].effect}`);
    item.append(icon, text);
    painters.push(() => paintBonusCanvas(icon, bonus));
    return item;
  });
  list.replaceChildren(...items);
  return painters;
}

// Le canvas d'une icône n'a sa taille qu'une fois la légende affichée.
const lobbyLegend = fillBonusLegend(required<HTMLUListElement>('#bonus-list'));
required<HTMLDetailsElement>('.legend').addEventListener('toggle', () => lobbyLegend.forEach((paint) => paint()));
const helpLegend = fillBonusLegend(required<HTMLUListElement>('#help-bonus-list'));
const settingsDialog = required<HTMLDialogElement>('#settings');
required<HTMLButtonElement>('#settings-btn').addEventListener('click', () => settingsDialog.showModal());
required<HTMLButtonElement>('#settings-close').addEventListener('click', () => settingsDialog.close());

required<HTMLButtonElement>('#help-btn').addEventListener('click', () => {
  helpDialog.showModal();
  helpLegend.forEach((paint) => paint());
});
required<HTMLButtonElement>('#help-close').addEventListener('click', () => helpDialog.close());

// ---- Avis des testeurs ----

/** Délais aller-retour mesurés avec le serveur (ms), pour les avis. */
const latencies: number[] = [];
window.setInterval(() => {
  if (connection && session) connection.send({ type: 'ping', sent: performance.now() });
}, 3000);

const feedbackDialog = required<HTMLDialogElement>('#feedback');
const feedbackForm = required<HTMLFormElement>('#feedback-form');
const feedbackStatus = required<HTMLElement>('#feedback-status');
const feedbackEndButton = required<HTMLButtonElement>('#feedback-end-btn');

required<HTMLSelectElement>('#feedback-bonus').append(
  ...BONUS_ORDER.map((bonus) => {
    const option = document.createElement('option');
    option.textContent = BONUS_INFO[bonus].name;
    return option;
  }),
);

// Étoiles : toutes celles jusqu'à la note choisie s'allument.
const stars = [...feedbackForm.querySelectorAll<HTMLInputElement>('input[name="note"]')];
for (const star of stars) {
  star.addEventListener('change', () => {
    for (const other of stars) other.nextElementSibling?.classList.toggle('lit', Number(other.value) <= Number(star.value));
  });
}

function openFeedback(): void {
  setText(feedbackStatus, '');
  feedbackDialog.showModal();
}
required<HTMLButtonElement>('#feedback-btn').addEventListener('click', openFeedback);
feedbackEndButton.addEventListener('click', openFeedback);
required<HTMLButtonElement>('#feedback-close').addEventListener('click', () => feedbackDialog.close());

function lastMatchSummary(): string {
  const match = snapshots.latest();
  if (!match) return 'pas encore joué';
  return `dernier match à ${match.playerCount} joueurs, arène ${ARENA_NAMES[match.round.arena]}`;
}

required<HTMLButtonElement>('#feedback-send').addEventListener('click', async () => {
  const data = new FormData(feedbackForm);
  const field = (name: keyof FeedbackAnswers) => String(data.get(name) ?? '');
  const connectionInfo = (navigator as Navigator & { connection?: { effectiveType?: string; type?: string } }).connection;
  const text = composeFeedback(
    {
      note: field('note'),
      priseEnMain: field('priseEnMain'),
      reactivite: field('reactivite'),
      sons: field('sons'),
      bonusFort: field('bonusFort'),
      arene: field('arene'),
      bug: field('bug'),
      remarque: field('remarque'),
    },
    {
      device: describeDevice(navigator.userAgent),
      screen: `${innerWidth} × ${innerHeight} ${innerHeight > innerWidth ? 'portrait' : 'paysage'}`,
      network: [connectionInfo?.type, connectionInfo?.effectiveType].filter(Boolean).join(' ') || 'inconnu',
      latencyMs: median(latencies),
      lastMatch: lastMatchSummary(),
    },
  );
  try {
    if (navigator.share) {
      await navigator.share({ text });
      setText(feedbackStatus, 'Merci pour votre avis !');
      return;
    }
    await navigator.clipboard.writeText(text);
    setText(feedbackStatus, 'Avis copié : collez-le dans un message à la personne qui vous a invité.');
  } catch (error) {
    // Partage annulé : on laisse le formulaire ouvert, rien n'est perdu.
    if (error instanceof DOMException && error.name === 'AbortError') return;
    setText(feedbackStatus, 'Impossible de partager ici : faites une capture d’écran de ce formulaire.');
  }
});

// ---- Son ----

function renderAudioButtons(): void {
  soundButton.setAttribute('aria-pressed', String(audio.settings.sound));
  musicButton.setAttribute('aria-pressed', String(audio.settings.music));
  gameSoundButton.setAttribute('aria-pressed', String(audio.settings.sound || audio.settings.music));
}
soundButton.addEventListener('click', () => {
  audio.setSound(!audio.settings.sound);
  renderAudioButtons();
});
musicButton.addEventListener('click', () => {
  audio.setMusic(!audio.settings.music);
  renderAudioButtons();
});
// En partie, un seul bouton coupe ou rétablit tout.
gameSoundButton.addEventListener('click', () => {
  const on = !(audio.settings.sound || audio.settings.music);
  audio.setSound(on);
  audio.setMusic(on);
  renderAudioButtons();
  gameSoundButton.blur();
});
renderAudioButtons();
// Petit clic sur les boutons de l'interface (hors bombe et détonateur, qui ont leurs sons).
document.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('.primary-btn, .secondary-btn, .link-btn')) audio.playClick();
});

shareButton.addEventListener('click', async () => {
  if (!session) return;
  const url = inviteLink(session.room);
  const text = `Rejoins ma partie de Boomz ! Code : ${session.room}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Boomz', text, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    setText(lobbyHint, 'Lien copié !');
  } catch {
    // Partage annulé ou presse-papiers refusé : le lien reste affiché à l'écran.
  }
});

required<HTMLButtonElement>('#leave-btn').addEventListener('click', () => {
  connection?.send({ type: 'leave' });
  giveUp('');
});

// ---- Parties contre des robots et tutoriel ----

const coach = required<HTMLElement>('#coach');
const welcomeDialog = required<HTMLDialogElement>('#welcome');

const coachActions = required<HTMLElement>('#coach-actions');
const coachQuit = required<HTMLButtonElement>('#coach-quit');

function renderCoach(): void {
  if (!tutorial) return;
  const finished = tutorial.step === 'done';
  if (finished) writeStorage(() => localStorage, TUTORIAL_KEY, '1');
  // Fin du match pendant le tutoriel : l'écran de victoire prend le relais.
  if (finished && snapshots.latest()?.phase === 'matchOver') {
    endTutorial();
    return;
  }
  coach.hidden = false;
  coach.classList.toggle('finished', finished);
  coachActions.hidden = !finished;
  coachQuit.hidden = finished;
  setText(required<HTMLElement>('#coach-step'), finished ? '✓' : `${tutorial.index}/${tutorial.total}`);
  setText(required<HTMLElement>('#coach-text'), finished ? 'Tutoriel terminé, vous savez jouer ! Continuez la partie ou revenez à l’accueil.' : tutorial.text);
}

function endTutorial(): void {
  tutorial = null;
  coach.hidden = true;
  writeStorage(() => localStorage, TUTORIAL_KEY, '1');
}

/** Quitte la partie en cours et revient à l'accueil. */
function leaveGame(): void {
  const wasChallenge = challenge;
  endTutorial();
  challenge = null;
  connection?.send({ type: 'leave' });
  giveUp('');
  if (wasChallenge !== null) openChallenges(wasChallenge);
}

/**
 * Personnage et apparence, annoncés avant de lancer une partie aussitôt créée :
 * l'accueil du salon (qui les annonce d'habitude) arrive après le lancement.
 */
function announceHero(): void {
  connection?.send({ type: 'features', teams: true });
  connection?.send({ type: 'accessory', accessory: myAccessory() });
  connection?.send({ type: 'character', character: myCharacter() });
  connection?.send({ type: 'skin', skin: mySkin() });
}

/** Salon sur ce téléphone ; `tutorial` : un robot Débutant et la partie lancée aussitôt. */
function playSolo(withTutorial: boolean): void {
  setText(homeError, '');
  const name = playerName();
  coach.hidden = true;
  const hero = CHARACTERS[myCharacter()];
  challenge = null;
  tutorial = withTutorial ? new Tutorial(window.matchMedia?.('(pointer: coarse)').matches ?? true, hero) : null;
  connect(() => {
    connection?.send({ type: 'create', name });
    announceHero();
    connection?.send({ type: 'addBot', level: withTutorial ? 'debutant' : 'pro' });
    if (withTutorial) {
      connection?.send({ type: 'start' });
      renderCoach();
    }
  }, soloLink);
}

required<HTMLButtonElement>('#solo-btn').addEventListener('click', () => playSolo(false));
coachQuit.addEventListener('click', leaveGame);
required<HTMLButtonElement>('#coach-end').addEventListener('click', leaveGame);
required<HTMLButtonElement>('#coach-continue').addEventListener('click', endTutorial);

// ---- Pause : seulement seul contre des robots (la partie tourne sur ce téléphone) ----

const pauseButton = required<HTMLButtonElement>('#pause-btn');
const pauseDialog = required<HTMLDialogElement>('#pause-dialog');
let paused = false;

function canPause(): boolean {
  const match = snapshots.latest();
  return solo && screen === 'game' && !!match && match.phase !== 'matchOver';
}

function setPaused(on: boolean): void {
  if (on === paused || (on && !canPause())) return;
  // Le lien refuse la pause quand d'autres téléphones jouent (en ligne, en local).
  if (connection?.setPaused?.(on) !== true) return;
  paused = on;
  if (on) {
    closeEmotes();
    if (!pauseDialog.open) pauseDialog.showModal();
  } else if (pauseDialog.open) {
    pauseDialog.close();
  }
}

pauseButton.addEventListener('click', (event) => {
  (event.currentTarget as HTMLElement).blur();
  setPaused(true);
});
required<HTMLButtonElement>('#pause-resume').addEventListener('click', () => setPaused(false));
required<HTMLButtonElement>('#pause-quit').addEventListener('click', () => {
  paused = false;
  pauseDialog.close();
  leaveGame();
});
// Échap ferme la fenêtre : on reprend la partie.
pauseDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  setPaused(false);
});
// Appli quittée (appel, écran verrouillé) : la partie contre les robots attend.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && canPause()) setPaused(true);
});
window.addEventListener('keydown', (event) => {
  if ((event.code === 'KeyP' || event.code === 'Escape') && !paused && canPause() && !isField(event.target)) setPaused(true);
});

// Quitter une partie : tout de suite contre des robots, après confirmation avec d'autres joueurs.
const quitDialog = required<HTMLDialogElement>('#quit-dialog');
required<HTMLButtonElement>('#quit-btn').addEventListener('click', (event) => {
  (event.currentTarget as HTMLElement).blur();
  if (solo) leaveGame();
  else quitDialog.showModal();
});
required<HTMLButtonElement>('#quit-confirm').addEventListener('click', () => {
  quitDialog.close();
  leaveGame();
});
required<HTMLButtonElement>('#quit-cancel').addEventListener('click', () => quitDialog.close());
required<HTMLButtonElement>('#welcome-start').addEventListener('click', () => {
  welcomeDialog.close();
  playSolo(true);
});
required<HTMLButtonElement>('#welcome-skip').addEventListener('click', () => {
  writeStorage(() => localStorage, TUTORIAL_KEY, '1');
  welcomeDialog.close();
});
required<HTMLButtonElement>('#help-tutorial').addEventListener('click', () => {
  helpDialog.close();
  playSolo(true);
});

backButton.addEventListener('click', () => {
  viewingResults = false;
  show('lobby');
});

// ---- Défis solo ----

const CHALLENGES_KEY = 'boomz.challenges';
const challengesDialog = required<HTMLDialogElement>('#challenges');
const challengeGrid = required<HTMLOListElement>('#challenge-grid');
const challengePlay = required<HTMLButtonElement>('#challenge-play');
const victoryStars = required<HTMLUListElement>('#victory-stars');
const victoryNext = required<HTMLButtonElement>('#victory-next');
let selectedChallenge = 0;

function challengeProgress(): number[] {
  return parseProgress(readStorage(() => localStorage, CHALLENGES_KEY));
}

function formatPar(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} s`;
  return rest ? `${minutes} min ${String(rest).padStart(2, '0')}` : `${minutes} min`;
}

/** Les trois objectifs d'un défi, avec l'étoile que chacun rapporte. */
function challengeGoals(info: Challenge, short = false): Array<[number, string]> {
  return short
    ? [
        [STAR_WIN, 'Victoire'],
        [STAR_FLAWLESS, 'Sans perdre une manche'],
        [STAR_FAST, `En moins de ${formatPar(info.parSeconds)}`],
      ]
    : [
        [STAR_WIN, 'Gagner le match'],
        [STAR_FLAWLESS, 'Gagner sans perdre une manche'],
        [STAR_FAST, `Gagner en moins de ${formatPar(info.parSeconds)} de jeu`],
      ];
}

function starSpan(won: boolean): HTMLSpanElement {
  const star = document.createElement('span');
  star.className = won ? 'star won' : 'star';
  star.textContent = '★';
  star.setAttribute('aria-hidden', 'true');
  return star;
}

function renderChallengesTotal(): void {
  const stars = totalStars(challengeProgress());
  setText(required<HTMLElement>('#challenges-total'), stars ? `★ ${stars}/${CHALLENGES.length * 3}` : '');
}

function renderChallenges(): void {
  const progress = challengeProgress();
  setText(required<HTMLElement>('#challenges-score'), `★ ${totalStars(progress)} / ${CHALLENGES.length * 3}`);
  challengeGrid.replaceChildren(
    ...CHALLENGES.map((info, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const open = isUnlocked(progress, index);
      button.type = 'button';
      button.className = open ? 'challenge-tile' : 'challenge-tile locked';
      button.setAttribute('aria-pressed', String(index === selectedChallenge));
      const stars = progress[index];
      const count = [STAR_WIN, STAR_FLAWLESS, STAR_FAST].filter((star) => stars & star).length;
      button.setAttribute('aria-label', `Défi ${index + 1}, ${info.title}${open ? `, ${count} étoile${count > 1 ? 's' : ''} sur 3` : ', verrouillé'}`);
      const number = document.createElement('span');
      number.className = 'challenge-number';
      number.textContent = open ? String(index + 1) : '🔒';
      const row = document.createElement('span');
      row.className = 'star-row';
      row.append(...[STAR_WIN, STAR_FLAWLESS, STAR_FAST].map((star) => starSpan((stars & star) !== 0)));
      button.append(number, row);
      button.addEventListener('click', () => {
        selectedChallenge = index;
        audio.playClick();
        renderChallenges();
      });
      item.append(button);
      return item;
    }),
  );
  const info = CHALLENGES[selectedChallenge];
  const open = isUnlocked(progress, selectedChallenge);
  setText(required<HTMLElement>('#challenge-name'), `${selectedChallenge + 1}. ${info.title}`);
  setText(required<HTMLElement>('#challenge-arena'), ARENA_NAMES[info.arena]);
  required<HTMLUListElement>('#challenge-opponents').replaceChildren(
    ...info.bots.map((bot) => {
      const item = document.createElement('li');
      item.className = 'challenge-opponent';
      const avatar = document.createElement('canvas');
      avatar.className = 'avatar';
      avatar.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = `${CHARACTERS[bot.character].name} · ${BOT_LEVEL_SHORT[bot.level]}`;
      item.append(avatar, label);
      requestAnimationFrame(() => drawAvatar(avatar, bot.character, 0));
      return item;
    }),
  );
  const goals = required<HTMLUListElement>('#challenge-goals');
  if (open) {
    goals.replaceChildren(
      ...challengeGoals(info).map(([star, text]) => {
        const item = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = text;
        item.append(starSpan((progress[selectedChallenge] & star) !== 0), label);
        return item;
      }),
    );
  } else {
    const item = document.createElement('li');
    item.className = 'challenge-locked';
    item.textContent = `Gagnez le défi ${selectedChallenge} pour débloquer celui-ci.`;
    goals.replaceChildren(item);
  }
  challengePlay.disabled = !open;
  setText(challengePlay, open ? `Jouer le défi ${selectedChallenge + 1}` : 'Verrouillé');
}

/** `focus` : défi à mettre en avant ; sinon le dernier débloqué. */
function openChallenges(focus?: number): void {
  const progress = challengeProgress();
  const lastOpen = CHALLENGES.reduce((last, _, index) => (isUnlocked(progress, index) ? index : last), 0);
  selectedChallenge = focus !== undefined && isUnlocked(progress, focus) ? focus : lastOpen;
  renderChallenges();
  renderChallengesTotal();
  if (!challengesDialog.open) challengesDialog.showModal();
}

/** Lance un défi sur ce téléphone : salon local, robots imposés, partie lancée aussitôt. */
function playChallenge(index: number): void {
  const info = CHALLENGES[index];
  setText(homeError, '');
  coach.hidden = true;
  tutorial = null;
  const name = playerName();
  connect(() => {
    challenge = index;
    connection?.send({ type: 'create', name });
    announceHero();
    connection?.send({ type: 'arena', arena: info.arena });
    for (const bot of info.bots) connection?.send({ type: 'addBot', level: bot.level, character: bot.character });
    connection?.send({ type: 'start' });
  }, soloLink);
}

/** Écran de fin d'un défi : étoiles obtenues (et enregistrées), défi suivant. */
function renderChallengeResult(match: MatchState, me: number | null): void {
  const info = challenge === null ? null : CHALLENGES[challenge];
  victoryStars.hidden = info === null;
  victoryNext.hidden = true;
  rematchButton.className = 'primary-btn';
  setText(required<HTMLButtonElement>('#victory-back'), info ? 'Retour aux défis' : 'Retour au salon');
  if (!info || challenge === null || me === null) return;
  const earned = starsEarned(match, me, info);
  const before = challengeProgress();
  const after = recordStars(before, challenge, earned);
  writeStorage(() => localStorage, CHALLENGES_KEY, JSON.stringify(after));
  renderChallengesTotal();
  setText(required<HTMLElement>('#victory-eyebrow'), earned ? `Défi ${challenge + 1} réussi !` : `Défi ${challenge + 1} raté`);
  victoryStars.replaceChildren(
    ...challengeGoals(info, true).map(([star, text]) => {
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'goal-text';
      label.textContent = text;
      item.append(starSpan((earned & star) !== 0), label);
      if ((earned & star) !== 0 && (before[challenge!] & star) === 0) {
        const fresh = document.createElement('span');
        fresh.className = 'star-new';
        fresh.textContent = 'Nouveau';
        item.append(fresh);
      }
      return item;
    }),
  );
  victoryNext.hidden = !(challenge + 1 < CHALLENGES.length && isUnlocked(after, challenge + 1));
  // Défi suivant disponible : il devient l'action principale.
  rematchButton.className = victoryNext.hidden ? 'primary-btn' : 'secondary-btn';
}

victoryNext.addEventListener('click', () => {
  if (challenge === null) return;
  const next = challenge + 1;
  victory.hidden = true;
  victoryDance.stop();
  endTutorial();
  challenge = null;
  connection?.send({ type: 'leave' });
  giveUp('');
  playChallenge(next);
});
required<HTMLButtonElement>('#challenges-btn').addEventListener('click', () => openChallenges());
required<HTMLButtonElement>('#challenges-close').addEventListener('click', () => challengesDialog.close());
challengePlay.addEventListener('click', () => {
  challengesDialog.close();
  playChallenge(selectedChallenge);
});
renderChallengesTotal();

// ---- Choix du personnage ----

const CHARACTER_KEY = 'boomz.character';
const SKIN_KEY = 'boomz.skin';
const charactersDialog = required<HTMLDialogElement>('#characters');
const characterGrid = required<HTMLUListElement>('#character-grid');
const skinOptions = required<HTMLElement>('#skin-options');
/** Sélection en cours dans la fenêtre, confirmée par « Choisir ». */
let pickedCharacter = 0;
let pickedSkin = 0;
let pickedAccessory = 0;
const ACCESSORY_KEY = 'boomz.accessory';

/** Accessoire enregistré, s'il est (toujours) débloqué par les étoiles des défis. */
function myAccessory(): number {
  const stored = Number(readStorage(() => localStorage, ACCESSORY_KEY));
  return accessoryUnlocked(stored, totalStars(challengeProgress())) ? stored : 0;
}

function renderAccessoryPicker(): void {
  const stars = totalStars(challengeProgress());
  setText(required<HTMLElement>('#accessory-stars'), `★ ${stars}`);
  required<HTMLElement>('#accessory-options').replaceChildren(
    ...ACCESSORIES.map((info, index) => {
      const open = accessoryUnlocked(index, stars);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'accessory-option';
      button.disabled = !open;
      button.setAttribute('aria-pressed', String(index === pickedAccessory));
      button.setAttribute('aria-label', open ? info.name : `${info.name} : à débloquer avec ${info.stars} étoiles des défis`);
      const avatar = document.createElement('canvas');
      avatar.className = 'avatar';
      const label = document.createElement('span');
      if (open) label.textContent = info.name;
      else {
        label.className = 'lock';
        label.textContent = `🔒 ★ ${info.stars}`;
      }
      button.append(avatar, label);
      button.addEventListener('click', () => {
        pickedAccessory = index;
        audio.playClick();
        renderCharacterPicker();
      });
      requestAnimationFrame(() => drawAvatar(avatar, pickedCharacter, pickedSkin, index));
      return button;
    }),
  );
}

/** Premier lancement : le tutoriel est proposé une fois le personnage choisi. */
let pickingFirst = false;

function storedCharacter(): number | null {
  const value = Number(readStorage(() => localStorage, CHARACTER_KEY));
  return readStorage(() => localStorage, CHARACTER_KEY) !== null && isCharacter(value) ? value : null;
}

function myCharacter(): number {
  return storedCharacter() ?? 0;
}

function mySkin(): number {
  const value = Number(readStorage(() => localStorage, SKIN_KEY));
  return Number.isInteger(value) && value >= 0 && value < SKIN_COUNT ? value : 0;
}

function renderHeroRow(): void {
  const hero = CHARACTERS[myCharacter()];
  setText(required<HTMLElement>('#hero-name'), hero.name);
  setText(required<HTMLElement>('#hero-power'), `Pouvoir : ${hero.power}`);
  requestAnimationFrame(() => drawAvatar(required<HTMLCanvasElement>('#hero-avatar'), myCharacter(), mySkin(), myAccessory()));
}

function renderCharacterPicker(): void {
  characterGrid.replaceChildren(
    ...CHARACTERS.map((character, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'character-choice';
      button.setAttribute('aria-pressed', String(index === pickedCharacter));
      button.setAttribute('aria-label', `${character.name}, pouvoir ${character.power}`);
      const avatar = document.createElement('canvas');
      avatar.className = 'avatar';
      const label = document.createElement('span');
      label.textContent = character.name;
      button.append(avatar, label);
      button.addEventListener('click', () => {
        pickedCharacter = index;
        audio.playClick();
        renderCharacterPicker();
      });
      item.append(button);
      requestAnimationFrame(() => drawAvatar(avatar, index, index === pickedCharacter ? pickedSkin : 0));
      return item;
    }),
  );
  const info = CHARACTERS[pickedCharacter];
  setText(required<HTMLElement>('#character-name'), info.name);
  setText(required<HTMLElement>('#character-category'), info.category);
  setText(required<HTMLElement>('#character-power'), `Pouvoir : ${info.power}`);
  setText(required<HTMLElement>('#character-description'), info.description);
  setText(required<HTMLElement>('#character-cooldown'), `Recharge : ${Math.round(info.cooldown / TICK_RATE)} s`);
  requestAnimationFrame(() => drawAvatar(required<HTMLCanvasElement>('#character-portrait'), pickedCharacter, pickedSkin, pickedAccessory));
  renderAccessoryPicker();
  skinOptions.replaceChildren(
    ...SKIN_NAMES.map((skinName, skin) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'skin-option';
      button.setAttribute('aria-pressed', String(skin === pickedSkin));
      const avatar = document.createElement('canvas');
      avatar.className = 'avatar';
      const label = document.createElement('span');
      label.textContent = skinName;
      button.append(avatar, label);
      button.addEventListener('click', () => {
        pickedSkin = skin;
        renderCharacterPicker();
      });
      requestAnimationFrame(() => drawAvatar(avatar, pickedCharacter, skin));
      return button;
    }),
  );
  setText(required<HTMLElement>('#characters-ok'), `Jouer ${info.name}`);
}

/** `first` : premier lancement, sans possibilité d'annuler. */
function openCharacters(first: boolean): void {
  pickingFirst = first;
  pickedCharacter = myCharacter();
  pickedSkin = mySkin();
  pickedAccessory = myAccessory();
  required<HTMLButtonElement>('#characters-close').hidden = first;
  renderCharacterPicker();
  charactersDialog.showModal();
}

required<HTMLButtonElement>('#characters-ok').addEventListener('click', () => {
  writeStorage(() => localStorage, CHARACTER_KEY, String(pickedCharacter));
  writeStorage(() => localStorage, SKIN_KEY, String(pickedSkin));
  writeStorage(() => localStorage, ACCESSORY_KEY, String(pickedAccessory));
  charactersDialog.close();
  renderHeroRow();
  if (session) {
    connection?.send({ type: 'character', character: pickedCharacter });
    connection?.send({ type: 'skin', skin: pickedSkin });
    connection?.send({ type: 'accessory', accessory: pickedAccessory });
  }
  if (pickingFirst && !readStorage(() => localStorage, TUTORIAL_KEY)) welcomeDialog.showModal();
  pickingFirst = false;
});
required<HTMLButtonElement>('#characters-close').addEventListener('click', () => charactersDialog.close());
// Premier lancement : pas de fermeture avec la touche Échap sans avoir choisi.
charactersDialog.addEventListener('cancel', (event) => {
  if (pickingFirst) event.preventDefault();
});
required<HTMLButtonElement>('#hero-change').addEventListener('click', () => openCharacters(false));
renderHeroRow();

// ---- Démarrage ----

nameInput.value = readStorage(() => localStorage, NAME_KEY) ?? '';
const invited = new URLSearchParams(location.search).get('salon')?.toUpperCase() ?? '';
codeInput.value = invited;
const previous = storedSession();
if (previous && (!invited || invited === previous.room)) {
  // Page rechargée en cours de partie : on reprend sa place.
  session = previous;
  resume(previous);
} else if (invited) {
  showInvitation(invited);
} else if (storedCharacter() === null) {
  // Premier lancement (ou première fois avec les personnages) : choix du personnage, puis tutoriel.
  openCharacters(true);
} else if (!readStorage(() => localStorage, TUTORIAL_KEY)) {
  welcomeDialog.showModal();
}

/** Arrivée par un lien d'invitation : « Rejoindre » devient l'action principale. */
function showInvitation(code: string): void {
  codeInput.value = code;
  setText(homeError, '');
  homeCard.classList.add('invited');
  required<HTMLElement>('#invite-banner').hidden = false;
  setText(required<HTMLElement>('#invite-code'), code);
  required<HTMLButtonElement>('#join-btn').textContent = 'Rejoindre le salon';
}

// Application installée : un lien d'invitation touché ailleurs (WhatsApp, SMS…)
// ouvre l'application au lieu du navigateur.
if (Capacitor.isNativePlatform()) {
  const openLink = (url: string | undefined) => {
    if (!url || session) return;
    const code = new URL(url).searchParams.get('salon')?.toUpperCase();
    if (code) showInvitation(code);
  };
  void App.getLaunchUrl().then((launch) => openLink(launch?.url));
  void App.addListener('appUrlOpen', (event) => openLink(event.url));
  // Retour dans l'application (après un message, un appel) : le son repart d'un moteur neuf si besoin.
  void App.addListener('appStateChange', ({ isActive }) => audio.background(!isActive));
}

// Dans l'application, la page de confidentialité est celle du site (ouverte dans le navigateur).
for (const link of document.querySelectorAll<HTMLAnchorElement>('.privacy-link')) {
  link.href = `${PUBLIC_ORIGIN}/confidentialite`;
}

// Pas de sélection de texte ni de menu contextuel sur un appui long, hors champs de saisie
// (le style suffit sur la plupart des téléphones ; ceci couvre les autres).
const isField = (target: EventTarget | null) => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
document.addEventListener('selectstart', (event) => {
  if (!isField(event.target)) event.preventDefault();
});
document.addEventListener('contextmenu', (event) => {
  if (!isField(event.target)) event.preventDefault();
});

applyScreenAmbience();
requestAnimationFrame(frameLoop);

if (import.meta.env.DEV) {
  // Accès à l'état pour les vérifications automatisées en développement.
  Object.assign(window, {
    boomz: {
      getMatch: () => snapshots.latest(),
      getLobby: () => lobby,
      /** Chat vocal (vérifications automatisées). */
      voice,
      /** Injecte un état, pour vérifier l'affichage de situations rares (bonus, détonateur). */
      inject: (match: MatchState) => snapshots.push(match, performance.now()),
      /** Ignore désormais les états du serveur (captures d'écran). */
      freeze: () => {
        devFrozen = true;
      },
      /** Un robot joue à la place de ce téléphone (vidéos et captures de présentation). */
      autopilot: (level: BotLevel | null) => {
        devAutopilot = level ? new BotBrain(level, Math.random) : null;
      },
      emote: (index: number) => connection?.send({ type: 'emote', emote: index }),
    },
  });
}
