import { ExtractionService } from './extraction.service';

describe('ExtractionService — repérage de l’échéance', () => {
  const service = new ExtractionService();

  it('retient la date annoncée comme échéance, pas celle d’émission', () => {
    const texte = [
      'FACTURE N° 2026-0842',
      'Date de facture : 01/08/2026',
      'Échéance de paiement : 30/09/2026',
      'Total TTC : 128,40 EUR',
    ].join('\n');

    const champs = service.extract(texte);

    expect(champs.suggestedDueDate).toBe('2026-09-30');
    expect(champs.suggestedDueLabel?.toLowerCase()).toBe(
      'échéance de paiement',
    );
  });

  it('reconnaît la formule même sans accents ni minuscules', () => {
    // Cas courant : lecture optique qui perd les accents, intitulés en
    // capitales dans les documents administratifs.
    const champs = service.extract('ECHEANCE DE PAIEMENT : 30/09/2026');
    expect(champs.suggestedDueDate).toBe('2026-09-30');
    expect(champs.suggestedDueLabel).toBe('ECHEANCE DE PAIEMENT');
  });

  it('reconnaît les formules de validité d’une attestation', () => {
    const champs = service.extract(
      'Attestation d’assurance habitation, valable jusqu’au 31/12/2026.',
    );
    expect(champs.suggestedDueDate).toBe('2026-12-31');
  });

  it('reconnaît une date limite de règlement', () => {
    const champs = service.extract('Montant à régler avant le 15/03/2027.');
    expect(champs.suggestedDueDate).toBe('2027-03-15');
  });

  it('préfère la formule la plus explicite quand plusieurs coexistent', () => {
    // « avant le » figure en premier dans le texte, mais « date limite de
    // paiement » désigne l'échéance de façon bien plus sûre.
    const texte = [
      'Merci de nous retourner le formulaire avant le 05/01/2027.',
      'Date limite de paiement : 20/02/2027',
    ].join('\n');

    expect(service.extract(texte).suggestedDueDate).toBe('2027-02-20');
  });

  it('ne propose rien quand aucune date n’est présentée comme une échéance', () => {
    const champs = service.extract(
      'Courrier du 12/04/2026. Né le 03/07/1988 à Metz. Cordialement.',
    );

    expect(champs.suggestedDueDate).toBeNull();
    expect(champs.suggestedDueLabel).toBeNull();
    // Les dates restent listées : c'est leur interprétation qui est refusée.
    expect(champs.suggestedDates).toContain('2026-04-12');
  });

  it('distingue la date du document de son échéance', () => {
    const champs = service.extract(
      [
        'FACTURE N° 2026-0842',
        'Date de facture : 01/08/2026',
        'Échéance de paiement : 30/09/2026',
      ].join('\n'),
    );

    expect(champs.suggestedDocumentDate).toBe('2026-08-01');
    expect(champs.suggestedDueDate).toBe('2026-09-30');
  });

  it('retient à défaut la première date, celle de l’en-tête', () => {
    const champs = service.extract(
      'Courrier du 12/04/2026. Né le 03/07/1988 à Metz.',
    );
    expect(champs.suggestedDocumentDate).toBe('2026-04-12');
  });

  it('ne prend pas l’échéance pour la date du document', () => {
    // Un rappel de paiement peut ne porter que sa date limite : mieux vaut
    // alors ne rien dater que dater le document du jour où il expire.
    const champs = service.extract('À payer avant le 15/03/2027.');

    expect(champs.suggestedDueDate).toBe('2027-03-15');
    expect(champs.suggestedDocumentDate).toBeNull();
  });

  it('ignore une formule dont la date est trop éloignée pour lui appartenir', () => {
    const champs = service.extract(
      'Échéance de paiement : se reporter aux conditions générales jointes au ' +
        'présent courrier, dont un exemplaire vous a été remis lors de la ' +
        'signature du contrat initial.\n\nDocument établi le 02/02/2026.',
    );
    expect(champs.suggestedDueDate).toBeNull();
  });
});

