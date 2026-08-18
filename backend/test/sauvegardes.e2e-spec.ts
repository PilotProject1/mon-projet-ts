import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { existsSync, rmSync } from 'fs';
import { gunzipSync } from 'zlib';
import { createTestApp, cleanupUsers } from './utils/test-app';
import { BackupService } from '../src/backup/backup.service';
import { BackupDepot } from '../src/backup/backup-depot';
import { dechiffrer } from '../src/backup/backup-crypto';

const JETON = 'jeton-de-sauvegarde-pour-les-tests';
const DOSSIER = 'backups-test';

async function inscrire(app: INestApplication, etiquette: string) {
  const email = `e2e-sauv-${etiquette}-${Date.now()}-${Math.random().toString(36).slice(2)}@syneco.test`;
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: 'super-secret-123', name: etiquette })
    .expect(201);
  return { email, userId: res.body.user.id as string };
}

describe('Sauvegardes (e2e)', () => {
  let app: INestApplication;
  const restes: string[] = [];
  const jetonInitial = process.env.BACKUP_TRIGGER_TOKEN;
  const cleInitiale = process.env.BACKUP_KEY;
  const dossierInitial = process.env.BACKUP_DIR;

  beforeAll(async () => {
    process.env.BACKUP_TRIGGER_TOKEN = JETON;
    process.env.BACKUP_KEY = 'cle-de-sauvegarde-de-test-plus-de-32-caracteres';
    process.env.BACKUP_DIR = DOSSIER;
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupUsers(app, restes);
    await app.close();
    if (existsSync(DOSSIER)) rmSync(DOSSIER, { recursive: true, force: true });
    if (jetonInitial === undefined) delete process.env.BACKUP_TRIGGER_TOKEN;
    else process.env.BACKUP_TRIGGER_TOKEN = jetonInitial;
    if (cleInitiale === undefined) delete process.env.BACKUP_KEY;
    else process.env.BACKUP_KEY = cleInitiale;
    if (dossierInitial === undefined) delete process.env.BACKUP_DIR;
    else process.env.BACKUP_DIR = dossierInitial;
  });

  describe('déclenchement externe', () => {
    it('refuse sans jeton', async () => {
      await request(app.getHttpServer())
        .post('/sauvegardes/executer')
        .expect(403);
    });

    it('refuse un jeton erroné', async () => {
      await request(app.getHttpServer())
        .post('/sauvegardes/executer')
        .set('x-sauvegardes-token', 'ce-n-est-pas-le-bon-jeton-du-tout')
        .expect(403);
    });

    it('reste fermé si aucun jeton n’est configuré', async () => {
      delete process.env.BACKUP_TRIGGER_TOKEN;
      try {
        await request(app.getHttpServer())
          .post('/sauvegardes/executer')
          .set('x-sauvegardes-token', JETON)
          .expect(503);
      } finally {
        process.env.BACKUP_TRIGGER_TOKEN = JETON;
      }
    });

    it('sauvegarde avec le bon jeton', async () => {
      const compte = await inscrire(app, 'declenchement');
      restes.push(compte.userId);

      const res = await request(app.getHttpServer())
        .post('/sauvegardes/executer')
        .set('x-sauvegardes-token', JETON)
        .expect(200);

      expect(res.body.cle).toMatch(/^syneco-.*\.syneco$/);
      expect(res.body.total).toBeGreaterThan(0);
      expect(res.body.lignes.User).toBeGreaterThan(0);
      expect(res.body.octets).toBeGreaterThan(0);
    });
  });

  describe('contenu', () => {
    /*
     * Le test qui compte : la sauvegarde doit être relisible, et contenir
     * réellement ce qui était en base. Une sauvegarde qu'on n'a jamais relue
     * n'est pas une sauvegarde.
     */
    it('se relit, se déchiffre, et contient le compte qui venait d’être créé', async () => {
      const compte = await inscrire(app, 'contenu');
      restes.push(compte.userId);

      const service = app.get(BackupService);
      const depot = app.get(BackupDepot);
      const resume = await service.executer();

      const brut = await depot.relire(resume.cle);
      const contenu = JSON.parse(gunzipSync(dechiffrer(brut)).toString('utf8'));

      expect(contenu.version).toBe(1);
      const comptes = contenu.tables.User as { id: string; email: string }[];
      expect(comptes.some((u) => u.id === compte.userId)).toBe(true);
      expect(comptes.find((u) => u.id === compte.userId)?.email).toBe(
        compte.email,
      );
    });

    it('ne laisse rien de lisible dans le fichier déposé', async () => {
      const compte = await inscrire(app, 'illisible');
      restes.push(compte.userId);

      const service = app.get(BackupService);
      const depot = app.get(BackupDepot);
      const resume = await service.executer();
      const brut = await depot.relire(resume.cle);

      expect(brut.toString('latin1')).not.toContain(compte.email);
      // Seul l'en-tête de format est en clair, et c'est voulu.
      expect(brut.subarray(0, 8).toString()).toBe('SYNBAK01');
    });

    it('signale l’état au suivi', async () => {
      const service = app.get(BackupService);
      await service.executer();
      const etat = await service.etat();

      expect(etat.configuree).toBe(true);
      expect(etat.nombre).toBeGreaterThan(0);
      expect(etat.derniere).toMatch(/\.syneco$/);
    });
  });

  describe('sans clé de chiffrement', () => {
    it('refuse de sauvegarder plutôt que d’écrire en clair', async () => {
      const cle = process.env.BACKUP_KEY;
      delete process.env.BACKUP_KEY;
      try {
        await request(app.getHttpServer())
          .post('/sauvegardes/executer')
          .set('x-sauvegardes-token', JETON)
          .expect(503);
      } finally {
        process.env.BACKUP_KEY = cle;
      }
    });
  });
});
