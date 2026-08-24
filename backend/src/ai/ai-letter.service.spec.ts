import { ServiceUnavailableException } from '@nestjs/common';
import { AiLetterService } from './ai-letter.service';

/*
 * Comme pour la recherche : on ne vérifie pas la qualité de la lettre — elle
 * ne dépend pas de nous — mais ce qu'on donne à lire au modèle et la façon
 * dont un échec est rattrapé.
 */
describe('AiLetterService', () => {
  let ai: any;
  let service: AiLetterService;
  let envoye: string;

  function repond(subject: string, body: string) {
    ai.sdk.messages.create.mockImplementation((requete: any) => {
      envoye = requete.messages[0].content as string;
      return Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify({ subject, body }) }],
      });
    });
  }

  beforeEach(() => {
    envoye = '';
    ai = { sdk: { messages: { create: jest.fn() } }, model: 'test' };
    service = new AiLetterService(ai);
    repond('Objet', 'Corps');
  });

  it('transmet les faits connus au modèle', async () => {
    await service.draft({
      kind: 'resiliation',
      provider: 'Free',
      reference: 'CTR-123',
      documentDate: new Date('2026-02-01T00:00:00.000Z'),
      amount: null,
    });

    expect(envoye).toContain('Free');
    expect(envoye).toContain('CTR-123');
    expect(envoye).toContain('2026-02-01');
  });

  it('omet les faits absents plutôt que d’écrire un champ vide', async () => {
    await service.draft({
      kind: 'contestation',
      provider: 'EDF',
      reference: null,
      documentDate: null,
      amount: 84.3,
    });

    expect(envoye).not.toContain('Référence');
    expect(envoye).not.toContain('Date du document');
    expect(envoye).toContain('84.30');
  });

  it('renvoie le sujet et le corps rédigés', async () => {
    repond('Résiliation — réf. CTR-123', 'Madame, Monsieur, ...');

    const result = await service.draft({
      kind: 'resiliation',
      provider: 'Free',
      reference: 'CTR-123',
      documentDate: null,
      amount: null,
    });

    expect(result).toEqual({
      subject: 'Résiliation — réf. CTR-123',
      body: 'Madame, Monsieur, ...',
    });
  });

  it('laisse remonter telle quelle une indisponibilité déjà signalée', async () => {
    const erreur = new ServiceUnavailableException('clé manquante');
    ai.sdk.messages.create.mockRejectedValue(erreur);

    await expect(
      service.draft({
        kind: 'resiliation',
        provider: 'Free',
        reference: null,
        documentDate: null,
        amount: null,
      }),
    ).rejects.toBe(erreur);
  });

  it('transforme une autre erreur en indisponibilité générique', async () => {
    ai.sdk.messages.create.mockRejectedValue(new Error('timeout'));

    await expect(
      service.draft({
        kind: 'resiliation',
        provider: 'Free',
        reference: null,
        documentDate: null,
        amount: null,
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
