import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, Check, Copy, Loader2, Upload } from 'lucide-react'
import type { AnalyseResiliation } from '../types'
import { ApiError, resiliationApi } from '../services/api'

const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * Dépôt d'un contrat, lecture, et lettre de résiliation prête à envoyer.
 *
 * Isolé de la page qui l'accueille : la page générique et les pages par
 * prestataire proposent le même geste, et le dupliquer aurait garanti qu'une
 * des deux copies finisse par diverger.
 */
export default function OutilResiliation() {
  const [fichier, setFichier] = useState<File | null>(null)
  const [analyse, setAnalyse] = useState<AnalyseResiliation | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [copie, setCopie] = useState(false)
  const champFichier = useRef<HTMLInputElement>(null)

  async function lancer(cible: File) {
    setEnCours(true)
    setErreur(null)
    setAnalyse(null)
    try {
      setAnalyse(await resiliationApi.analyser(cible))
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'L’analyse a échoué')
    } finally {
      setEnCours(false)
    }
  }

  function choisir(liste: FileList | null) {
    const cible = liste?.[0]
    if (!cible) return
    setFichier(cible)
    void lancer(cible)
  }

  async function copier() {
    if (!analyse) return
    try {
      await navigator.clipboard.writeText(
        `${analyse.lettre.objet}\n\n${analyse.lettre.corps}`,
      )
      setCopie(true)
      setTimeout(() => setCopie(false), 2500)
    } catch {
      setErreur('La copie automatique a échoué — sélectionnez le texte à la main.')
    }
  }

  const mailto = analyse
    ? `mailto:?subject=${encodeURIComponent(analyse.lettre.objet)}&body=${encodeURIComponent(analyse.lettre.corps)}`
    : '#'

  return (
    <>
      <div>
        <input
          ref={champFichier}
          id="fichier-resiliation"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => choisir(e.target.files)}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => champFichier.current?.click()}
          disabled={enCours}
          className="brand-gradient flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-4 text-[15px] font-semibold text-white disabled:opacity-70 sm:w-auto"
        >
          {enCours ? (
            <>
              <Loader2 size={17} className="animate-spin" />
              Lecture du document...
            </>
          ) : (
            <>
              <Upload size={17} />
              Déposer mon contrat
            </>
          )}
        </button>
        <p className="mt-2.5 text-[13px] text-brand-muted">
          PDF, JPG, PNG ou WEBP — 10 Mo maximum.
          {fichier && !enCours && (
            <span className="ml-1 text-brand-deep">Fichier lu : {fichier.name}</span>
          )}
        </p>
      </div>

      {erreur && (
        <div className="mt-5 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {analyse && (
        <div className="mt-8">
          {analyse.avertissement && (
            <div className="mb-4 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
              {analyse.avertissement}
            </div>
          )}

          {/* Ce que la lecture a reconnu. Empilé sur téléphone : côte à côte,
              un nom d'organisme long écraserait la date. */}
          {(analyse.prestataire || analyse.echeance) && (
            <div className="brand-card-shadow mb-4 rounded-lg border border-brand-border bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                {analyse.prestataire && (
                  <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-brand-muted uppercase">
                      Organisme
                    </p>
                    <p className="font-heading truncate text-[17px] font-semibold text-brand-deep">
                      {analyse.prestataire}
                    </p>
                    {analyse.reference && (
                      <p className="mt-0.5 truncate text-[13px] text-brand-muted">
                        Référence : {analyse.reference}
                      </p>
                    )}
                  </div>
                )}
                {analyse.echeance && (
                  <div className="min-w-0 sm:text-right">
                    <p className="text-xs font-medium tracking-wide text-brand-muted uppercase">
                      Date repérée
                    </p>
                    <p className="font-heading flex items-center gap-1.5 text-[17px] font-semibold text-brand-deep sm:justify-end">
                      <CalendarClock size={16} className="shrink-0 text-brand-green" />
                      {DATE_LONGUE.format(new Date(analyse.echeance))}
                    </p>
                    {analyse.echeanceLibelle && (
                      <p className="mt-0.5 text-[13px] text-brand-muted">
                        Mention « {analyse.echeanceLibelle} »
                      </p>
                    )}
                  </div>
                )}
              </div>

              {analyse.echeance && (
                /* On cite le document, on n'énonce pas le droit : les délais
                   varient selon le contrat et sa date de souscription, et
                   annoncer une date limite fausse serait pire que se taire. */
                <p className="mt-3.5 border-t border-brand-border pt-3 text-[13px] leading-relaxed text-brand-muted">
                  Cette date est celle écrite sur votre document. Le délai à respecter pour
                  résilier dépend du type de contrat : vérifiez vos conditions générales ou{' '}
                  <a
                    href="https://www.service-public.fr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-green underline"
                  >
                    service-public.fr
                  </a>
                  . Envoyez de préférence en recommandé avec accusé de réception.
                </p>
              )}
            </div>
          )}

          <div className="brand-card-shadow rounded-lg border border-brand-border bg-white p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <p className="font-heading text-[15px] font-semibold text-brand-deep">
                Votre lettre de résiliation
              </p>
              {analyse.redigeeParIA && (
                <span className="w-fit shrink-0 rounded-full bg-brand-green-soft px-2 py-0.5 text-xs font-medium text-brand-green-deep">
                  Rédigée par l’IA
                </span>
              )}
            </div>

            <p className="mb-2 text-[13px] text-brand-muted">
              Objet : <span className="text-brand-ink">{analyse.lettre.objet}</span>
            </p>
            <textarea
              readOnly
              value={analyse.lettre.corps}
              rows={14}
              aria-label="Corps de la lettre de résiliation"
              className="w-full resize-y rounded-md border border-brand-border bg-brand-mint/40 p-3 font-mono text-[13px] leading-relaxed text-brand-ink"
            />

            {/* Empilés sur téléphone : les deux intitulés seraient tronqués. */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={copier}
                className="brand-gradient flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white"
              >
                {copie ? <Check size={15} /> : <Copy size={15} />}
                {copie ? 'Copié' : 'Copier la lettre'}
              </button>
              <a
                href={mailto}
                className="flex items-center justify-center rounded-md border border-brand-border px-4 py-2.5 text-sm font-medium text-brand-deep hover:bg-brand-mint"
              >
                Ouvrir dans mon client mail
              </a>
            </div>
            <p className="mt-2.5 text-[12.5px] text-brand-muted">
              Relisez-la et complétez vos coordonnées avant l’envoi : rien n’est expédié pour
              vous.
            </p>
          </div>

          {/* La bascule vers le compte : elle arrive une fois le service rendu,
              et porte sur ce que le visiteur n'a pas encore en tête — les
              autres contrats qui se reconduiront sans le prévenir. */}
          <div className="brand-card-shadow neon-carte mt-4 rounded-lg border border-brand-border bg-white p-5">
            <h2 className="font-heading text-[17px] font-semibold text-brand-deep">
              Et vos autres contrats ?
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">
              Celui-ci est réglé. Les suivants se reconduiront eux aussi, à des dates que
              personne ne retient. SYNeco les lit une fois et vous prévient trente jours avant,
              puis sept, puis la veille.
            </p>
            <Link
              to="/inscription"
              className="brand-gradient mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
            >
              Surveiller mes échéances gratuitement
              <ArrowRight size={15} />
            </Link>
            <p className="mt-2 text-[12.5px] text-brand-muted">
              Sans carte bancaire · 10 documents offerts
            </p>
          </div>
        </div>
      )}
    </>
  )
}
