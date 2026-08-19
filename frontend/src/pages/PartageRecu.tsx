import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, Loader2, Share2 } from 'lucide-react'
import { ApiError, documentsApi } from '../services/api'
import { useTitrePage } from '../utils/useTitrePage'

/*
 * Ce qui se passe quand on partage un document vers SYNeco depuis une autre
 * application — la messagerie, la galerie, un gestionnaire de fichiers.
 *
 * Le système remet les fichiers au service worker par une requête POST, que
 * cette page ne voit jamais : elle est ouverte ensuite, par une navigation
 * ordinaire, et vient récupérer ce qui a été mis de côté.
 *
 * Le dépôt n'est pas automatique. Un document qui part dans un coffre sans
 * qu'on ait rien confirmé serait déroutant, et un partage déclenché par
 * mégarde n'aurait aucun retour en arrière. On montre donc ce qui a été
 * reçu, et on attend un geste.
 */

const CLE_PARTAGE = '/__partage-en-attente'
const CACHE_PARTAGE = /-partage$/

interface FichierRecu {
  nom: string
  fichier: File
}

type Etape = 'lecture' | 'pret' | 'envoi' | 'fini' | 'vide'

function poids(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

export default function PartageRecu() {
  useTitrePage('Document partagé — SYNeco', 'Déposer un document partagé depuis une autre application.')
  const [etape, setEtape] = useState<Etape>('lecture')
  const [recus, setRecus] = useState<FichierRecu[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [deposes, setDeposes] = useState(0)
  const navigate = useNavigate()
  // Deux exécutions de l'effet en développement videraient la boîte de
  // transit avant la seconde lecture.
  const dejaLu = useRef(false)

  /** Retrouve le cache de transit, dont le nom porte le numéro de version. */
  const ouvrirLaBoite = useCallback(async () => {
    const noms = await caches.keys()
    const nom = noms.find((n) => CACHE_PARTAGE.test(n))
    return nom ? caches.open(nom) : null
  }, [])

  useEffect(() => {
    if (dejaLu.current) return
    dejaLu.current = true

    void (async () => {
      if (typeof caches === 'undefined') {
        setEtape('vide')
        return
      }
      const boite = await ouvrirLaBoite()
      if (!boite) {
        setEtape('vide')
        return
      }

      const clefs = (await boite.keys()).filter((r) =>
        new URL(r.url).pathname.startsWith(CLE_PARTAGE),
      )
      const trouves: FichierRecu[] = []
      for (const clef of clefs) {
        const reponse = await boite.match(clef)
        if (!reponse) continue
        const nom = decodeURIComponent(
          reponse.headers.get('x-nom-fichier') || 'document',
        )
        const type = reponse.headers.get('content-type') || 'application/octet-stream'
        trouves.push({ nom, fichier: new File([await reponse.blob()], nom, { type }) })
        // Consommé : un partage ne doit pas ressurgir au prochain passage.
        await boite.delete(clef)
      }

      setRecus(trouves)
      setEtape(trouves.length > 0 ? 'pret' : 'vide')
    })()
  }, [ouvrirLaBoite])

  async function deposer() {
    setErreur(null)
    setEtape('envoi')
    let reussis = 0
    try {
      for (const recu of recus) {
        await documentsApi.create({ name: recu.nom, file: recu.fichier })
        reussis += 1
        setDeposes(reussis)
      }
      setEtape('fini')
      /*
       * Rechargement complet, et non une navigation interne : le dépôt s'est
       * fait ici, sans passer par l'état que l'application tient de la liste
       * des documents. Une simple navigation afficherait la liste d'avant, et
       * le document tout juste déposé semblerait perdu.
       */
      setTimeout(() => window.location.assign('/documents'), 1400)
    } catch (err) {
      setDeposes(reussis)
      setErreur(err instanceof ApiError ? err.message : 'Le dépôt n’a pas abouti')
      setEtape('pret')
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-start gap-2.5">
        <Share2 size={20} className="mt-1 shrink-0 text-brand-green" />
        <div className="min-w-0">
          <h1 className="font-heading text-[22px] font-semibold text-brand-ink">
            Document partagé
          </h1>
          <p className="mt-1 text-[13.5px] text-brand-muted">
            Reçu depuis une autre application.
          </p>
        </div>
      </div>

      {etape === 'lecture' && (
        <p className="mt-6 flex items-center gap-2 text-sm text-brand-muted">
          <Loader2 size={16} className="animate-spin" />
          Lecture du partage…
        </p>
      )}

      {etape === 'vide' && (
        <div className="mt-6 rounded-[14px] border border-brand-border bg-white px-5 py-5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-brand-amber" />
            <div className="min-w-0">
              <p className="text-[13.5px] leading-relaxed text-brand-ink">
                Aucun document à déposer.
              </p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-muted">
                Cette page s’ouvre quand vous partagez un fichier vers SYNeco depuis une
                autre application. Elle n’a rien à afficher si vous y êtes arrivé
                autrement — ou si le partage a déjà été déposé.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/documents')}
            className="mt-4 rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-deep hover:bg-brand-mint"
          >
            Aller à mes documents
          </button>
        </div>
      )}

      {(etape === 'pret' || etape === 'envoi' || etape === 'fini') && (
        <div className="mt-6 rounded-[14px] border border-brand-border bg-white px-5 py-5">
          <ul className="divide-y divide-brand-border">
            {recus.map((recu, i) => (
              <li key={`${recu.nom}-${i}`} className="flex items-center gap-3 py-2.5">
                {etape !== 'pret' && i < deposes ? (
                  <Check size={16} className="shrink-0 text-brand-green" />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full border border-brand-border" />
                )}
                <div className="min-w-0">
                  {/* truncate : un nom de pièce jointe est souvent très long. */}
                  <p className="truncate text-sm font-medium text-brand-ink">{recu.nom}</p>
                  <p className="text-xs text-brand-muted">{poids(recu.fichier.size)}</p>
                </div>
              </li>
            ))}
          </ul>

          {erreur && <p className="mt-2 text-xs text-brand-danger">{erreur}</p>}

          {etape === 'fini' ? (
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-green">
              <Check size={16} />
              {deposes > 1 ? `${deposes} documents déposés` : 'Document déposé'}
            </p>
          ) : (
            /* Empilés sur téléphone : côte à côte, les intitulés seraient tronqués. */
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void deposer()}
                disabled={etape === 'envoi'}
                className="flex items-center justify-center gap-2 rounded-md bg-brand-green px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {etape === 'envoi' && <Loader2 size={15} className="animate-spin" />}
                {etape === 'envoi'
                  ? 'Dépôt en cours…'
                  : recus.length > 1
                    ? `Déposer les ${recus.length} documents`
                    : 'Déposer ce document'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/documents')}
                disabled={etape === 'envoi'}
                className="rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-muted hover:bg-brand-mint disabled:opacity-60"
              >
                Annuler
              </button>
            </div>
          )}

          <p className="mt-3 text-[12.5px] leading-relaxed text-brand-muted">
            Le type de chaque document sera reconnu automatiquement après le dépôt.
          </p>
        </div>
      )}
    </div>
  )
}
