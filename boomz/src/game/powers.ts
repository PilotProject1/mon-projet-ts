import { TICK_RATE } from './constants';

export type Category = 'Attaque' | 'Mobilité' | 'Défense / Contrôle' | 'Technique';

export interface CharacterInfo {
  name: string;
  category: Category;
  /** Nom du pouvoir. */
  power: string;
  /** Ce que fait le pouvoir, en une phrase (écran de choix du personnage). */
  description: string;
  /** Temps de recharge après utilisation (ticks). */
  cooldown: number;
}

/**
 * Personnages jouables et leur pouvoir (planche docs/personnages.jpg). Chaque
 * pouvoir est une capacité active avec temps de recharge ; tous sont
 * disponibles pour tout le monde. Premier lot de 8 sur les 20 de la planche.
 */
export const CHARACTERS: readonly CharacterInfo[] = [
  { name: 'Boomer', category: 'Attaque', power: 'Surcharge', description: 'Pendant 6 secondes, ses bombes portent 2 cases plus loin.', cooldown: 16 * TICK_RATE },
  { name: 'Blaster', category: 'Attaque', power: 'Mise à feu', description: 'Fait exploser presque aussitôt toutes ses bombes posées.', cooldown: 12 * TICK_RATE },
  { name: 'Frost', category: 'Défense / Contrôle', power: 'Gel', description: 'Gèle sur place les adversaires proches pendant 1,5 seconde.', cooldown: 18 * TICK_RATE },
  { name: 'Toxic', category: 'Défense / Contrôle', power: 'Zone toxique', description: 'Pendant 6 secondes, ses explosions laissent un nuage toxique qui ne le touche pas.', cooldown: 18 * TICK_RATE },
  { name: 'Boomette', category: 'Technique', power: 'Doppelbombe', description: 'Pose un leurre identique à une vraie bombe, qui n’explose pas.', cooldown: 10 * TICK_RATE },
  { name: 'Omega', category: 'Technique', power: 'Copie', description: 'Utilise le pouvoir de l’adversaire le plus proche.', cooldown: 16 * TICK_RATE },
  { name: 'Rocket', category: 'Mobilité', power: 'Dash', description: 'Fonce de 3 cases tout droit, en passant par-dessus les bombes.', cooldown: 7 * TICK_RATE },
  { name: 'Rocco', category: 'Défense / Contrôle', power: 'Carapace', description: 'Résiste aux explosions pendant 3 secondes, mais avance lentement.', cooldown: 15 * TICK_RATE },
];

export const CHARACTER_COUNT = CHARACTERS.length;

/** Numéros des personnages, pour la lisibilité du code des pouvoirs. */
export const Hero = {
  Boomer: 0,
  Blaster: 1,
  Frost: 2,
  Toxic: 3,
  Boomette: 4,
  Omega: 5,
  Rocket: 6,
  Rocco: 7,
} as const;

/** Pouvoir disponible quelques secondes après le début de la manche, pas dès le « Go ». */
export const POWER_START_TICKS = 4 * TICK_RATE;
export const SURCHARGE_TICKS = 6 * TICK_RATE;
/** Mèche des bombes de Blaster après sa Mise à feu. */
export const BLAST_FUSE_TICKS = Math.round(TICK_RATE / 3);
export const SURCHARGE_RANGE = 2;
export const FREEZE_RADIUS = 2.5;
export const FREEZE_TICKS = Math.round(1.5 * TICK_RATE);
export const TOXIC_POWER_TICKS = 6 * TICK_RATE;
/** Durée d'un nuage toxique laissé par une explosion. */
export const TOXIC_CLOUD_TICKS = 2 * TICK_RATE;
export const DASH_CELLS = 3;
export const DASH_SPEED = 12 / TICK_RATE;
export const DASH_TICKS = Math.ceil(DASH_CELLS / DASH_SPEED);
export const SHELL_TICKS = 3 * TICK_RATE;
/** Vitesse de Rocco sous sa carapace, en proportion de la normale. */
export const SHELL_SLOWDOWN = 0.55;

/** Personnage par défaut d'une place (joueurs qui n'ont rien choisi). */
export function defaultCharacter(seat: number): number {
  return seat % 6;
}

export function isCharacter(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < CHARACTER_COUNT;
}
