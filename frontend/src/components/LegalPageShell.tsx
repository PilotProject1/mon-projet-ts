import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import { useTitrePage } from '../utils/useTitrePage'

/**
 * Champ que l'éditeur doit renseigner avant la mise en ligne publique.
 * Volontairement très visible pour qu'aucun placeholder ne passe en production.
 */
export function ARemplir({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">
      [À compléter : {children}]
    </mark>
  )
}

interface LegalPageShellProps {
  title: string
  lastUpdated: string
  children: ReactNode
}

export default function LegalPageShell({ title, lastUpdated, children }: LegalPageShellProps) {
  useTitrePage(`${title} — SYNeco`)
  return (
    <div className="min-h-screen bg-brand-mint">
      <header className="border-b border-brand-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/">
            <BrandLogo iconSize={32} wordmarkClassName="text-base" />
          </Link>
          <Link
            to="/connexion"
            className="shrink-0 text-sm font-medium text-brand-green hover:underline"
          >
            Retour au site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <h1 className="font-heading text-2xl font-bold text-brand-deep sm:text-[32px]">{title}</h1>
        <p className="mt-1.5 text-sm text-brand-muted">Dernière mise à jour : {lastUpdated}</p>

        <div className="legal-content mt-8">{children}</div>

        <footer className="mt-12 border-t border-brand-border pt-6 text-sm text-brand-muted">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/mentions-legales" className="hover:text-brand-green hover:underline">
              Mentions légales
            </Link>
            <Link to="/confidentialite" className="hover:text-brand-green hover:underline">
              Politique de confidentialité
            </Link>
            <Link to="/cgv" className="hover:text-brand-green hover:underline">
              Conditions générales de vente
            </Link>
          </div>
        </footer>
      </main>
    </div>
  )
}
