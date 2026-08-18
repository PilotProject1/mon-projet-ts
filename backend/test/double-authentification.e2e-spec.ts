import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupUsers } from './utils/test-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { codePour, pasDeTemps } from '../src/auth/totp';

const MOT_DE_PASSE = 'super-secret-123';

async function inscrire(app: INestApplication, etiquette: string) {
  const email = `e2e-2fa-${etiquette}-${Date.now()}-${Math.random().toString(36).slice(2)}@syneco.test`;
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

/**
 * Ouvre un compte et l'équipe de la double authentification.
 *
 * Rend le secret en clair — l'application ne le montre qu'une fois, à cet
 * instant précis — pour que le test puisse fabriquer les codes suivants, et
 * la tranche de temps utilisée à l'activation, dont dépend le refus du rejeu.
 */
async function inscrireEtProteger(app: INestApplication, etiquette: string) {
  const compte = await inscrire(app, etiquette);

  const preparation = await request(app.getHttpServer())
    .post('/auth/2fa/preparer')
    .set('Authorization', `Bearer ${compte.accessToken}`)
    .expect(200);

  const secret = preparation.body.secret as string;
  const pasBase = pasDeTemps();

  const activation = await request(app.getHttpServer())
    .post('/auth/2fa/activer')
    .set('Authorization', `Bearer ${compte.accessToken}`)
    .send({ code: codePour(secret, pasBase) })
    .expect(200);

  return {
    ...compte,
    secret,
    pasBase,
    codesDeSecours: activation.body.codesDeSecours as string[],
  };
}

describe('Double authentification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const restes: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupUsers(app, restes);
    await app.close();
  });

  describe('activation', () => {
    it('ne montre le secret qu’à son titulaire', async () => {
      await request(app.getHttpServer()).post('/auth/2fa/preparer').expect(401);
    });

    it('propose un secret et un code graphique, sans rien activer', async () => {
      const compte = await inscrire(app, 'preparation');
      restes.push(compte.userId);

      const res = await request(app.getHttpServer())
        .post('/auth/2fa/preparer')
        .set('Authorization', `Bearer ${compte.accessToken}`)
        .expect(200);

      expect(res.body.secret).toMatch(/^[A-Z2-7=]+$/);
      expect(res.body.uri).toContain('otpauth://totp/SYNeco:');
      expect(res.body.qrCode).toMatch(/^data:image\/png;base64,/);

      // Rien n'est actif tant qu'un code n'a pas prouvé le bon réglage.
      const etat = await request(app.getHttpServer())
        .get('/auth/2fa')
        .set('Authorization', `Bearer ${compte.accessToken}`)
        .expect(200);
      expect(etat.body.actif).toBe(false);
    });

    it('conserve le secret chiffré, jamais en clair', async () => {
      const compte = await inscrireEtProteger(app, 'chiffre');
      restes.push(compte.userId);

      const enBase = await prisma.user.findUnique({
        where: { id: compte.userId },
        select: { twoFactorSecret: true },
      });

      expect(enBase?.twoFactorSecret).toBeTruthy();
      expect(enBase?.twoFactorSecret).not.toContain(compte.secret);
      expect(enBase?.twoFactorSecret).toMatch(/^v1\./);
    });

    it('refuse un code faux, et n’active rien', async () => {
      const compte = await inscrire(app, 'code-faux');
      restes.push(compte.userId);

      await request(app.getHttpServer())
        .post('/auth/2fa/preparer')
        .set('Authorization', `Bearer ${compte.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/2fa/activer')
        .set('Authorization', `Bearer ${compte.accessToken}`)
        .send({ code: '000000' })
        .expect(400);

      const etat = await request(app.getHttpServer())
        .get('/auth/2fa')
        .set('Authorization', `Bearer ${compte.accessToken}`)
        .expect(200);
      expect(etat.body.actif).toBe(false);
    });

    it('remet dix codes de secours, une seule fois', async () => {
      const compte = await inscrireEtProteger(app, 'codes');
      restes.push(compte.userId);

      expect(compte.codesDeSecours).toHaveLength(10);
      compte.codesDeSecours.forEach((code) =>
        expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/),
      );

      const etat = await request(app.getHttpServer())
        .get('/auth/2fa')
        .set('Authorization', `Bearer ${compte.accessToken}`)
        .expect(200);
      expect(etat.body).toMatchObject({
        actif: true,
        codesDeSecoursRestants: 10,
      });
      // L'état ne doit jamais laisser filtrer de quoi fabriquer un code.
      expect(JSON.stringify(etat.body)).not.toContain(compte.secret);
    });

    it('refuse une seconde activation sur un compte déjà protégé', async () => {
      const compte = await inscrireEtProteger(app, 'deja-actif');
      restes.push(compte.userId);

      await request(app.getHttpServer())
        .post('/auth/2fa/preparer')
        .set('Authorization', `Bearer ${compte.accessToken}`)
        .expect(400);
    });
  });

  describe('connexion', () => {
    /*
     * Le test qui porte tout le reste : sur un compte protégé, un mot de
     * passe correct ne délivre aucun jeton. S'il tombe, la double
     * authentification est décorative.
     */
    it('ne délivre aucun jeton contre le seul mot de passe', async () => {
      const compte = await inscrireEtProteger(app, 'connexion');
      restes.push(compte.userId);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: compte.email, password: MOT_DE_PASSE })
        .expect(200);

      expect(res.body.deuxiemeFacteurRequis).toBe(true);
      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();
      expect(res.body.user).toBeUndefined();
      expect(res.body.challengeToken).toEqual(expect.any(String));
    });

    it('refuse le jeton de défi comme jeton d’accès', async () => {
      const compte = await inscrireEtProteger(app, 'defi-vs-acces');
      restes.push(compte.userId);

      const connexion = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: compte.email, password: MOT_DE_PASSE })
        .expect(200);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${connexion.body.challengeToken}`)
        .expect(401);
    });

    it('délivre les jetons contre un code valable', async () => {
      const compte = await inscrireEtProteger(app, 'code-bon');
      restes.push(compte.userId);

      const connexion = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: compte.email, password: MOT_DE_PASSE })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/auth/login/2fa')
        .send({
          challengeToken: connexion.body.challengeToken,
          code: codePour(compte.secret, compte.pasBase + 1),
        })
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user.id).toBe(compte.userId);

      // Et le jeton obtenu ouvre bien ce qu'il doit ouvrir.
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);
    });

    it('refuse un code faux', async () => {
      const compte = await inscrireEtProteger(app, 'connexion-faux');
      restes.push(compte.userId);

      const connexion = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: compte.email, password: MOT_DE_PASSE })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login/2fa')
        .send({ challengeToken: connexion.body.challengeToken, code: '000000' })
        .expect(401);
    });

    /*
     * Un code lu par-dessus l'épaule reste affiché une trentaine de secondes.
     * Sans ce refus, il suffirait de le retaper.
     */
    it('refuse un code déjà utilisé', async () => {
      const compte = await inscrireEtProteger(app, 'rejeu');
      restes.push(compte.userId);
      const code = codePour(compte.secret, compte.pasBase + 1);

      const premiere = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: compte.email, password: MOT_DE_PASSE })
        .expect(200);
      await request(app.getHttpServer())
        .post('/auth/login/2fa')
        .send({ challengeToken: premiere.body.challengeToken, code })
        .expect(200);

      const seconde = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: compte.email, password: MOT_DE_PASSE })
        .expect(200);
      await request(app.getHttpServer())
        .post('/auth/login/2fa')
        .send({ challengeToken: seconde.body.challengeToken, code })
        .expect(401);
    });

    it('accepte un code de secours, une fois et une seule', async () => {
      const compte = await inscrireEtProteger(app, 'secours');
      restes.push(compte.userId);
      const [code] = compte.codesDeSecours;

      const premiere = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: compte.email, password: MOT_DE_PASSE })
        .expect(200);
      await request(app.getHttpServer())
        .post('/auth/login/2fa')
        .send({ challengeToken: premiere.body.challengeToken, code })
        .expect(200);

      const seconde = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: compte.email, password: MOT_DE_PASSE })
        .expect(200);
      await request(app.getHttpServer())
        .post('/auth/login/2fa')
        .send({ challengeToken: seconde.body.challengeToken, code })
        .expect(401);
    });

    it('laisse passer un compte non protégé, comme avant', async () => {
      const compte = await inscrire(app, 'sans-2fa');
      restes.push(compte.userId);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: compte.email, password: MOT_DE_PASSE })
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.deuxiemeFacteurRequis).toBeUndefined();
    });
  });

  describe('retrait', () => {
    it('exige le mot de passe et un code', async () => {
      const compte = await inscrireEtProteger(app, 'retrait-refus');
      restes.push(compte.userId);

      await request(app.getHttpServer())
        .post('/auth/2fa/retirer')
        .set('Authorization', `Bearer ${compte.accessToken}`)
        .send({
          password: 'ce-n-est-pas-le-bon',
          code: codePour(compte.secret, compte.pasBase + 1),
        })
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/2fa/retirer')
        .set('Authorization', `Bearer ${compte.accessToken}`)
        .send({ password: MOT_DE_PASSE, code: '000000' })
        .expect(401);

      const etat = await request(app.getHttpServer())
        .get('/auth/2fa')
        .set('Authorization', `Bearer ${compte.accessToken}`)
        .expect(200);
      expect(etat.body.actif).toBe(true);
    });

    it('retire la protection et les codes de secours avec elle', async () => {
      const compte = await inscrireEtProteger(app, 'retrait');
      restes.push(compte.userId);

      await request(app.getHttpServer())
        .post('/auth/2fa/retirer')
        .set('Authorization', `Bearer ${compte.accessToken}`)
        .send({
          password: MOT_DE_PASSE,
          code: codePour(compte.secret, compte.pasBase + 1),
        })
        .expect(204);

      expect(
        await prisma.twoFactorRecoveryCode.count({
          where: { userId: compte.userId },
        }),
      ).toBe(0);

      const connexion = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: compte.email, password: MOT_DE_PASSE })
        .expect(200);
      expect(connexion.body.accessToken).toEqual(expect.any(String));
    });
  });

  describe('sans clé de chiffrement', () => {
    it('refuse l’activation plutôt que d’enregistrer un secret en clair', async () => {
      const compte = await inscrire(app, 'sans-cle');
      restes.push(compte.userId);

      const cle = process.env.TWO_FACTOR_KEY;
      delete process.env.TWO_FACTOR_KEY;
      try {
        await request(app.getHttpServer())
          .post('/auth/2fa/preparer')
          .set('Authorization', `Bearer ${compte.accessToken}`)
          .expect(503);
      } finally {
        process.env.TWO_FACTOR_KEY = cle;
      }
    });
  });
});
