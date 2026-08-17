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
