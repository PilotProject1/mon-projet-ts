import { BudgetIaService } from './budget-ia.service';

/**
 * Le plafond borne ce qu'un outil ouvert sans compte peut dépenser en une
 * journée. Une erreur ici se paie en facture, pas en bogue visible.
 */
describe('BudgetIaService', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, RESILIATION_IA_MAX_PAR_JOUR: '3' };
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.useRealTimers();
  });

  it('accorde les appels jusqu’au plafond, puis les refuse', () => {
    const budget = new BudgetIaService();
    expect([budget.reserver(), budget.reserver(), budget.reserver()]).toEqual([
      true,
      true,
      true,
    ]);
    expect(budget.reserver()).toBe(false);
    expect(budget.reserver()).toBe(false);
  });

  it('repart de zéro au changement de jour', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-10T23:59:00Z'));
    const budget = new BudgetIaService();
    budget.reserver();
    budget.reserver();
    budget.reserver();
    expect(budget.reserver()).toBe(false);

    jest.setSystemTime(new Date('2026-03-11T00:01:00Z'));
    expect(budget.reserver()).toBe(true);
    expect(budget.etat()).toMatchObject({ jour: '2026-03-11', consommes: 1 });
  });

  /*
   * Un plafond à zéro doit tout refuser plutôt que d'être pris pour une
   * valeur absente : c'est ainsi qu'on coupe la dépense en urgence, sans
   * redéploiement.
   */
  it('refuse tout appel quand le plafond vaut zéro', () => {
    process.env.RESILIATION_IA_MAX_PAR_JOUR = '0';
    expect(new BudgetIaService().reserver()).toBe(false);
  });

  it('retombe sur la valeur par défaut si la variable est illisible', () => {
    process.env.RESILIATION_IA_MAX_PAR_JOUR = 'beaucoup';
    expect(new BudgetIaService().etat().max).toBe(200);
  });
});
