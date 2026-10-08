import { CourseIntro } from './intro-course';
import { FuseIntro } from './intro-fuse';
import { MazeIntro } from './intro-maze';
import { ShatterIntro } from './intro-shatter';
import type { IntroOptions } from './intro-base';

export type { IntroOptions } from './intro-base';

/** Les intros possibles au lancement (voir chaque scène). */
const STYLES = { course: CourseIntro, meche: FuseIntro, poursuite: MazeIntro, eclats: ShatterIntro };
export type IntroStyle = keyof typeof STYLES;

export function isIntroStyle(value: string | null): value is IntroStyle {
  return value !== null && Object.hasOwn(STYLES, value);
}

/**
 * Intro au lancement, par-dessus l'accueil : elle fait apparaître le titre
 * BOOMZ à l'endroit exact où il se trouve sur l'accueil, puis s'efface. Un
 * toucher la passe ; aucune intro si l'utilisateur réduit les animations.
 *
 * La promesse se résout quand l'accueil commence à apparaître (musique et
 * fond animé peuvent alors démarrer).
 */
export function playIntro(options: IntroOptions, style: IntroStyle = 'course'): Promise<void> {
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (still) return Promise.resolve();
  return new Promise((resolve) => new STYLES[style](options, resolve).start());
}
