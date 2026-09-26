import type { SoundEvent } from './audio/events';
import type { MatchState } from './game/match';

export type TutorialStep = 'move' | 'bomb' | 'flee' | 'kick' | 'fight' | 'done';

/** Au bout de ce délai, l'astuce de la poussée laisse place à la suite (ms). */
const KICK_TIP_MS = 9000;
/** Durée du dernier conseil avant que le tutoriel ne s'efface (ms). */
const FIGHT_TIP_MS = 6000;
/** Distance à parcourir pour valider l'étape « bouger » (en cases). */
const MOVE_DISTANCE = 1.5;

/**
 * Tutoriel de la première partie, contre un robot : bouger, poser une bombe,
 * s'abriter, pousser une bombe, puis jouer. Chaque étape se valide en la
 * faisant, d'après les états reçus.
 */
export class Tutorial {
  step: TutorialStep = 'move';
  /** Éliminé par sa propre bombe pendant l'étape « s'abriter ». */
  caught = false;
  private start: { x: number; y: number; round: number } | null = null;
  private stepAt = 0;
  private readonly touch: boolean;

  constructor(touch: boolean) {
    this.touch = touch;
  }

  /** Avance d'après ce qui vient de se passer ; renvoie vrai si l'étape a changé. */
  update(match: MatchState, me: number | null, events: SoundEvent[], now: number): boolean {
    const before = this.step;
    if (this.stepAt === 0) this.stepAt = now;
    const player = me === null ? undefined : match.round.players[me];
    const has = (kind: SoundEvent['kind'], mine?: boolean) =>
      events.some((event) => event.kind === kind && (mine === undefined || ('mine' in event && event.mine === mine)));

    // Match terminé : le tutoriel s'efface devant l'écran de victoire.
    if (match.phase === 'matchOver') this.go('done', now);

    switch (this.step) {
      case 'move':
        // Bombe posée d'emblée : l'étape « bouger » est sautée.
        if (has('bombPlaced', true)) {
          this.go('flee', now);
          break;
        }
        if (!player?.alive || match.phase !== 'playing') break;
        if (!this.start || this.start.round !== match.roundNumber) {
          this.start = { x: player.x, y: player.y, round: match.roundNumber };
        } else if (Math.hypot(player.x - this.start.x, player.y - this.start.y) >= MOVE_DISTANCE) {
          this.go('bomb', now);
        }
        break;
      case 'bomb':
        if (has('bombPlaced', true)) this.go('flee', now);
        break;
      case 'flee':
        if (has('death', true)) {
          this.caught = true;
          this.go('kick', now);
        } else if (has('explosion')) this.go('kick', now);
        break;
      case 'kick':
        if (has('kick') || now - this.stepAt > KICK_TIP_MS) this.go('fight', now);
        break;
      case 'fight':
        if (now - this.stepAt > FIGHT_TIP_MS) this.go('done', now);
        break;
    }
    return this.step !== before;
  }

  private go(step: TutorialStep, now: number): void {
    this.step = step;
    this.stepAt = now;
  }

  /** Numéro de l'étape (de 1 à 5), pour l'indicateur de progression. */
  get index(): number {
    return ['move', 'bomb', 'flee', 'kick', 'fight', 'done'].indexOf(this.step) + 1;
  }

  get text(): string {
    switch (this.step) {
      case 'move':
        return this.touch
          ? 'Posez le pouce à gauche de l’écran et glissez pour bouger.'
          : 'Utilisez les flèches (ou ZQSD) pour bouger.';
      case 'bomb':
        return this.touch ? 'Touchez le bouton « Bombe » pour poser une bombe.' : 'Appuyez sur Espace pour poser une bombe.';
      case 'flee':
        return 'Vite, à l’abri ! L’explosion part en croix : changez de couloir.';
      case 'kick':
        return this.caught
          ? 'Oups ! Restez hors de la croix des flammes. Astuce : marchez sur votre bombe pour la pousser.'
          : 'Bien joué ! Astuce : marchez sur votre bombe pour la pousser.';
      case 'fight':
        return 'Cassez les caisses pour trouver des bonus, et éliminez le robot !';
      case 'done':
        return '';
    }
  }
}
