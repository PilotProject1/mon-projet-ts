import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import {
  AVATARS,
  LONGUEUR_MAX_QUESTION,
  MAX_JOUEURS,
  MAX_QUESTIONS_PAR_JOUEUR,
  MIN_JOUEURS,
  MODES,
  ORDRE_MODES,
  SOURCES,
  type Ack,
  type JoueurVue,
  type Mode,
  type SourceQuestions,
  type Statistiques,
  type Vue,
} from '../shared/protocol.ts';
import { envoyer, memoriserSession, socket } from './connexion.ts';
import { preparerPhoto } from './photo.ts';
import { Ardoise } from './ardoise.tsx';
import { Gerbe } from './Fond.tsx';
import { Avatar, Bouton, Carte, Erreur, Pastille } from './ui.tsx';

/** Lance une action serveur et expose son état d'envoi et son erreur. */
function useAction() {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  async function agir<T extends object>(emettre: (ack: (r: Ack<T>) => void) => void) {
    setEnCours(true);
    setErreur(null);
    const r = await envoyer(emettre);
    setEnCours(false);
    if (!r.ok) setErreur(r.erreur);
    return r;
  }
  return { enCours, erreur, agir };
}

/** Photo ou dessin d'une manche, servi par le serveur sous un identifiant anonyme. */
function ImageManche({ vue, id }: { vue: Vue; id: string }) {
  return (
    <img
      src={`/image/${vue.code}/${id}`}
      alt={vue.question?.mode === 'qui2dessine' ? 'Dessin d’un joueur' : 'Photo d’un joueur'}
      loading="lazy"
      className="max-h-64 w-full rounded-2xl bg-black/30 object-contain"
    />
  );
}

function parId(vue: Vue) {
  return new Map(vue.joueurs.map((j) => [j.id, j]));
}

// ——— Accueil ———

