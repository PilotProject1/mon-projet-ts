import { Link } from 'react-router-dom'
import { ShieldCheck, Check, ArrowRight } from 'lucide-react'
import type { ComponentType } from 'react'
import BrandLogo from '../components/BrandLogo'
import {
  IllustrationCadrage,
  IllustrationLecture,
  IllustrationRappels,
  IllustrationHausse,
} from '../components/IllustrationsAtouts'
import AmbientBackground from '../components/AmbientBackground'
import { useTitrePage } from '../utils/useTitrePage'

/*
 * Page vue par un visiteur qui n'a pas de compte.
 *
 * Jusqu'ici, l'adresse du site menait directement à l'écran de connexion :
 * personne ne pouvait comprendre ce qu'est SYNeco sans s'inscrire, et les
 * moteurs de recherche n'avaient rien à indexer. C'est la seule page dont le
 * travail est d'expliquer.
 *
 * Elle ne promet que ce que le code fait réellement. Une page d'accueil qui
 * exagère se paie deux fois : à l'inscription, puis à la résiliation.
 */

interface AtoutProps {
  /** Illustration du geste décrit, affichée en tête de la case. */
  illustration: ComponentType
  titre: string
  texte: string
}

const ATOUTS: AtoutProps[] = [
  {
    illustration: IllustrationCadrage,
    titre: 'Photographiez, c’est rangé',
    texte:
      'Le document est cadré, redressé et éclairci automatiquement. Aucune retouche à faire, aucun scanner à sortir.',
  },
  {
    illustration: IllustrationLecture,
    titre: 'Le document est lu',
    texte:
      'Son type, son émetteur, son montant et sa date sont reconnus dans le texte. Vous n’avez rien à saisir.',
  },
  {
    illustration: IllustrationRappels,
    titre: 'Vous êtes prévenu à temps',
    texte:
      'L’échéance repérée devient un rappel : trente jours, sept jours et un jour avant, puis le jour même — par notification et par e-mail.',
  },
  {
    illustration: IllustrationHausse,
    titre: 'Les hausses ne passent plus',
    texte:
      'Vos dépenses qui reviennent sont reconstituées à partir de vos factures, et une augmentation vous est signalée en euros.',
  },
]

const OFFRES = [
  {
    nom: 'Gratuit',
    prix: '0 €',
    detail: 'Jusqu’à 10 documents',
    inclus: ['Échéances et rappels', 'Dépenses récurrentes', 'Application installable'],
  },
  {
    nom: 'Particulier Premium',
    prix: '4,99 €',
    detail: 'par mois, sans engagement',
    inclus: [
      'Documents illimités',
      'Lecture par intelligence artificielle',
      'Recherche en langage naturel',
      'Partage sécurisé',
    ],
    vedette: true,
  },
  {
    nom: 'Professionnel',
    prix: '19,99 €',
    detail: 'par mois, sans engagement',
    // Pas de devis dans le code : ne pas l'annoncer ici.
    inclus: ['Tout Premium', 'Entreprise et clients', 'Factures émises et suivies'],
  },
]

