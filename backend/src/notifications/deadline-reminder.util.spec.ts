import {
  daysUntil,
  reminderMessage,
  reminderOffsetFor,
} from './deadline-reminder.util';

describe('deadline-reminder.util', () => {
  const jour = 24 * 60 * 60 * 1000;
  // Milieu de journée : le décompte doit ignorer l'heure.
  const maintenant = new Date('2026-08-14T14:30:00Z');
  const dans = (n: number) => new Date(maintenant.getTime() + n * jour);

  describe('daysUntil', () => {
    it('compte en jours pleins, quelle que soit l’heure', () => {
      expect(daysUntil(new Date('2026-08-14T23:59:00Z'), maintenant)).toBe(0);
      expect(daysUntil(new Date('2026-08-15T00:01:00Z'), maintenant)).toBe(1);
    });

    it('rend un nombre négatif pour une échéance dépassée', () => {
      expect(daysUntil(dans(-3), maintenant)).toBe(-3);
    });
  });

  describe('reminderOffsetFor', () => {
    it('retient le plus petit palier couvrant les jours restants', () => {
      expect(reminderOffsetFor(30)).toBe(30);
      expect(reminderOffsetFor(12)).toBe(30);
      expect(reminderOffsetFor(7)).toBe(7);
      expect(reminderOffsetFor(5)).toBe(7);
      expect(reminderOffsetFor(1)).toBe(1);
      expect(reminderOffsetFor(0)).toBe(0);
    });

    it('rattrape une échéance dépassée par le palier du jour même', () => {
      expect(reminderOffsetFor(-4)).toBe(0);
    });

    it('ignore une échéance encore trop lointaine', () => {
      expect(reminderOffsetFor(31)).toBeNull();
      expect(reminderOffsetFor(90)).toBeNull();
    });
  });

  describe('reminderMessage', () => {
    it('adapte la formulation à l’urgence', () => {
      expect(reminderMessage('Assurance', dans(12), 12)).toContain(
        'dans 12 jours',
      );
      expect(reminderMessage('Assurance', dans(1), 1)).toContain('demain');
      expect(reminderMessage('Assurance', dans(0), 0)).toContain("aujourd'hui");
      expect(reminderMessage('Assurance', dans(-2), -2)).toContain('dépassée');
    });

    it('reprend l’intitulé de l’échéance', () => {
      expect(reminderMessage('Contrôle technique', dans(7), 7)).toContain(
        'Contrôle technique',
      );
    });
  });
});
