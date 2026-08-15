/**
 * Paliers de rappel, exprimés en jours restants avant l'échéance.
 *
 * Ordre croissant : c'est le premier palier supérieur ou égal au nombre de
 * jours restants qui s'applique.
 */
export const REMINDER_OFFSETS = [0, 1, 7, 30] as const;

/** Ramène une date au début de sa journée, pour compter en jours pleins. */
function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function daysUntil(dueDate: Date, now: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round(
    (startOfDay(dueDate).getTime() - startOfDay(now).getTime()) / MS_PER_DAY,
  );
}

/**
 * Palier applicable, ou null si l'échéance est encore trop lointaine.
 *
 * Le palier retenu est le plus petit qui couvre le nombre de jours restants :
 * à douze jours de l'échéance, c'est celui de trente jours. Un rappel manqué —
 * service arrêté, échéance créée tardivement — est donc rattrapé à la tournée
 * suivante au lieu d'être perdu.
 */
export function reminderOffsetFor(daysLeft: number): number | null {
  return REMINDER_OFFSETS.find((offset) => offset >= daysLeft) ?? null;
}

export function formatDueDate(dueDate: Date): string {
  return dueDate.toISOString().slice(0, 10);
}

/** Formulation du rappel, adaptée à l'urgence réelle. */
export function reminderMessage(
  title: string,
  dueDate: Date,
  daysLeft: number,
): string {
  const date = formatDueDate(dueDate);
  if (daysLeft < 0) {
    return `« ${title} » est dépassée depuis le ${date}.`;
  }
  if (daysLeft === 0) {
    return `« ${title} » arrive à échéance aujourd'hui.`;
  }
  if (daysLeft === 1) {
    return `« ${title} » arrive à échéance demain, le ${date}.`;
  }
  return `« ${title} » arrive à échéance dans ${daysLeft} jours, le ${date}.`;
}
