import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupUsers } from './utils/test-app';
import { PrismaService } from '../src/prisma/prisma.service';

async function registerUser(app: INestApplication, label: string) {
  const email = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@syneco.test`;
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: 'super-secret-123', name: label })
    .expect(201);
  return {
    email,
    accessToken: res.body.accessToken as string,
    userId: res.body.user.id as string,
  };
}

describe('Suppression de compte (e2e)', () => {
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

  it('refuse sans jeton', async () => {
    await request(app.getHttpServer())
      .delete('/users/moi')
      .send({ password: 'super-secret-123' })
      .expect(401);
  });

  it('refuse sans mot de passe', async () => {
    const u = await registerUser(app, 'sans-mdp');
    restes.push(u.userId);
    await request(app.getHttpServer())
      .delete('/users/moi')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .send({})
      .expect(400);
  });

  it('refuse avec un mot de passe erroné, et ne supprime rien', async () => {
    const u = await registerUser(app, 'mauvais-mdp');
    restes.push(u.userId);
    await request(app.getHttpServer())
      .delete('/users/moi')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .send({ password: 'ce-n-est-pas-le-bon' })
      .expect(401);

    expect(
      await prisma.user.findUnique({ where: { id: u.userId } }),
    ).not.toBeNull();
  });

  it('supprime le compte et tout ce qui s’y rattache', async () => {
    const u = await registerUser(app, 'a-supprimer');

    // Un document, une échéance : de quoi vérifier que les cascades jouent.
    const doc = await request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .field('name', 'Facture à effacer')
      .field('type', 'facture')
      .attach('file', Buffer.from('%PDF-1.4 contenu'), {
        filename: 'f.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/deadlines')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .send({
        title: 'À effacer',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/users/moi')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .send({ password: 'super-secret-123' })
      .expect(204);

    expect(
      await prisma.user.findUnique({ where: { id: u.userId } }),
    ).toBeNull();
    expect(await prisma.document.count({ where: { userId: u.userId } })).toBe(
      0,
    );
    expect(await prisma.deadline.count({ where: { userId: u.userId } })).toBe(
      0,
    );
    expect(
      await prisma.document.findUnique({
        where: { id: doc.body.id as string },
      }),
    ).toBeNull();
  });

  it('rend le jeton inutilisable ensuite', async () => {
    const u = await registerUser(app, 'jeton-mort');
    await request(app.getHttpServer())
      .delete('/users/moi')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .send({ password: 'super-secret-123' })
      .expect(204);

    // Le compte n'existe plus : la stratégie JWT ne le retrouve pas.
    await request(app.getHttpServer())
      .get('/documents')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .expect(401);
  });

  it('libère l’adresse e-mail pour une nouvelle inscription', async () => {
    const u = await registerUser(app, 'reinscription');
    await request(app.getHttpServer())
      .delete('/users/moi')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .send({ password: 'super-secret-123' })
      .expect(204);

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: u.email,
        password: 'un-autre-mot-de-passe',
        name: 'Revenu',
      })
      .expect(201);
    restes.push(res.body.user.id as string);
  });
});