describe('ExtractionService — émetteur', () => {
  const service = new ExtractionService();

  it('préfère le nom le plus précis à position égale', () => {
    // « Free » est contenu dans « Free Mobile » : c'est le second qui désigne.
    expect(
      service.extract('Facture Free Mobile du 03/07/2026').suggestedProvider,
    ).toBe('Free Mobile');
  });

  it('retient l’émetteur annoncé en premier', () => {
    const champs = service.extract(
      'EDF\nVotre facture\nPrélèvement sur votre compte Boursorama.',
    );
    expect(champs.suggestedProvider).toBe('EDF');
  });

  it('reconnaît un nom écrit sans accents ni apostrophe courbe', () => {
    expect(service.extract("CAISSE D'EPARGNE - releve").suggestedProvider).toBe(
      'Caisse d’Épargne',
    );
  });

  describe('facture OVH signalée par un utilisateur', () => {
    const facture = [
      'OVHcloud',
      'Référence de la facture : FR79815011',
      "Date d'émission : 13 Août 2026",
      'Commande : BC248381185',
      'Total de la facture HT 5,00 €',
      'TVA (20%) 1,00 €',
      'Total de la facture TTC 6,00 €',
      'OVH - 2 rue Kellermann 59100 Roubaix (France)',
      'SAS au capital de 50 000 000,00 € - RCS LILLE METROPOLE',
    ].join('\n');

    it('reconnaît OVHcloud, et non un assureur caché dans « Commande »', () => {
      // « MMA » se lit dans « Commande » : sans frontière de mot, la facture
      // était attribuée à un assureur.
      expect(service.extract(facture).suggestedProvider).toBe('OVHcloud');
    });

    it('lit la date écrite en toutes lettres', () => {
      expect(service.extract(facture).suggestedDocumentDate).toBe('2026-08-13');
      expect(service.extract(facture).suggestedDates).toContain('2026-08-13');
    });

    it('retient le TTC, ni le HT ni le capital social', () => {
      expect(service.extract(facture).suggestedAmount).toBe(6);
    });
  });

  describe('montants', () => {
    it('reconnaît un montant en fin de ligne', () => {
      // Le motif exigeait une lettre après « € » : aucun montant ainsi écrit
      // n'était vu.
      expect(service.extract('Total TTC 42,50 €').suggestedAmount).toBe(42.5);
    });

    it('ne prend pas le nombre de la colonne voisine', () => {
      expect(
        service.extract('Total TTC 12,00 €\nLigne 5,00 € 5,00 €')
          .suggestedAmount,
      ).toBe(12);
    });

    it('lit les espaces insécables des milliers', () => {
      expect(
        service.extract('Net à payer 1\u00a0234,56 €').suggestedAmount,
      ).toBe(1234.56);
    });

    it('retombe sur le plus grand montant sans formule explicite', () => {
      expect(service.extract('Divers 3,00 € et 9,00 €').suggestedAmount).toBe(
        9,
      );
    });
  });

  describe('dates écrites en toutes lettres', () => {
    it('lit « 1er septembre 2026 »', () => {
      expect(
        service.extract('Fait le 1er septembre 2026').suggestedDocumentDate,
      ).toBe('2026-09-01');
    });

    it('lit une échéance annoncée en toutes lettres', () => {
      expect(
        service.extract('À régler avant le 5 décembre 2026').suggestedDueDate,
      ).toBe('2026-12-05');
    });

    it('ignore un mois inexistant', () => {
      expect(service.extract('Le 13 brumaire 2026').suggestedDates).toEqual([]);
    });
  });

  describe('référence du document', () => {
    it('retient la référence de la facture plutôt que celle du client', () => {
      // Les deux figurent sur une facture OVH : c'est la sienne qu'on cite.
      const r = service.extract(
        'Référence de la facture : FR79815011\nIdentifiant Client : sh203366-ovh',
      );
      expect(r.suggestedReference).toBe('FR79815011');
      expect(r.suggestedReferenceLabel).toBe('Référence de la facture');
    });

    it('lit un numéro annoncé par « Facture n° »', () => {
      expect(service.extract('Facture n° 4839201-08').suggestedReference).toBe(
        '4839201-08',
      );
    });

    it('lit un numéro de police d’assurance', () => {
      expect(service.extract('Police n° 8830192').suggestedReference).toBe(
        '8830192',
      );
    });

    it('refuse une référence sans chiffre', () => {
      // « Référence : voir ci-dessous » n'est pas une référence.
      expect(
        service.extract('Référence : voir ci-dessous').suggestedReference,
      ).toBeNull();
    });

    it('ne propose rien quand le document n’en porte aucune', () => {
      expect(
        service.extract('Ticket de caisse 12,90 €').suggestedReference,
      ).toBeNull();
    });
  });

  describe('statut de paiement', () => {
    it('reconnaît une facture déjà prélevée', () => {
      expect(
        service.extract('Le montant de 6,00 € a été prélevé').suggestedPaid,
      ).toBe(true);
    });

    it('reconnaît une facture encore due', () => {
      expect(
        service.extract('À régler avant le 05/09/2026').suggestedPaid,
      ).toBe(false);
    });

    it('fait primer l’acquittement sur l’intitulé du total', () => {
      // « Net à payer » n'est qu'un libellé de ligne : il ne dit rien du
      // règlement, contrairement à « a été prélevé ».
      expect(
        service.extract('Net à payer 6,00 €\nCe montant a été prélevé.')
          .suggestedPaid,
      ).toBe(true);
    });

    it('ne tranche pas quand rien ne le dit', () => {
      expect(service.extract('Facture EDF 84,30 €').suggestedPaid).toBeNull();
    });
  });

  describe('nature du document', () => {
    it('classe un bon de garantie en garantie, non en assurance', () => {
      // « garantie » figure dans les deux listes de mots-clés. C'est la
      // tournure la plus longue qui doit trancher, sans quoi tout bon de
      // garantie partait en assurance.
      expect(
        service.extract(
          'Bon de garantie\nAppareil : lave-linge\nGarantie constructeur de deux ans',
        ).suggestedType,
      ).toBe('garantie');
    });

    it('classe une attestation d’assurance en assurance malgré le mot garantie', () => {
      expect(
        service.extract(
          "Attestation d'assurance habitation\nL'assuré : Monsieur Vincent\n" +
            'Étendue des garanties et déclaration de sinistre',
        ).suggestedType,
      ).toBe('assurance');
    });

    it('classe une facture, un contrat et un courrier', () => {
      expect(
        service.extract('Facture d’électricité\nTotal TTC : 84,30 EUR')
          .suggestedType,
      ).toBe('facture');
      expect(
        service.extract(
          'Contrat de bail\nDurée du contrat : trois ans\nConditions générales',
        ).suggestedType,
      ).toBe('contrat');
      expect(
        service.extract(
          'Madame, Monsieur,\nNous vous informons...\nVeuillez agréer nos salutations.',
        ).suggestedType,
      ).toBe('courrier');
    });

    it('ne devine aucune nature sur un texte qui n’en porte pas', () => {
      expect(
        service.extract('Notes de courses\npain, lait').suggestedType,
      ).toBe(null);
    });
  });
});
