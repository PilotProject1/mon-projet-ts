import type { Direction } from '../game/types';

interface KeyLayout {
  directions: Record<string, Direction>;
  bomb: string[];
}

// `code` désigne la position physique de la touche : ZQSD sur un clavier
// AZERTY correspond à WASD sur un clavier QWERTY.
const LAYOUTS: KeyLayout[] = [
  { directions: { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' }, bomb: ['Space', 'KeyE'] },
  {
    directions: { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' },
    bomb: ['Enter', 'NumpadEnter', 'ShiftRight'],
  },
];

export class KeyboardInput {
  /** Directions tenues par joueur, la plus récente en dernier. */
  private held: Direction[][] = LAYOUTS.map(() => []);
  private bombRequested: boolean[] = LAYOUTS.map(() => false);

  constructor(target: Window) {
    target.addEventListener('keydown', (event) => this.onKey(event, true));
    target.addEventListener('keyup', (event) => this.onKey(event, false));
    target.addEventListener('blur', () => {
      this.held = LAYOUTS.map(() => []);
    });
  }

  private onKey(event: KeyboardEvent, down: boolean): void {
    LAYOUTS.forEach((layout, player) => {
      const direction = layout.directions[event.code];
      if (direction) {
        event.preventDefault();
        this.held[player] = this.held[player].filter((held) => held !== direction);
        if (down) this.held[player].push(direction);
      } else if (layout.bomb.includes(event.code)) {
        event.preventDefault();
        if (down && !event.repeat) this.bombRequested[player] = true;
      }
    });
  }

  direction(player: number): Direction | null {
    const held = this.held[player] ?? [];
    return held.length > 0 ? held[held.length - 1] : null;
  }

  /** Renvoie vrai une seule fois par appui. */
  consumeBomb(player: number): boolean {
    const requested = this.bombRequested[player] ?? false;
    this.bombRequested[player] = false;
    return requested;
  }
}
