import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { DOCUMENTS, type Attendu } from './comparaison/documents';

/*
 * Banc d'essai : quel modèle lit le mieux un document administratif, et à
 * quel prix ?
 *
 * L'extraction tourne aujourd'hui sur Opus 5, le modèle le plus cher du
 * catalogue, pour une tâche — reconnaître un émetteur, un montant, une date —
 * que de plus petits modèles savent faire. La question n'est pas de savoir
 * lequel coûte le moins : c'est de savoir si le moins cher lit aussi bien.
 * Une facture mal lue coûte infiniment plus qu'un dixième de centime
 * économisé.
 *
 *   npm run comparer-modeles
 *
 * Exige ANTHROPIC_API_KEY dans l'environnement. Le script n'écrit rien, ne
 * touche pas à la base, et n'envoie que les documents d'épreuve du dépôt —
 * ceux de personne d'autre.
 */

const MODELES = [
  { id: 'claude-opus-5', nom: 'Opus 5 (actuel)', entree: 5, sortie: 25 },
  { id: 'claude-sonnet-5', nom: 'Sonnet 5', entree: 3, sortie: 15 },
  { id: 'claude-haiku-4-5-20251001', nom: 'Haiku 4.5', entree: 1, sortie: 5 },
] as const;

/*
 * Repris à l'identique du service : comparer des modèles sur une consigne
 * différente de celle de production ne prouverait rien sur la production.
 */
const SYSTEM_PROMPT =
  "Tu extrais des champs structurés à partir du texte de documents administratifs français (factures, contrats, assurances, garanties, courriers). Réponds uniquement à partir du texte fourni. Si une information est absente ou incertaine, renvoie null plutôt que d'inventer une valeur. Pour l'échéance, ne retiens une date que si le document indique explicitement qu'une action est attendue avant elle : une date d'émission, de naissance ou de signature n'est pas une échéance.";

const CHAMPS = [
  'suggestedType',
  'suggestedProvider',
  'suggestedAmount',
  'suggestedDueDate',
  'suggestedReference',
  'suggestedPaid',
] as const;

const SCHEMA = {
  type: 'object',
  properties: {
    suggestedType: { type: ['string', 'null'] },
    suggestedProvider: { type: ['string', 'null'] },
    suggestedAmount: { type: ['number', 'null'] },
    suggestedDueDate: { type: ['string', 'null'] },
    suggestedReference: { type: ['string', 'null'] },
    suggestedPaid: { type: ['boolean', 'null'] },
  },
  required: [...CHAMPS],
  additionalProperties: false,
};

interface Resultat {
  champs: Record<string, unknown>;
  jetonsEntree: number;
  jetonsSortie: number;
  millisecondes: number;
}

/*
 * Deux valeurs se valent-elles ? On ne compare pas au caractère près : un
 * modèle qui répond « OVH » là où on attend « OVHcloud » a reconnu
 * l'émetteur, et le refuser noterait la forme au lieu du fond.
 */
function equivalent(champ: string, attendu: unknown, obtenu: unknown): boolean {
  if (attendu === null || attendu === undefined)
    return obtenu === null || obtenu === undefined;
  if (obtenu === null || obtenu === undefined) return false;

  if (typeof attendu === 'number' && typeof obtenu === 'number') {
    return Math.abs(attendu - obtenu) < 0.005;
  }
  if (typeof attendu === 'boolean') return attendu === obtenu;

  // Les dates se comparent avant tout nettoyage : un modèle qui répond
  // « 2026-09-05T00:00:00Z » a donné la bonne date, et retirer les tirets
  // avant de tronquer décalerait la comparaison au point de la déclarer
  // fausse.
  if (champ === 'suggestedDueDate') {
    return String(attendu).slice(0, 10) === String(obtenu).slice(0, 10);
  }

  const a = String(attendu).toLowerCase().replace(/[\s-]/g, '');
  const b = String(obtenu).toLowerCase().replace(/[\s-]/g, '');
  return a.includes(b) || b.includes(a);
}

async function interroger(
  client: Anthropic,
  modele: string,
  texte: string,
): Promise<Resultat> {
  const debut = Date.now();
  const reponse = await client.messages.create({
    model: modele,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: texte.slice(0, 8000) }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  });
  const millisecondes = Date.now() - debut;

  const bloc = reponse.content.find((b) => b.type === 'text');
  if (!bloc || bloc.type !== 'text') throw new Error('pas de bloc texte');

  return {
    champs: JSON.parse(bloc.text) as Record<string, unknown>,
    jetonsEntree: reponse.usage.input_tokens,
    jetonsSortie: reponse.usage.output_tokens,
    millisecondes,
  };
}

