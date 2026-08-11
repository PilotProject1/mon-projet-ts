import { DeadlineStatus } from '@prisma/client';

export type DeadlinePriority = 'basse' | 'moyenne' | 'haute';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeDeadlinePriority(
  dueDate: Date,
  status: DeadlineStatus,
  now: Date = new Date(),
): DeadlinePriority {
  if (status === 'terminee') {
    return 'basse';
  }

  const daysUntilDue = (dueDate.getTime() - now.getTime()) / MS_PER_DAY;

  if (daysUntilDue <= 3) {
    return 'haute';
  }
  if (daysUntilDue <= 14) {
    return 'moyenne';
  }
  return 'basse';
}
