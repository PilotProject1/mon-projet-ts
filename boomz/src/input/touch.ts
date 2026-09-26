import type { Direction } from '../game/types';

const DEAD_ZONE = 14; // px
const KNOB_TRAVEL = 36; // px

/**
 * Manette tactile : un joystick flottant (il apparaît sous le pouce) et un
 * bouton bombe. Chaque contact est suivi par son `pointerId`, ce qui permet
 * de bouger et de poser une bombe en même temps avec deux pouces.
 */
export class TouchPad {
  private stickPointer: number | null = null;
  private origin = { x: 0, y: 0 };
  private currentDirection: Direction | null = null;
  private bombRequested = false;
  private readonly zone: HTMLElement;
  private readonly base: HTMLElement;
  private readonly knob: HTMLElement;

  constructor(zone: HTMLElement, base: HTMLElement, knob: HTMLElement, bombButton: HTMLElement) {
    this.zone = zone;
    this.base = base;
    this.knob = knob;
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
    this.base.style.left = `${event.clientX - rect.left}px`;
    this.base.style.top = `${event.clientY - rect.top}px`;
    this.base.classList.add('active');
    this.updateKnob(0, 0);
  }

  private onStickMove(event: PointerEvent): void {
    if (event.pointerId !== this.stickPointer) return;
    const dx = event.clientX - this.origin.x;
    const dy = event.clientY - this.origin.y;
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

  direction(): Direction | null {
    return this.currentDirection;
  }

  consumeBomb(): boolean {
    const requested = this.bombRequested;
    this.bombRequested = false;
    return requested;
  }
}
