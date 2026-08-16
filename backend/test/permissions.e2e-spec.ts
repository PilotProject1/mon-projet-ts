import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupUsers, setPlan } from './utils/test-app';

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

function authed(app: INestApplication, token: string) {
  return {
    get: (url: string) =>
      request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${token}`),
    post: (url: string) =>
      request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${token}`),
    patch: (url: string) =>
      request(app.getHttpServer())
        .patch(url)
        .set('Authorization', `Bearer ${token}`),
    delete: (url: string) =>
      request(app.getHttpServer())
        .delete(url)
        .set('Authorization', `Bearer ${token}`),
  };
}

describe('Cross-user permissions (e2e)', () => {
  let app: INestApplication;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupUsers(app, createdUserIds);
    await app.close();
  });

  describe('Documents / Deadlines / Contracts / Shares', () => {
    let userA: { accessToken: string; userId: string };
    let userB: { accessToken: string; userId: string };
    let documentId: string;
    let deadlineId: string;
    let contractId: string;

    beforeAll(async () => {
      userA = await registerUser(app, 'docs-a');
      userB = await registerUser(app, 'docs-b');
      createdUserIds.push(userA.userId, userB.userId);
      // Les deux comptes, y compris celui dont on attend des refus : ce que
      // ce test vérifie est le cloisonnement, pas la barrière d'abonnement.
      await setPlan(app, userA.userId, 'pro');
      await setPlan(app, userB.userId, 'pro');

      const docRes = await authed(app, userA.accessToken)
        .post('/documents')
        .field('name', 'Facture EDF')
        .field('type', 'facture')
        .attach('file', Buffer.from('%PDF-1.4 fake content'), {
          filename: 'facture.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);
      documentId = docRes.body.id;

      const deadlineRes = await authed(app, userA.accessToken)
        .post('/deadlines')
        .send({ title: 'Payer la facture', dueDate: '2026-12-01', documentId })
        .expect(201);
      deadlineId = deadlineRes.body.id;

      const contractRes = await authed(app, userA.accessToken)
        .post('/contracts')
        .send({
          provider: 'EDF',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          amount: 42.5,
          renewalType: 'tacite',
          documentId,
        })
        .expect(201);
      contractId = contractRes.body.id;
    });

    it('lets the owner read their own document/deadline/contract', async () => {
      await authed(app, userA.accessToken)
        .get(`/documents/${documentId}`)
        .expect(200);
      await authed(app, userA.accessToken)
        .get(`/deadlines/${deadlineId}`)
        .expect(200);
      await authed(app, userA.accessToken)
        .get(`/contracts/${contractId}`)
        .expect(200);
    });

    it("blocks another user from reading user A's document", async () => {
      await authed(app, userB.accessToken)
        .get(`/documents/${documentId}`)
        .expect(403);
    });

    it("blocks another user from updating user A's document", async () => {
      await authed(app, userB.accessToken)
        .patch(`/documents/${documentId}`)
        .send({ name: 'hacked' })
        .expect(403);
    });

    it("blocks another user from deleting user A's document", async () => {
      await authed(app, userB.accessToken)
        .delete(`/documents/${documentId}`)
        .expect(403);
    });

    it("blocks another user from reading or deleting user A's deadline", async () => {
      await authed(app, userB.accessToken)
        .get(`/deadlines/${deadlineId}`)
        .expect(403);
      await authed(app, userB.accessToken)
        .delete(`/deadlines/${deadlineId}`)
        .expect(403);
    });

    it("blocks another user from reading or deleting user A's contract", async () => {
      await authed(app, userB.accessToken)
        .get(`/contracts/${contractId}`)
        .expect(403);
      await authed(app, userB.accessToken)
        .delete(`/contracts/${contractId}`)
        .expect(403);
    });

    it('blocks user B from creating a deadline linked to a document they do not own', async () => {
      await authed(app, userB.accessToken)
        .post('/deadlines')
        .send({ title: 'Intrusion', dueDate: '2026-12-01', documentId })
        .expect(403);
    });

    it('rejects unauthenticated access entirely', async () => {
      await request(app.getHttpServer())
        .get(`/documents/${documentId}`)
        .expect(401);
      await request(app.getHttpServer()).get('/documents').expect(401);
    });

    it('a share link created by the owner is readable publicly, and revoking it ends access', async () => {
      const shareRes = await authed(app, userA.accessToken)
        .post('/shares')
        .send({ documentId, expiresInHours: 24 })
        .expect(201);
      const token = shareRes.body.token as string;
      const shareId = shareRes.body.id as string;

      await request(app.getHttpServer())
        .get(`/public/shares/${token}`)
        .expect(200);

      // user B cannot create a share for a document they don't own
      await authed(app, userB.accessToken)
        .post('/shares')
        .send({ documentId, expiresInHours: 24 })
        .expect(403);

      // user B cannot revoke user A's share link
      await authed(app, userB.accessToken)
        .delete(`/shares/${shareId}`)
        .expect(403);

      // owner revokes it -> public access is now gone
      await authed(app, userA.accessToken)
        .delete(`/shares/${shareId}`)
        .expect(204);
      await request(app.getHttpServer())
        .get(`/public/shares/${token}`)
        .expect(410);
    });

    it('an unknown public share token returns 404', async () => {
      await request(app.getHttpServer())
        .get('/public/shares/does-not-exist')
        .expect(404);
    });
  });

  describe('Company / Clients / Invoices', () => {
    let userA: { accessToken: string; userId: string };
    let userB: { accessToken: string; userId: string };
    let clientAId: string;
    let invoiceAId: string;

    beforeAll(async () => {
      userA = await registerUser(app, 'biz-a');
      userB = await registerUser(app, 'biz-b');
      createdUserIds.push(userA.userId, userB.userId);
      // Le module de facturation est réservé aux plans professionnels.
      await setPlan(app, userA.userId, 'pro');
      await setPlan(app, userB.userId, 'pro');

      await authed(app, userA.accessToken)
        .post('/company')
        .send({ name: 'Studio A' })
        .expect(201);
      await authed(app, userB.accessToken)
        .post('/company')
        .send({ name: 'Studio B' })
        .expect(201);

      const clientRes = await authed(app, userA.accessToken)
        .post('/clients')
        .send({ name: 'Client de A', email: 'client-a@example.com' })
        .expect(201);
      clientAId = clientRes.body.id;

      const invoiceRes = await authed(app, userA.accessToken)
        .post('/invoices')
        .send({ clientId: clientAId, total: 850, dueDate: '2026-09-01' })
        .expect(201);
      invoiceAId = invoiceRes.body.id;
    });

    it("blocks user B from reading user A's client even though B has their own company", async () => {
      await authed(app, userB.accessToken)
        .get(`/clients/${clientAId}`)
        .expect(403);
    });

    it("blocks user B from reading or updating user A's invoice", async () => {
      await authed(app, userB.accessToken)
        .get(`/invoices/${invoiceAId}`)
        .expect(403);
      await authed(app, userB.accessToken)
        .patch(`/invoices/${invoiceAId}`)
        .send({ status: 'payee' })
        .expect(403);
    });

    it('blocks user B from invoicing a client that belongs to company A', async () => {
      await authed(app, userB.accessToken)
        .post('/invoices')
        .send({ clientId: clientAId, total: 100, dueDate: '2026-09-01' })
        .expect(403);
    });

    it("user B's own client/invoice list stays empty and does not leak user A's data", async () => {
      const clients = await authed(app, userB.accessToken)
        .get('/clients')
        .expect(200);
      expect(clients.body).toEqual([]);
      const invoices = await authed(app, userB.accessToken)
        .get('/invoices')
        .expect(200);
      expect(invoices.body).toEqual([]);
    });

    it('a user with no company yet gets a clear 404 instead of a crash', async () => {
      const fresh = await registerUser(app, 'no-company');
      createdUserIds.push(fresh.userId);
      // Le compte a le droit d'accéder au module ; il n'a simplement pas
      // encore créé son entreprise. C'est bien un 404 qui est attendu.
      await setPlan(app, fresh.userId, 'pro');

      await authed(app, fresh.accessToken).get('/company').expect(404);
      await authed(app, fresh.accessToken)
        .post('/clients')
        .send({ name: 'x', email: 'x@x.com' })
        .expect(404);
    });
  });
});
