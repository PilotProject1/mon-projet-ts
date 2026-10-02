// Contrat entre le serveur de jeu et les téléphones des joueurs.
// Le serveur est seul maître de l'état : chaque téléphone reçoit une « vue »
// qui ne contient que ce que ce joueur a le droit de voir à cet instant.

export const MIN_JOUEURS = 3;
export const MAX_JOUEURS = 8;

export const AVATARS = ['🦊', '🐼', '🐸', '🐙', '🦄', '🐯', '🐧', '🦉', '🐵', '🐨', '🦖', '🐝'] as const;

export type Mode = 'qui2nous' | 'quiARepondu' | 'qui2photo';

/** Photo envoyée : côté plus long (px) et taille maximale de l'envoi (data URL). */
export const PHOTO_COTE_MAX = 1280;
export const PHOTO_TAILLE_MAX = 1_500_000;

export const MODES: Record<Mode, { nom: string; consigne: string }> = {
  qui2nous: {
    nom: 'Qui2Nous ?',
    consigne: 'Désigne en secret le joueur qui correspond le mieux à la question.',
  },
  quiARepondu: {
    nom: 'Qui a répondu ?',
    consigne: 'Réponds en secret. Ensuite, retrouve qui a écrit chaque réponse.',
  },
  qui2photo: {
    nom: 'Qui2Photo ?',
    consigne: 'Choisis une photo de ta galerie. Ensuite, retrouve à qui appartient chaque photo.',
  },
};

/** D'où viennent les questions de la partie (étape 4 de la feuille de route). */
export type SourceQuestions = 'auto' | 'createur' | 'collectif';

export const SOURCES: Record<SourceQuestions, { nom: string; description: string }> = {
  auto: { nom: 'Automatiques', description: 'Les questions de la bibliothèque du jeu.' },
  createur: { nom: 'Mode créateur', description: 'Seul le créateur du salon écrit les questions.' },
  collectif: { nom: 'Mode collectif', description: 'Chaque joueur propose ses propres questions.' },
};

export const MAX_QUESTIONS_PAR_JOUEUR = 5;
export const LONGUEUR_MAX_QUESTION = 120;

export type Phase = 'lobby' | 'redaction' | 'decompte' | 'reponse' | 'vote' | 'resultat' | 'podium';

export interface JoueurVue {
  id: string;
  nom: string;
  avatar: string;
  score: number;
  connecte: boolean;
  /** Arrivé en cours de manche : joue à partir de la suivante. */
  enAttente: boolean;
  /** Faux joueur pour tester seul : il répond et vote au hasard. */
  robot: boolean;
}

export interface Question {
  mode: Mode;
  categorie: string;
  texte: string;
  /** Écrite par un joueur. Son auteur n'est jamais révélé. */
  perso?: boolean;
}

export interface Gain {
  points: number;
  raisons: string[];
}

export type Resultat =
  | {
      mode: 'qui2nous';
      /** Joueurs désignés, du plus au moins voté, avec ceux qui les ont désignés. */
      decompte: { joueurId: string; votants: string[] }[];
      gains: Record<string, Gain>;
    }
  | {
      mode: 'quiARepondu' | 'qui2photo';
      /** Pour une photo, `texte` est vide : l'image se charge depuis /photo/:code/:id. */
      reponses: { id: string; texte: string; photo: boolean; auteurId: string; trouvePar: string[] }[];
      gains: Record<string, Gain>;
    };

export interface Titre {
  emoji: string;
  intitule: string;
  joueurId: string;
}

export interface Vue {
  code: string;
  moi: string;
  hoteId: string;
  joueurs: JoueurVue[];
  phase: Phase;
  manche: number;
  totalManches: number;
  grandeFinale: boolean;
  /** Échéance de la phase en cours (horodatage serveur, ms). */
  echeance: number | null;
  /** Heure du serveur à l'envoi, pour corriger l'horloge du téléphone. */
  maintenant: number;
  question: Question | null;
  sourceQuestions: SourceQuestions;
  /** Le créateur a gardé le mode Qui2Photo pour cette partie. */
  photos: boolean;
  /** Phase de rédaction : qui écrit des questions, et qui a terminé. */
  redacteurs: string[];
  ontFini: string[];
  mesQuestions: { id: string; texte: string; mode: Mode }[];
  /** Nombre de questions écrites par le groupe (sans dire par qui). */
  nbQuestionsGroupe: number;
  /** Joueurs attendus pour cette manche. */
  participants: string[];
  ontRepondu: string[];
  ontVote: string[];
  /** Joueur désigné, texte écrit, ou « photo » une fois la photo envoyée. */
  maReponse: string | null;
  /** Phase de vote de « Qui a répondu ? » : réponses mélangées, anonymes. */
  reponsesAnonymes: { id: string; texte: string; photo: boolean; estLaMienne: boolean }[];
  resultat: Resultat | null;
  titres: Titre[];
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; erreur: string };

export interface ClientVersServeur {
  creer: (p: { nom: string; avatar: string }, ack: (r: Ack<{ code: string; jeton: string }>) => void) => void;
  rejoindre: (
    p: { code: string; nom: string; avatar: string },
    ack: (r: Ack<{ code: string; jeton: string }>) => void,
  ) => void;
  reprendre: (p: { code: string; jeton: string }, ack: (r: Ack) => void) => void;
  ajouterRobot: (ack: (r: Ack) => void) => void;
  retirerRobot: (p: { id: string }, ack: (r: Ack) => void) => void;
  lancer: (p: { manches: number; questions: SourceQuestions; photos: boolean }, ack: (r: Ack) => void) => void;
  proposerQuestion: (p: { texte: string; mode: Mode }, ack: (r: Ack) => void) => void;
  retirerQuestion: (p: { id: string }, ack: (r: Ack) => void) => void;
  finirRedaction: (ack: (r: Ack) => void) => void;
  repondre: (p: { valeur: string }, ack: (r: Ack) => void) => void;
  voter: (p: { attributions: Record<string, string> }, ack: (r: Ack) => void) => void;
  suivant: (ack: (r: Ack) => void) => void;
  rejouer: (ack: (r: Ack) => void) => void;
  quitter: () => void;
}

export interface ServeurVersClient {
  vue: (v: Vue) => void;
}
