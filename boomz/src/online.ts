import './online.css';
import { GameAudio } from './audio/audio';
import { soundEvents } from './audio/events';
import { composeFeedback, describeDevice, median, type FeedbackAnswers } from './feedback';
import { drawMascot, MenuDemo } from './menu/demo';
import { COUNTDOWN_TICKS, SUDDEN_DEATH_TICKS, TICK_RATE, WINS_TO_TAKE_MATCH } from './game/constants';
import { ARENA_NAMES } from './game/arena';
import { BASE_MAX_BOMBS, BASE_RANGE, BASE_SPEED, SKIN_COUNT, SPEED_STEP } from './game/constants';
import type { ArenaChoice, MatchState } from './game/match';
import { ARENA_IDS, Bonus, type Direction, type Player } from './game/types';
import { KeyboardInput } from './input/keyboard';
import { TouchPad } from './input/touch';
import { Connection, SnapshotBuffer } from './net/connection';
import { MIN_PLAYERS, RECONNECT_GRACE_SECONDS, type LobbyPlayer, type ServerMessage } from './net/protocol';
import { BONUS_INFO, BONUS_ORDER, paintBonusCanvas } from './render/bonuses';
import { drawAvatar, PLAYER_LOOKS, SKIN_NAMES } from './render/characters';
import { Renderer } from './render/renderer';
import { screenToGrid } from './render/view';

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
const demo = new MenuDemo(required<HTMLCanvasElement>('#home-bg'));
const homeCard = required<HTMLElement>('#home-card');
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

let connection: Connection | null = null;
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

