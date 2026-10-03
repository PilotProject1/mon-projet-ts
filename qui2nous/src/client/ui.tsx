import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import type { JoueurVue } from '../shared/protocol.ts';

export function Bouton({
  variante = 'principal',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'secondaire' }) {
  const styles =
    variante === 'principal'
      ? 'bg-white text-fuchsia-600 font-bold shadow-[0_5px_0_#a21caf,0_10px_24px_rgba(0,0,0,0.2)] active:translate-y-1 active:shadow-[0_1px_0_#a21caf]'
      : 'bg-white/20 text-white ring-1 ring-white/40 backdrop-blur-md active:bg-white/30';
  return (
    <button
      className={`min-h-12 rounded-2xl px-5 py-3 font-display text-lg font-semibold transition hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Carte({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div style={style} className={`rounded-3xl bg-white/20 p-4 shadow-xl ring-1 ring-white/40 backdrop-blur-md ${className}`}>
      {children}
    </div>
  );
}

export function Avatar({ joueur, taille = 'md' }: { joueur: Pick<JoueurVue, 'avatar' | 'connecte'>; taille?: 'sm' | 'md' | 'lg' }) {
  const t = { sm: 'size-8 text-lg', md: 'size-11 text-2xl', lg: 'size-16 text-4xl' }[taille];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white/35 shadow-md ring-2 ring-white/70 ${t} ${joueur.connecte ? '' : 'opacity-40 grayscale'}`}
    >
      {joueur.avatar}
    </span>
  );
}

export function Pastille({ joueur, moi }: { joueur: JoueurVue; moi?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar joueur={joueur} taille="sm" />
      <span className="truncate font-medium">
        {joueur.nom}
        {moi && <span className="text-white/75"> (toi)</span>}
      </span>
    </span>
  );
}

/** Le petit logo en relief de l'en-tête, aux couleurs de l'intro. */
export function Logo() {
  const ombre = (c: string) => ({ textShadow: `0 0.07em 0 ${c}, 0 0.14em 0.3em rgba(0,0,0,0.25)` });
  return (
    <h1 className="font-display text-2xl font-bold tracking-tight" aria-label="Qui2Nous">
      <span style={ombre('#9d174d')}>QUI</span>
      <span className="inline-block -rotate-6 text-yellow-300" style={ombre('#b45309')}>
        2
      </span>
      <span className="text-cyan-300" style={ombre('#1e3a8a')}>
        NOUS
      </span>
    </h1>
  );
}

export function Erreur({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="anim-secoue rounded-2xl bg-white px-4 py-2 text-center text-sm font-medium text-rose-600 shadow-lg">
      {message}
    </p>
  );
}
