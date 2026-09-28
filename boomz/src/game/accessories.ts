/** Un accessoire porté par le personnage (cosmétique, sans effet sur le jeu). */
export interface AccessoryInfo {
  name: string;
  /** Étoiles des défis nécessaires pour le débloquer (0 : dès le départ). */
  stars: number;
}

/** Accessoires, dans l'ordre d'affichage ; le premier est « aucun ». */
export const ACCESSORIES: readonly AccessoryInfo[] = [
  { name: 'Aucun', stars: 0 },
  { name: 'Lunettes noires', stars: 0 },
  { name: 'Nœud papillon', stars: 0 },
  { name: 'Moustache', stars: 3 },
  { name: 'Cache-œil', stars: 6 },
  { name: 'Écharpe', stars: 10 },
  { name: 'Casque audio', stars: 15 },
  { name: 'Couronne', stars: 24 },
];

export const Accessory = {
  None: 0,
  Sunglasses: 1,
  BowTie: 2,
  Moustache: 3,
  EyePatch: 4,
  Scarf: 5,
  Headphones: 6,
  Crown: 7,
} as const;

export function isAccessory(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < ACCESSORIES.length;
}

/** Accessoire débloqué avec ce nombre d'étoiles ? */
export function accessoryUnlocked(accessory: number, stars: number): boolean {
  return isAccessory(accessory) && stars >= ACCESSORIES[accessory].stars;
}
