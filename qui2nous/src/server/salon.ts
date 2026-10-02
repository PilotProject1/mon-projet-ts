import { randomBytes, randomUUID } from 'node:crypto';
import {
  AVATARS,
  LONGUEUR_MAX_QUESTION,
  MAX_JOUEURS,
  MAX_QUESTIONS_PAR_JOUEUR,
  MIN_JOUEURS,
  type Gain,
  type Mode,
  type Phase,
  type Question,
  type Resultat,
  type SourceQuestions,
  type Titre,
  type Vue,
} from '../shared/protocol.ts';
import { QUESTIONS } from '../shared/questions.ts';

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
  reponse: { qui2nous: 25_000, quiARepondu: 60_000 } satisfies Record<Mode, number>,
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
];
export const DELAIS_ROBOT = {
  redaction: [3_000, 8_000],
  reponse: { qui2nous: [2_000, 9_000], quiARepondu: [4_000, 15_000] },
  vote: [3_000, 10_000],
} as const;

interface Joueur {
  id: string;
  jeton: string;
  nom: string;
  avatar: string;
  score: number;
  connecte: boolean;
  enAttente: boolean;
  robot: boolean;
  stats: { trouves: number; devine: number; designe: number; anticipations: number };
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

export class ErreurJeu extends Error {}

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
  /** Réponse secrète de chaque participant : un joueurId (Qui2Nous) ou un texte. */
  private reponses = new Map<string, { valeur: string; a: number }>();
  private debutReponse = 0;
  private votes = new Map<string, Record<string, string>>();
  private anonymes: { id: string; texte: string; auteurId: string }[] = [];
  private dejaPosees = new Set<string>();
  sourceQuestions: SourceQuestions = 'auto';
  /** Qui écrit des questions pendant la phase de rédaction. */
  redacteurs: string[] = [];
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
      stats: { trouves: 0, devine: 0, designe: 0, anticipations: 0 },
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
      stats: { trouves: 0, devine: 0, designe: 0, anticipations: 0 },
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

  lancer(id: string, manches: number, source: unknown = 'auto') {
    if (id !== this.hoteId) throw new ErreurJeu('Seul le créateur du salon peut lancer la partie.');
    if (this.phase !== 'lobby') throw new ErreurJeu('La partie est déjà lancée.');
    if (this.connectes().length < MIN_JOUEURS) {
      throw new ErreurJeu(`Il faut au moins ${MIN_JOUEURS} joueurs connectés.`);
    }
    this.totalManches = (MANCHES_POSSIBLES as readonly number[]).includes(manches) ? manches : 6;
    this.manche = 0;
    for (const j of this.joueurs.values()) {
      j.score = 0;
      j.stats = { trouves: 0, devine: 0, designe: 0, anticipations: 0 };
    }
    this.sourceQuestions = source === 'createur' || source === 'collectif' ? source : 'auto';
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
    if (mode !== 'qui2nous' && mode !== 'quiARepondu') throw new ErreurJeu('Type de question inconnu.');
    const t = String(texte ?? '').replace(/\s+/g, ' ').trim().slice(0, LONGUEUR_MAX_QUESTION);
    if (t.length < 8) throw new ErreurJeu('Ta question est trop courte.');
    const miennes = this.propositions.filter((q) => q.auteurId === id);
    if (miennes.length >= MAX_QUESTIONS_PAR_JOUEUR) {
      throw new ErreurJeu(`${MAX_QUESTIONS_PAR_JOUEUR} questions maximum par joueur.`);
    }
    if (this.propositions.some((q) => q.texte.toLowerCase() === t.toLowerCase())) {
      throw new ErreurJeu('Cette question est déjà proposée.');
    }
    this.propositions.push({ id: randomUUID(), auteurId: id, texte: t, mode });
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
   * Questions du groupe d'abord (au plus une par manche), complétées par la
   * bibliothèque en équilibrant les deux modes. Sans question du groupe, les
   * modes alternent ; avec, tout est mélangé pour ne pas trahir les auteurs.
   */
  private construirePlan() {
    const perso: Question[] = melanger(this.propositions, this.hasard)
      .slice(0, this.totalManches)
      .map((q) => ({ mode: q.mode, categorie: '✏️ Question du groupe', texte: q.texte, perso: true }));
    const plan = [...perso];
    while (plan.length < this.totalManches) {
      const nb = (m: Mode) => plan.filter((q) => q.mode === m).length;
      const mode: Mode = perso.length === 0
        ? (plan.length % 2 === 0 ? 'qui2nous' : 'quiARepondu')
        : nb('qui2nous') <= nb('quiARepondu') ? 'qui2nous' : 'quiARepondu';
      plan.push(this.tirerQuestion(mode));
    }
    this.plan = perso.length ? melanger(plan, this.hasard) : plan;
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
    }
    this.surChangement();
  }

