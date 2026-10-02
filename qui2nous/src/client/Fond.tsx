import { useMemo } from 'react';

// Décor coloré et pétillant partagé par l'intro et l'accueil : taches de
// couleur floues qui dérivent et étincelles qui scintillent. À placer dans un
// conteneur `intro-fond` (le dégradé animé) en `overflow-hidden`.

export const COULEURS_CONFETTIS = ['#fde047', '#f472b6', '#67e8f9', '#a3e635', '#fb923c', '#ffffff', '#c084fc'];

/** Petit générateur déterministe : les étincelles ne bougent pas d'un rendu à l'autre. */
export function aleatoire(graine: number) {
  let s = graine;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function DecorPetillant({ etincelles: n = 36 }: { etincelles?: number }) {
  const etincelles = useMemo(() => {
    const r = aleatoire(42);
    return Array.from({ length: n }, (_, i) => ({
      gauche: `${r() * 100}%`,
      haut: `${r() * 100}%`,
      taille: 3 + r() * 7,
      couleur: COULEURS_CONFETTIS[i % COULEURS_CONFETTIS.length],
      delai: `${r() * 3}s`,
      duree: `${1.6 + r() * 2.4}s`,
    }));
  }, [n]);

  return (
    <>
      <span className="intro-tache" style={{ background: '#e879f9', top: '-10%', left: '-20%' }} aria-hidden />
      <span
        className="intro-tache"
        style={{ background: '#7c3aed', bottom: '-15%', right: '-25%', animationDelay: '-4s' }}
        aria-hidden
      />
      <span
        className="intro-tache"
        style={{ background: '#fb923c', top: '35%', left: '55%', animationDelay: '-8s', opacity: 0.45 }}
        aria-hidden
      />
      {etincelles.map((e, i) => (
        <span
          key={i}
          aria-hidden
          className="intro-etincelle absolute rounded-full"
          style={{
            left: e.gauche,
            top: e.haut,
            width: e.taille,
            height: e.taille,
            backgroundColor: e.couleur,
            boxShadow: `0 0 ${e.taille * 2}px ${e.couleur}`,
            animationDelay: e.delai,
            animationDuration: e.duree,
          }}
        />
      ))}
    </>
  );
}