function lire(cle: string) {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

export function Accueil() {
  const codeLien = new URLSearchParams(location.search).get('code')?.toUpperCase() ?? '';
  const [nom, setNom] = useState(() => lire('qui2nous:nom') ?? '');
  const [avatar, setAvatar] = useState(
    () => lire('qui2nous:avatar') ?? AVATARS[Math.floor(Math.random() * AVATARS.length)],
  );
  const [code, setCode] = useState(codeLien);
  const { enCours, erreur, agir } = useAction();

  async function entrer(e: FormEvent, mode: 'creer' | 'rejoindre') {
    e.preventDefault();
    try {
      localStorage.setItem('qui2nous:nom', nom);
      localStorage.setItem('qui2nous:avatar', avatar);
    } catch {
      /* sans stockage, on redemandera le pseudo */
    }
    const r = await agir<{ code: string; jeton: string }>((ack) =>
      mode === 'creer' ? socket.emit('creer', { nom, avatar }, ack) : socket.emit('rejoindre', { code, nom, avatar }, ack),
    );
    if (r.ok) {
      memoriserSession(r.code, r.jeton);
      history.replaceState(null, '', location.pathname);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-5 pt-2">
        <header className="accueil-monte text-center">
          <LogoVif />
          <p className="mt-2 font-display text-lg font-medium text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.25)]">
            Le jeu qui révèle ce que vous pensez vraiment les uns des autres
          </p>
        </header>

        <section
          className="accueil-monte flex flex-col gap-4 rounded-3xl bg-white/20 p-4 shadow-xl ring-1 ring-white/40 backdrop-blur-md"
          style={{ animationDelay: '0.1s' }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="font-display text-lg font-semibold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.2)]">
              Ton pseudo
            </span>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              maxLength={16}
              autoComplete="nickname"
              placeholder="Ex. Lucas"
              className="min-h-13 w-full rounded-2xl bg-white px-4 font-display text-xl text-indigo-950 shadow-inner outline-none placeholder:text-indigo-950/35 focus:ring-4 focus:ring-yellow-300"
            />
          </label>
          <fieldset>
            <legend className="mb-1.5 font-display text-lg font-semibold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.2)]">
              Ton avatar
            </legend>
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={a === avatar}
                  onClick={() => setAvatar(a)}
                  className={`aspect-square rounded-2xl text-2xl transition duration-200 sm:text-3xl ${
                    a === avatar
                      ? 'scale-110 bg-yellow-300 shadow-[0_4px_0_#ca8a04] ring-4 ring-white'
                      : 'bg-white/25 hover:bg-white/40 active:scale-95'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </fieldset>
        </section>

        {erreur && (
          <p role="alert" className="rounded-2xl bg-white px-4 py-2 text-center font-medium text-rose-600 shadow-lg">
            {erreur}
          </p>
        )}

        {!codeLien && (
          <form onSubmit={(e) => entrer(e, 'creer')} className="accueil-monte" style={{ animationDelay: '0.2s' }}>
            <button type="submit" className={`${BOUTON_BLANC} w-full`} disabled={enCours || !nom.trim()}>
              Créer une partie
            </button>
          </form>
        )}

        {!codeLien && (
          <p
            className="accueil-monte flex items-center gap-3 font-display text-white/90"
            style={{ animationDelay: '0.25s' }}
          >
            <span className="h-px flex-1 bg-white/50" />
            ou rejoins tes amis
            <span className="h-px flex-1 bg-white/50" />
          </p>
        )}

        <form
          onSubmit={(e) => entrer(e, 'rejoindre')}
          className="accueil-monte flex flex-col gap-3 rounded-3xl bg-white/20 p-3 ring-1 ring-white/40 backdrop-blur-md sm:flex-row"
          style={{ animationDelay: '0.3s' }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            maxLength={4}
            inputMode="text"
            autoCapitalize="characters"
            placeholder="CODE"
            aria-label="Code du salon"
            className="min-h-14 w-full min-w-0 rounded-2xl bg-white px-4 text-center font-display text-3xl font-bold tracking-[0.4em] text-fuchsia-600 shadow-inner outline-none placeholder:text-indigo-950/25 focus:ring-4 focus:ring-yellow-300 sm:flex-1"
          />
          <button
            type="submit"
            disabled={enCours || !nom.trim() || code.length !== 4}
            className={`${BOUTON_JAUNE} sm:shrink-0`}
          >
            Rejoindre
          </button>
        </form>
      </div>
    </>
  );
}

/** Gros bouton blanc en relief, comme « Jouer » dans l'intro. */
const BOUTON_BLANC =
  'min-h-16 rounded-full bg-white px-8 font-display text-2xl font-bold text-fuchsia-600 shadow-[0_6px_0_#a21caf,0_12px_30px_rgba(0,0,0,0.25)] transition active:translate-y-1 active:shadow-[0_2px_0_#a21caf] disabled:opacity-60 disabled:active:translate-y-0';
const BOUTON_JAUNE =
  'min-h-14 rounded-2xl bg-yellow-300 px-6 font-display text-xl font-bold text-indigo-950 shadow-[0_5px_0_#ca8a04] transition active:translate-y-1 active:shadow-[0_1px_0_#ca8a04] disabled:opacity-60 disabled:active:translate-y-0';

/** Le logo de l'intro, en ligne : QUI en blanc, 2 en jaune, NOUS en cyan, en relief. */
function LogoVif() {
  const mot = (texte: string, couleur: string, ombre: string, taille: string, angle: string) => (
    <span
      className="inline-block font-display font-bold tracking-tight"
      style={{
        color: couleur,
        fontSize: taille,
        transform: `rotate(${angle})`,
        textShadow: `0 0.06em 0 ${ombre}, 0 0.12em 0 rgba(0,0,0,0.2), 0 0.2em 0.4em rgba(0,0,0,0.3)`,
      }}
    >
      {texte}
    </span>
  );
  return (
    <h1 className="flex items-end justify-center gap-1 leading-none" aria-label="Qui2Nous">
      {mot('QUI', '#ffffff', '#9d174d', 'clamp(2.75rem, 13vw, 4rem)', '-4deg')}
      {mot('2', '#fde047', '#b45309', 'clamp(3.5rem, 17vw, 5rem)', '6deg')}
      {mot('NOUS', '#67e8f9', '#1e3a8a', 'clamp(2.75rem, 13vw, 4rem)', '-3deg')}
    </h1>
  );
}

// ——— Lobby ———

/** Décalage d'animation selon le rang de l'élément (voir .anim-rebond). */
const rang = (i: number) => ({ '--i': i }) as CSSProperties;

const DESCRIPTIONS_MODES: Record<Mode, string> = {
  qui2nous: 'Qui correspond le mieux à la question\u00a0?',
  quiARepondu: 'Retrouver l’auteur de chaque réponse.',
  qui2photo: 'Chacun montre une photo de sa galerie.',
  qui2dessine: 'Chacun dessine, on retrouve l’artiste.',
};

export function Lobby({ vue }: { vue: Vue }) {
  const [manches, setManches] = useState(6);
  const [source, setSource] = useState<SourceQuestions>('auto');
  const [modes, setModes] = useState<Mode[]>(ORDRE_MODES);
  const [copie, setCopie] = useState(false);
  const { enCours, erreur, agir } = useAction();
  const estHote = vue.moi === vue.hoteId;
  const connectes = vue.joueurs.filter((j) => j.connecte).length;
  const hote = vue.joueurs.find((j) => j.id === vue.hoteId);
  const lien = `${location.origin}/?code=${vue.code}`;

  async function partager() {
    if (navigator.share) {
      await navigator.share({ title: 'Qui2Nous ?', text: `Rejoins ma partie avec le code ${vue.code}`, url: lien }).catch(() => {});
    } else {
      await navigator.clipboard?.writeText(lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Carte className="text-center">
        <p className="text-sm font-medium tracking-wide text-white/85 uppercase">Code du salon</p>
        <p className="flex justify-center gap-1 font-display text-6xl font-bold text-yellow-300 [text-shadow:0_4px_0_#b45309,0_8px_18px_rgba(0,0,0,0.25)]">
          {[...vue.code].map((c, i) => (
            <span key={i} className="anim-rebond inline-block" style={rang(i + 1)}>
              {c}
            </span>
          ))}
        </p>
        <Bouton variante="secondaire" className="mt-3 text-base" onClick={partager}>
          {copie ? 'Lien copié ✓' : 'Inviter des amis'}
        </Bouton>
      </Carte>

      <section>
        <h2 className="mb-2 flex items-baseline justify-between font-display text-xl">
          Joueurs
          <span className="text-base text-white/85">
            {vue.joueurs.length}/{MAX_JOUEURS}
          </span>
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {vue.joueurs.map((j) => (
            <li key={j.id} className="anim-rebond flex min-w-0 items-center gap-3 rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/40">
              <Avatar joueur={j} />
              <span className="min-w-0 flex-1 truncate font-medium">
                {j.nom}
                {j.id === vue.moi && <span className="text-white/75"> (toi)</span>}
              </span>
              {j.id === vue.hoteId && (
                <span title="Créateur du salon" className="anim-flotte inline-block">
                  👑
                </span>
              )}
              {j.robot && estHote && (
                <button
                  onClick={() => agir((ack) => socket.emit('retirerRobot', { id: j.id }, ack))}
                  aria-label={`Retirer ${j.nom}`}
                  title="Retirer ce robot"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/75 hover:bg-white/20 hover:text-white"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        {connectes < MIN_JOUEURS && (
          <p className="mt-3 text-center text-sm text-white/85">
            Encore {MIN_JOUEURS - connectes} joueur{MIN_JOUEURS - connectes > 1 ? 's' : ''} minimum pour jouer.
          </p>
        )}
        {estHote && vue.joueurs.length < MAX_JOUEURS && (
          <Bouton
            variante="secondaire"
            className="mt-3 w-full text-base"
            disabled={enCours}
            onClick={() => agir((ack) => socket.emit('ajouterRobot', ack))}
          >
            🤖 Ajouter un robot
          </Bouton>
        )}
      </section>

      {estHote ? (
        <Carte className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-white/90">Nombre de manches</p>
            <div className="grid grid-cols-3 gap-2">
              {[4, 6, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => setManches(n)}
                  aria-pressed={manches === n}
                  className={`min-h-11 rounded-xl font-display text-lg ${manches === n ? 'bg-yellow-300 text-indigo-950' : 'bg-white/20'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-white/75">
              Les modes choisis s’enchaînent. La dernière manche est la grande finale : question spéciale et points
              doublés.
            </p>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-white/90">Modes de jeu</legend>
            <div className="flex flex-col gap-2">
              {ORDRE_MODES.map((m) => {
                const actif = modes.includes(m);
                const dernier = actif && modes.length === 1;
                return (
                  <button
                    key={m}
                    role="switch"
                    aria-checked={actif}
                    disabled={dernier}
                    title={dernier ? 'Il faut garder au moins un mode' : undefined}
                    onClick={() =>
                      setModes((ms) => (actif ? ms.filter((x) => x !== m) : ORDRE_MODES.filter((x) => ms.includes(x) || x === m)))
                    }
                    className="flex items-center gap-3 rounded-xl bg-white/20 px-3 py-2 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-lg leading-tight">{MODES[m].nom}</span>
                      <span className="block text-sm text-white/85">{DESCRIPTIONS_MODES[m]}</span>
                    </span>
                    <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${actif ? 'bg-yellow-300' : 'bg-white/20'}`}>
                      <span className={`absolute top-1 size-5 rounded-full bg-white transition-all ${actif ? 'left-6' : 'left-1'}`} />
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-white/90">Questions</legend>
            <div className="flex flex-col gap-2">
              {(Object.keys(SOURCES) as SourceQuestions[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  aria-pressed={source === s}
                  className={`rounded-xl px-3 py-2 text-left ${source === s ? 'bg-yellow-300 text-indigo-950' : 'bg-white/20'}`}
                >
                  <span className="block font-display text-lg leading-tight">{SOURCES[s].nom}</span>
                  <span className={`block text-sm ${source === s ? 'text-indigo-950/80' : 'text-white/85'}`}>
                    {SOURCES[s].description}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <Erreur message={erreur} />
          <Bouton
            disabled={enCours || connectes < MIN_JOUEURS}
            onClick={() => agir((ack) => socket.emit('lancer', { manches, questions: source, modes }, ack))}
          >
            Lancer la partie
          </Bouton>
        </Carte>
      ) : (
        <p className="text-center text-white/90">
          En attente du lancement par <strong>{hote?.nom ?? 'le créateur'}</strong>…
        </p>
      )}
    </div>
  );
}

// ——— Rédaction des questions (mode créateur ou collectif) ———

const TYPES_QUESTION: Record<Mode, { libelle: string; exemple: string }> = {
  qui2nous: { libelle: 'Qui de nous… ?', exemple: 'Qui de nous chante sous la douche ?' },
  quiARepondu: { libelle: 'Question ouverte', exemple: 'Ton pire souvenir de vacances ?' },
  qui2photo: { libelle: 'Photo 📸', exemple: 'Une photo de ton dernier repas de fête.' },
  qui2dessine: { libelle: 'Dessin ✏️', exemple: 'Dessine ton pire cauchemar.' },
};

export function Redaction({ vue }: { vue: Vue }) {
  const [mode, setMode] = useState<Mode>(vue.modes[0]);
  const [texte, setTexte] = useState('');
  const { enCours, erreur, agir } = useAction();
  const joueurs = parId(vue);
  const ecrit = vue.redacteurs.includes(vue.moi);
  const fini = vue.ontFini.includes(vue.moi);
  const plein = vue.mesQuestions.length >= MAX_QUESTIONS_PAR_JOUEUR;
  const redacteurs = vue.redacteurs.map((id) => joueurs.get(id)).filter((j): j is JoueurVue => !!j);
  // En mode créateur, l'auteur est connu de tous : on ne promet l'anonymat qu'en mode collectif.
  const melange =
    vue.sourceQuestions === 'collectif'
      ? 'Elles seront mélangées : personne ne saura qui les a écrites.'
      : 'Elles seront mélangées avec celles du jeu, dans un ordre surprise.';
  const progression = (
    <div className="text-center">
      <p className="mb-2 text-sm text-white/85">
        {vue.nbQuestionsGroupe} question{vue.nbQuestionsGroupe > 1 ? 's' : ''} écrite{vue.nbQuestionsGroupe > 1 ? 's' : ''} ·{' '}
        {vue.ontFini.length}/{redacteurs.length} {redacteurs.length > 1 ? 'ont terminé' : 'a terminé'}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {redacteurs.map((j) => (
          <span key={j.id} className={vue.ontFini.includes(j.id) ? '' : 'opacity-30'} title={j.nom}>
            <Avatar joueur={j} taille="sm" />
          </span>
        ))}
      </div>
    </div>
  );

  if (!ecrit || fini) {
    const createur = joueurs.get(vue.hoteId);
    return (
      <div className="flex flex-col gap-6">
        <Carte className="text-center">
          <p className="text-4xl">✏️</p>
          <p className="mt-2 font-display text-xl">
            {fini ? 'Questions envoyées ✓' : `${createur?.nom ?? 'Le créateur'} prépare les questions…`}
          </p>
          <p className="mt-1 text-sm text-white/85">{melange}</p>
        </Carte>
        {progression}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="font-display text-2xl">Écris tes questions</p>
        <p className="text-sm text-white/85">
          Jusqu’à {MAX_QUESTIONS_PAR_JOUEUR}. {melange}
        </p>
      </div>
      <Carte className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {vue.modes.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`min-h-11 rounded-xl px-2 text-sm font-semibold ${mode === m ? 'bg-yellow-300 text-indigo-950' : 'bg-white/20'}`}
            >
              {TYPES_QUESTION[m].libelle}
            </button>
          ))}
        </div>
        <p className="text-xs text-white/75">{MODES[mode].consigne}</p>
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await agir((ack) => socket.emit('proposerQuestion', { texte, mode }, ack));
            if (r.ok) setTexte('');
          }}
        >
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            maxLength={LONGUEUR_MAX_QUESTION}
            rows={2}
            disabled={plein}
            placeholder={`Ex. ${TYPES_QUESTION[mode].exemple}`}
            className="w-full resize-none rounded-xl bg-white text-indigo-950 px-4 py-3 text-lg ring-1 ring-white/40 outline-none placeholder:text-indigo-950/35 focus:ring-2 focus:ring-yellow-300 disabled:opacity-40"
          />
          <Bouton type="submit" variante="secondaire" disabled={enCours || plein || texte.trim().length < 8}>
            {plein ? 'Maximum atteint' : 'Ajouter la question'}
          </Bouton>
        </form>
        <Erreur message={erreur} />
      </Carte>

      {vue.mesQuestions.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-baseline justify-between font-display text-xl">
            Mes questions
            <span className="text-base text-white/85">
              {vue.mesQuestions.length}/{MAX_QUESTIONS_PAR_JOUEUR}
            </span>
          </h2>
          <ul className="flex flex-col gap-2">
            {vue.mesQuestions.map((q) => (
              <li key={q.id} className="flex min-w-0 items-start gap-3 rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/40">
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-yellow-300">{TYPES_QUESTION[q.mode].libelle}</span>
                  <span className="block break-words">{q.texte}</span>
                </span>
                <button
                  onClick={() => agir((ack) => socket.emit('retirerQuestion', { id: q.id }, ack))}
                  aria-label="Retirer cette question"
                  title="Retirer cette question"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/75 hover:bg-white/20 hover:text-white"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Bouton disabled={enCours} onClick={() => agir((ack) => socket.emit('finirRedaction', ack))}>
        {vue.mesQuestions.length ? 'J’ai fini' : 'Passer (questions du jeu)'}
      </Bouton>
      {progression}
    </div>
  );
}

// ——— En jeu ———

export function EnTete({ vue, secondes }: { vue: Vue; secondes: number | null }) {
  const mode = vue.question ? MODES[vue.question.mode].nom : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="shrink-0 text-sm font-medium text-white/90">
          {vue.phase === 'redaction' ? 'Préparation' : `Manche ${vue.manche}/${vue.totalManches}`}
        </span>
        {mode && (
          <span className="anim-rebond min-w-0 truncate rounded-full bg-white px-3 py-1 font-display text-sm font-bold text-fuchsia-600 shadow-md">
            {mode}
          </span>
        )}
        {secondes !== null && vue.phase !== 'decompte' && (
          <span
            className={`shrink-0 rounded-full px-3 py-1 font-display text-lg tabular-nums ${secondes <= 5 ? 'anim-urgence bg-rose-500 text-white shadow-lg' : 'bg-white/20'}`}
          >
            {secondes}s
          </span>
        )}
      </div>
      {vue.grandeFinale && (
        <p className="anim-flotte rounded-xl bg-gradient-to-r from-yellow-300 to-pink-500 px-3 py-1.5 text-center font-display font-bold text-indigo-950 shadow-lg">
          👑 GRANDE FINALE · points doublés
        </p>
      )}
    </div>
  );
}

export function Decompte({ vue, secondes }: { vue: Vue; secondes: number | null }) {
  const n = Math.min(3, Math.max(1, secondes ?? 3));
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-6 text-center">
      <p className="anim-rebond font-display text-3xl font-bold">{vue.grandeFinale ? '👑 Grande finale…' : `Manche ${vue.manche}`}</p>
      <div key={n} className="relative flex size-56 items-center justify-center">
        <span className="anim-onde absolute inset-0 rounded-full bg-white/40" aria-hidden />
        <span
          className="anim-chiffre font-display text-[10rem] leading-none font-bold"
          style={{
            color: ['#67e8f9', '#fde047', '#ffffff'][n - 1],
            textShadow: `0 0.06em 0 ${['#1e3a8a', '#b45309', '#9d174d'][n - 1]}, 0 0.12em 0.4em rgba(0,0,0,0.3)`,
          }}
        >
          {n}
        </span>
      </div>
    </div>
  );
}

function CarteQuestion({ vue }: { vue: Vue }) {
  if (!vue.question) return null;
  return (
    <Carte className="anim-rebond text-center">
      <p className="text-sm text-white/85">{vue.question.categorie}</p>
      <p className="mt-1 font-display text-2xl leading-tight font-semibold sm:text-3xl">{vue.question.texte}</p>
      <p className="mt-3 text-sm text-white/85">{MODES[vue.question.mode].consigne}</p>
    </Carte>
  );
}

function Progression({ vue, faits, libelle }: { vue: Vue; faits: string[]; libelle: string }) {
  const joueurs = parId(vue);
  const attendus = vue.participants.map((id) => joueurs.get(id)).filter((j): j is JoueurVue => !!j);
  return (
    <div className="text-center">
      <p className="mb-2 text-sm text-white/85">
        {faits.length}/{attendus.length} {libelle}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {attendus.map((j) => (
          <span key={j.id} className={`transition ${faits.includes(j.id) ? '' : 'opacity-30'}`} title={j.nom}>
            <Avatar joueur={j} taille="sm" />
          </span>
        ))}
      </div>
    </div>
  );
}

export function EcranReponse({ vue, secondes }: { vue: Vue; secondes: number | null }) {
  const [texte, setTexte] = useState('');
  const { enCours, erreur, agir } = useAction();
  const joueurs = parId(vue);
  const q = vue.question!;
  const repondre = (valeur: string) => agir((ack) => socket.emit('repondre', { valeur }, ack));
  const finDuTemps = secondes !== null && secondes <= 1;

  // Réponse écrite mais pas envoyée à la fin du temps : on l'envoie plutôt que de la perdre.
  const texteEnvoye = useRef(false);
  useEffect(() => {
    if (finDuTemps && q.mode === 'quiARepondu' && texte.trim() && !texteEnvoye.current && vue.maReponse === null) {
      texteEnvoye.current = true;
      repondre(texte);
    }
  });

  if (vue.maReponse !== null) {
    return (
      <div className="flex flex-col gap-6">
        <CarteQuestion vue={vue} />
        <Carte className="text-center">
          <p className="text-sm text-white/85">Ta réponse secrète</p>
          {q.mode === 'qui2nous' ? (
            <div className="mt-2 flex justify-center">
              {joueurs.get(vue.maReponse) && <Pastille joueur={joueurs.get(vue.maReponse)!} />}
            </div>
          ) : q.mode === 'qui2photo' ? (
            <p className="mt-1 font-display text-xl">Photo envoyée 📸</p>
          ) : q.mode === 'qui2dessine' ? (
            <p className="mt-1 font-display text-xl">Dessin envoyé ✏️</p>
          ) : (
            <p className="mt-1 font-display text-xl break-words">« {vue.maReponse} »</p>
          )}
        </Carte>
        <Progression vue={vue} faits={vue.ontRepondu} libelle="ont répondu" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <CarteQuestion vue={vue} />
      <Erreur message={erreur} />
      {q.mode === 'qui2nous' ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {vue.participants.map((id, i) => {
            const j = joueurs.get(id);
            if (!j) return null;
            return (
              <button
                key={id}
                disabled={enCours}
                onClick={() => repondre(id)}
                style={rang(i + 2)}
                className="anim-rebond flex min-w-0 flex-col items-center gap-1 rounded-2xl bg-white/20 p-3 shadow-lg ring-1 ring-white/40 backdrop-blur-md transition hover:scale-105 hover:bg-white/30 active:scale-90 active:bg-yellow-300/50"
              >
                <Avatar joueur={j} taille="lg" />
                <span className="w-full truncate text-center font-medium">{j.id === vue.moi ? `${j.nom} (toi)` : j.nom}</span>
              </button>
            );
          })}
        </div>
      ) : q.mode === 'qui2photo' ? (
        <ChoixPhoto envoyer={repondre} enCours={enCours} finDuTemps={finDuTemps} />
      ) : q.mode === 'qui2dessine' ? (
        <Ardoise envoyer={repondre} enCours={enCours} secondes={secondes} />
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            repondre(texte);
          }}
        >
          <input
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            maxLength={80}
            autoFocus
            placeholder="Ta réponse, en secret…"
            className="min-h-14 w-full rounded-2xl bg-white text-indigo-950 px-4 text-lg ring-1 ring-white/40 outline-none placeholder:text-indigo-950/35 focus:ring-2 focus:ring-yellow-300"
          />
          <Bouton type="submit" disabled={enCours || !texte.trim()}>
            Envoyer
          </Bouton>
        </form>
      )}
    </div>
  );
}

function ChoixPhoto({
  envoyer,
  enCours,
  finDuTemps,
}: {
  envoyer: (photo: string) => Promise<{ ok: boolean }>;
  enCours: boolean;
  finDuTemps: boolean;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [preparation, setPreparation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Photo choisie mais pas envoyée à la fin du temps : on l'envoie quand même.
  const envoyee = useRef(false);
  useEffect(() => {
    if (finDuTemps && photo && !envoyee.current) {
      envoyee.current = true;
      envoyer(photo);
    }
  });

  async function choisir(fichier: File | undefined) {
    if (!fichier) return;
    setErreur(null);
    setPreparation(true);
    try {
      setPhoto(await preparerPhoto(fichier));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Impossible de lire cette photo.');
    } finally {
      setPreparation(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {photo && <img src={photo} alt="Ta photo" className="max-h-80 w-full rounded-2xl bg-black/30 object-contain" />}
      <Erreur message={erreur} />
      {/* Le sélecteur du téléphone : une seule photo, sans accès à toute la galerie. */}
      <label
        className={`flex min-h-12 cursor-pointer items-center justify-center rounded-2xl px-5 py-3 text-center font-display text-lg font-semibold ${photo ? 'bg-white/20 ring-1 ring-white/40' : 'bg-yellow-300 text-indigo-950 shadow-[0_4px_0_#b45309]'}`}
      >
        {preparation ? 'Préparation…' : photo ? 'Changer de photo' : '📸 Choisir une photo'}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={preparation || enCours}
          onChange={(e) => {
            choisir(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      {photo && (
        <Bouton disabled={enCours} onClick={() => envoyer(photo)}>
          Envoyer cette photo
        </Bouton>
      )}
      <p className="text-center text-xs text-white/75">
        Seule la photo choisie est partagée, sans sa localisation. Elle est effacée à la fin de la manche.
      </p>
    </div>
  );
}

const TITRES_VOTE: Record<Mode, string> = {
  qui2nous: '',
  quiARepondu: 'Qui a écrit quoi\u00a0?',
  qui2photo: 'À qui est chaque photo\u00a0?',
  qui2dessine: 'Qui a dessiné quoi\u00a0?',
};
const LA_MIENNE: Record<Mode, string> = {
  qui2nous: '',
  quiARepondu: 'C’est ta réponse.',
  qui2photo: 'C’est ta photo.',
  qui2dessine: 'C’est ton dessin.',
};

export function EcranVote({ vue }: { vue: Vue }) {
  const [choix, setChoix] = useState<Record<string, string>>({});
  const { enCours, erreur, agir } = useAction();
  const joueurs = parId(vue);
  const aVote = vue.ontVote.includes(vue.moi);
  const aDeviner = vue.reponsesAnonymes.filter((r) => !r.estLaMienne);
  const candidats = vue.participants.filter((id) => id !== vue.moi).map((id) => joueurs.get(id)).filter((j): j is JoueurVue => !!j);
  const complet = aDeviner.every((r) => choix[r.id]);

  if (aVote) {
    return (
      <div className="flex flex-col gap-6">
        <CarteQuestion vue={vue} />
        <p className="text-center font-display text-xl">Vote enregistré 🗳️</p>
        <Progression vue={vue} faits={vue.ontVote} libelle="ont voté" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="text-center">
        <p className="font-display text-2xl">{TITRES_VOTE[vue.question?.mode ?? 'quiARepondu']}</p>
        <p className="text-sm text-white/85">{vue.question?.texte}</p>
      </div>
      {vue.reponsesAnonymes.map((r, i) => (
        <Carte key={r.id} style={rang(i)} className={r.estLaMienne ? 'opacity-60' : 'anim-rebond'}>
          {r.image ? <ImageManche vue={vue} id={r.id} /> : <p className="font-display text-xl break-words">« {r.texte} »</p>}
          {r.estLaMienne ? (
            <p className="mt-2 text-sm text-white/85">{LA_MIENNE[vue.question?.mode ?? 'quiARepondu']}</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {candidats.map((j) => {
                const actif = choix[r.id] === j.id;
                return (
                  <button
                    key={j.id}
                    onClick={() => setChoix((c) => ({ ...c, [r.id]: j.id }))}
                    aria-pressed={actif}
                    className={`flex max-w-full min-w-0 items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-sm transition ${actif ? 'bg-yellow-300 font-semibold text-indigo-950' : 'bg-white/20'}`}
                  >
                    <span className="text-xl">{j.avatar}</span>
                    <span className="truncate">{j.nom}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Carte>
      ))}
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-fuchsia-900/70 via-fuchsia-900/40 to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md flex-col gap-2">
          <Erreur message={erreur} />
          <Bouton
            className="w-full"
            disabled={enCours || !complet}
            onClick={() => agir((ack) => socket.emit('voter', { attributions: choix }, ack))}
          >
            Valider mon vote
          </Bouton>
        </div>
      </div>
    </div>
  );
}

function Classement({ vue }: { vue: Vue }) {
  const tri = [...vue.joueurs].sort((a, b) => b.score - a.score);
  const medailles = ['🥇', '🥈', '🥉'];
  return (
    <ol className="flex flex-col gap-1.5">
      {tri.map((j, i) => {
        // Ex æquo : même place pour le même score.
        const place = tri.findIndex((k) => k.score === j.score);
        return (
        <li
          key={j.id}
          style={rang(i)}
          className={`anim-rebond flex items-center gap-3 rounded-2xl px-3 py-2 ${j.id === vue.moi ? 'bg-yellow-300/15 ring-1 ring-yellow-300/40' : 'bg-white/15'}`}
        >
          <span className="w-7 shrink-0 text-center font-display text-lg">{medailles[place] ?? place + 1}</span>
          <span className="min-w-0 flex-1">
            <Pastille joueur={j} moi={j.id === vue.moi} />
          </span>
          <span className="shrink-0 font-display text-lg tabular-nums">{j.score.toLocaleString('fr-FR')}</span>
        </li>
        );
      })}
    </ol>
  );
}

/**
 * Grande finale : les résultats se révèlent un par un, avec suspense
 * (étape 7). Renvoie combien d'éléments sont visibles ; tout, hors finale.
 */
function useRevelation(total: number, progressive: boolean) {
  const [reveles, setReveles] = useState(progressive ? 0 : total);
  useEffect(() => {
    if (reveles >= total) return;
    const t = setTimeout(() => setReveles((n) => n + 1), reveles === total - 1 ? 2_500 : 1_600);
    return () => clearTimeout(t);
  }, [reveles, total]);
  return reveles;
}

function Suspense({ texte }: { texte: string }) {
  return (
    <Carte className="anim-flotte text-center">
      <p className="font-display text-xl">
        <span className="anim-urgence inline-block">🥁</span> {texte}
      </p>
    </Carte>
  );
}

export function EcranResultat({ vue }: { vue: Vue }) {
  const { enCours, erreur, agir } = useAction();
  const joueurs = parId(vue);
  const r = vue.resultat!;
  const monGain = r.gains[vue.moi];
  const hote = joueurs.get(vue.hoteId);
  const peutPiloter = vue.moi === vue.hoteId || !hote?.connecte;
  const derniere = vue.manche >= vue.totalManches;
  const total = r.mode === 'qui2nous' ? r.decompte.length : r.reponses.length;
  const reveles = useRevelation(total, vue.grandeFinale);
  const toutRevele = reveles >= total;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-center font-display text-2xl">{vue.question?.texte}</p>

      {r.mode === 'qui2nous' ? (
        <div className="flex flex-col gap-2">
          {r.decompte.length === 0 && <p className="text-center text-white/85">Personne n’a répondu à temps.</p>}
          {/* En finale, on dévoile du moins désigné au plus désigné. */}
          {!toutRevele && <Suspense texte={total - reveles === 1 ? 'Et le plus désigné est…' : 'Révélation…'} />}
          {r.decompte.map((d, i) => {
            const j = joueurs.get(d.joueurId);
            if (!j || i < total - reveles) return null;
            return (
              <Carte key={d.joueurId} style={rang(total - 1 - i)} className={`anim-rebond ${i === 0 ? 'ring-4 ring-yellow-300' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <Pastille joueur={j} moi={j.id === vue.moi} />
                  <span className="shrink-0 font-display text-xl">
                    {d.votants.length} vote{d.votants.length > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="mt-2 text-sm break-words text-white/85">
                  Désigné par {d.votants.map((v) => joueurs.get(v)?.nom ?? '?').join(', ')}
                </p>
              </Carte>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {r.reponses.length === 0 && <p className="text-center text-white/85">Pas assez de réponses cette fois.</p>}
          {r.reponses.slice(0, reveles).map((rep) => {
            const auteur = joueurs.get(rep.auteurId);
            return (
              <Carte key={rep.id} className="anim-rebond">
                {rep.image ? (
                  <ImageManche vue={vue} id={rep.id} />
                ) : (
                  <p className="font-display text-lg break-words">« {rep.texte} »</p>
                )}
                <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  {auteur && <Pastille joueur={auteur} moi={auteur.id === vue.moi} />}
                  <span className="text-sm text-white/85">
                    {rep.trouvePar.length === 0
                      ? 'Personne n’a trouvé 🤫'
                      : `Trouvé par ${rep.trouvePar.map((v) => joueurs.get(v)?.nom ?? '?').join(', ')}`}
                  </span>
                </div>
              </Carte>
            );
          })}
          {!toutRevele && <Suspense texte="Révélation suivante…" />}
        </div>
      )}

      {toutRevele && (
        <>
          <Carte className="relative overflow-visible text-center">
            {monGain ? (
              <>
                <Gerbe delai={0.35} graine={vue.manche + 3} />
                <p className="anim-points font-display text-5xl font-bold text-yellow-300 [text-shadow:0_3px_0_#b45309,0_6px_14px_rgba(0,0,0,0.25)]">
                  +{monGain.points}
                </p>
                <p className="text-sm text-white/90">{monGain.raisons.join(' · ')}</p>
              </>
            ) : (
              <p className="text-white/90">Pas de points pour toi cette manche.</p>
            )}
          </Carte>

          <section>
            <h2 className="mb-2 font-display text-xl">Classement</h2>
            <Classement vue={vue} />
          </section>

          <Erreur message={erreur} />
          {peutPiloter ? (
            <Bouton disabled={enCours} onClick={() => agir((ack) => socket.emit('suivant', ack))}>
              {derniere ? 'Voir le podium 🏆' : 'Manche suivante'}
            </Bouton>
          ) : (
            <p className="text-center text-sm text-white/85">{hote?.nom ?? 'Le créateur'} lance la suite…</p>
          )}
        </>
      )}
    </div>
  );
}

const STATS_AFFICHEES: [keyof Statistiques, string, string, string][] = [
  ['trouves', '🕵️', 'auteur trouvé', 'auteurs trouvés'],
  ['anticipations', '🔮', 'vote avec la majorité', 'votes avec la majorité'],
  ['designe', '👑', 'fois désigné', 'fois désigné'],
  ['devine', '😂', 'réponse reconnue', 'réponses reconnues'],
  ['photos', '📸', 'photo reconnue', 'photos reconnues'],
  ['dessins', '🎨', 'dessin reconnu', 'dessins reconnus'],
];

export function Podium({ vue, quitter }: { vue: Vue; quitter: () => void }) {
  const { enCours, erreur, agir } = useAction();
  const joueurs = parId(vue);
  const tri = [...vue.joueurs].sort((a, b) => b.score - a.score);
  const [premier, deuxieme, troisieme] = tri;
  const hote = joueurs.get(vue.hoteId);
  const peutPiloter = vue.moi === vue.hoteId || !hote?.connecte;
  // Les marches montent du 3e au 1er ; le gagnant reçoit sa couronne et son feu d'artifice.
  const marche = (j: JoueurVue | undefined, hauteur: string, place: string, ordre: number, gagnant = false) =>
    j && (
      <div className="relative flex min-w-0 flex-1 flex-col items-center gap-1">
        {gagnant && <Gerbe delai={1.3} graine={11} />}
        {gagnant && (
          <span className="anim-couronne text-4xl" aria-hidden>
            👑
          </span>
        )}
        <span className="anim-rebond flex flex-col items-center" style={rang(ordre * 3 + 2)}>
          <Avatar joueur={j} taille="lg" />
        </span>
        <span className="w-full truncate text-center text-sm font-medium">{j.nom}</span>
        <div
          style={rang(ordre)}
          className={`anim-marche flex w-full items-start justify-center rounded-t-2xl bg-white/30 pt-2 font-display text-3xl shadow-xl ring-1 ring-white/50 backdrop-blur-md ${hauteur}`}
        >
          {place}
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <p className="anim-rebond font-display text-4xl font-bold [text-shadow:0_3px_0_#9d174d,0_6px_14px_rgba(0,0,0,0.25)]">
          🏆 Partie terminée
        </p>
        {premier && (
          <p className="mt-1 text-white/90">
            Victoire de <strong className="text-yellow-300">{premier.nom}</strong> avec {premier.score.toLocaleString('fr-FR')} points
          </p>
        )}
      </div>

      <div className="flex items-end gap-2">
        {marche(deuxieme, 'h-20', '🥈', 1)}
        {marche(premier, 'h-28', '🥇', 2, true)}
        {marche(troisieme, 'h-14', '🥉', 0)}
      </div>

      {vue.titres.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-xl">Les titres</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {vue.titres.map((t, i) => {
              const j = joueurs.get(t.joueurId);
              return (
                <li
                  key={t.intitule}
                  style={rang(i + 8)}
                  className="anim-rebond flex min-w-0 items-center gap-3 rounded-2xl bg-white/20 px-3 py-2 ring-1 ring-white/40"
                >
                  <span className="anim-flotte text-3xl" style={{ animationDelay: `${i * 0.3}s` }}>
                    {t.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-white/85">{t.intitule}</span>
                    <span className="block truncate font-medium">{j?.nom ?? '?'}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-display text-xl">Classement final</h2>
        <Classement vue={vue} />
      </section>

      <section>
        <h2 className="mb-2 font-display text-xl">Statistiques</h2>
        <ul className="flex flex-col gap-2">
          {tri.map((j) => {
            const st = vue.statistiques[j.id];
            const puces = st
              ? STATS_AFFICHEES.filter(([cle]) => st[cle] > 0).map(([cle, emoji, un, plusieurs]) => (
                  <span key={cle} className="rounded-full bg-white/20 px-2 py-0.5 text-xs whitespace-nowrap">
                    {emoji} {st[cle]} {st[cle] > 1 ? plusieurs : un}
                  </span>
                ))
              : [];
            return (
              <li key={j.id} className="flex flex-col gap-2 rounded-2xl bg-white/15 px-3 py-2 sm:flex-row sm:items-center">
                <span className="min-w-0 sm:w-40 sm:shrink-0">
                  <Pastille joueur={j} moi={j.id === vue.moi} />
                </span>
                <span className="flex min-w-0 flex-wrap gap-1.5">
                  {puces.length ? puces : <span className="text-xs text-white/75">Discret toute la partie 🤐</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <Erreur message={erreur} />
      <div className="flex flex-col gap-3 sm:flex-row">
        {peutPiloter && (
          <Bouton className="sm:flex-1" disabled={enCours} onClick={() => agir((ack) => socket.emit('rejouer', ack))}>
            Rejouer
          </Bouton>
        )}
        <Bouton variante="secondaire" className="sm:flex-1" onClick={quitter}>
          Quitter
        </Bouton>
      </div>
    </div>
  );
}

export function EnAttente() {
  return (
    <Carte className="mt-10 text-center">
      <p className="text-4xl">⏳</p>
      <p className="mt-2 font-display text-xl">Une manche est en cours</p>
      <p className="mt-1 text-white/90">Tu entres dans la partie à la prochaine manche.</p>
    </Carte>
  );
}
