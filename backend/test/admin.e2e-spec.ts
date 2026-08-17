import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupUsers, setRole } from './utils/test-app';

async function registerUser(app: INestApplication, label: string) {
  const email = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@syneco.test`;
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: 'super-secret-123', name: label })
    .expect(201);
  return {
    accessToken: res.body.accessToken as string,
    userId: res.body.user.id as string,
  };
}

describe('Administration (e2e)', () => {
  let app: INestApplication;
  const crees: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupUsers(app, crees);
    await app.close();
  });

  it('refuse un visiteur sans jeton', async () => {
    await request(app.getHttpServer()).get('/admin/statistiques').expect(401);
  });

  it('refuse un compte ordinaire', async () => {
    const utilisateur = await registerUser(app, 'ordinaire');
    crees.push(utilisateur.userId);
    await request(app.getHttpServer())
      .get('/admin/statistiques')
      .set('Authorization', `Bearer ${utilisateur.accessToken}`)
      .expect(403);
  });

  it('répond à un compte d’administration, sans donnée personnelle', async () => {
    const patron = await registerUser(app, 'patron');
    crees.push(patron.userId);
    await setRole(app, patron.userId, 'admin');

    const res = await request(app.getHttpServer())
      .get('/admin/statistiques')
      .set('Authorization', `Bearer ${patron.accessToken}`)
      .expect(200);

    expect(res.body.comptes.total).toBeGreaterThan(0);
    expect(res.body.comptes.aujourdhui).toBeGreaterThan(0);
    expect(res.body.inscriptionsParJour).toHaveLength(14);
    expect(res.body.plans.gratuit).toBeGreaterThan(0);

    // Aucune adresse, aucun nom : la réponse ne porte que des compteurs.
    const brut = JSON.stringify(res.body);
    expect(brut).not.toContain('@');
    expect(brut).not.toContain('patron');
  });

  it('cesse de répondre dès que le rôle est retiré', async () => {
    const ancien = await registerUser(app, 'ancien');
    crees.push(ancien.userId);
    await setRole(app, ancien.userId, 'admin');
    await request(app.getHttpServer())
      .get('/admin/statistiques')
      .set('Authorization', `Bearer ${ancien.accessToken}`)
      .expect(200);

    // Le rôle est relu à chaque requête : le jeton déjà émis ne suffit plus.
    await setRole(app, ancien.userId, 'user');
    await request(app.getHttpServer())
      .get('/admin/statistiques')
      .set('Authorization', `Bearer ${ancien.accessToken}`)
      .expect(403);
  });
});
