import { Link } from 'react-router-dom'
import { useTitrePage } from '../utils/useTitrePage'
import BrandLogo from '../components/BrandLogo'
import AmbientBackground from '../components/AmbientBackground'
import OutilResiliation from '../components/OutilResiliation'
import { PRESTATAIRES } from '../data/prestataires'

/**
 * Outil public de résiliation.
 *
 * Il rend service avant de demander quoi que ce soit : ni compte, ni adresse
 * e-mail, ni carte. Quelqu'un qui cherche « résilier son assurance » veut sa
 * lettre, pas une inscription — l'inscription se propose ensuite, pour les
 * autres contrats qu'il n'a pas encore en tête.
 */
export default function Resilier() {
  useTitrePage(
    'Résilier un contrat — lettre de résiliation gratuite | SYNeco',
    'Déposez votre contrat : SYNeco y lit l’organisme et la date d’échéance, et rédige votre lettre de résiliation. Gratuit, sans inscription, rien n’est conservé.',
  )

  return (
    <CoquilleResiliation>
      <h1 className="font-heading text-[28px] leading-[1.15] font-bold text-brand-deep sm:text-[40px]">
        Résilier un contrat, sans y passer la soirée
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-brand-muted sm:text-[16.5px]">
        Déposez votre contrat ou votre avis d’échéance. SYNeco y lit l’organisme et la date qui
        compte, puis rédige votre lettre. Gratuit, sans inscription — et votre document n’est pas
        conservé.
      </p>

      <div className="mt-7">
        <OutilResiliation />
      </div>

      <section className="mt-12">
        <h2 className="font-heading text-[19px] font-semibold text-brand-deep">
          Résilier chez un organisme en particulier
        </h2>
        <p className="mt-1.5 text-sm text-brand-muted">
          Les règles diffèrent selon qu’il s’agit d’une assurance, d’un forfait ou d’un contrat
          d’énergie.
        </p>
        {/* Maillage interne : ces liens font découvrir les pages par
            prestataire, qu'un moteur ne trouverait pas autrement. */}
        <ul className="mt-4 flex flex-wrap gap-2">
          {PRESTATAIRES.map((p) => (
            <li key={p.slug}>
              <Link
                to={`/resilier/${p.slug}`}
                className="inline-block rounded-full border border-brand-border bg-white px-3 py-1.5 text-[13px] font-medium text-brand-deep hover:border-brand-green hover:text-brand-green"
              >
                {p.nom}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </CoquilleResiliation>
  )
}

/** En-tête, fond et pied communs aux pages de résiliation. */
export function CoquilleResiliation({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-mint">
      <header className="relative z-10 border-b border-brand-border/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 pt-[calc(0.875rem+var(--zone-sure-haut))] pb-3.5 sm:px-8">
          <Link to="/">
            <BrandLogo iconSize={32} wordmarkClassName="text-base" />
          </Link>
          <Link
            to="/inscription"
            className="brand-gradient shrink-0 rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-white"
          >
            Créer un compte
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <AmbientBackground variant="auth" />
        <div className="relative z-10 mx-auto max-w-3xl px-5 pt-12 pb-16 sm:px-8 sm:pt-16">
          {children}
        </div>
      </section>

      <footer className="mx-auto max-w-3xl px-5 pb-12 text-[12.5px] text-brand-muted sm:px-8">
        Votre document est lu puis oublié : il n’est ni enregistré, ni rattaché à un compte.{' '}
        <Link to="/confidentialite" className="underline">
          Confidentialité
        </Link>
      </footer>
    </div>
  )
}