  get grandeFinale() {
    return this.totalManches >= 3 && this.manche === this.totalManches;
  }

  private mancheSuivante() {
    this.manche += 1;
    this.question = this.plan[this.manche - 1] ?? this.tirerQuestion(this.manche % 2 === 1 ? 'qui2nous' : 'quiARepondu');
    const mode = this.question.mode;
    for (const j of this.joueurs.values()) j.enAttente = false;
    this.participants = [...this.joueurs.keys()];
    this.reponses.clear();
    this.votes.clear();
    this.anonymes = [];
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
    const q = restantes[Math.floor(this.hasard() * restantes.length)];
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

  /** Salon supprimé : on coupe les minuteurs encore en route. */
  fermer() {
    this.arreterMinuteur();
  }

  private auHasard<T>(t: readonly T[]): T {
    return t[Math.floor(this.hasard() * t.length)];
  }

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
  }

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
    let v = String(valeur ?? '').trim();
    if (this.question.mode === 'qui2nous') {
      if (!this.participants.includes(v)) throw new ErreurJeu('Choisis un joueur de la partie.');
    } else {
      v = v.replace(/\s+/g, ' ').slice(0, 80);
      if (!v) throw new ErreurJeu('Écris une réponse.');
    }
    this.reponses.set(id, { valeur: v, a: this.horloge.maintenant() });
    this.surChangement();
    this.verifierFinDePhase();
  }

  private finReponses() {
    if (this.phase !== 'reponse' || !this.question) return;
    if (this.question.mode === 'qui2nous') return this.resoudreQui2nous();
    this.anonymes = melanger(
      [...this.reponses].map(([auteurId, r]) => ({ id: randomUUID(), texte: r.valeur, auteurId })),
      this.hasard,
    );
    if (this.anonymes.length < 2) return this.resoudreQuiARepondu();
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
    if (this.phase === 'vote') this.resoudreQuiARepondu();
  }

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

  private resoudreQuiARepondu() {
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
      if (auteur) auteur.stats.devine += trouvePar.length;
      return { id: r.id, texte: r.texte, auteurId: r.auteurId, trouvePar };
    });
    this.resultat = { mode: 'quiARepondu', reponses, gains };
    this.passerA('resultat', null);
  }

  private terminer() {
    const js = [...this.joueurs.values()];
    const meilleur = (cle: keyof Joueur['stats']) => {
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
    this.titres = titres;
    this.question = null;
    this.passerA('podium', null);
  }

  private faireEcrireRobots() {
    const [min, max] = DELAIS_ROBOT.redaction;
    for (const id of this.redacteurs.filter((r) => this.joueurs.get(r)?.robot)) {
      const delai = min + Math.floor(this.hasard() * (max - min));
      this.annulerRobots.push(
        this.horloge.planifier(delai, () => {
          try {
            const libres = QUESTIONS_ROBOT.filter((q) => !this.propositions.some((p) => p.texte === q.texte));
            for (const q of melanger(libres, this.hasard).slice(0, 2)) this.proposerQuestion(id, q.texte, q.mode);
            this.finirRedaction(id);
          } catch {
            /* la phase a changé entre-temps */
          }
        }),
      );
    }
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
        ? this.anonymes.map((r) => ({ id: r.id, texte: r.texte, estLaMienne: r.auteurId === id }))
        : [],
      resultat: this.resultat,
      titres: this.titres,
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