function centimes(euros: number): string {
  return `${(euros * 100).toFixed(3)} c`;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      'ANTHROPIC_API_KEY manquante. Ajoutez-la dans backend/.env — jamais dans le dépôt.',
    );
    process.exit(1);
  }
  const client = new Anthropic();

  // Un dollar en euros, pour parler dans la monnaie des factures Stripe.
  const TAUX = Number(process.env.TAUX_USD_EUR ?? '0.92');

  const bilan = new Map<
    string,
    {
      justes: number;
      total: number;
      cout: number;
      duree: number;
      erreurs: number;
    }
  >();
  for (const m of MODELES) {
    bilan.set(m.id, { justes: 0, total: 0, cout: 0, duree: 0, erreurs: 0 });
  }

  for (const doc of DOCUMENTS) {
    console.log(`\n${'═'.repeat(74)}`);
    console.log(`  ${doc.nom}`);
    console.log(`  ${doc.piege}`);
    console.log('═'.repeat(74));

    for (const modele of MODELES) {
      const suivi = bilan.get(modele.id)!;
      let resultat: Resultat;
      try {
        resultat = await interroger(client, modele.id, doc.texte);
      } catch (err) {
        suivi.erreurs += 1;
        console.log(
          `\n  ${modele.nom.padEnd(16)} ÉCHEC : ${(err as Error).message}`,
        );
        continue;
      }

      const cout =
        ((resultat.jetonsEntree / 1e6) * modele.entree +
          (resultat.jetonsSortie / 1e6) * modele.sortie) *
        TAUX;
      suivi.cout += cout;
      suivi.duree += resultat.millisecondes;

      const ecarts: string[] = [];
      for (const champ of CHAMPS) {
        suivi.total += 1;
        const attendu = (doc.attendu as unknown as Record<string, unknown>)[
          champ
        ];
        const obtenu = resultat.champs[champ];
        if (equivalent(champ, attendu, obtenu)) {
          suivi.justes += 1;
        } else {
          ecarts.push(
            `${champ} : attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`,
          );
        }
      }

      const note = `${CHAMPS.length - ecarts.length}/${CHAMPS.length}`;
      console.log(
        `\n  ${modele.nom.padEnd(16)} ${note}   ${resultat.millisecondes} ms   ${centimes(cout)}`,
      );
      for (const ecart of ecarts) console.log(`    ✗ ${ecart}`);
      if (ecarts.length === 0) console.log('    ✓ tous les champs');
    }
  }

  console.log(`\n${'═'.repeat(74)}`);
  console.log('  BILAN');
  console.log('═'.repeat(74));
  console.log(
    `\n  ${'Modèle'.padEnd(18)}${'Justes'.padEnd(12)}${'Moyenne'.padEnd(11)}${'Coût/doc'.padEnd(12)}Pour 1 000 docs`,
  );

  for (const modele of MODELES) {
    const s = bilan.get(modele.id)!;
    const passes = DOCUMENTS.length - s.erreurs;
    if (passes === 0) {
      console.log(`  ${modele.nom.padEnd(18)}aucune réponse exploitable`);
      continue;
    }
    const part = `${s.justes}/${s.total}`;
    const pourcent = `(${Math.round((s.justes / s.total) * 100)} %)`;
    const parDoc = s.cout / passes;
    console.log(
      `  ${modele.nom.padEnd(18)}${`${part} ${pourcent}`.padEnd(12)}` +
        `${`${Math.round(s.duree / passes)} ms`.padEnd(11)}` +
        `${centimes(parDoc).padEnd(12)}${(parDoc * 1000).toFixed(2)} €`,
    );
  }

  console.log(
    '\n  Prix publics au 18 août 2026, convertis à ' +
      `${TAUX} € pour 1 $. Sonnet 5 bénéficie d'un tarif de lancement\n` +
      "  jusqu'au 31 août 2026 : le coût réel est plus bas que celui affiché ici.",
  );
  console.log(
    "\n  Un modèle moins cher ne se choisit que s'il lit aussi bien : une facture\n" +
      "  mal lue coûte plus qu'un dixième de centime économisé.\n",
  );
}

main().catch((err) => {
  console.error('Échec de la comparaison :', err.message ?? err);
  process.exit(1);
});
