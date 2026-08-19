import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupUsers } from './utils/test-app';
import { PrismaService } from '../src/prisma/prisma.service';

const CLE = 'cle-de-reception-pour-les-tests';
const DOMAINE = 'depot.syneco.test';
const MOT_DE_PASSE = 'super-secret-123';

/** Un PDF minimal mais authentique : sa signature doit être reconnue. */
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
);

/** Un exécutable Windows : commence par « MZ ». Le nom mentira, pas lui. */
const EXECUTABLE = Buffer.from([
  0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
]);

async function inscrire(app: INestApplication, etiquette: string) {
  const email = `e2e-depot-${etiquette}-${Date.now()}-${Math.random().toString(36).slice(2)}@syneco.test`;
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: MOT_DE_PASSE, name: etiquette })
    .expect(201);
  return {
    email,
    accessToken: res.body.accessToken as string,
    userId: res.body.user.id as string,
  };
}

describe('Dépôt par e-mail (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const restes: string[] = [];
  const initial = {
    domaine: process.env.INBOUND_DOMAIN,
    cle: process.env.INBOUND_WEBHOOK_KEY,
    brevo: process.env.BREVO_API_KEY,
  };

  beforeAll(async () => {
    process.env.INBOUND_DOMAIN = DOMAINE;
    process.env.INBOUND_WEBHOOK_KEY = CLE;
    process.env.BREVO_API_KEY = 'cle-brevo-de-test';
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupUsers(app, restes);
    await app.close();
    for (const [nom, valeur] of [
      ['INBOUND_DOMAIN', initial.domaine],
      ['INBOUND_WEBHOOK_KEY', initial.cle],
      ['BREVO_API_KEY', initial.brevo],
    ] as const) {
      if (valeur === undefined) delete process.env[nom];
      else process.env[nom] = valeur;
    }
  });

  /*
   * On ne veut pas appeler le prestataire depuis un test : le téléchargement
   * de la pièce jointe est remplacé par le contenu qu'on choisit. Ce qui est
   * éprouvé ici, c'est notre traitement, pas le réseau de quelqu'un d'autre.
   */
  function simulerTelechargement(contenu: Buffer | null) {
    const vrai = global.fetch;
    const reponse = contenu
      ? { ok: true, arrayBuffer: () => Promise.resolve(contenu) }
      : { ok: false, status: 404, statusText: 'Not Found' };
    global.fetch = () => Promise.resolve(reponse as unknown as Response);
    return () => {
      global.fetch = vrai;
    };
  }

  function message(
    adresse: string,
    pieces: unknown[],
    sujet = 'Votre facture',
  ) {
    return {
      items: [
        {
          From: { Address: 'facturation@fournisseur.test' },
          To: [{ Address: adresse }],
          Subject: sujet,
          Attachments: pieces,
        },
      ],
    };
  }

  async function adresseDe(compte: { accessToken: string }): Promise<string> {
    const res = await request(app.getHttpServer())
      .get('/depot-email/adresse')
      .set('Authorization', `Bearer ${compte.accessToken}`)
      .expect(200);
    return res.body.adresse as string;
  }

  describe('adresse', () => {
    it('exige un jeton', async () => {
      await request(app.getHttpServer())
        .get('/depot-email/adresse')
        .expect(401);
    });

    it('donne une adresse propre au compte, à la première demande', async () => {
      const compte = await inscrire(app, 'adresse');
      restes.push(compte.userId);

      // Rien n'est posé tant que personne n'a demandé : une adresse qui
      // existe est une porte ouverte.
      const avant = await prisma.user.findUnique({
        where: { id: compte.userId },
        select: { inboundToken: true },
      });
      expect(avant?.inboundToken).toBeNull();

      const adresse = await adresseDe(compte);
      expect(adresse).toMatch(
        new RegExp(`^depot-[bcdfghjkmnpqrstvwxz23456789]{16}@${DOMAINE}$`),
      );
    });

    it('rend la même adresse à la demande suivante', async () => {
      const compte = await inscrire(app, 'stable');
      restes.push(compte.userId);
      expect(await adresseDe(compte)).toBe(await adresseDe(compte));
    });

    it('renouvelle l’adresse, et l’ancienne cesse de valoir', async () => {
      const compte = await inscrire(app, 'renouvellement');
      restes.push(compte.userId);
      const ancienne = await adresseDe(compte);

      const nouvelle = (
        await request(app.getHttpServer())
          .post('/depot-email/regenerer')
          .set('Authorization', `Bearer ${compte.accessToken}`)
          .expect(200)
      ).body.adresse as string;

      expect(nouvelle).not.toBe(ancienne);

      const rendre = simulerTelechargement(PDF);
      try {
        const res = await request(app.getHttpServer())
          .post('/depot-email/reception')
          .set('x-depot-cle', CLE)
          .send(message(ancienne, [{ Name: 'f.pdf', DownloadToken: 'jeton' }]))
          .expect(200);
        expect(res.body.deposes).toBe(0);
        expect(res.body.ecartees).toContain('adresse révoquée');
      } finally {
        rendre();
      }
    });
  });

  describe('réception', () => {
    it('refuse sans clé, et avec une mauvaise clé', async () => {
      await request(app.getHttpServer())
        .post('/depot-email/reception')
        .send({ items: [] })
        .expect(403);
      await request(app.getHttpServer())
        .post('/depot-email/reception')
        .set('x-depot-cle', 'ce-n-est-pas-la-bonne-cle-du-tout')
        .send({ items: [] })
        .expect(403);
    });

    it('dépose la pièce jointe dans le bon compte', async () => {
      const compte = await inscrire(app, 'depot');
      restes.push(compte.userId);
      const adresse = await adresseDe(compte);

      const rendre = simulerTelechargement(PDF);
      try {
        const res = await request(app.getHttpServer())
          .post('/depot-email/reception')
          .set('x-depot-cle', CLE)
          .send(
            message(adresse, [
              { Name: 'facture-edf.pdf', DownloadToken: 'jeton' },
            ]),
          )
          .expect(200);
        expect(res.body.deposes).toBe(1);
      } finally {
        rendre();
      }

      const documents = await prisma.document.findMany({
        where: { userId: compte.userId },
      });
      expect(documents).toHaveLength(1);
      expect(documents[0].name).toBe('facture-edf.pdf');
      expect(documents[0].mimeType).toBe('application/pdf');
    });

    /*
     * Le point qui tient toute la sécurité : l'expéditeur d'un courriel se
     * falsifie en trois lignes. Seule l'adresse de destination désigne le
     * compte, et une adresse inconnue ne dépose nulle part.
     */
    it('n’écrit dans aucun compte si l’adresse est inconnue', async () => {
      const compte = await inscrire(app, 'inconnue');
      restes.push(compte.userId);
      await adresseDe(compte);

      const rendre = simulerTelechargement(PDF);
      try {
        const res = await request(app.getHttpServer())
          .post('/depot-email/reception')
          .set('x-depot-cle', CLE)
          .send(
            message(`depot-zzzzzzzzzzzzzzzz@${DOMAINE}`, [
              { Name: 'f.pdf', DownloadToken: 'jeton' },
            ]),
          )
          .expect(200);
        expect(res.body.deposes).toBe(0);
      } finally {
        rendre();
      }

      expect(
        await prisma.document.count({ where: { userId: compte.userId } }),
      ).toBe(0);
    });

    it('refuse un fichier dont le contenu n’est pas d’un type autorisé', async () => {
      const compte = await inscrire(app, 'type-refuse');
      restes.push(compte.userId);
      const adresse = await adresseDe(compte);

      const rendre = simulerTelechargement(EXECUTABLE);
      try {
        const res = await request(app.getHttpServer())
          .post('/depot-email/reception')
          .set('x-depot-cle', CLE)
          .send(
            message(adresse, [{ Name: 'facture.pdf', DownloadToken: 'jeton' }]),
          )
          .expect(200);
        expect(res.body.deposes).toBe(0);
        expect(res.body.ecartees).toContain('type de fichier refusé');
      } finally {
        rendre();
      }

      expect(
        await prisma.document.count({ where: { userId: compte.userId } }),
      ).toBe(0);
    });

    it('écarte un message sans pièce jointe sans rien casser', async () => {
      const compte = await inscrire(app, 'sans-piece');
      restes.push(compte.userId);
      const adresse = await adresseDe(compte);

      const res = await request(app.getHttpServer())
        .post('/depot-email/reception')
        .set('x-depot-cle', CLE)
        .send(message(adresse, []))
        .expect(200);
      expect(res.body.ecartees).toContain('aucune pièce jointe');
    });

    it('reprend le sujet du message quand la pièce n’a pas de nom', async () => {
      const compte = await inscrire(app, 'sans-nom');
      restes.push(compte.userId);
      const adresse = await adresseDe(compte);

      const rendre = simulerTelechargement(PDF);
      try {
        await request(app.getHttpServer())
          .post('/depot-email/reception')
          .set('x-depot-cle', CLE)
          .send(
            message(adresse, [{ DownloadToken: 'jeton' }], 'Facture MAIF août'),
          )
          .expect(200);
      } finally {
        rendre();
      }

      const doc = await prisma.document.findFirst({
        where: { userId: compte.userId },
      });
      expect(doc?.name).toBe('Facture MAIF août');
    });
  });
});
