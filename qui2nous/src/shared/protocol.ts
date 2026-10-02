// Contrat entre le serveur de jeu et les téléphones des joueurs.
// Le serveur est seul maître de l'état : chaque téléphone reçoit une « vue »
// qui ne contient que ce que ce joueur a le droit de voir à cet instant.

export const MIN_JOUEURS = 3;
export const MAX_JOUEURS = 8;

export const AVATARS = ['🦊', '🐼', '🐸', '🐙', '🦄', '🐯', '🐧', '🦉', '🐵', '🐨', '🦖', '🐝'] as const;

export type Mode = 'qui2nous' | 'quiARepondu';

export const MODES: Record<Mode, { nom: string; consigne: string }> = {
  qui2nous: {
    nom: 'Qui2Nous ?',
    consigne: 'Désigne en secret le joueur qui correspond le mieux à la question.',
  },
  quiARepondu: {
    nom: 'Qui a répondu ?',
    consigne: 'Réponds en secret. Ensuite, retrouve qui a écrit chaque réponse.',
  },
};

export type Phase = 'lobby' | 'decompte' | 'reponse' | 'vote' | 'resultat' | 'podium';

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
      mode: 'quiARepondu';
      reponses: { id: string; texte: string; auteurId: string; trouvePar: string[] }[];
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
  /** Joueurs attendus pour cette manche. */
  participants: string[];
  ontRepondu: string[];
  ontVote: string[];
  maReponse: string | null;
  /** Phase de vote de « Qui a répondu ? » : réponses mélangées, anonymes. */
  reponsesAnonymes: { id: string; texte: string; estLaMienne: boolean }[];
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
  lancer: (p: { manches: number }, ack: (r: Ack) => void) => void;
  repondre: (p: { valeur: string }, ack: (r: Ack) => void) => void;
  voter: (p: { attributions: Record<string, string> }, ack: (r: Ack) => void) => void;
  suivant: (ack: (r: Ack) => void) => void;
  rejouer: (ack: (r: Ack) => void) => void;
  quitter: () => void;
}

export interface ServeurVersClient {
  vue: (v: Vue) => void;
}
