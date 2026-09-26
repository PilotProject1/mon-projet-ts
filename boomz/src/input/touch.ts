import type { Direction } from '../game/types';

const DEAD_ZONE = 14; // px
const KNOB_TRAVEL = 36; // px

const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/**
 * Manette tactile d'un joueur : un joystick flottant (il apparaît sous le
 * pouce) et un bouton bombe. Chaque contact est suivi par son `pointerId`,
 * ce qui permet à deux joueurs de jouer en même temps sur le même écran.
 */
export class TouchPad {
  private stickPointer: number | null = null;
  private origin = { x: 0, y: 0 };
  private currentDirection: Direction | null = null;
  private bombRequested = false;
  private readonly zone: HTMLElement;
  private readonly base: HTMLElement;
  private readonly knob: HTMLElement;
  /** Vrai quand la manette est retournée (joueur assis en face, écran en portrait). */
  private readonly isFlipped: () => boolean;

  constructor(zone: HTMLElement, base: HTMLElement, knob: HTMLElement, bombButton: HTMLElement, isFlipped: () => boolean) {
    this.zone = zone;
    this.base = base;
    this.knob = knob;
    this.isFlipped = isFlipped;
    zone.addEventListener('pointerdown', (event) => this.onStickDown(event));
    zone.addEventListener('pointermove', (event) => this.onStickMove(event));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      zone.addEventListener(type, (event) => this.onStickUp(event));
    }
    bombButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.bombRequested = true;
      bombButton.classList.add('pressed');
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      bombButton.addEventListener(type, () => bombButton.classList.remove('pressed'));
    }
  }

  private onStickDown(event: PointerEvent): void {
    if (this.stickPointer !== null) return;
    event.preventDefault();
    this.stickPointer = event.pointerId;
    this.zone.setPointerCapture(event.pointerId);
    this.origin = { x: event.clientX, y: event.clientY };
    const rect = this.zone.getBoundingClientRect();
    // Le joystick est placé en coordonnées locales : dans une manette retournée
    // de 180°, le point local correspond au point symétrique à l'écran.
    const localX = this.isFlipped() ? rect.right - event.clientX : event.clientX - rect.left;
    const localY = this.isFlipped() ? rect.bottom - event.clientY : event.clientY - rect.top;
    this.base.style.left = `${localX}px`;
    this.base.style.top = `${localY}px`;
    this.base.classList.add('active');
    this.updateKnob(0, 0);
  }

  private onStickMove(event: PointerEvent): void {
    if (event.pointerId !== this.stickPointer) return;
    let dx = event.clientX - this.origin.x;
    let dy = event.clientY - this.origin.y;
    if (this.isFlipped()) {
      dx = -dx;
      dy = -dy;
    }
    const length = Math.hypot(dx, dy);
    const clamped = Math.min(length, KNOB_TRAVEL);
    this.updateKnob(length > 0 ? (dx / length) * clamped : 0, length > 0 ? (dy / length) * clamped : 0);
    if (length < DEAD_ZONE) {
      this.currentDirection = null;
    } else if (Math.abs(dx) > Math.abs(dy)) {
      this.currentDirection = dx > 0 ? 'right' : 'left';
    } else {
      this.currentDirection = dy > 0 ? 'down' : 'up';
    }
  }

  private onStickUp(event: PointerEvent): void {
    if (event.pointerId !== this.stickPointer) return;
    this.stickPointer = null;
    this.currentDirection = null;
    this.base.classList.remove('active');
    this.base.style.left = '';
    this.base.style.top = '';
    this.updateKnob(0, 0);
  }

  private updateKnob(x: number, y: number): void {
    this.knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  }

  /** Direction dans le repère de l'arène (et non de la manette). */
  direction(): Direction | null {
    if (!this.currentDirection) return null;
    return this.isFlipped() ? OPPOSITE[this.currentDirection] : this.currentDirection;
  }

  consumeBomb(): boolean {
    const requested = this.bombRequested;
    this.bombRequested = false;
    return requested;
  }
}
