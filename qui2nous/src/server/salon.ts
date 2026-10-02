import { randomBytes, randomUUID } from 'node:crypto';
import {
  AVATARS,
  IMAGE_TAILLE_MAX,
  LONGUEUR_MAX_QUESTION,
  MAX_JOUEURS,
  MAX_QUESTIONS_PAR_JOUEUR,
  MIN_JOUEURS,
  ORDRE_MODES,
  estModeImage,
  type Gain,
  type Mode,
  type Phase,
  type Question,
  type Resultat,
  type SourceQuestions,
  type Statistiques,
  type Titre,
  type Vue,
} from '../shared/protocol.ts';
import { QUESTIONS, QUESTIONS_FINALE } from '../shared/questions.ts';
import { imageRobot } from './imageRobot.ts';

// Barème (phase 9 de la feuille de route).
export const POINTS = {
  identification: 500,
  identificationDifficile: 400,
  anticipation: 300,
  rapiditeMax: 200,
} as const;

export const DUREES = {
  redaction: 120_000,
  decompte: 3_500,
  reponse: { qui2nous: 25_000, quiARepondu: 60_000, qui2photo: 60_000, qui2dessine: 80_000 } satisfies Record<
    Mode,
    number
  >,
  vote: 60_000,
} as const;

export const MANCHES_POSSIBLES = [4, 6, 8] as const;

// Robots : de faux amis pour tester une partie seul. Ils répondent et votent
// au hasard, après un délai qui imite un humain qui réfléchit.
const ROBOTS = ['Robot Bob', 'Robot Zoé', 'Robot Max', 'Robot Lili', 'Robot Gus', 'Robot Nina', 'Robot Tom'];
const REPONSES_ROBOT = [
  'Les brocolis tièdes',
  'Une licorne gonflable',
  'Danser la macarena',
  'Mon grille-pain',
  'Un câlin de chat',
  'Le karaoké du mardi',
  'Des chaussettes dépareillées',
  'Une pizza à l’ananas',
  'Courir après le bus',
  'Bip bip, je ne sais pas',
];
const QUESTIONS_ROBOT: { mode: Mode; texte: string }[] = [
  { mode: 'qui2nous', texte: 'Qui de nous parle à ses plantes ?' },
  { mode: 'qui2nous', texte: 'Qui de nous mange le dessert en premier ?' },
  { mode: 'qui2nous', texte: 'Qui de nous se perdrait dans son propre quartier ?' },
  { mode: 'quiARepondu', texte: 'Ton snack de minuit préféré ?' },
  { mode: 'quiARepondu', texte: 'Le pire prénom pour un chat ?' },
  { mode: 'quiARepondu', texte: 'Ce que tu emporterais sur Mars ?' },
  { mode: 'qui2photo', texte: 'La photo la plus étrange de ta galerie.' },
  { mode: 'qui2dessine', texte: 'Dessine un robot qui fait la fête.' },
];
export const DELAIS_ROBOT = {
  redaction: [3_000, 8_000],
  reponse: {
    qui2nous: [2_000, 9_000],
    quiARepondu: [4_000, 15_000],
    qui2photo: [4_000, 15_000],
    qui2dessine: [6_000, 20_000],
  },
  vote: [3_000, 10_000],
} as const;

export class ErreurJeu extends Error {}

/** Photo ou dessin envoyé par un joueur. */
export interface ImageJeu {
  type: 'image/jpeg' | 'image/png';
  octets: Buffer;
}

/**
 * Image envoyée par un téléphone : une data URL JPEG ou PNG dont le contenu
 * commence bien par la signature du format annoncé. Tout le reste est refusé
 * (SVG compris, qui pourrait embarquer du script).
 */
