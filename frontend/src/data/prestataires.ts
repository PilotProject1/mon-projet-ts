/**
 * Prestataires couverts par les pages « Résilier X ».
 *
 * Ces pages visent des recherches à forte intention (« résilier MAIF »,
 * « résilier Free »). Elles ne peuvent pas se contenter de décliner le même
 * texte avec un nom différent : un moteur de recherche traite un ensemble de
 * pages quasi identiques comme du contenu sans valeur et les déclasse toutes.
 * La substance vient donc du secteur — les règles de résiliation d'une
 * assurance, d'un forfait mobile et d'un contrat d'électricité n'ont rien à
 * voir — et le prestataire ne fait que désigner lequel s'applique.
 *
 * Aucune adresse postale ni aucun délai propre à un opérateur n'est affirmé
 * ici : ces informations changent sans prévenir, et une donnée fausse sur une
 * page qui prétend aider à résilier ferait manquer l'échéance qu'elle promet
 * de sauver. La date qui fait foi est celle lue sur le document déposé.
 */

export type Secteur = 'assurance' | 'telecom' | 'energie'

export interface Prestataire {
  /** Segment d'URL : /resilier/maif */
  slug: string
  nom: string
  secteur: Secteur
}

export interface DescriptionSecteur {
  /** Nom du type de contrat, au singulier, pour les phrases. */
  contrat: string
  /** Ce que le visiteur doit comprendre en premier. */
  principe: string
  /** Points pratiques, vérifiables et stables dans le temps. */
  points: string[]
  /** Page officielle de référence pour ce secteur. */
  source: { libelle: string; url: string }
}

export const SECTEURS: Record<Secteur, DescriptionSecteur> = {
  assurance: {
    contrat: 'contrat d’assurance',
    principe:
      'Passé la première année, un contrat d’assurance peut en général être résilié à tout moment, sans frais ni justification, la résiliation prenant effet un mois après sa réception. Avant ce terme, c’est la date d’échéance annuelle inscrite sur votre contrat qui commande.',
    points: [
      'Votre assureur doit vous rappeler la date limite de résiliation avant l’échéance annuelle. S’il ne l’a pas fait, vous disposez généralement d’un délai supplémentaire.',
      'Pour l’assurance emprunteur et certaines garanties obligatoires, des règles particulières s’appliquent : vérifiez vos conditions générales.',
      'Un nouvel assureur se charge le plus souvent des démarches à votre place pour l’auto et l’habitation.',
    ],
    source: {
      libelle: 'service-public.fr — résiliation d’un contrat d’assurance',
      url: 'https://www.service-public.fr/particuliers/vosdroits/F2123',
    },
  },
  telecom: {
    contrat: 'forfait ou abonnement',
    principe:
      'Hors période d’engagement, un forfait mobile ou une offre internet se résilie à tout moment. Pendant l’engagement, une résiliation anticipée reste possible mais les mensualités restantes peuvent être dues, en totalité ou en partie selon l’ancienneté du contrat.',
    points: [
      'Vérifiez d’abord si vous êtes encore engagé : la date de fin d’engagement figure sur votre facture ou dans votre espace client.',
      'Certains motifs — déménagement à l’étranger, perte d’emploi, situation de surendettement — permettent une résiliation sans frais. Un justificatif est demandé.',
      'Si vous changez d’opérateur en gardant votre numéro, la portabilité entraîne la résiliation : la demander deux fois ferait double emploi.',
    ],
    source: {
      libelle: 'service-public.fr — résiliation d’un contrat de téléphonie',
      url: 'https://www.service-public.fr/particuliers/vosdroits/F10896',
    },
  },
  energie: {
    contrat: 'contrat d’électricité ou de gaz',
    principe:
      'Un contrat d’électricité ou de gaz destiné à un particulier se résilie à tout moment, sans préavis et sans frais de résiliation. C’est le secteur où la démarche est la plus simple.',
    points: [
      'En cas de changement de fournisseur, le nouveau se charge de résilier l’ancien : vous n’avez rien à envoyer.',
      'Une lettre reste utile pour un déménagement ou une fermeture de compteur, où il faut communiquer un relevé et une date.',
      'Notez votre index de compteur le jour du départ : c’est lui qui détermine votre facture de clôture.',
    ],
    source: {
      libelle: 'service-public.fr — changement de fournisseur d’énergie',
      url: 'https://www.service-public.fr/particuliers/vosdroits/F16542',
    },
  },
}

export const PRESTATAIRES: Prestataire[] = [
  { slug: 'maif', nom: 'MAIF', secteur: 'assurance' },
  { slug: 'macif', nom: 'MACIF', secteur: 'assurance' },
  { slug: 'maaf', nom: 'MAAF', secteur: 'assurance' },
  { slug: 'axa', nom: 'AXA', secteur: 'assurance' },
  { slug: 'allianz', nom: 'Allianz', secteur: 'assurance' },
  { slug: 'groupama', nom: 'Groupama', secteur: 'assurance' },
  { slug: 'matmut', nom: 'Matmut', secteur: 'assurance' },
  { slug: 'gmf', nom: 'GMF', secteur: 'assurance' },
  { slug: 'direct-assurance', nom: 'Direct Assurance', secteur: 'assurance' },
  { slug: 'free', nom: 'Free', secteur: 'telecom' },
  { slug: 'orange', nom: 'Orange', secteur: 'telecom' },
  { slug: 'sfr', nom: 'SFR', secteur: 'telecom' },
  { slug: 'bouygues-telecom', nom: 'Bouygues Telecom', secteur: 'telecom' },
  { slug: 'sosh', nom: 'Sosh', secteur: 'telecom' },
  { slug: 'red-by-sfr', nom: 'RED by SFR', secteur: 'telecom' },
  { slug: 'edf', nom: 'EDF', secteur: 'energie' },
  { slug: 'engie', nom: 'Engie', secteur: 'energie' },
  { slug: 'totalenergies', nom: 'TotalEnergies', secteur: 'energie' },
]

export function prestatairePourSlug(slug: string): Prestataire | undefined {
  return PRESTATAIRES.find((p) => p.slug === slug)
}

/** Titre et description servis aux moteurs, partagés avec la prégénération. */
export function metaPrestataire(p: Prestataire) {
  const { contrat } = SECTEURS[p.secteur]
  return {
    titre: `Résilier ${p.nom} : lettre de résiliation gratuite | SYNeco`,
    description:
      `Résilier votre ${contrat} ${p.nom} : déposez le document, SYNeco y lit la date ` +
      `qui compte et rédige votre lettre. Gratuit, sans inscription.`,
  }
}
