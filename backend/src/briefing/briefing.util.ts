/*
 * Ce qui demande une décision, dit en une fois.
 *
 * Le reste du service attend qu'on l'interroge : il faut ouvrir les
 * échéances, faire défiler les documents, comparer deux factures. Le briefing
 * fait l'inverse — il parle en premier, et seulement quand il a quelque chose
 * à dire. C'est ce qui distingue un coffre-fort d'un dossier de fichiers.
 *
 * Deux règles y président. Ne rien dire plutôt que meubler : un briefing qui
 * parle tous les jours n'est plus lu au bout d'une semaine. Et ne dire que ce
 * qui appelle un geste : « vous avez 14 documents » n'appelle rien.
 */

export type Urgence = 'urgent' | 'attention' | 'information';

export interface PointBriefing {
  /** Sert de clé d'affichage et de repère dans les tests. */
  kind:
    | 'echeances_depassees'
    | 'echeances_proches'
    | 'echeances_proposees'
    | 'hausses'
    | 'quota';
  urgence: Urgence;
  message: string;
  actionLabel: string;
  actionTo: string;
}

export interface EntreesBriefing {
  /** Échéances restant à faire. */
  deadlines: { id: string; title: string; dueDate: Date }[];
  /** Documents portant une échéance proposée non tranchée. */
  proposees: { id: string; name: string }[];
  /** Séries dont le montant a sensiblement augmenté. */
  hausses: { provider: string; variation: number }[];
  /** Quota de documents du plan ; max null pour illimité. */
  quota: { used: number; max: number | null };
}

const JOUR_MS = 86_400_000;

/** Fenêtre de ce qui est « proche » : la semaine devant soi. */
const HORIZON_JOURS = 7;

/** Part du quota atteinte à partir de laquelle il vaut la peine d'être dit. */
const SEUIL_QUOTA = 0.8;

function jourSeul(date: Date): number {
  return Math.floor(date.getTime() / JOUR_MS);
}

function pluriel(nombre: number, singulier: string, pluriel: string): string {
  return nombre > 1 ? pluriel : singulier;
}

/**
 * Points du briefing, du plus urgent au moins pressant.
 *
 * Un tableau vide est un résultat parfaitement normal — et même celui qu'on
 * souhaite à l'utilisateur.
 */
export function composerBriefing(
  entrees: EntreesBriefing,
  maintenant = new Date(),
): PointBriefing[] {
  const points: PointBriefing[] = [];
  const aujourdhui = jourSeul(maintenant);

  const depassees = entrees.deadlines.filter(
    (d) => jourSeul(d.dueDate) < aujourdhui,
  );
  const proches = entrees.deadlines.filter((d) => {
    const jour = jourSeul(d.dueDate);
    return jour >= aujourdhui && jour <= aujourdhui + HORIZON_JOURS;
  });

  if (depassees.length > 0) {
    points.push({
      kind: 'echeances_depassees',
      urgence: 'urgent',
      message:
        depassees.length === 1
          ? `« ${depassees[0].title} » est dépassée.`
          : `${depassees.length} échéances sont dépassées, dont « ${depassees[0].title} ».`,
      actionLabel: 'Voir les échéances',
      actionTo: '/echeances',
    });
  }

  if (proches.length > 0) {
    points.push({
      kind: 'echeances_proches',
      urgence: 'attention',
      message:
        proches.length === 1
          ? `« ${proches[0].title} » arrive dans les sept jours.`
          : `${proches.length} échéances arrivent dans les sept jours.`,
      actionLabel: 'Voir les échéances',
      actionTo: '/echeances',
    });
  }

  if (entrees.proposees.length > 0) {
    const n = entrees.proposees.length;
    points.push({
      kind: 'echeances_proposees',
      urgence: 'attention',
      // Le geste est minuscule et le gain énorme : sans cette décision,
      // aucun rappel ne partira pour ce document.
      message:
        n === 1
          ? `Une échéance a été repérée dans « ${entrees.proposees[0].name} » et attend votre accord.`
          : `${n} échéances repérées dans vos documents attendent votre accord.`,
      actionLabel: pluriel(n, 'Voir le document', 'Voir les documents'),
      actionTo: '/documents',
    });
  }

  if (entrees.hausses.length > 0) {
    const premiere = entrees.hausses[0];
    const autres = entrees.hausses.length - 1;
    points.push({
      kind: 'hausses',
      urgence: 'attention',
      message:
        autres === 0
          ? `Votre dépense chez ${premiere.provider} a augmenté de ${formatEuros(premiere.variation)}.`
          : `Votre dépense chez ${premiere.provider} a augmenté de ${formatEuros(premiere.variation)}, et ${autres} autre${autres > 1 ? 's' : ''} également.`,
      actionLabel: 'Voir le détail',
      actionTo: '/',
    });
  }

  const { used, max } = entrees.quota;
  if (max !== null && used >= max * SEUIL_QUOTA) {
    points.push({
      kind: 'quota',
      urgence: used >= max ? 'attention' : 'information',
      message:
        used >= max
          ? `Votre offre est pleine : ${used} documents sur ${max}. Aucun nouveau document ne peut être déposé.`
          : `Il vous reste ${max - used} ${pluriel(max - used, 'document', 'documents')} sur les ${max} de votre offre.`,
      actionLabel: 'Voir les offres',
      actionTo: '/abonnement',
    });
  }

  return points;
}

function formatEuros(montant: number): string {
  return `${montant.toFixed(2).replace('.', ',')} €`;
}
