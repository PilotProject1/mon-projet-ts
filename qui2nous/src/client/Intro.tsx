import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { COULEURS_CONFETTIS, DecorPetillant, aleatoire } from './Fond.tsx';
import { boom, contexteAudio, vibrer } from './sons.ts';

// Écran d'ouverture : « QUI », « 2 » puis « NOUS » tombent du haut et
// s'empilent, sur un fond coloré et pétillant. Un toucher mène à l'accueil.

const MOTS = [
  { texte: 'QUI', couleur: '#ffffff', ombre: '#9d174d', taille: 'clamp(4.5rem, 24vw, 8.5rem)', angle: '-4deg' },
  { texte: '2', couleur: '#fde047', ombre: '#b45309', taille: 'clamp(6rem, 34vw, 12rem)', angle: '6deg' },
  { texte: 'NOUS', couleur: '#67e8f9', ombre: '#1e3a8a', taille: 'clamp(4.5rem, 24vw, 8.5rem)', angle: '-3deg' },
];
/** Début de chute de chaque mot (s) ; il touche le sol à 60 % de la durée de chute. */
const DEPARTS = [0.25, 0.85, 1.45];
const DUREE_CHUTE = 0.8;
const atterrissage = (i: number) => DEPARTS[i] + DUREE_CHUTE * 0.6;

/** Gerbe de confettis qui jaillit quand un mot touche le sol. */
function Eclats({ delai, graine }: { delai: number; graine: number }) {
  const eclats = useMemo(() => {
    const r = aleatoire(graine);
    return Array.from({ length: 14 }, (_, i) => {
      const angle = (i / 14) * Math.PI * 2 + r() * 0.4;
      const distance = 70 + r() * 90;
      return {
        dx: `${Math.cos(angle) * distance}px`,
        dy: `${Math.sin(angle) * distance * 0.6 - 20}px`,
        couleur: COULEURS_CONFETTIS[Math.floor(r() * COULEURS_CONFETTIS.length)],
        taille: 6 + r() * 8,
        rond: r() > 0.5,
      };
    });
  }, [graine]);
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {eclats.map((e, i) => (
        <span
          key={i}
          className="intro-eclat absolute"
          style={
            {
              '--dx': e.dx,
              '--dy': e.dy,
              width: e.taille,
              height: e.rond ? e.taille : e.taille / 2,
              borderRadius: e.rond ? '9999px' : '2px',
              backgroundColor: e.couleur,
              animationDelay: `${delai}s`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

const mouvementReduit = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function Intro({ onFini }: { onFini: () => void }) {
  const [sortie, setSortie] = useState(false);
  // Les téléphones bloquent le son avant le premier toucher : dans ce cas, on
  // attend ce toucher pour lancer la chute, afin que chaque mot fasse BOOM.
  const [lance, setLance] = useState(() => {
    const ctx = contexteAudio();
    return !ctx || ctx.state === 'running' || mouvementReduit();
  });

  const partir = () => {
    if (!lance) {
      contexteAudio()?.resume();
      setLance(true);
    } else if (!sortie) setSortie(true);
  };

  // Un BOOM (et une vibration sur Android) à chaque mot qui touche le sol.
  useEffect(() => {
    const ctx = contexteAudio();
    if (!lance || !ctx || mouvementReduit()) return;
    let annule = false;
    const minuteries: ReturnType<typeof setTimeout>[] = [];
    ctx
      .resume()
      .catch(() => {})
      .then(() => {
        if (annule || ctx.state !== 'running') return;
        const t0 = ctx.currentTime;
        DEPARTS.forEach((_, i) => {
          boom(ctx, t0 + atterrissage(i), 1 + i * 0.3);
          minuteries.push(setTimeout(() => vibrer(60 + i * 40), atterrissage(i) * 1000));
        });
      });
    return () => {
      annule = true;
      minuteries.forEach(clearTimeout);
    };
  }, [lance]);

  // Fin de l'animation de sortie : on passe à l'accueil.
  useEffect(() => {
    if (!sortie) return;
    const t = setTimeout(onFini, 450);
    return () => clearTimeout(t);
  }, [sortie, onFini]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Qui2Nous ? Toucher pour commencer"
      onClick={partir}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && partir()}
      className={`intro-fond fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center overflow-hidden px-4 select-none ${sortie ? 'intro-sortie' : ''}`}
    >
      <DecorPetillant />

      {!lance && (
        <div className="flex flex-col items-center gap-3 text-white">
          <span className="intro-pulsation text-7xl drop-shadow-lg" style={{ animationDelay: '0s, 0.6s' }}>
            👆
          </span>
          <p className="font-display text-3xl font-bold drop-shadow">Touche l’écran</p>
          <p className="font-display text-lg text-white/85">🔊 Monte le son !</p>
        </div>
      )}

      {lance && (
        <>
          {/* Les mots qui tombent, puis la pile qui tremble à chaque atterrissage */}
          <div
            className="intro-pile relative flex flex-col items-center"
            style={{ animationDelay: DEPARTS.map((_, i) => `${atterrissage(i)}s`).join(', ') }}
          >
            {MOTS.map((m, i) => (
              <span key={m.texte} className="relative block leading-[0.82]">
                <span
                  className="intro-mot block font-display font-bold tracking-tight"
                  style={
                    {
                      '--angle': m.angle,
                      fontSize: m.taille,
                      color: m.couleur,
                      textShadow: `0 0.06em 0 ${m.ombre}, 0 0.12em 0 rgba(0,0,0,0.25), 0 0.2em 0.5em rgba(0,0,0,0.35)`,
                      animationDelay: `${DEPARTS[i]}s`,
                      animationDuration: `${DUREE_CHUTE}s`,
                    } as CSSProperties
                  }
                >
                  {m.texte}
                </span>
                <Eclats delai={atterrissage(i)} graine={i + 7} />
              </span>
            ))}
          </div>

          <p className="intro-apparition mt-6 max-w-xs text-center font-display text-xl font-medium text-white drop-shadow">
            Le jeu qui révèle ce que vous pensez vraiment les uns des autres
          </p>
          <span
            className="intro-apparition intro-pulsation mt-8 rounded-full bg-white px-10 py-4 font-display text-2xl font-bold text-fuchsia-600 shadow-[0_6px_0_#a21caf,0_12px_30px_rgba(0,0,0,0.3)]"
            style={{ animationDelay: '2.9s, 3.4s' }}
          >
            Jouer
          </span>
        </>
      )}
    </div>
  );
}