export default function Accueil() {
  useTitrePage(
    'SYNeco — Le coffre-fort administratif du particulier et de l’indépendant',
    'Photographiez un document : SYNeco le lit, repère son échéance et vous prévient avant qu’elle n’arrive. Gratuit jusqu’à 10 documents.',
  )

  return (
    <div className="min-h-screen bg-brand-mint">
      <header className="relative z-10 border-b border-brand-border/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 pt-[calc(0.875rem+var(--zone-sure-haut))] pb-3.5 sm:px-8">
          <BrandLogo iconSize={32} wordmarkClassName="text-base" />
          <div className="flex shrink-0 items-center gap-3">
            <Link
              to="/connexion"
              className="text-[13.5px] font-medium text-brand-muted hover:text-brand-green"
            >
              Se connecter
            </Link>
            <Link
              to="/inscription"
              className="brand-gradient rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-white"
            >
              Créer un compte
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <AmbientBackground variant="auth" />
        <div className="relative z-10 mx-auto max-w-5xl px-5 pt-14 pb-16 sm:px-8 sm:pt-20 sm:pb-20">
          <h1 className="font-heading max-w-3xl text-[30px] leading-[1.15] font-bold text-brand-deep sm:text-[44px]">
            Le coffre-fort administratif du particulier et de l’indépendant
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-brand-muted sm:text-[17px]">
            Photographiez un document : SYNeco le lit, repère son échéance et vous prévient avant
            qu’elle n’arrive. Vos contrats, factures et attestations au même endroit, consultables
            depuis votre téléphone.
          </p>

          {/* Sur téléphone les deux boutons s'empilent : côte à côte, leurs
              intitulés seraient tronqués. */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/inscription"
              className="brand-gradient flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold text-white"
            >
              Commencer gratuitement
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/connexion"
              className="flex items-center justify-center rounded-xl border border-brand-border bg-white px-5 py-3 text-[15px] font-semibold text-brand-deep hover:bg-white/70"
            >
              J’ai déjà un compte
            </Link>
          </div>
          <p className="mt-4 text-[13px] text-brand-muted">
            Sans carte bancaire · 10 documents offerts · Résiliation en un clic
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-16 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {ATOUTS.map(({ illustration: Illustration, titre, texte }) => (
            <div
              key={titre}
              className="brand-card-shadow overflow-hidden rounded-[14px] border border-brand-border bg-white"
            >
              {/* L'illustration occupe toute la largeur de la case : à cette
                  taille, un dessin encadré perdrait sa lisibilité. */}
              <div className="border-b border-brand-border bg-brand-mint/60 px-5 pt-4 pb-2">
                <Illustration />
              </div>
              <div className="px-5 pt-4 pb-5">
              <h2 className="font-heading text-[15.5px] font-semibold text-brand-ink">{titre}</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-muted">{texte}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-16 sm:px-8">
        <h2 className="font-heading text-[22px] font-semibold text-brand-deep">
          Des offres lisibles
        </h2>
        <p className="mt-1.5 text-[13.5px] text-brand-muted">
          TVA non applicable, article 293 B du Code général des impôts : les prix affichés sont
          ceux réellement prélevés.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {OFFRES.map((offre) => (
            <div
              key={offre.nom}
              className={`rounded-[14px] border bg-white px-5 py-5 ${
                offre.vedette
                  ? 'border-brand-green shadow-[0_18px_40px_-24px_rgba(47,143,111,0.55)]'
                  : 'border-brand-border'
              }`}
            >
              <p className="text-[13px] font-semibold text-brand-muted">{offre.nom}</p>
              <p className="font-heading mt-1 text-[26px] font-semibold text-brand-ink">
                {offre.prix}
              </p>
              <p className="text-[12.5px] text-brand-muted">{offre.detail}</p>
              <ul className="mt-4 space-y-2">
                {offre.inclus.map((ligne) => (
                  <li key={ligne} className="flex items-start gap-2 text-[13px] text-brand-ink">
                    <Check size={14} className="mt-0.5 shrink-0 text-brand-green" />
                    <span className="min-w-0">{ligne}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-16 sm:px-8">
        <div className="rounded-[14px] border border-brand-border bg-white px-5 py-5">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-green" />
            <div className="min-w-0">
              <h2 className="font-heading text-[15.5px] font-semibold text-brand-ink">
                Ce que SYNeco ne fait pas
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-muted">
                Aucun accès à vos comptes bancaires, aucune publicité, aucune revente de vos
                données. La base de données est hébergée dans l’Union européenne. Vous pouvez
                supprimer vos documents et votre compte à tout moment.{' '}
                <Link to="/confidentialite" className="font-medium text-brand-green hover:underline">
                  Politique de confidentialité
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-20 sm:px-8">
        <div className="brand-gradient rounded-[16px] px-6 py-8 text-center">
          <h2 className="font-heading text-[20px] font-semibold text-white sm:text-[24px]">
            Le premier document prend deux minutes
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[13.5px] leading-relaxed text-white/85">
            Photographiez une facture ou une attestation : vous verrez tout de suite ce que SYNeco
            en tire.
          </p>
          <Link
            to="/inscription"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[15px] font-semibold text-brand-deep"
          >
            Créer un compte gratuit
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-brand-border bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-6 text-[13px] text-brand-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} SYNeco — VincentLV</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/mentions-legales" className="hover:text-brand-green hover:underline">
              Mentions légales
            </Link>
            <Link to="/confidentialite" className="hover:text-brand-green hover:underline">
              Confidentialité
            </Link>
            <Link to="/cgv" className="hover:text-brand-green hover:underline">
              CGV
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
