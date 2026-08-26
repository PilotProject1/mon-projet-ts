import { Link, Navigate, useParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useTitrePage } from '../utils/useTitrePage'
import OutilResiliation from '../components/OutilResiliation'
import { CoquilleResiliation } from './Resilier'
import {
  PRESTATAIRES,
  SECTEURS,
  metaPrestataire,
  prestatairePourSlug,
} from '../data/prestataires'

/**
 * Page « Résilier X ».
 *
 * Elle vise une recherche précise et doit y répondre : le contenu vient du
 * secteur du prestataire — assurance, télécom ou énergie n'obéissent pas aux
 * mêmes règles — et non d'un gabarit où seul le nom changerait.
 */
export default function ResilierPrestataire() {
  const { slug } = useParams<{ slug: string }>()
  const prestataire = slug ? prestatairePourSlug(slug) : undefined

  // Un slug inconnu ne doit pas produire une page vide indexable : mieux vaut
  // renvoyer sur l'outil générique, qui rend le même service.
  if (!prestataire) return <Navigate to="/resilier" replace />

  return <Contenu prestataire={prestataire} />
}

function Contenu({
  prestataire,
}: {
  prestataire: NonNullable<ReturnType<typeof prestatairePourSlug>>
}) {
  const meta = metaPrestataire(prestataire)
  useTitrePage(meta.titre, meta.description)

  const secteur = SECTEURS[prestataire.secteur]
  const voisins = PRESTATAIRES.filter(
    (p) => p.secteur === prestataire.secteur && p.slug !== prestataire.slug,
  )

  return (
    <CoquilleResiliation>
      <p className="text-[12px] font-semibold tracking-wide text-brand-green uppercase">
        <Link to="/resilier" className="hover:underline">
          Résiliation
        </Link>{' '}
        · {prestataire.nom}
      </p>
      <h1 className="font-heading mt-2 text-[28px] leading-[1.15] font-bold text-brand-deep sm:text-[40px]">
        Résilier votre {secteur.contrat} {prestataire.nom}
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-brand-muted sm:text-[16.5px]">
        {secteur.principe}
      </p>

      <div className="mt-7">
        <OutilResiliation />
      </div>

      <section className="mt-12">
        <h2 className="font-heading text-[19px] font-semibold text-brand-deep">
          À vérifier avant d’envoyer
        </h2>
        <ul className="mt-3 space-y-2.5">
          {secteur.points.map((point) => (
            <li key={point} className="flex items-start gap-2.5">
              <Check size={16} className="mt-0.5 shrink-0 text-brand-green" />
              <span className="text-[14.5px] leading-relaxed text-brand-ink">{point}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] leading-relaxed text-brand-muted">
          Ces informations sont générales et ne remplacent pas vos conditions contractuelles. Pour
          le détail applicable à votre situation, consultez{' '}
          <a
            href={secteur.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-green underline"
          >
            {secteur.source.libelle}
          </a>
          .
        </p>
      </section>

      {voisins.length > 0 && (
        <section className="mt-10">
          <h2 className="font-heading text-[19px] font-semibold text-brand-deep">
            Autres organismes du même secteur
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {voisins.map((p) => (
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
      )}
    </CoquilleResiliation>
  )
}
