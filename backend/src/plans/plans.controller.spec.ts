import { PlansController } from './plans.controller';

/**
 * Le catalogue sert de source unique aux prix affichés. Il doit dire non
 * seulement ce que coûte une offre, mais ce qu'on peut réellement souscrire :
 * annoncer une formule annuelle dont le tarif n'existe pas chez Stripe mène
 * le client à un paiement refusé, après avoir choisi.
 */
describe('PlansController — catalogue', () => {
  const OLD_ENV = process.env;
  const controller = new PlansController({} as any);

  /** Périodicités souscriptibles annoncées pour une offre. */
  function intervalles(plan: string): string[] {
    const entree = controller
      .getCatalogue()
      .plans.find((p) => p.plan === plan)!;
    return entree.purchasableIntervals;
  }

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.STRIPE_PRICE_PREMIUM;
    delete process.env.STRIPE_PRICE_PRO;
    delete process.env.STRIPE_PRICE_PREMIUM_ANNUEL;
    delete process.env.STRIPE_PRICE_PRO_ANNUEL;
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('n’annonce que les périodicités dont le tarif est configuré', () => {
    process.env.STRIPE_PRICE_PREMIUM = 'price_m';
    expect(intervalles('premium')).toEqual(['mensuel']);
  });

  it('annonce l’annuel dès que son tarif existe', () => {
    process.env.STRIPE_PRICE_PREMIUM = 'price_m';
    process.env.STRIPE_PRICE_PREMIUM_ANNUEL = 'price_a';
    expect(intervalles('premium')).toEqual(['mensuel', 'annuel']);
  });

  it('n’annonce rien quand le paiement n’est pas configuré', () => {
    expect(intervalles('premium')).toEqual([]);
    expect(intervalles('pro')).toEqual([]);
  });

  it('laisse le plan gratuit hors du champ des périodicités', () => {
    process.env.STRIPE_PRICE_PREMIUM_ANNUEL = 'price_a';
    expect(intervalles('gratuit')).toEqual([]);
  });

  /*
   * Le prix annuel reste annoncé même quand il n'est pas souscriptible : il
   * décrit l'offre, tandis que purchasableIntervals décrit ce que le bouton
   * peut faire. Les confondre effacerait le tarif des pages publiques.
   */
  it('continue d’annoncer le prix annuel du catalogue', () => {
    const premium = controller
      .getCatalogue()
      .plans.find((p) => p.plan === 'premium')!;
    expect(premium.yearlyPrice).toBe(49.9);
    expect(premium.purchasableIntervals).toEqual([]);
  });
});
