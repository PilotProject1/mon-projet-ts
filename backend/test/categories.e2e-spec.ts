import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupUsers } from './utils/test-app';

const MOT_DE_PASSE = 'super-secret-123';

/** Un PDF minimal mais authentique : sa signature doit être reconnue. */
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
);

/*
 * Le rangement par pan de vie, vu depuis l'extérieur.
 *
 * Ce qui se joue ici et que les tests unitaires du classement ne couvrent
 * pas : la catégorie traverse bien un envoi multipart, franchit la validation
 * du DTO, et se retrouve dans la réponse. Un champ correctement calculé mais
 * refusé à l'entrée ne sert à rien.
 */
describe('Catégories de documents (e2e)', () => {
  let app: INestApplication;
  const restes: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupUsers(app, restes);
    await app.close();
  });

  async function inscrire(etiquette: string) {
    const email = `e2e-cat-${etiquette}-${Date.now()}-${Math.random().toString(36).slice(2)}@syneco.test`;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: MOT_DE_PASSE, name: etiquette })
      .expect(201);
    restes.push(res.body.user.id as string);
    return res.body.accessToken as string;
  }

  function deposer(jeton: string, champs: Record<string, string>) {
    const req = request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${jeton}`);
    for (const [cle, valeur] of Object.entries(champs)) req.field(cle, valeur);
    return req.attach('file', PDF, {
      filename: 'facture.pdf',
      contentType: 'application/pdf',
    });
  }

  it('retient la catégorie choisie au dépôt', async () => {
    const jeton = await inscrire('choix');
    const res = await deposer(jeton, {
      name: 'Quittance de loyer',
      type: 'facture',
      category: 'maison',
    }).expect(201);

    expect(res.body.category).toBe('maison');
  });

  it('laisse la catégorie vide quand rien n’est choisi', async () => {
    const jeton = await inscrire('sans-choix');
    // Un type est donné pour couper la lecture du document : ce test porte
    // sur l'absence de choix, non sur la reconnaissance automatique.
    const res = await deposer(jeton, {
      name: 'Document quelconque',
      type: 'autre',
    }).expect(201);

    expect(res.body.category).toBeNull();
  });

  it('refuse une catégorie inventée', async () => {
    const jeton = await inscrire('invalide');
    await deposer(jeton, {
      name: 'Document',
      type: 'autre',
      category: 'vacances',
    }).expect(400);
  });

  it('range et dérange un document déjà déposé', async () => {
    const jeton = await inscrire('deplacement');
    const cree = await deposer(jeton, {
      name: 'Document',
      type: 'autre',
    }).expect(201);

    const range = await request(app.getHttpServer())
      .patch(`/documents/${cree.body.id}`)
      .set('Authorization', `Bearer ${jeton}`)
      .send({ category: 'famille' })
      .expect(200);
    expect(range.body.category).toBe('famille');

    // Sortir un document de sa case doit rester possible : un rangement
    // qu'on ne peut pas défaire vaut moins qu'une absence de rangement.
    const sorti = await request(app.getHttpServer())
      .patch(`/documents/${cree.body.id}`)
      .set('Authorization', `Bearer ${jeton}`)
      .send({ category: null })
      .expect(200);
    expect(sorti.body.category).toBeNull();
  });

  it('rend la catégorie dans la liste', async () => {
    const jeton = await inscrire('liste');
    await deposer(jeton, {
      name: 'Mutuelle',
      type: 'contrat',
      category: 'personnel',
    }).expect(201);

    const res = await request(app.getHttpServer())
      .get('/documents')
      .set('Authorization', `Bearer ${jeton}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe('personnel');
  });
});
