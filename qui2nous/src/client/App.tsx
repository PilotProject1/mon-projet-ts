import { useState } from 'react';
import { useCompteARebours, useJeu } from './connexion.ts';
import { Intro } from './Intro.tsx';
import { Accueil, Decompte, Redaction, EcranReponse, EcranResultat, EcranVote, EnAttente, EnTete, Lobby, Podium } from './ecrans.tsx';
import { Logo } from './ui.tsx';
import { DecorPetillant } from './Fond.tsx';

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