function show(next: Screen): void {
  if (screen === next) return;
  screen = next;
  for (const [key, element] of Object.entries(screens)) element.hidden = key !== next;
  applyScreenAmbience();
  // Un bouton resté sélectionné capterait Espace et Entrée pendant la partie.
  if (next === 'game' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

/** Musique et fond animé selon l'écran affiché. */
function applyScreenAmbience(): void {
  audio.playMusic(screen === 'game' ? 'game' : 'menu');
  if (screen === 'home') demo.start();
  else demo.stop();
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
  return `${location.origin}/?salon=${room}`;
}

// ---- Connexion ----

function connect(first: () => void): void {
  connection?.close();
  const current = new Connection(
    (message) => {
      if (connection === current) onMessage(message);
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
  if (!session) return;
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
      you = message.you;
      session = { room: message.room, token: message.token };
      writeStorage(() => sessionStorage, SESSION_KEY, JSON.stringify(session));
      history.replaceState(null, '', `/?salon=${message.room}`);
      reconnectUntil = 0;
      connectionBanner.hidden = true;
      setText(homeError, '');
      setText(roomCodeText, message.room);
      setText(inviteLinkText, inviteLink(message.room));
      return;
    case 'lobby':
      lobby = message;
      renderLobby();
      decideScreen();
      return;
    case 'snapshot': {
      const previousState = snapshots.latest();
      if (screen === 'game') {
        for (const event of soundEvents(previousState, message.match, mySeat())) audio.play(event);
      }
      snapshots.push(message.match, performance.now());
      decideScreen();
      return;
    }
    case 'pong':
      latencies.push(performance.now() - message.sent);
      if (latencies.length > 20) latencies.shift();
      return;
    case 'error':
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

  const othersReady = players.filter((player) => player.id !== lobby?.host).every((player) => player.ready);
  const allHere = players.every((player) => player.connected);
  readyButton.hidden = isHost;
  readyButton.textContent = me?.ready ? 'Prêt ✓ (annuler)' : 'Je suis prêt';
  startButton.hidden = !isHost;
  startButton.disabled = players.length < MIN_PLAYERS || !othersReady || !allHere;

  let hint = '';
  if (players.length < MIN_PLAYERS) hint = 'Partagez le lien : il faut au moins 2 joueurs.';
  else if (!allHere) hint = 'Un joueur se reconnecte…';
  else if (isHost && !othersReady) hint = 'En attente que tout le monde soit prêt.';
  else if (!isHost) hint = me?.ready ? 'L’hôte va lancer la partie.' : 'Appuyez sur « Je suis prêt ».';
  setText(lobbyHint, hint);
  setText(skinHint, 'Touchez votre personnage pour changer d’apparence.');
  setText(lobbyError, '');
}

function arenaLabel(choice: ArenaChoice): string {
  return choice === 'rotation' ? 'Une différente à chaque manche' : ARENA_NAMES[choice];
}

function lobbyRow(player: LobbyPlayer, index: number, host: boolean, self: boolean): HTMLLIElement {
  const item = document.createElement('li');
  const avatar = document.createElement('canvas');
  avatar.className = 'avatar';
  const name = document.createElement('span');
  name.className = 'player-name';
  name.textContent = `${player.name}${self ? ' (vous)' : ''}`;
  const character = document.createElement('span');
  character.className = 'player-tag';
  character.textContent = player.skin ? `${PLAYER_LOOKS[index].name} ${SKIN_NAMES[player.skin]}` : PLAYER_LOOKS[index].name;
  const status = document.createElement('span');
  status.className = 'player-tag';
  if (!player.connected) {
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
  if (self) {
    // Son propre personnage : le toucher fait défiler ses apparences.
    const skinButton = document.createElement('button');
    skinButton.type = 'button';
    skinButton.className = 'avatar-btn';
    skinButton.setAttribute('aria-label', `Changer d'apparence (actuelle : ${SKIN_NAMES[player.skin]})`);
    skinButton.append(avatar);
    skinButton.addEventListener('click', () => {
      connection?.send({ type: 'skin', skin: (player.skin + 1) % SKIN_COUNT });
      audio.playClick();
    });
    item.append(skinButton, name, character, status);
  } else {
    item.append(avatar, name, character, status);
  }
  requestAnimationFrame(() => drawAvatar(avatar, index, player.skin));
  return item;
}

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
  const key = JSON.stringify([match.scores, match.round.players.map((player) => player.alive), [...names], me, match.skins]);
  if (key === renderedScoresKey) return;
  renderedScoresKey = key;
  scoresList.dataset.count = String(match.round.players.length);
  scoresList.replaceChildren(
    ...match.round.players.map((player) => {
      const item = document.createElement('li');
      if (player.id === me) item.classList.add('me');
      if (!player.alive) item.classList.add('out');
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
      requestAnimationFrame(() => drawAvatar(avatar, player.id, match.skins?.[player.id] ?? 0));
      return item;
    }),
  );
}

function seatName(seat: number | null): string {
  if (seat === null || !lobby) return '';
  const player = lobby.players.find((candidate) => lobby?.seats[candidate.id] === seat);
  return player?.name ?? PLAYER_LOOKS[seat].name;
}

function formatClock(ticks: number): string {
  const seconds = Math.ceil(ticks / TICK_RATE);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function updateGameHud(match: MatchState): void {
  renderScores(match);
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
  renderPowers(mine);
  detonateButton.hidden = !(mine?.alive && mine.detonator && match.phase === 'playing');

  const remaining = SUDDEN_DEATH_TICKS - match.round.tick;
  setText(timer, remaining > 0 ? formatClock(remaining) : 'Le mur avance !');
  timer.classList.toggle('danger', remaining <= 10 * TICK_RATE);

  let title = '';
  let subtitle = '';
  if (match.phase === 'roundOver') {
    if (match.roundWinner === null) title = 'Égalité !';
    else title = match.roundWinner === me ? 'Manche gagnée !' : `${seatName(match.roundWinner)} gagne la manche`;
    subtitle = `Manche ${match.roundNumber} · ${match.scores.join(' – ')}`;
  } else if (match.phase === 'matchOver') {
    title = match.matchWinner === me ? 'Victoire !' : `${seatName(match.matchWinner)} remporte le match`;
    subtitle = match.scores.join(' – ');
  } else if (match.phase === 'playing' && me !== null && !match.round.players[me]?.alive) {
    title = 'Éliminé !';
    subtitle = 'Regardez la fin de la manche…';
  } else if (match.phase === 'countdown') {
    subtitle = `Manche ${match.roundNumber}`;
  }
  banner.hidden = title === '';
  // Pendant le compte à rebours, le numéro de manche s'affiche sous les chiffres.
  if (match.phase === 'countdown') banner.hidden = true;
  setText(bannerText, title);
  setText(bannerSub, subtitle);
  backButton.hidden = match.phase !== 'matchOver';
  feedbackEndButton.hidden = match.phase !== 'matchOver';
}

let detonateRequested = false;
detonateButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  detonateRequested = true;
  audio.playDetonateClick();
});

// ---- Bonus du joueur ----

let renderedPowersKey = '';

/** Rangée des bonus de ce joueur : niveaux de portée, de bombes et de vitesse, puis pouvoirs. */
function renderPowers(player: Player | undefined): void {
  const entries: Array<[Bonus, string]> = [];
  if (player) {
    entries.push([Bonus.Flame, String(player.range)]);
    entries.push([Bonus.Bomb, String(player.maxBombs)]);
    const speedLevel = Math.round((player.speed - BASE_SPEED) / SPEED_STEP);
    if (speedLevel > 0) entries.push([Bonus.Speed, `+${speedLevel}`]);
    if (player.vest) entries.push([Bonus.Vest, '']);
    if (player.detonator) entries.push([Bonus.Detonator, '']);
    if (player.kick) entries.push([Bonus.Kick, '']);
    if (player.bombPass) entries.push([Bonus.BombPass, '']);
    if (player.wallPass) entries.push([Bonus.WallPass, '']);
  }
  const key = JSON.stringify(entries);
  if (key === renderedPowersKey) return;
  renderedPowersKey = key;
  // Rien à montrer tant que le joueur n'a que ses caractéristiques de départ.
  const upgraded =
    player && (player.range > BASE_RANGE || player.maxBombs > BASE_MAX_BOMBS || entries.length > 2);
  powers.replaceChildren(
    ...(upgraded ? entries : []).map(([bonus, level]) => {
      const chip = document.createElement('span');
      chip.className = 'power';
      chip.title = BONUS_INFO[bonus as Exclude<Bonus, 0>].name;
      const icon = document.createElement('canvas');
      icon.className = 'power-icon';
      chip.append(icon);
      if (level) {
        const text = document.createElement('span');
        text.textContent = level;
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
  const playing = screen === 'game' && match?.phase === 'playing';
  // Le joueur pousse selon ce qu'il voit : si l'arène est affichée pivotée,
  // la direction à l'écran est convertie en direction dans l'arène.
  const pushed = playing ? (touch.direction() ?? keyboard.direction()) : null;
  const direction = pushed && screenToGrid(pushed, renderer.rotated);
  if (direction !== lastSentDirection) {
    connection.send({ type: 'input', direction });
    lastSentDirection = direction;
  }
  if (playing && (touchBomb || keyBomb)) connection.send({ type: 'bomb' });
  if (playing && detonate) connection.send({ type: 'detonate' });
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
  connect(() => connection?.send({ type: 'create', name }));
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
  connect(() => connection?.send({ type: 'join', room, name }));
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

backButton.addEventListener('click', () => {
  viewingResults = false;
  show('lobby');
});

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
  setText(homeError, '');
  // Arrivée par un lien d'invitation : « Rejoindre » devient l'action principale.
  homeCard.classList.add('invited');
  required<HTMLElement>('#invite-banner').hidden = false;
  setText(required<HTMLElement>('#invite-code'), invited);
  required<HTMLButtonElement>('#join-btn').textContent = 'Rejoindre le salon';
}

drawMascot(required<HTMLCanvasElement>('#mascot'));
applyScreenAmbience();
requestAnimationFrame(frameLoop);

if (import.meta.env.DEV) {
  // Accès à l'état pour les vérifications automatisées en développement.
  Object.assign(window, {
    boomz: {
      getMatch: () => snapshots.latest(),
      getLobby: () => lobby,
      /** Injecte un état, pour vérifier l'affichage de situations rares (bonus, détonateur). */
      inject: (match: MatchState) => snapshots.push(match, performance.now()),
    },
  });
}
