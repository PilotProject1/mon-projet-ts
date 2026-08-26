import { ResiliationService } from './resiliation.service';

/**
 * L'outil public sert de porte d'entrée : un visiteur venu d'une recherche
 * doit repartir avec une lettre, même quand le modèle est coupé, saturé ou
 * que le document se lit mal. Chaque cas ci-dessous décrit une manière dont
 * la chaîne peut céder sans que le visiteur en pâtisse.
 */
describe('ResiliationService', () => {
  const CHAMPS_VIDES = {
    suggestedType: null,
    suggestedProvider: null,
    suggestedDates: [],
    suggestedAmount: null,
    suggestedDueDate: null,
    suggestedDueLabel: null,
    suggestedDocumentDate: null,
    suggestedReference: null,
    suggestedReferenceLabel: null,
    suggestedPaid: null,
  };

  function monter(options: {
    texte?: string;
    champs?: Partial<typeof CHAMPS_VIDES>;
    iaDisponible?: boolean;
    budgetOk?: boolean;
    lettreEchoue?: boolean;
  }) {
    const champs = { ...CHAMPS_VIDES, ...options.champs };
    const ocr = {
      extractText: jest
        .fn()
        .mockResolvedValue({ text: options.texte ?? 'texte', warning: null }),
    };
    const extraction = { extract: jest.fn().mockReturnValue(champs) };
    const aiExtraction = { extract: jest.fn().mockResolvedValue(champs) };
    const aiLetter = {
      draft: options.lettreEchoue
        ? jest.fn().mockRejectedValue(new Error('modèle indisponible'))
        : jest
            .fn()
            .mockResolvedValue({ subject: 'Objet IA', body: 'Corps IA' }),
    };
    const ai = { available: options.iaDisponible ?? true };
    const budget = {
      reserver: jest.fn().mockReturnValue(options.budgetOk ?? true),
    };

    const service = new ResiliationService(
      ocr as any,
      extraction as any,
      ai as any,
      aiExtraction as any,
      aiLetter as any,
      budget as any,
    );
    return { service, ocr, extraction, aiExtraction, aiLetter, budget };
  }

  const fichier = {
    buffer: Buffer.from('x'),
    mimetype: 'application/pdf',
  } as Express.Multer.File;

  it('rend la lettre du modèle quand tout est disponible', async () => {
    const { service, aiExtraction } = monter({
      champs: { suggestedProvider: 'MAIF', suggestedDueDate: '2026-10-03' },
    });
    const resultat = await service.analyser(fichier);

    expect(aiExtraction.extract).toHaveBeenCalled();
    expect(resultat).toMatchObject({
      prestataire: 'MAIF',
      echeance: '2026-10-03',
      redigeeParIA: true,
      lettre: { objet: 'Objet IA', corps: 'Corps IA' },
    });
  });

  /*
   * Le plafond atteint ne doit jamais se voir comme une panne : c'est
   * précisément quand l'outil marche fort qu'il ne faut pas qu'il ferme.
   */
  it('retombe sur le moteur local et le gabarit quand le budget est épuisé', async () => {
    const { service, extraction, aiExtraction, aiLetter } = monter({
      budgetOk: false,
      champs: { suggestedProvider: 'Free' },
    });
    const resultat = await service.analyser(fichier);

    expect(aiExtraction.extract).not.toHaveBeenCalled();
    expect(aiLetter.draft).not.toHaveBeenCalled();
    expect(extraction.extract).toHaveBeenCalled();
    expect(resultat.redigeeParIA).toBe(false);
    expect(resultat.lettre.corps).toContain('Free');
    expect(resultat.lettre.corps).toContain('[Votre nom]');
  });

  it('retombe sur le gabarit quand la rédaction IA échoue', async () => {
    const { service } = monter({
      lettreEchoue: true,
      champs: { suggestedProvider: 'EDF' },
    });
    const resultat = await service.analyser(fichier);

    expect(resultat.redigeeParIA).toBe(false);
    expect(resultat.lettre.corps).toContain('EDF');
  });

  it('prévient sans échouer quand le document est illisible', async () => {
    const { service } = monter({ texte: '   ' });
    const resultat = await service.analyser(fichier);

    expect(resultat.avertissement).toMatch(/Aucun texte/);
    expect(resultat.lettre.corps).toContain('[Nom de l’organisme]');
  });

  /*
   * Sans émetteur, une lettre reste utile : le visiteur complète le
   * destinataire lui-même. Refuser tout net le renverrait les mains vides.
   */
  it('rend un gabarit à compléter quand l’émetteur n’est pas reconnu', async () => {
    const { service, aiLetter } = monter({
      champs: { suggestedProvider: null, suggestedDueDate: '2027-01-15' },
    });
    const resultat = await service.analyser(fichier);

    expect(aiLetter.draft).not.toHaveBeenCalled();
    expect(resultat.prestataire).toBeNull();
    expect(resultat.echeance).toBe('2027-01-15');
    expect(resultat.avertissement).toMatch(/organisme/);
  });

  it('n’appelle pas le modèle quand aucune clé n’est configurée', async () => {
    const { service, aiExtraction, aiLetter, budget } = monter({
      iaDisponible: false,
      champs: { suggestedProvider: 'Orange' },
    });
    const resultat = await service.analyser(fichier);

    expect(budget.reserver).not.toHaveBeenCalled();
    expect(aiExtraction.extract).not.toHaveBeenCalled();
    expect(aiLetter.draft).not.toHaveBeenCalled();
    expect(resultat.redigeeParIA).toBe(false);
  });
});
