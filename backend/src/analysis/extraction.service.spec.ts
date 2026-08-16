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
    expect(champs.suggestedDueLabel?.toLowerCase()).toBe('échéance de paiement');
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

  it('ignore une formule dont la date est trop éloignée pour lui appartenir', () => {
    const champs = service.extract(
      'Échéance de paiement : se reporter aux conditions générales jointes au ' +
        'présent courrier, dont un exemplaire vous a été remis lors de la ' +
        'signature du contrat initial.\n\nDocument établi le 02/02/2026.',
    );
    expect(champs.suggestedDueDate).toBeNull();
  });
});
