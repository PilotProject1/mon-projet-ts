import { useEffect, useRef, useState } from 'react';
import { useCompteARebours, useJeu } from './connexion.ts';
import { Intro } from './Intro.tsx';
import { Accueil, Decompte, Redaction, EcranReponse, EcranResultat, EcranVote, EnAttente, EnTete, Lobby, Podium } from './ecrans.tsx';
import { Logo } from './ui.tsx';
import { DecorPetillant } from './Fond.tsx';
import { DUREE_STRESS, chargerPet, contexteAudio, debloquerAuPremierToucher, musiqueStress } from './sons.ts';
import type { Vue } from '../shared/protocol.ts';

debloquerAuPremierToucher();

/**
 * Musique stressante quand il reste 10 secondes pour répondre ou voter.
 * Elle s'arrête dès que la phase change (tout le monde a répondu).
 */
function useMusiqueChrono(vue: Vue | null, decalage: number) {
  const phase = vue?.phase;
  const echeance = vue?.echeance ?? null;
  const active = (phase === 'reponse' || phase === 'vote') && echeance !== null;
  // Le décalage d'horloge bouge un peu à chaque message : on le lit sans relancer la musique.
  const decalageRef = useRef(decalage);
  decalageRef.current = decalage;
  useEffect(() => {
    const decalage = decalageRef.current;
    if (!active || echeance === null) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let arreter: (() => void) | null = null;
    // Le pet de fin est téléchargé dès le début de la phase, bien avant les 10 dernières secondes.
    const ctxAudio = contexteAudio();
    if (ctxAudio) chargerPet(ctxAudio);
    const lancer = () => {
      const ctx = contexteAudio();
      if (!ctx || ctx.state !== 'running') return;
      const restant = (echeance - (Date.now() + decalage)) / 1000;
      if (restant > 0.3) arreter = musiqueStress(ctx, ctx.currentTime, Math.min(restant, DUREE_STRESS));
    };
    const avant = echeance - (Date.now() + decalage) - DUREE_STRESS * 1000;
    const t = setTimeout(lancer, Math.max(0, avant));
    return () => {
      clearTimeout(t);
      arreter?.();
    };
  }, [active, phase, echeance]);
}

const CLE_INTRO = 'qui2nous:intro';

function introDejaVue() {
  try {
    return sessionStorage.getItem(CLE_INTRO) === '1';
  } catch {
    return false;
  }
}

function memoriserIntroVue() {
  try {
    sessionStorage.setItem(CLE_INTRO, '1');
  } catch {
    /* sans stockage, l'intro reviendra au prochain rechargement */
  }
}

export function App() {
  const { vue, decalage, connecte, reprise, quitter } = useJeu();
  const secondes = useCompteARebours(vue?.echeance ?? null, decalage);
  const moi = vue?.joueurs.find((j) => j.id === vue.moi);
  useMusiqueChrono(vue, decalage);
  // L'intro s'affiche à l'ouverture, une fois par visite, mais jamais quand on
  // revient dans une partie en cours (écran rallumé, page rechargée).
  const [intro, setIntro] = useState(() => !reprise && !introDejaVue());

  if (intro) {
    return (
      <Intro
        onFini={() => {
          memoriserIntroVue();
          setIntro(false);
        }}
      />
    );
  }

  let ecran;
  if (!vue) {
    ecran = reprise ? <p className="mt-20 text-center text-white/90">Retour dans la partie…</p> : <Accueil />;
  } else if (vue.phase === 'lobby') {
    ecran = <Lobby vue={vue} />;
  } else if (vue.phase === 'podium') {
    ecran = <Podium vue={vue} quitter={quitter} />;
  } else if (moi?.enAttente) {
    ecran = <EnAttente />;
  } else {
    // La clé remet à zéro les saisies d'une manche à l'autre.
    const cle = `${vue.manche}-${vue.phase}`;
    ecran = (
      <div className="flex flex-col gap-5">
        <EnTete vue={vue} secondes={secondes} />
        {vue.phase === 'redaction' && <Redaction vue={vue} />}
        {vue.phase === 'decompte' && <Decompte key={cle} vue={vue} secondes={secondes} />}
        {vue.phase === 'reponse' && <EcranReponse key={cle} vue={vue} secondes={secondes} />}
        {vue.phase === 'vote' && <EcranVote key={cle} vue={vue} />}
        {vue.phase === 'resultat' && <EcranResultat key={cle} vue={vue} />}
      </div>
    );
  }

  return (
    <>
    {/* Le fond coloré et pétillant de l'intro, derrière tous les écrans */}
    <div className="intro-fond fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <DecorPetillant etincelles={24} />
    </div>
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-8">
      {vue && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <Logo />
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-white/20 px-3 py-1 font-display tracking-widest">{vue.code}</span>
            {vue.phase !== 'podium' && (
              <button
                onClick={() => confirm('Quitter la partie ?') && quitter()}
                className="rounded-full px-2 py-1 text-sm text-white/85 hover:text-white"
              >
                Quitter
              </button>
            )}
          </div>
        </header>
      )}
      {!connecte && (
        <p role="status" className="anim-secoue mb-4 rounded-2xl bg-white px-3 py-2 text-center text-sm font-medium text-fuchsia-700 shadow-lg">
          Connexion perdue, reconnexion en cours…
        </p>
      )}
      <main className="flex-1">{ecran}</main>
    </div>
    </>
  );
}
