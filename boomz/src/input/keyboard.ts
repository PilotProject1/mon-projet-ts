import type { Direction } from '../game/types';

// `code` désigne la position physique de la touche : ZQSD sur un clavier
// AZERTY correspond à WASD sur un clavier QWERTY.
const DIRECTION_KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};
const BOMB_KEYS = ['Space', 'Enter', 'NumpadEnter'];
/** Déclenchement des bombes (bonus Détonateur). */
const DETONATE_KEYS = ['KeyE', 'ShiftLeft', 'ShiftRight'];
/** Pouvoir du personnage. */
const POWER_KEYS = ['KeyF', 'KeyR'];

/** Clavier, pour jouer depuis un ordinateur. */
export class KeyboardInput {
  /** Directions tenues, la plus récente en dernier. */
  private held: Direction[] = [];
  private bombRequested = false;
  private detonateRequested = false;
  private powerRequested = false;

  constructor(target: Window) {
    target.addEventListener('keydown', (event) => this.onKey(event, true));
    target.addEventListener('keyup', (event) => this.onKey(event, false));
    target.addEventListener('blur', () => {
      this.held = [];
    });
  }

  private onKey(event: KeyboardEvent, down: boolean): void {
    // Champs de saisie, boutons et liens gardent leur comportement habituel.
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) {
      return;
    }
    const direction = DIRECTION_KEYS[event.code];
    if (direction) {
      event.preventDefault();
      this.held = this.held.filter((held) => held !== direction);
      if (down) this.held.push(direction);
    } else if (BOMB_KEYS.includes(event.code)) {
      event.preventDefault();
      if (down && !event.repeat) this.bombRequested = true;
    } else if (DETONATE_KEYS.includes(event.code)) {
      event.preventDefault();
      if (down && !event.repeat) this.detonateRequested = true;
    } else if (POWER_KEYS.includes(event.code)) {
      event.preventDefault();
      if (down && !event.repeat) this.powerRequested = true;
    }
  }

  direction(): Direction | null {
    return this.held.length > 0 ? this.held[this.held.length - 1] : null;
  }

  /** Renvoie vrai une seule fois par appui. */
  consumeBomb(): boolean {
    const requested = this.bombRequested;
    this.bombRequested = false;
    return requested;
  }

  consumePower(): boolean {
    const requested = this.powerRequested;
    this.powerRequested = false;
    return requested;
  }

  consumeDetonate(): boolean {
    const requested = this.detonateRequested;
    this.detonateRequested = false;
    return requested;
  }
}
