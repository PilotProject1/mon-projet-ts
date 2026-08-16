import { SearchService } from './search.service';

/*
 * Ce qui est vérifié ici n'est pas la qualité de la réponse du modèle — elle
 * ne dépend pas de nous — mais ce qu'on lui donne à lire et ce qu'on accepte
 * d'en ressortir : le catalogue envoyé, et le filtrage des identifiants.
 */
describe('SearchService', () => {
  let prisma: any;
  let ai: any;
  let service: SearchService;
  let envoye: string;

  const FACTURE = {
    id: 'doc1',
    name: 'Facture EDF',
    type: 'facture',
    status: 'traite',
    createdAt: new Date('2026-08-15T00:00:00Z'),
    provider: 'EDF',
    amount: 128.4,
    documentDate: new Date('2026-08-01T00:00:00Z'),
  };

  function repond(results: unknown[], summary = 'Voici.') {
    ai.sdk.messages.create.mockImplementation((requete: any) => {
      envoye = requete.messages[0].content as string;
      return Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify({ summary, results }) }],
      });
    });
  }

  beforeEach(() => {
    envoye = '';
    prisma = {
      document: { findMany: jest.fn().mockResolvedValue([FACTURE]) },
      deadline: { findMany: jest.fn().mockResolvedValue([]) },
      contract: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      company: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    ai = { sdk: { messages: { create: jest.fn() } }, model: 'test' };
    service = new SearchService(prisma, ai);
    repond([]);
  });

  /** Requête Prisma correspondant à la recherche de passages. */
  function requeteDesPassages() {
    return prisma.document.findMany.mock.calls
      .map(([args]: any[]) => args)
      .find((args: any) => args?.where?.OR);
  }

  it('cherche les mots de la question dans le texte des documents', async () => {
    await service.ask('facture EDF de février', 'u1');

    const formes = requeteDesPassages().where.OR.map(
      (clause: any) => clause.extractedText.contains,
    );
    expect(formes).toContain('facture');
    // Le mot est cherché tel qu'écrit et sans accents : la lecture optique
    // restitue « fevrier » aussi souvent que « février ».
    expect(formes).toContain('février');
    expect(formes).toContain('fevrier');
  });

  it('écarte les mots outils, qui ne désignent aucun document', async () => {
    await service.ask('combien pour la facture ?', 'u1');

    const formes = requeteDesPassages().where.OR.map(
      (clause: any) => clause.extractedText.contains,
    );
    expect(formes).toEqual(['facture']);
  });

  it('ne cherche aucun passage quand la question ne porte aucun mot utile', async () => {
    await service.ask('et pour ça ?', 'u1');

    expect(requeteDesPassages()).toBeUndefined();
  });

  it('joint au catalogue le passage du document où figure le mot', async () => {
    prisma.document.findMany.mockImplementation((args: any) =>
      Promise.resolve(
        args?.where?.OR
          ? [
              {
                id: 'doc1',
                extractedText:
                  'FACTURE EDF\nRéférence client 42\nTotal TTC : 128,40 EUR',
              },
            ]
          : [FACTURE],
      ),
    );

    await service.ask('référence client de ma facture EDF', 'u1');

    expect(envoye).toContain('Référence client 42');
    // Les faits lus dans le document accompagnent le passage : sans eux, la
    // question « combien » resterait sans réponse.
    expect(envoye).toContain('"provider":"EDF"');
    expect(envoye).toContain('"amount":128.4');
  });

  it('ignore un identifiant que le modèle aurait inventé', async () => {
    repond([
      { kind: 'document', id: 'doc1', reason: 'la voici' },
      { kind: 'document', id: 'inexistant', reason: 'inventé' },
    ]);

    const reponse = await service.ask('ma facture EDF', 'u1');

    expect(reponse.results).toHaveLength(1);
    expect(reponse.results[0].item.id).toBe('doc1');
  });
});
