import { BillingService } from './billing.service';

/**
 * Une erreur de configuration Stripe est muette : un identifiant collé dans
 * la mauvaise variable reste valide, et le paiement aboutit — au mauvais
 * montant ou pour la mauvaise durée. Ce contrôle est le seul endroit où
 * l'écart entre le catalogue affiché et ce que Stripe facture peut être vu
 * avant qu'un client ne le découvre sur son relevé.
 */
describe('BillingService — contrôle des tarifs configurés', () => {
  const OLD_ENV = process.env;

  /** Tarif Stripe conforme au catalogue, sauf ce qu'on en surcharge. */
  function prix(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      active: true,
      currency: 'eur',
      unit_amount: 499,
      recurring: { interval: 'month' },
      ...overrides,
    };
  }

  function monter(prixParId: Record<string, unknown>) {
    const service = new BillingService({} as any);
    const retrieve = jest.fn((id: string) => {
      const p = prixParId[id];
      if (!p) {
        return Promise.reject(
          Object.assign(new Error('No such price'), {
            code: 'resource_missing',
          }),
        );
      }
      return Promise.resolve(p);
    });
    Object.defineProperty(service, 'stripe', {
      get: () => ({ prices: { retrieve } }),
    });
    return { service, retrieve };
  }

  beforeEach(() => {
    process.env = { ...OLD_ENV, STRIPE_SECRET_KEY: 'sk_test' };
    delete process.env.STRIPE_PRICE_PREMIUM;
    delete process.env.STRIPE_PRICE_PRO;
    delete process.env.STRIPE_PRICE_PREMIUM_ANNUEL;
    delete process.env.STRIPE_PRICE_PRO_ANNUEL;
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  /** Le contrôle d'un seul couple plan/périodicité, pour lire les cas. */
  async function controler(variable: string, valeur: string, catalogue: any) {
    process.env[variable] = valeur;
    const { service } = monter({ [valeur]: catalogue });
    const tous = await service.verifierTarifs();
    return tous.find((c) => c.variable === variable)!;
  }

  it('valide un tarif conforme au catalogue', async () => {
    const c = await controler('STRIPE_PRICE_PREMIUM', 'price_ok', prix());
    expect(c.statut).toBe('conforme');
  });

  it('valide le tarif annuel à dix mois', async () => {
    const c = await controler(
      'STRIPE_PRICE_PREMIUM_ANNUEL',
      'price_an',
      prix({ unit_amount: 4990, recurring: { interval: 'year' } }),
    );
    expect(c.statut).toBe('conforme');
  });

  /*
   * Le piège le plus probable : coller l'identifiant mensuel dans la variable
   * annuelle. Le paiement aboutirait, mais l'abonné serait prélevé tous les
   * mois d'un montant annoncé pour l'année.
   */
  it('repère un tarif mensuel placé dans la variable annuelle', async () => {
    const c = await controler(
      'STRIPE_PRICE_PREMIUM_ANNUEL',
      'price_mensuel',
      prix(),
    );
    expect(c.statut).toBe('incoherent');
    expect(c.detail).toContain('périodicité month au lieu de year');
    expect(c.detail).toContain('montant 4.99 € au lieu de 49.9 €');
  });

  it('repère un montant qui ne correspond plus au catalogue', async () => {
    const c = await controler(
      'STRIPE_PRICE_PRO',
      'price_pro',
      prix({ unit_amount: 2499 }),
    );
    expect(c.statut).toBe('incoherent');
    expect(c.detail).toContain('19.99 €');
  });

  it('repère une devise étrangère', async () => {
    const c = await controler(
      'STRIPE_PRICE_PREMIUM',
      'price_usd',
      prix({ currency: 'usd' }),
    );
    expect(c.statut).toBe('incoherent');
    expect(c.detail).toContain('devise usd');
  });

  it('repère un tarif archivé', async () => {
    const c = await controler(
      'STRIPE_PRICE_PREMIUM',
      'price_vieux',
      prix({ active: false }),
    );
    expect(c.statut).toBe('inactif');
  });

  /*
   * Cas courant : la clé de production avec un identifiant créé en test. Le
   * message doit le dire, sans quoi on cherche l'erreur dans le code.
   */
  it('repère un identifiant inconnu du compte Stripe', async () => {
    process.env.STRIPE_PRICE_PREMIUM = 'price_absent';
    const { service } = monter({});
    const c = (await service.verifierTarifs()).find(
      (x) => x.variable === 'STRIPE_PRICE_PREMIUM',
    )!;
    expect(c.statut).toBe('introuvable');
    expect(c.detail).toContain('clé de test');
  });

  it('signale une formule annoncée au catalogue mais non configurée', async () => {
    const { service } = monter({});
    const c = (await service.verifierTarifs()).find(
      (x) => x.variable === 'STRIPE_PRICE_PRO_ANNUEL',
    )!;
    expect(c.statut).toBe('absent');
    expect(c.detail).toContain('199 €');
  });

  /*
   * Une variable vide chez l'hébergeur est plus fréquente qu'une variable
   * absente : elle doit être traitée comme non configurée, et non transmise
   * telle quelle à Stripe.
   */
  it('traite une variable vide comme non configurée', async () => {
    process.env.STRIPE_PRICE_PREMIUM = '';
    const { service, retrieve } = monter({});
    const c = (await service.verifierTarifs()).find(
      (x) => x.variable === 'STRIPE_PRICE_PREMIUM',
    )!;
    expect(c.statut).toBe('absent');
    expect(retrieve).not.toHaveBeenCalled();
  });

  /*
   * Une clé refusée ne dit rien des tarifs eux-mêmes. La signaler comme un
   * identifiant inconnu enverrait corriger des variables qui sont justes.
   */
  it('ne conclut rien des tarifs quand la clé est refusée', async () => {
    process.env.STRIPE_PRICE_PREMIUM = 'price_ok';
    const service = new BillingService({} as any);
    Object.defineProperty(service, 'stripe', {
      get: () => ({
        prices: {
          retrieve: () =>
            Promise.reject(
              Object.assign(new Error('Invalid API Key'), {
                code: 'api_key_invalid',
              }),
            ),
        },
      }),
    });

    await expect(service.verifierTarifs()).rejects.toThrow('Invalid API Key');
    // Le démarrage, lui, s'en accommode.
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it('ne bloque pas le démarrage quand Stripe est injoignable', async () => {
    process.env.STRIPE_PRICE_PREMIUM = 'price_ok';
    const service = new BillingService({} as any);
    Object.defineProperty(service, 'stripe', {
      get: () => {
        throw new Error('réseau indisponible');
      },
    });
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it('ne contrôle rien quand le paiement n’est pas configuré', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { service, retrieve } = monter({});
    await service.onApplicationBootstrap();
    expect(retrieve).not.toHaveBeenCalled();
  });
});
