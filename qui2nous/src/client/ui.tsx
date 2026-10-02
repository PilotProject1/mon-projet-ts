import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { JoueurVue } from '../shared/protocol.ts';

export function Bouton({
  variante = 'principal',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'secondaire' }) {
  const styles =
    variante === 'principal'
      ? 'bg-amber-400 text-indigo-950 shadow-[0_4px_0_#b45309] active:translate-y-1 active:shadow-none'
      : 'bg-white/10 text-white ring-1 ring-white/20 active:bg-white/20';
  return (
    <button
      className={`min-h-12 rounded-2xl px-5 py-3 font-display text-lg font-semibold transition disabled:pointer-events-none disabled:opacity-40 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Carte({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur ${className}`}>{children}</div>;
}

export function Avatar({ joueur, taille = 'md' }: { joueur: Pick<JoueurVue, 'avatar' | 'connecte'>; taille?: 'sm' | 'md' | 'lg' }) {
  const t = { sm: 'size-8 text-lg', md: 'size-11 text-2xl', lg: 'size-16 text-4xl' }[taille];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-900/80 ring-2 ring-white/20 ${t} ${joueur.connecte ? '' : 'opacity-40 grayscale'}`}
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
        {moi && <span className="text-white/50"> (toi)</span>}
      </span>
    </span>
  );
}

export function Logo({ grand = false }: { grand?: boolean }) {
  return (
    <h1 className={`font-display font-bold tracking-tight ${grand ? 'text-5xl sm:text-6xl' : 'text-2xl'}`}>
      Qui<span className="text-amber-400">2</span>Nous <span className="text-pink-400">?</span>
    </h1>
  );
}

export function Erreur({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-rose-500/20 px-3 py-2 text-sm text-rose-100 ring-1 ring-rose-400/40">
      {message}
    </p>
  );
}
