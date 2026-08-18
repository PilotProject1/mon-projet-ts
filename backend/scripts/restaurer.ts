import 'dotenv/config';
import { writeFile } from 'fs/promises';
import { gunzipSync } from 'zlib';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { BackupDepot } from '../src/backup/backup-depot';
import { dechiffrer } from '../src/backup/backup-crypto';

/*
 * Restauration d'une sauvegarde.
 *
 * Ce script existe parce qu'une sauvegarde qu'on ne sait pas restaurer ne
 * vaut rien, et qu'on ne veut pas écrire ce script le jour où il faut s'en
 * servir. Il fait deux choses, et la première est la seule qu'on utilisera
 * sans doute jamais en urgence :
 *
 *   npm run restaurer -- --lister
 *       Ce que contient le dépôt.
 *
 *   npm run restaurer -- <clé>
 *       Déchiffre la sauvegarde vers un fichier JSON lisible, sans rien
 *       toucher à la base. C'est ce qu'on veut dans 90 % des cas : retrouver
 *       une ligne effacée, vérifier un contenu, comparer.
 *
 *   npm run restaurer -- <clé> --reinjecter --je-confirme
 *       Vide la base et y recharge la sauvegarde. Les deux drapeaux sont
 *       exigés séparément parce que cette commande détruit tout ce que la
 *       base contient aujourd'hui.
 *
 * L'exercer une fois, à froid, sur une base de test, vaut mieux que de
 * découvrir le jour venu qu'on avait mal lu.
 */

/** Ordre de réinsertion : les parents avant les enfants. */
const TABLES = [
  'User',
  'Document',
  'Deadline',
  'Contract',
  'ShareLink',
  'ShareLinkAccess',
  'Company',
  'Client',
  'Invoice',
  'Notification',
  'PushSubscription',
  'TwoFactorRecoveryCode',
] as const;

function modele(table: string): string {
  return table.charAt(0).toLowerCase() + table.slice(1);
}

/** Les dates sortent du JSON comme des chaînes ; Prisma les veut en Date. */
const FORME_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function ranimerLesDates(ligne: Record<string, unknown>) {
  for (const [champ, valeur] of Object.entries(ligne)) {
    if (typeof valeur === 'string' && FORME_DATE.test(valeur)) {
      ligne[champ] = new Date(valeur);
    }
  }
  return ligne;
}

async function main() {
  const args = process.argv.slice(2);
  const depot = new BackupDepot();

  if (args.includes('--lister')) {
    const objets = await depot.lister();
    if (objets.length === 0) {
      console.log(`Aucune sauvegarde dans ${depot.emplacement}`);
      return;
    }
    console.log(`${objets.length} sauvegarde(s) dans ${depot.emplacement} :`);
    for (const objet of objets) {
      const taille = objet.taille
        ? ` (${Math.round(objet.taille / 1024)} Kio)`
        : '';
      console.log(`  ${objet.cle}${taille}`);
    }
    return;
  }

  const cle = args.find((a) => !a.startsWith('--'));
  if (!cle) {
    console.error(
      'Usage : npm run restaurer -- --lister\n' +
        '        npm run restaurer -- <clé>\n' +
        '        npm run restaurer -- <clé> --reinjecter --je-confirme',
    );
    process.exit(1);
  }

  console.log(`Lecture de ${cle} depuis ${depot.emplacement}...`);
  const contenu = JSON.parse(
    gunzipSync(dechiffrer(await depot.relire(cle))).toString('utf8'),
  ) as {
    version: number;
    creeeLe: string;
    tables: Record<string, Record<string, unknown>[]>;
  };

  const total = Object.values(contenu.tables).reduce((s, r) => s + r.length, 0);
  console.log(`Sauvegarde du ${contenu.creeeLe} — ${total} ligne(s) :`);
  for (const table of TABLES) {
    console.log(`  ${table.padEnd(24)} ${contenu.tables[table]?.length ?? 0}`);
  }

  if (!args.includes('--reinjecter')) {
    const fichier = `restauration-${cle.replace(/\.syneco$/, '')}.json`;
    await writeFile(fichier, JSON.stringify(contenu, null, 2));
    console.log(`\nÉcrit en clair dans ${fichier}`);
    console.log(
      'Ce fichier contient des données personnelles : le supprimer une fois consulté.',
    );
    return;
  }

  if (!args.includes('--je-confirme')) {
    console.error(
      '\nRefus : --reinjecter vide la base avant de recharger.\n' +
        'Ajouter --je-confirme si c’est bien ce que vous voulez.',
    );
    process.exit(1);
  }

  // Prisma 7 exige un adaptateur : sans lui, le client refuse de se
  // connecter. Le même que celui du service de l'application.
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const client = prisma as unknown as Record<
    string,
    {
      deleteMany: () => Promise<unknown>;
      createMany: (a: unknown) => Promise<{ count: number }>;
    }
  >;

  console.log('\nVidage de la base...');
  // Dans l'ordre inverse : les enfants avant les parents.
  for (const table of [...TABLES].reverse()) {
    await client[modele(table)].deleteMany();
  }

  console.log('Rechargement...');
  for (const table of TABLES) {
    const rangees = (contenu.tables[table] ?? []).map(ranimerLesDates);
    if (rangees.length === 0) continue;
    const { count } = await client[modele(table)].createMany({ data: rangees });
    console.log(`  ${table.padEnd(24)} ${count}`);
  }

  await prisma.$disconnect();
  console.log('\nRestauration terminée.');
}

main().catch((err) => {
  console.error('Échec de la restauration :', err.message ?? err);
  process.exit(1);
});
