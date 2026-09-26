import './local.css';
import { COUNTDOWN_TICKS, SUDDEN_DEATH_TICKS, TICK_RATE, TICK_SECONDS, WINS_TO_TAKE_MATCH } from './game/constants';
import { createMatch, stepMatch, type MatchState } from './game/match';
import type { PlayerInput } from './game/types';
import { KeyboardInput } from './input/keyboard';
import { TouchPad } from './input/touch';
import { Renderer } from './render/renderer';

const PLAYER_COUNT = 2;
const TICK_MS = TICK_SECONDS * 1000;
/** Au retour d'un onglet en arrière-plan, on ne rattrape pas plus de 250 ms. */
const MAX_FRAME_MS = 250;

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Élément introuvable : ${selector}`);
  return element;
}

function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

const portrait = window.matchMedia('(orientation: portrait)');
const keyboard = new KeyboardInput(window);

const pads = Array.from({ length: PLAYER_COUNT }, (_, id) => {
  const root = required<HTMLElement>(document, `.pad[data-player="${id}"]`);
  return {
    touch: new TouchPad(
      required(root, '.stick-zone'),
      required(root, '.stick-base'),
      required(root, '.stick-knob'),
      required(root, '.bomb-btn'),
      // Seule la manette du joueur 2 est retournée, et seulement en portrait.
      () => id === 1 && portrait.matches,
    ),
    score: required<HTMLElement>(root, '.pad-score'),
    status: required<HTMLElement>(root, '.pad-status'),
  };
});

const canvas = required<HTMLCanvasElement>(document, '#arena');
const frame = required<HTMLElement>(document, '.board-frame');
const overlay = required<HTMLElement>(document, '#overlay');
const overlayText = required<HTMLElement>(document, '#overlay-text');
const overlayButton = required<HTMLButtonElement>(document, '#overlay-btn');
const countdown = required<HTMLElement>(document, '#countdown');
const timer = required<HTMLElement>(document, '.hud-timer');
const renderer = new Renderer(canvas);

// En attendant la première partie, on affiche une arène d'aperçu figée.
let match: MatchState = createMatch(PLAYER_COUNT, randomSeed());
let started = false;

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function startMatch(): void {
  match = createMatch(PLAYER_COUNT, randomSeed());
  started = true;
  overlay.hidden = true;
  // Le bouton « Jouer » garderait sinon Espace et Entrée pour lui.
  overlayButton.blur();
}

overlayButton.addEventListener('click', startMatch);

function collectInputs(): PlayerInput[] {
  return pads.map((pad, id) => {
    // Les deux sources sont vidées à chaque tick pour ne pas garder d'appui en réserve.
    const touchBomb = pad.touch.consumeBomb();
    const keyBomb = keyboard.consumeBomb(id);
    return {
      direction: pad.touch.direction() ?? keyboard.direction(id),
      bomb: touchBomb || keyBomb,
    };
  });
}

function playerStatus(id: number): string {
  if (!started) return '';
  switch (match.phase) {
    case 'countdown':
      return `Manche ${match.roundNumber}`;
    case 'playing':
      return match.round.players[id].alive ? '' : 'Éliminé !';
    case 'roundOver':
      if (match.roundWinner === null) return 'Égalité, on rejoue';
      return match.roundWinner === id ? 'Manche gagnée !' : 'Manche perdue';
    case 'matchOver':
      return match.matchWinner === id ? 'Victoire !' : 'Défaite';
  }
}

function formatClock(ticks: number): string {
  const seconds = Math.ceil(ticks / TICK_RATE);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function updateHud(): void {
  pads.forEach((pad, id) => {
    const wins = match.scores[id];
    setText(pad.score, '●'.repeat(wins) + '○'.repeat(WINS_TO_TAKE_MATCH - wins));
    setText(pad.status, playerStatus(id));
  });

  const showCountdown = started && (match.phase === 'countdown' || (match.phase === 'playing' && match.phaseTick < 40));
  countdown.hidden = !showCountdown;
  if (showCountdown) {
    setText(
      countdown,
      match.phase === 'countdown' ? String(Math.ceil((COUNTDOWN_TICKS - match.phaseTick) / TICK_RATE)) : 'Go !',
    );
  }

  timer.hidden = !started || match.phase === 'matchOver';
  const remaining = SUDDEN_DEATH_TICKS - match.round.tick;
  setText(timer, remaining > 0 ? formatClock(remaining) : 'Le mur avance !');
  timer.classList.toggle('danger', remaining <= 10 * TICK_RATE);

  if (started && match.phase === 'matchOver' && overlay.hidden) {
    overlayText.textContent = `Joueur ${(match.matchWinner ?? 0) + 1} remporte le match ${match.scores.join(' – ')}.`;
    overlayButton.textContent = 'Rejouer';
    overlay.hidden = false;
  }
}

let lastTime = performance.now();
let accumulator = 0;

function frameLoop(now: number): void {
  accumulator += Math.min(now - lastTime, MAX_FRAME_MS);
  lastTime = now;
  while (accumulator >= TICK_MS) {
    const inputs = collectInputs();
    if (started) stepMatch(match, inputs);
    accumulator -= TICK_MS;
  }
  renderer.render(match);
  updateHud();
  requestAnimationFrame(frameLoop);
}

new ResizeObserver(([entry]) => {
  const { width, height } = entry.contentRect;
  renderer.resize(width, height);
  renderer.render(match);
}).observe(frame);

document.addEventListener('visibilitychange', () => {
  lastTime = performance.now();
});

requestAnimationFrame(frameLoop);

if (import.meta.env.DEV) {
  // Accès à l'état pour les vérifications automatisées en développement.
  Object.assign(window, { boomz: { getMatch: () => match } });
}
