import 'dotenv/config';
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs';
import { cp } from 'fs/promises';
import { join } from 'path';

const BACKUPS_TO_KEEP = 10;

function resolvePgDump(): string {
  const candidates = [
    process.env.PG_DUMP_PATH,
    'pg_dump',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version']);
    if (!probe.error) {
      return candidate;
    }
  }
  throw new Error(
    "pg_dump introuvable. Définis PG_DUMP_PATH dans l'environnement si PostgreSQL n'est pas installé au chemin par défaut.",
  );
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL manquant dans .env');
  }
  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace(/^\//, '');

  const backupsRoot = join(__dirname, '..', 'backups');
  const dest = join(backupsRoot, timestamp());
  mkdirSync(dest, { recursive: true });

  console.log(`Sauvegarde de la base "${dbName}" vers ${dest}...`);
  const pgDump = resolvePgDump();
  const dumpFile = join(dest, 'database.dump');
  const result = spawnSync(
    pgDump,
    [
      '-h', url.hostname,
      '-p', url.port || '5432',
      '-U', decodeURIComponent(url.username),
      '-F', 'c',
      '-f', dumpFile,
      dbName,
    ],
    { env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) } },
  );
  if (result.status !== 0) {
    throw new Error(`pg_dump a échoué (code ${result.status}) : ${result.stderr}`);
  }
  console.log(`Base de données sauvegardée : ${dumpFile}`);

  const uploadsDir = join(__dirname, '..', 'uploads');
  if (existsSync(uploadsDir)) {
    const uploadsDest = join(dest, 'uploads');
    await cp(uploadsDir, uploadsDest, { recursive: true });
    console.log(`Fichiers uploadés copiés vers : ${uploadsDest}`);
  } else {
    console.log('Aucun dossier uploads/ à sauvegarder.');
  }

  pruneOldBackups(backupsRoot);
  console.log('Sauvegarde terminée.');
}

function pruneOldBackups(backupsRoot: string) {
  if (!existsSync(backupsRoot)) return;
  const entries = readdirSync(backupsRoot)
    .map((name) => join(backupsRoot, name))
    .filter((path) => statSync(path).isDirectory())
    .sort();

  const toDelete = entries.slice(0, Math.max(0, entries.length - BACKUPS_TO_KEEP));
  for (const dir of toDelete) {
    rmSync(dir, { recursive: true, force: true });
    console.log(`Ancienne sauvegarde supprimée : ${dir}`);
  }
}

main().catch((err) => {
  console.error('Échec de la sauvegarde :', err.message ?? err);
  process.exit(1);
});