export function lireImage(valeur: unknown): ImageJeu {
  const v = String(valeur ?? '');
  if (v.length > IMAGE_TAILLE_MAX) throw new ErreurJeu('Image trop lourde, choisis-en une autre.');
  const m = /^data:(image\/jpeg|image\/png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(v);
  if (!m) throw new ErreurJeu('Ce fichier n’est pas une image.');
  const type = m[1] as ImageJeu['type'];
  const octets = Buffer.from(m[2], 'base64');
  const signature = type === 'image/jpeg' ? [0xff, 0xd8, 0xff] : [0x89, 0x50, 0x4e, 0x47];
  if (!signature.every((o, i) => octets[i] === o)) throw new ErreurJeu('Ce fichier n’est pas une image.');
  return { type, octets };
}

const statsVides = (): Statistiques => ({
  trouves: 0,
  devine: 0,
  designe: 0,
  anticipations: 0,
  photos: 0,
  dessins: 0,
});

interface Joueur {
  id: string;
  jeton: string;
  nom: string;
  avatar: string;
  score: number;
  connecte: boolean;
  enAttente: boolean;
  robot: boolean;
  stats: Statistiques;
}

export interface Horloge {
  maintenant: () => number;
  planifier: (ms: number, fn: () => void) => () => void;
}

const horlogeReelle: Horloge = {
  maintenant: () => Date.now(),
  planifier: (ms, fn) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
};

function melanger<T>(t: T[], hasard: () => number): T[] {
  const r = [...t];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function nettoyerNom(nom: unknown): string {
  const n = String(nom ?? '').replace(/\s+/g, ' ').trim().slice(0, 16);
  if (!n) throw new ErreurJeu('Choisis un pseudo.');
  return n;
}

export function nettoyerAvatar(avatar: unknown): string {
  return (AVATARS as readonly string[]).includes(String(avatar)) ? String(avatar) : AVATARS[0];
}

/** Modes demandés par le créateur, dans l'ordre de rotation ; tous si la demande est vide ou invalide. */
export function nettoyerModes(modes: unknown): Mode[] {
  const demandes = Array.isArray(modes) ? modes : [];
  const valides = ORDRE_MODES.filter((m) => demandes.includes(m));
  return valides.length ? valides : [...ORDRE_MODES];
}

export class Salon {
  readonly joueurs = new Map<string, Joueur>();
  hoteId = '';
  phase: Phase = 'lobby';
  manche = 0;
  totalManches = 6;
  question: Question | null = null;
  participants: string[] = [];
  echeance: number | null = null;
  resultat: Resultat | null = null;
  titres: Titre[] = [];
  sourceQuestions: SourceQuestions = 'auto';
  /** Modes choisis dans le lobby (un groupe peut refuser les photos, par exemple). */
  modes: Mode[] = [...ORDRE_MODES];
  /** Qui écrit des questions pendant la phase de rédaction. */
  redacteurs: string[] = [];
  /** Réponse secrète de chaque participant : un joueurId (Qui2Nous), un texte, ou une image. */
  private reponses = new Map<string, { valeur: string; a: number; image?: ImageJeu }>();
  private debutReponse = 0;
  private votes = new Map<string, Record<string, string>>();
  private anonymes: { id: string; texte: string; auteurId: string; image?: ImageJeu }[] = [];
  private dejaPosees = new Set<string>();
  private finis = new Set<string>();
  private propositions: { id: string; auteurId: string; texte: string; mode: Mode }[] = [];
  /** Questions de chaque manche, décidées au lancement. */
  private plan: Question[] = [];
  private annulerMinuteur: (() => void) | null = null;
  private annulerRobots: (() => void)[] = [];

  constructor(
    readonly code: string,
    private readonly surChangement: () => void,
    private readonly horloge: Horloge = horlogeReelle,
    private readonly hasard: () => number = Math.random,
  ) {}

  // ——— Joueurs ———

  ajouter(nom: unknown, avatar: unknown): Joueur {
    if (this.joueurs.size >= MAX_JOUEURS) throw new ErreurJeu(`Le salon est complet (${MAX_JOUEURS} joueurs).`);
    const n = nettoyerNom(nom);
    if ([...this.joueurs.values()].some((j) => j.nom.toLowerCase() === n.toLowerCase())) {
      throw new ErreurJeu('Ce pseudo est déjà pris dans ce salon.');
    }
    const j: Joueur = {
      id: randomUUID(),
      jeton: randomBytes(18).toString('base64url'),
      nom: n,
      avatar: nettoyerAvatar(avatar),
      score: 0,
      connecte: true,
      enAttente: this.phase !== 'lobby',
      robot: false,
      stats: statsVides(),
    };
    this.joueurs.set(j.id, j);
    if (!this.hoteId) this.hoteId = j.id;
    this.surChangement();
    return j;
  }

  ajouterRobot(id: string): Joueur {
    if (id !== this.hoteId) throw new ErreurJeu('Seul le créateur du salon peut ajouter un robot.');
    if (this.phase !== 'lobby') throw new ErreurJeu('On ajoute les robots avant de lancer la partie.');
    if (this.joueurs.size >= MAX_JOUEURS) throw new ErreurJeu(`Le salon est complet (${MAX_JOUEURS} joueurs).`);
    const pris = new Set([...this.joueurs.values()].map((j) => j.nom.toLowerCase()));
    const nom = ROBOTS.find((n) => !pris.has(n.toLowerCase()));
    if (!nom) throw new ErreurJeu('Plus de robot disponible.');
    const j: Joueur = {
      id: randomUUID(),
      jeton: randomBytes(18).toString('base64url'),
      nom,
      avatar: '🤖',
      score: 0,
      connecte: true,
      enAttente: false,
      robot: true,
      stats: statsVides(),
    };
    this.joueurs.set(j.id, j);
    this.surChangement();
    return j;
  }

  retirerRobot(id: string, robotId: unknown) {
    if (id !== this.hoteId) throw new ErreurJeu('Seul le créateur du salon peut retirer un robot.');
    if (this.phase !== 'lobby') throw new ErreurJeu('On retire les robots avant de lancer la partie.');
    const r = this.joueurs.get(String(robotId));
    if (!r?.robot) throw new ErreurJeu('Ce joueur n’est pas un robot.');
    this.retirer(r.id);
  }

  parJeton(jeton: string): Joueur | undefined {
    return [...this.joueurs.values()].find((j) => j.jeton === jeton);
  }

  connexion(id: string, connecte: boolean) {
    const j = this.joueurs.get(id);
    if (!j || j.connecte === connecte) return;
    j.connecte = connecte;
    this.surChangement();
    if (!connecte) this.verifierFinDePhase();
  }

  retirer(id: string) {
    if (!this.joueurs.delete(id)) return;
    this.participants = this.participants.filter((p) => p !== id);
    if (this.hoteId === id) {
      const humains = [...this.joueurs.values()].filter((j) => !j.robot);
      const suivant = humains.find((j) => j.connecte) ?? humains[0];
      this.hoteId = suivant?.id ?? '';
    }
    this.surChangement();
    this.verifierFinDePhase();
  }

  /** Plus aucun humain : les robots seuls ne font pas vivre un salon. */
  get vide() {
    return [...this.joueurs.values()].every((j) => j.robot);
  }

  get toutLeMondeDeconnecte() {
    return [...this.joueurs.values()].every((j) => j.robot || !j.connecte);
  }

  private connectes() {
    return [...this.joueurs.values()].filter((j) => j.connecte);
  }

  /** L'hôte décide ; s'il a perdu la connexion, n'importe qui peut faire avancer la partie. */
  private peutPiloter(id: string) {
    return id === this.hoteId || !this.joueurs.get(this.hoteId)?.connecte;
  }

  // ——— Déroulement ———

  lancer(id: string, manches: number, source: unknown = 'auto', modes: unknown = ORDRE_MODES) {
    if (id !== this.hoteId) throw new ErreurJeu('Seul le créateur du salon peut lancer la partie.');
    if (this.phase !== 'lobby') throw new ErreurJeu('La partie est déjà lancée.');
    if (this.connectes().length < MIN_JOUEURS) {
      throw new ErreurJeu(`Il faut au moins ${MIN_JOUEURS} joueurs connectés.`);
    }
    this.totalManches = (MANCHES_POSSIBLES as readonly number[]).includes(manches) ? manches : 6;
    this.manche = 0;
    for (const j of this.joueurs.values()) {
      j.score = 0;
      j.stats = statsVides();
    }
    this.sourceQuestions = source === 'createur' || source === 'collectif' ? source : 'auto';
    this.modes = nettoyerModes(modes);
    this.propositions = [];
    this.finis.clear();
    if (this.sourceQuestions === 'auto') {
      this.redacteurs = [];
      this.construirePlan();
      return this.mancheSuivante();
    }
    this.redacteurs = this.sourceQuestions === 'createur' ? [this.hoteId] : [...this.joueurs.keys()];
    this.passerA('redaction', DUREES.redaction, () => this.finRedaction());
  }

  // ——— Questions personnalisées ———

  proposerQuestion(id: string, texte: unknown, mode: unknown) {
    if (this.phase !== 'redaction') throw new ErreurJeu('Ce n’est pas le moment d’écrire des questions.');
    if (!this.redacteurs.includes(id)) throw new ErreurJeu('Dans ce mode, c’est le créateur qui écrit les questions.');
    if (this.finis.has(id)) throw new ErreurJeu('Tu as déjà terminé.');
    if (!this.modes.includes(mode as Mode)) throw new ErreurJeu('Type de question indisponible dans cette partie.');
    const t = String(texte ?? '').replace(/\s+/g, ' ').trim().slice(0, LONGUEUR_MAX_QUESTION);
    if (t.length < 8) throw new ErreurJeu('Ta question est trop courte.');
    const miennes = this.propositions.filter((q) => q.auteurId === id);
    if (miennes.length >= MAX_QUESTIONS_PAR_JOUEUR) {
      throw new ErreurJeu(`${MAX_QUESTIONS_PAR_JOUEUR} questions maximum par joueur.`);
    }
    if (this.propositions.some((q) => q.texte.toLowerCase() === t.toLowerCase())) {
      throw new ErreurJeu('Cette question est déjà proposée.');
    }
    this.propositions.push({ id: randomUUID(), auteurId: id, texte: t, mode: mode as Mode });
    this.surChangement();
  }

  retirerQuestion(id: string, questionId: unknown) {
    if (this.phase !== 'redaction') throw new ErreurJeu('Les questions sont déjà distribuées.');
    const avant = this.propositions.length;
    this.propositions = this.propositions.filter((q) => !(q.id === questionId && q.auteurId === id));
    if (this.propositions.length === avant) throw new ErreurJeu('Question introuvable.');
    this.surChangement();
  }

  finirRedaction(id: string) {
    if (this.phase !== 'redaction') throw new ErreurJeu('Ce n’est pas le moment.');
    if (!this.redacteurs.includes(id)) throw new ErreurJeu('Tu n’écris pas de questions dans ce mode.');
    this.finis.add(id);
    this.surChangement();
    this.verifierFinDePhase();
  }

  private finRedaction() {
    if (this.phase !== 'redaction') return;
    this.construirePlan();
    this.mancheSuivante();
  }

  /**
   * Toutes les manches sauf la dernière : questions du groupe d'abord (au plus
   * une par manche), complétées par la bibliothèque. Sans question du groupe,
   * les modes tournent dans l'ordre ; avec, tout est mélangé pour ne pas
   * trahir les auteurs. La dernière manche est toujours la grande finale.
   */
  private construirePlan() {
    const ordinaires = this.totalManches - 1;
    const perso: Question[] = melanger(this.propositions, this.hasard)
      .slice(0, ordinaires)
      .map((q) => ({ mode: q.mode, categorie: '✏️ Question du groupe', texte: q.texte, perso: true }));
    const plan = [...perso];
    while (plan.length < ordinaires) {
      const nb = (m: Mode) => plan.filter((q) => q.mode === m).length;
      const mode =
        perso.length === 0
          ? this.modes[plan.length % this.modes.length]
          : this.modes.reduce((a, b) => (nb(b) < nb(a) ? b : a));
      plan.push(this.tirerQuestion(mode));
    }
    this.plan = [...(perso.length ? melanger(plan, this.hasard) : plan), this.questionFinale(plan)];
  }

  /**
   * Question de finale, dans le mode le moins joué jusque-là : une partie de
   * 4 manches fait ainsi passer les 4 modes.
   */
  private questionFinale(plan: Question[]): Question {
    const nb = (m: Mode) => plan.filter((q) => q.mode === m).length;
    const mode = this.modes.reduce((a, b) => (nb(b) < nb(a) ? b : a));
    return this.auHasard(QUESTIONS_FINALE[mode]);
  }

  suivant(id: string) {
    if (this.phase !== 'resultat') throw new ErreurJeu('Rien à passer pour le moment.');
    if (!this.peutPiloter(id)) throw new ErreurJeu('C’est le créateur du salon qui passe à la suite.');
    if (this.manche >= this.totalManches) this.terminer();
    else this.mancheSuivante();
  }

  rejouer(id: string) {
    if (this.phase !== 'podium') throw new ErreurJeu('La partie n’est pas terminée.');
    if (!this.peutPiloter(id)) throw new ErreurJeu('C’est le créateur du salon qui relance.');
    this.arreterMinuteur();
    this.phase = 'lobby';
    this.manche = 0;
    this.question = null;
    this.resultat = null;
    this.titres = [];
    this.echeance = null;
    this.plan = [];
    this.propositions = [];
    this.redacteurs = [];
    this.finis.clear();
    for (const j of this.joueurs.values()) {
      j.enAttente = false;
      j.score = 0;
      j.stats = statsVides();
    }
    this.surChangement();
  }

  get grandeFinale() {
    return this.totalManches >= 3 && this.manche === this.totalManches;
  }

  private mancheSuivante() {
    this.manche += 1;
    this.question = this.plan[this.manche - 1] ?? this.tirerQuestion(this.modes[0]);
    const mode = this.question.mode;
    for (const j of this.joueurs.values()) j.enAttente = false;
    this.participants = [...this.joueurs.keys()];
    this.reponses.clear();
    this.votes.clear();
    this.anonymes = []; // efface les images de la manche précédente
    this.resultat = null;
    this.passerA('decompte', DUREES.decompte, () => {
      this.debutReponse = this.horloge.maintenant();
      this.passerA('reponse', DUREES.reponse[mode], () => this.finReponses());
    });
  }

  private tirerQuestion(mode: Mode): Question {
    let restantes = QUESTIONS[mode].filter((q) => !this.dejaPosees.has(q.texte));
    if (restantes.length === 0) {
      for (const q of QUESTIONS[mode]) this.dejaPosees.delete(q.texte);
      restantes = QUESTIONS[mode];
    }
    const q = this.auHasard(restantes);
    this.dejaPosees.add(q.texte);
    return q;
  }

  private passerA(phase: Phase, duree: number | null, alEcheance?: () => void) {
    this.arreterMinuteur();
    this.phase = phase;
    this.echeance = duree === null ? null : this.horloge.maintenant() + duree;
    if (duree !== null && alEcheance) this.annulerMinuteur = this.horloge.planifier(duree, alEcheance);
    this.surChangement();
    this.faireJouerRobots();
  }

  private arreterMinuteur() {
    this.annulerMinuteur?.();
    this.annulerMinuteur = null;
    for (const annuler of this.annulerRobots) annuler();
    this.annulerRobots = [];
  }

  /** Salon supprimé : on coupe les minuteurs encore en route et on efface les images. */
  fermer() {
    this.arreterMinuteur();
    this.anonymes = [];
    this.reponses.clear();
  }

  private auHasard<T>(t: readonly T[]): T {
    return t[Math.floor(this.hasard() * t.length)];
  }

  // ——— Robots ———

  private faireJouerRobots() {
    if (this.phase === 'redaction') return this.faireEcrireRobots();
    if (!this.question || (this.phase !== 'reponse' && this.phase !== 'vote')) return;
    const mode = this.question.mode;
    const [min, max] = this.phase === 'reponse' ? DELAIS_ROBOT.reponse[mode] : DELAIS_ROBOT.vote;
    const robots = this.participants.filter((id) => this.joueurs.get(id)?.robot);
    const phase = this.phase;
    const dejaPrises = new Set<string>();
    for (const id of robots) {
      const delai = min + Math.floor(this.hasard() * (max - min));
      let action: () => void;
      if (phase === 'reponse' && mode === 'qui2nous') {
        const choix = this.auHasard(this.participants);
        action = () => this.repondre(id, choix);
      } else if (phase === 'reponse' && estModeImage(mode)) {
        // Photo ou dessin : de l'art abstrait.
        const image = `data:image/png;base64,${imageRobot(this.hasard).toString('base64')}`;
        action = () => this.repondre(id, image);
      } else if (phase === 'reponse') {
        const libres = REPONSES_ROBOT.filter((r) => !dejaPrises.has(r));
        const texte = this.auHasard(libres.length ? libres : REPONSES_ROBOT);
        dejaPrises.add(texte);
        action = () => this.repondre(id, texte);
      } else {
        action = () => {
          const attributions: Record<string, string> = {};
          const candidats = this.participants.filter((p) => p !== id);
          for (const r of this.anonymes) if (r.auteurId !== id) attributions[r.id] = this.auHasard(candidats);
          this.voter(id, attributions);
        };
      }
      this.planifierRobot(delai, action);
    }
  }

  private faireEcrireRobots() {
    const [min, max] = DELAIS_ROBOT.redaction;
    for (const id of this.redacteurs.filter((r) => this.joueurs.get(r)?.robot)) {
      const delai = min + Math.floor(this.hasard() * (max - min));
      this.planifierRobot(delai, () => {
        const libres = QUESTIONS_ROBOT.filter(
          (q) => this.modes.includes(q.mode) && !this.propositions.some((p) => p.texte === q.texte),
        );
        for (const q of melanger(libres, this.hasard).slice(0, 2)) this.proposerQuestion(id, q.texte, q.mode);
        this.finirRedaction(id);
      });
    }
  }

  private planifierRobot(delai: number, action: () => void) {
    this.annulerRobots.push(
      this.horloge.planifier(delai, () => {
        try {
          action();
        } catch {
          /* la phase a changé entre-temps : le robot laisse tomber */
        }
      }),
    );
  }

  // ——— Réponses et votes ———

  /** Participants encore là, dont on attend l'action. */
  private attendus() {
    return this.participants.filter((id) => this.joueurs.get(id)?.connecte);
  }

  private verifierFinDePhase() {
    if (this.phase === 'redaction') {
      const attendus = this.redacteurs.filter((id) => this.joueurs.get(id)?.connecte);
      if (attendus.every((id) => this.finis.has(id))) this.finRedaction();
    } else if (this.phase === 'reponse' && this.attendus().every((id) => this.reponses.has(id))) this.finReponses();
    else if (this.phase === 'vote' && this.attendus().every((id) => this.votes.has(id))) this.finVotes();
  }

  repondre(id: string, valeur: unknown) {
    if (this.phase !== 'reponse' || !this.question) throw new ErreurJeu('Ce n’est pas le moment de répondre.');
    if (!this.participants.includes(id)) throw new ErreurJeu('Tu joues à partir de la prochaine manche.');
    if (this.reponses.has(id)) throw new ErreurJeu('Tu as déjà répondu.');
    const a = this.horloge.maintenant();
    const mode = this.question.mode;
    if (estModeImage(mode)) {
      this.reponses.set(id, { valeur: 'image', a, image: lireImage(valeur) });
    } else {
      let v = String(valeur ?? '').trim();
      if (mode === 'qui2nous') {
        if (!this.participants.includes(v)) throw new ErreurJeu('Choisis un joueur de la partie.');
      } else {
        v = v.replace(/\s+/g, ' ').slice(0, 80);
        if (!v) throw new ErreurJeu('Écris une réponse.');
      }
      this.reponses.set(id, { valeur: v, a });
    }
    this.surChangement();
    this.verifierFinDePhase();
  }

  private finReponses() {
    if (this.phase !== 'reponse' || !this.question) return;
    if (this.question.mode === 'qui2nous') return this.resoudreQui2nous();
    this.anonymes = melanger(
      [...this.reponses].map(([auteurId, r]) => ({
        id: randomUUID(),
        texte: r.image ? '' : r.valeur,
        auteurId,
        image: r.image,
      })),
      this.hasard,
    );
    if (this.anonymes.length < 2) return this.resoudreAuteurs();
    this.passerA('vote', DUREES.vote, () => this.finVotes());
  }

  voter(id: string, attributions: unknown) {
    if (this.phase !== 'vote') throw new ErreurJeu('Ce n’est pas le moment de voter.');
    if (!this.participants.includes(id)) throw new ErreurJeu('Tu joues à partir de la prochaine manche.');
    if (this.votes.has(id)) throw new ErreurJeu('Tu as déjà voté.');
    const a = (attributions ?? {}) as Record<string, unknown>;
    const propre: Record<string, string> = {};
    for (const r of this.anonymes) {
      if (r.auteurId === id) continue;
      const choix = String(a[r.id] ?? '');
      if (!choix) throw new ErreurJeu('Attribue un auteur à chaque réponse.');
      if (choix === id || !this.participants.includes(choix)) throw new ErreurJeu('Auteur impossible.');
      propre[r.id] = choix;
    }
    this.votes.set(id, propre);
    this.surChangement();
    this.verifierFinDePhase();
  }

  private finVotes() {
    if (this.phase === 'vote') this.resoudreAuteurs();
  }

  // ——— Points ———

  private multiplicateur() {
    return this.grandeFinale ? 2 : 1;
  }

  private crediter(gains: Record<string, Gain>, id: string, points: number, raison: string) {
    const g = (gains[id] ??= { points: 0, raisons: [] });
    const p = points * this.multiplicateur();
    g.points += p;
    g.raisons.push(`${raison} +${p}`);
    const j = this.joueurs.get(id);
    if (j) j.score += p;
  }

  private resoudreQui2nous() {
    const parDesigne = new Map<string, string[]>();
    for (const [votant, r] of this.reponses) {
      parDesigne.set(r.valeur, [...(parDesigne.get(r.valeur) ?? []), votant]);
    }
    const decompte = [...parDesigne]
      .map(([joueurId, votants]) => ({ joueurId, votants }))
      .sort((a, b) => b.votants.length - a.votants.length);
    const max = decompte[0]?.votants.length ?? 0;
    const gagnants = new Set(decompte.filter((d) => d.votants.length === max).map((d) => d.joueurId));
    const gains: Record<string, Gain> = {};
    const duree = DUREES.reponse.qui2nous;
    for (const d of decompte) {
      const j = this.joueurs.get(d.joueurId);
      if (j) j.stats.designe += d.votants.length;
    }
    // Une seule voix exprimée ne fait pas une majorité : pas d'anticipation.
    if (this.reponses.size >= 2 && max >= 2) {
      for (const [votant, r] of this.reponses) {
        if (!gagnants.has(r.valeur)) continue;
        this.crediter(gains, votant, POINTS.anticipation, 'Bonne anticipation');
        const restant = Math.max(0, 1 - (r.a - this.debutReponse) / duree);
        const bonus = Math.round((POINTS.rapiditeMax * restant) / 10) * 10;
        if (bonus > 0) this.crediter(gains, votant, bonus, 'Rapidité');
        const j = this.joueurs.get(votant);
        if (j) j.stats.anticipations += 1;
      }
    }
    this.resultat = { mode: 'qui2nous', decompte, gains };
    this.passerA('resultat', null);
  }

  /** Résultat des modes « retrouver l'auteur » : réponse écrite, photo ou dessin. */
  private resoudreAuteurs() {
    const mode = this.question?.mode;
    const cle: keyof Statistiques = mode === 'qui2photo' ? 'photos' : mode === 'qui2dessine' ? 'dessins' : 'devine';
    const gains: Record<string, Gain> = {};
    const reponses = this.anonymes.map((r) => {
      const votants = [...this.votes].filter(([votant]) => votant !== r.auteurId);
      const trouvePar = votants.filter(([, a]) => a[r.id] === r.auteurId).map(([v]) => v);
      const difficile = trouvePar.length > 0 && trouvePar.length * 2 < votants.length;
      for (const v of trouvePar) {
        this.crediter(gains, v, POINTS.identification, 'Bonne identification');
        if (difficile) this.crediter(gains, v, POINTS.identificationDifficile, 'Identification difficile');
        const j = this.joueurs.get(v);
        if (j) j.stats.trouves += 1;
      }
      const auteur = this.joueurs.get(r.auteurId);
      if (auteur) auteur.stats[cle] += trouvePar.length;
      return { id: r.id, texte: r.texte, image: !!r.image, auteurId: r.auteurId, trouvePar };
    });
    this.resultat = { mode: mode && mode !== 'qui2nous' ? mode : 'quiARepondu', reponses, gains };
    this.passerA('resultat', null);
  }

  private terminer() {
    const js = [...this.joueurs.values()];
    const meilleur = (cle: keyof Statistiques) => {
      const j = [...js].sort((a, b) => b.stats[cle] - a.stats[cle])[0];
      return j && j.stats[cle] > 0 ? j.id : null;
    };
    const titres: Titre[] = [];
    const ajouter = (emoji: string, intitule: string, id: string | null) => {
      if (id) titres.push({ emoji, intitule, joueurId: id });
    };
    ajouter('🕵️', 'Meilleur détective', meilleur('trouves'));
    ajouter('🔮', 'Lit dans les pensées', meilleur('anticipations'));
    ajouter('😂', 'Plus prévisible', meilleur('devine'));
    ajouter('👑', 'Le plus désigné', meilleur('designe'));
    ajouter('📸', 'Roi des dossiers', meilleur('photos'));
    ajouter('🎨', 'Picasso du groupe', meilleur('dessins'));
    this.titres = titres;
    this.question = null;
    this.anonymes = []; // les images de la dernière manche sont effacées
    this.passerA('podium', null);
  }

  /**
   * Image (photo ou dessin) d'une manche, servie aux téléphones par son
   * identifiant anonyme. Elle n'existe que pendant le vote et le résultat de sa
   * manche : la manche suivante, la fin de partie ou la fermeture du salon l'effacent.
   */
  image(idAnonyme: string): ImageJeu | undefined {
    if (this.phase !== 'vote' && this.phase !== 'resultat') return undefined;
    return this.anonymes.find((r) => r.id === idAnonyme)?.image;
  }

  // ——— Ce que voit chaque joueur ———

  vuePour(id: string): Vue {
    const montrerReponses = this.phase === 'vote';
    return {
      code: this.code,
      moi: id,
      hoteId: this.hoteId,
      joueurs: [...this.joueurs.values()].map((j) => ({
        id: j.id,
        nom: j.nom,
        avatar: j.avatar,
        score: j.score,
        connecte: j.connecte,
        enAttente: j.enAttente,
        robot: j.robot,
      })),
      phase: this.phase,
      manche: this.manche,
      totalManches: this.totalManches,
      grandeFinale: this.grandeFinale,
      echeance: this.echeance,
      maintenant: this.horloge.maintenant(),
      // La question n'apparaît qu'à la fin du décompte, en même temps pour tous.
      question: this.phase === 'decompte' ? null : this.question,
      sourceQuestions: this.sourceQuestions,
      modes: this.modes,
      redacteurs: this.redacteurs,
      ontFini: [...this.finis],
      mesQuestions: this.propositions
        .filter((q) => q.auteurId === id)
        .map((q) => ({ id: q.id, texte: q.texte, mode: q.mode })),
      nbQuestionsGroupe: this.propositions.length,
      participants: this.participants,
      ontRepondu: [...this.reponses.keys()],
      ontVote: [...this.votes.keys()],
      maReponse: this.reponses.get(id)?.valeur ?? null,
      reponsesAnonymes: montrerReponses
        ? this.anonymes.map((r) => ({ id: r.id, texte: r.texte, image: !!r.image, estLaMienne: r.auteurId === id }))
        : [],
      resultat: this.resultat,
      titres: this.titres,
      statistiques:
        this.phase === 'podium' ? Object.fromEntries([...this.joueurs.values()].map((j) => [j.id, j.stats])) : {},
    };
  }
}

// ——— Registre des salons ———

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I, O, 0, 1 : lisible à voix haute

export function genererCode(existe: (c: string) => boolean, hasard: () => number = Math.random): string {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += ALPHABET[Math.floor(hasard() * ALPHABET.length)];
    if (!existe(c)) return c;
  }
}
