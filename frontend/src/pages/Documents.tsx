import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eye, Loader2, ScanSearch, Share2, Trash2 } from 'lucide-react'
import type {
  Document,
  DocumentCategory,
  DocumentType,
  DocumentAnalysis,
  PlanUsage,
  RenewalType,
  ShareLink,
} from '../types'
import { ApiError, documentsApi } from '../services/api'
import { formatDate } from '../utils/formatDate'
import { formatAmount } from '../utils/formatAmount'
import PlanUsageCard from '../components/PlanUsageCard'
import PastilleCategorie from '../components/PastilleCategorie'
import { CATEGORIES } from '../components/categories'
import DepotParEmail from '../components/DepotParEmail'
import DocumentScanner from '../components/DocumentScanner'
import SuggestedDeadline from '../components/SuggestedDeadline'
import { useEntree } from '../utils/useApparition'

interface DocumentsProps {
  documents: Document[]
  planUsage: PlanUsage | null
  onAdd: (data: {
    name: string
    type?: DocumentType
    category?: DocumentCategory
    file: File
  }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCreateDeadline: (data: { title: string; dueDate: string; documentId?: string }) => Promise<void>
  onCreateContract: (data: {
    provider: string
    startDate: string
    endDate: string
    amount: number
    renewalType: RenewalType
    documentId: string
  }) => Promise<void>
  onCreateShare: (data: {
    documentId: string
    expiresInHours: 24 | 168 | 720
  }) => Promise<ShareLink>
  /** Relit documents et échéances après acceptation d'une proposition. */
  onRefresh: () => Promise<void>
}

const shareDurationLabels: Record<24 | 168 | 720, string> = {
  24: '24 heures',
  168: '7 jours',
  720: '30 jours',
}

const typeLabels: Record<DocumentType, string> = {
  contrat: 'Contrat',
  facture: 'Facture',
  assurance: 'Assurance',
  garantie: 'Garantie',
  courrier: 'Courrier',
  autre: 'Autre',
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

/**
 * Nom donné à un document déposé en lot.
 *
 * On repart du nom du fichier, sans son extension : c'est ce que
 * l'utilisateur reconnaîtra, et lui demander de saisir vingt intitulés
 * annulerait tout l'intérêt du dépôt groupé. Les séparateurs techniques
 * deviennent des espaces, faute de quoi la liste afficherait des
 * « facture_edf_2026-08 » peu lisibles.
 */
function nomDepuisFichier(fichier: File): string {
  const sansExtension = fichier.name.replace(/\.[^.]+$/, '')
  const lisible = sansExtension.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return lisible.slice(0, 120) || fichier.name
}

/** Ce qu'un dépôt groupé a produit, une fois tous les fichiers traités. */
interface BilanDepot {
  reussis: number
  echecs: { nom: string; message: string }[]
}

/**
 * Ce que la lecture du document a reconnu : émetteur, montant, date portée
 * par le document. Chaîne vide quand rien n'a été trouvé — il n'y a alors
 * rien à afficher, et surtout pas une ligne de tirets.
 */
function resumeLu(doc: Document): string {
  return [
    doc.provider,
    doc.amount !== null ? formatAmount(doc.amount) : null,
    doc.documentDate ? `document du ${formatDate(doc.documentDate)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Pastille de règlement. Rien n'est affiché quand le document ne tranche
 * pas : « statut inconnu » n'apprendrait rien et encombrerait chaque ligne.
 */
function PastillePaiement({ paid }: { paid: boolean | null }) {
  if (paid === null) return null
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        paid
          ? 'bg-brand-green-soft text-brand-green-deep'
          : 'bg-amber-50 text-amber-800'
      }`}
    >
      {paid ? 'Réglée' : 'À régler'}
    </span>
  )
}

export default function Documents({
  documents,
  planUsage,
  onAdd,
  onDelete,
  onCreateDeadline,
  onCreateContract,
  onCreateShare,
  onRefresh,
}: DocumentsProps) {
  const listeDocs = useEntree<HTMLUListElement>()
  const quotaReached =
    planUsage !== null &&
    planUsage.documents.max !== null &&
    planUsage.documents.used >= planUsage.documents.max

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'tous'>('tous')
  // Le rangement par pan de vie, indépendant du filtre par nature : on
  // cherche « les papiers de la maison » plus souvent que « les contrats ».
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'toutes'>('toutes')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  // Chaîne vide : le serveur reconnaît le type à partir du contenu.
  const [type, setType] = useState<DocumentType | ''>('')
  // Idem : sans choix, la lecture du document range le document elle-même.
  const [category, setCategory] = useState<DocumentCategory | ''>('')
  // Plusieurs fichiers peuvent être choisis d'un coup : c'est le cas du
  // tiroir qu'on vide. Un seul fichier reste le cas courant, et garde son
  // formulaire nommé.
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [progression, setProgression] = useState<{ fait: number; total: number } | null>(null)
  const [bilan, setBilan] = useState<BilanDepot | null>(null)
  const [scanning, setScanning] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Le raccourci « Photographier un document » de l'application installée
  // arrive sur /documents?scan=1 : le formulaire doit être déjà ouvert.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('scan') === null) return
    if (!quotaReached) setShowForm(true)
    searchParams.delete('scan')
    setSearchParams(searchParams, { replace: true })
  }, [searchParams, setSearchParams, quotaReached])

  /*
   * Une case du tableau de bord mène ici avec sa catégorie : /documents?
   * categorie=maison. Le paramètre est consommé puis retiré de l'adresse,
   * pour qu'un retour en arrière ne rejoue pas indéfiniment le filtre.
   */
  useEffect(() => {
    const demandee = searchParams.get('categorie')
    if (demandee === null) return
    if (CATEGORIES.some((c) => c.cle === demandee)) {
      setCategoryFilter(demandee as DocumentCategory)
    }
    searchParams.delete('categorie')
    setSearchParams(searchParams, { replace: true })
  }, [searchParams, setSearchParams])

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [creatingSuggestion, setCreatingSuggestion] = useState<'deadline' | 'contract' | null>(
    null,
  )
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(null)

  const [shareExpandedId, setShareExpandedId] = useState<string | null>(null)
  const [shareDuration, setShareDuration] = useState<24 | 168 | 720>(168)
  const [creatingShare, setCreatingShare] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [createdShareUrl, setCreatedShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  /** Plusieurs fichiers choisis : le formulaire bascule en dépôt groupé. */
  const depotGroupe = files.length > 1

  const filtered = documents.filter((doc) => {
    const recherche = search.toLowerCase()
    const matchesSearch =
      doc.name.toLowerCase().includes(recherche) ||
      (doc.reference?.toLowerCase().includes(recherche) ?? false) ||
      (doc.provider?.toLowerCase().includes(recherche) ?? false)
    const matchesType = typeFilter === 'tous' || doc.type === typeFilter
    const matchesCategory =
      categoryFilter === 'toutes' || doc.category === categoryFilter
    return matchesSearch && matchesType && matchesCategory
  })

  /**
   * Trie la sélection en fichiers retenus et fichiers écartés.
   *
   * Un lot n'est pas rejeté en bloc parce qu'un seul fichier est trop lourd :
   * on garde les autres et on nomme précisément ceux qui manquent, sans quoi
   * l'utilisateur devrait recommencer sa sélection à l'aveugle.
   */
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selection = Array.from(e.target.files ?? [])
    setError(null)
    setBilan(null)
    if (selection.length === 0) {
      setFiles([])
      return
    }

    const retenus: File[] = []
    const ecartes: string[] = []
    for (const fichier of selection) {
      if (!ALLOWED_MIME_TYPES.includes(fichier.type)) {
        ecartes.push(`${fichier.name} (format non accepté)`)
      } else if (fichier.size > MAX_FILE_SIZE_BYTES) {
        ecartes.push(`${fichier.name} (${formatSize(fichier.size)}, maximum 10 Mo)`)
      } else {
        retenus.push(fichier)
      }
    }

    if (ecartes.length > 0) {
      setError(
        ecartes.length === selection.length
          ? `Aucun fichier retenu : ${ecartes.join(', ')}.`
          : `${ecartes.length} fichier(s) écarté(s) : ${ecartes.join(', ')}. Les autres restent sélectionnés.`,
      )
    }
    setFiles(retenus)
    if (retenus.length === 0) e.target.value = ''
  }

  /**
   * Le scanner produit un JPEG déjà conforme (type et taille). Le nom est
   * prérempli pour que la photo puisse être enregistrée sans autre saisie.
   */
  function handleScanned(scanned: File) {
    setError(null)
    setBilan(null)
    setFiles([scanned])
    if (fileInputRef.current) fileInputRef.current.value = ''
    setName((current) =>
      current.trim() ? current : `Document photographié du ${formatDate(new Date().toISOString())}`,
    )
  }

  function reinitialiserFormulaire() {
    setName('')
    setType('')
    setCategory('')
    setFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  /**
   * Dépose les fichiers un par un.
   *
   * Séquentiel à dessein : le serveur tourne sur une instance modeste et
   * lance une reconnaissance par document. Vingt envois simultanés la
   * saturerait, et l'utilisateur n'y gagnerait que quelques secondes.
   *
   * Un échec n'interrompt pas le lot — le fichier fautif est nommé dans le
   * bilan, les suivants sont quand même déposés.
   */
  async function deposerLot(lot: File[]) {
    const echecs: BilanDepot['echecs'] = []
    let reussis = 0

    for (const [index, fichier] of lot.entries()) {
      setProgression({ fait: index, total: lot.length })
      try {
        // Aucun type transmis : le serveur le déduit du contenu, ce qui est
        // tout l'intérêt du dépôt groupé.
        await onAdd({ name: nomDepuisFichier(fichier), file: fichier })
        reussis += 1
      } catch (err) {
        echecs.push({
          nom: fichier.name,
          message: err instanceof ApiError ? err.message : 'envoi impossible',
        })
      }
    }

    setProgression(null)
    setBilan({ reussis, echecs })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (files.length === 0) {
      setError('Photographiez le document ou choisissez un ou plusieurs fichiers.')
      return
    }

    // Le quota est vérifié avant le premier envoi : prévenir après le
    // dixième document reviendrait à laisser un lot à moitié déposé.
    const restants = planUsage?.documents.remaining ?? null
    if (restants !== null && files.length > restants) {
      setError(
        `Il vous reste ${restants} document${restants > 1 ? 's' : ''} sur votre offre ${planUsage?.label ?? 'actuelle'}, ` +
          `et vous en avez sélectionné ${files.length}. Retirez-en de la sélection, ou passez à une offre supérieure pour un dépôt sans limite.`,
      )
      return
    }

    setError(null)
    setBilan(null)
    setSubmitting(true)
    try {
      if (files.length === 1) {
        if (!name.trim()) {
          setError('Donnez un nom au document.')
          return
        }
        await onAdd({
          name: name.trim(),
          ...(type ? { type } : {}),
          ...(category ? { category } : {}),
          file: files[0],
        })
        reinitialiserFormulaire()
        setShowForm(false)
      } else {
        await deposerLot(files)
        reinitialiserFormulaire()
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'ajouter le document")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      await onDelete(id)
      if (expandedId === id) setExpandedId(null)
      if (shareExpandedId === id) setShareExpandedId(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de supprimer le document')
    }
  }

  async function handleView(doc: Document) {
    setError(null)
    setOpeningId(doc.id)
    try {
      const blob = await documentsApi.getFileBlob(doc.id)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'ouvrir le document")
    } finally {
      setOpeningId(null)
    }
  }

  async function handleAnalyze(doc: Document) {
    if (expandedId === doc.id) {
      setExpandedId(null)
      return
    }
    setShareExpandedId(null)
    setExpandedId(doc.id)
    setAnalysis(null)
    setAnalysisError(null)
    setSuggestionMessage(null)
    setAnalyzing(true)
    try {
      const result = await documentsApi.analyze(doc.id)
      setAnalysis(result)
    } catch (err) {
      setAnalysisError(err instanceof ApiError ? err.message : "Impossible d'analyser ce document")
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleCreateDeadlineFromSuggestion(doc: Document) {
    if (!analysis || analysis.suggestedDates.length === 0) return
    setCreatingSuggestion('deadline')
    setSuggestionMessage(null)
    try {
      await onCreateDeadline({
        title: `Échéance : ${doc.name}`,
        dueDate: analysis.suggestedDates[0],
        documentId: doc.id,
      })
      setSuggestionMessage('Échéance créée à partir de la suggestion.')
    } catch (err) {
      setAnalysisError(err instanceof ApiError ? err.message : "Impossible de créer l'échéance")
    } finally {
      setCreatingSuggestion(null)
    }
  }

  async function handleCreateContractFromSuggestion(doc: Document) {
    if (!analysis || !analysis.suggestedProvider || analysis.suggestedDates.length === 0 || analysis.suggestedAmount === null) return
    setCreatingSuggestion('contract')
    setSuggestionMessage(null)
    try {
      await onCreateContract({
        provider: analysis.suggestedProvider,
        startDate: analysis.suggestedDates[0],
        endDate: analysis.suggestedDates[1] ?? analysis.suggestedDates[0],
        amount: analysis.suggestedAmount,
        renewalType: 'aucun',
        documentId: doc.id,
      })
      setSuggestionMessage('Contrat créé à partir de la suggestion.')
    } catch (err) {
      setAnalysisError(err instanceof ApiError ? err.message : 'Impossible de créer le contrat')
    } finally {
      setCreatingSuggestion(null)
    }
  }

  function handleToggleShare(doc: Document) {
    if (shareExpandedId === doc.id) {
      setShareExpandedId(null)
      return
    }
    setExpandedId(null)
    setShareExpandedId(doc.id)
    setShareError(null)
    setCreatedShareUrl(null)
    setCopied(false)
    setShareDuration(168)
  }

  async function handleCreateShare(doc: Document) {
    setCreatingShare(true)
    setShareError(null)
    try {
      const share = await onCreateShare({ documentId: doc.id, expiresInHours: shareDuration })
      setCreatedShareUrl(`${window.location.origin}/partage/${share.token}`)
    } catch (err) {
      setShareError(err instanceof ApiError ? err.message : 'Impossible de créer le lien')
    } finally {
      setCreatingShare(false)
    }
  }

  async function handleCopyShareUrl() {
    if (!createdShareUrl) return
    try {
      await navigator.clipboard.writeText(createdShareUrl)
      setCopied(true)
    } catch {
      setShareError('Impossible de copier le lien automatiquement, copie-le manuellement.')
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-[28px] font-semibold text-brand-deep">Documents</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          disabled={!showForm && quotaReached}
          title={
            quotaReached ? 'Limite de documents atteinte sur votre plan actuel' : undefined
          }
          className="brand-gradient rounded-md px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {showForm ? 'Annuler' : '+ Ajouter un document'}
        </button>
      </div>

      {planUsage && (
        <div className="mb-6">
          <PlanUsageCard usage={planUsage} />
        </div>
      )}

      {/* Une autre façon d'ajouter un document : sa place est près du bouton
          qui en ajoute un, pas dans un écran de réglages où personne ne la
          trouverait. */}
      <div className="mb-6">
        <DepotParEmail />
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Bilan d'un dépôt groupé. Les échecs sont nommés un par un : savoir
          que « 3 documents n'ont pas été déposés » sans savoir lesquels
          obligerait à comparer la liste à la main. */}
      {bilan && (
        <div className="mb-4 rounded-md border border-brand-border bg-white px-3 py-2.5">
          <p className="text-sm font-medium text-brand-deep">
            {bilan.reussis > 0
              ? `${bilan.reussis} document${bilan.reussis > 1 ? 's' : ''} déposé${bilan.reussis > 1 ? 's' : ''}.`
              : 'Aucun document déposé.'}{' '}
            {bilan.reussis > 0 && (
              <span className="font-normal text-brand-muted">
                Leur classement se précise à mesure que chacun est lu.
              </span>
            )}
          </p>
          {bilan.echecs.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {bilan.echecs.map((echec) => (
                <li key={echec.nom} className="text-xs text-brand-danger">
                  <span className="font-medium">{echec.nom}</span> — {echec.message}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setBilan(null)}
            className="mt-2 text-xs font-medium text-brand-green underline-offset-2 hover:underline"
          >
            Fermer
          </button>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 space-y-3 rounded-lg border border-brand-border bg-white p-4"
        >
          {/* Nommer et typer n'a de sens que pour un document isolé. Sur un
              lot, ces deux champs disparaissent : le nom vient du fichier et
              le type de la lecture. */}
          {depotGroupe ? (
            <div className="rounded-md border border-brand-green/30 bg-brand-green-soft/50 px-3 py-2.5">
              <p className="text-sm font-medium text-brand-deep">
                {files.length} documents seront classés automatiquement
              </p>
              <p className="mt-0.5 text-xs text-brand-muted">
                Chacun est lu après son dépôt, puis rangé en facture, contrat, assurance, garantie
                ou courrier. Le nom reprend celui du fichier. Vous pourrez corriger un classement
                depuis la liste.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="doc-name" className="mb-1 block text-sm font-medium text-brand-deep">
                  Nom du document
                </label>
                <input
                  id="doc-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
                  placeholder="Ex : Facture électricité août"
                />
              </div>
              <div>
                <label htmlFor="doc-type" className="mb-1 block text-sm font-medium text-brand-deep">
                  Type
                </label>
                <select
                  id="doc-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as DocumentType | '')}
                  className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
                >
                  <option value="">Détecter automatiquement</option>
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {type === '' && (
                  <p className="mt-1 text-xs text-brand-muted">
                    Le type est déduit du texte du document (« facture », « assuré », « garantie »…),
                    juste après le dépôt.
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="doc-categorie"
                  className="mb-1 block text-sm font-medium text-brand-deep"
                >
                  Catégorie
                </label>
                <select
                  id="doc-categorie"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DocumentCategory | '')}
                  className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
                >
                  <option value="">Ranger automatiquement</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.cle} value={c.cle}>
                      {c.libelle} — {c.exemples}
                    </option>
                  ))}
                </select>
                {category === '' && (
                  <p className="mt-1 text-xs text-brand-muted">
                    Maison, personnel ou famille : reconnu au même moment que le type. Le
                    document reste sans catégorie si rien ne permet de trancher.
                  </p>
                )}
              </div>
            </>
          )}
          <DocumentScanner onScanned={handleScanned} onProcessingChange={setScanning} />

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-brand-border" />
            <span className="text-xs font-medium text-brand-muted">ou</span>
            <span className="h-px flex-1 bg-brand-border" />
          </div>

          <div>
            <label htmlFor="doc-file" className="mb-1 block text-sm font-medium text-brand-deep">
              Choisir des fichiers (PDF, JPG, PNG ou WEBP, 10 Mo chacun)
            </label>
            <input
              id="doc-file"
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_MIME_TYPES.join(',')}
              onChange={handleFileChange}
              className="w-full text-sm text-brand-ink file:mr-3 file:rounded-md file:border-0 file:bg-brand-mint file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-deep hover:file:bg-brand-border"
            />
            <p className="mt-1 text-xs text-brand-muted">
              Vous pouvez en sélectionner plusieurs d'un coup : ils seront classés pour vous.
            </p>
          </div>

          {files.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-brand-border bg-brand-mint/50 px-3 py-2">
              {files.map((fichier, index) => (
                // Le nom et la taille se disputent la largeur d'un téléphone :
                // le nom se tronque, la taille garde la sienne.
                <li
                  key={`${fichier.name}-${index}`}
                  className="flex items-center justify-between gap-2 text-xs text-brand-muted"
                >
                  <span className="min-w-0 truncate">{fichier.name}</span>
                  <span className="shrink-0">{formatSize(fichier.size)}</span>
                </li>
              ))}
            </ul>
          )}

          {progression && (
            <div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-border">
                <div
                  className="h-full bg-brand-green transition-all duration-300"
                  style={{ width: `${Math.round((progression.fait / progression.total) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-brand-muted">
                Dépôt en cours : {progression.fait} sur {progression.total}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || scanning || files.length === 0}
            className="brand-gradient rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting
              ? 'Envoi...'
              : depotGroupe
                ? `Déposer et classer les ${files.length} documents`
                : 'Enregistrer'}
          </button>
        </form>
      )}

      {/* Empilés sur téléphone : côte à côte, le champ de recherche se
          réduirait à quelques caractères. */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:gap-3">
        {/* La liste est filtrée à chaque frappe : il n'y a rien à valider.
            type="search" fait afficher au clavier mobile une touche « rechercher »
            qui referme le clavier, et une croix pour effacer le champ. */}
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
          placeholder="Nom, émetteur ou référence..."
          aria-label="Rechercher un document"
          className="flex-1 rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as DocumentType | 'tous')}
          className="rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
        >
          <option value="tous">Tous les types</option>
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/*
       * Les trois pans de vie, montrés plutôt que rangés dans un menu.
       *
       * C'est le rangement que la page d'accueil promet ; caché derrière une
       * liste déroulante, il resterait invisible à qui ne l'ouvre pas. Le
       * compte affiché à côté de chaque case dit d'un coup d'œil ce qu'elle
       * contient — et une case vide se voit, ce qui invite à y ranger.
       */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryFilter('toutes')}
          aria-pressed={categoryFilter === 'toutes'}
          className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium ${
            categoryFilter === 'toutes'
              ? 'border-brand-deep bg-brand-deep text-white'
              : 'border-brand-border bg-white text-brand-muted hover:bg-brand-mint'
          }`}
        >
          Tout ({documents.length})
        </button>
        {CATEGORIES.map(({ cle, libelle, icone: Icone, teinte }) => {
          const nombre = documents.filter((d) => d.category === cle).length
          const actif = categoryFilter === cle
          return (
            <button
              key={cle}
              type="button"
              onClick={() => setCategoryFilter(actif ? 'toutes' : cle)}
              aria-pressed={actif}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium"
              style={
                actif
                  ? { borderColor: teinte, background: teinte, color: '#fff' }
                  : { borderColor: `${teinte}55`, background: `${teinte}12`, color: teinte }
              }
            >
              <Icone size={13} strokeWidth={2.4} />
              {libelle} ({nombre})
            </button>
          )
        })}
      </div>

      <div className="rounded-lg border border-brand-border bg-white">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-brand-muted">Aucun document trouvé.</p>
        ) : (
          <ul
            ref={listeDocs.ref}
            className={`mvt-liste divide-y divide-brand-border ${listeDocs.classe}`}
          >
            {filtered.map((doc, rang) => (
              <li
                key={doc.id}
                className="mvt-ligne px-4 py-3 hover:bg-brand-mint/40"
                style={{ '--rang': rang } as CSSProperties}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-ink">{doc.name}</p>
                    <p className="text-xs text-brand-muted">
                      {typeLabels[doc.type]} · {formatSize(doc.sizeBytes)} · Ajouté le{' '}
                      {formatDate(doc.createdAt)}
                    </p>
                    {/* Ce que la lecture a reconnu dans le document. Ligne
                        distincte et tronquée : un nom de fournisseur long ne
                        doit pas repousser le reste hors de l'écran. */}
                    {(resumeLu(doc) || doc.paid !== null || doc.category) && (
                      /* flex-wrap : sur téléphone, résumé et pastilles ne
                         tiennent pas sur une seule ligne. */
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        {resumeLu(doc) && (
                          <p className="truncate text-xs text-brand-green">{resumeLu(doc)}</p>
                        )}
                        <PastilleCategorie category={doc.category} />
                        <PastillePaiement paid={doc.paid} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:shrink-0">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        doc.status === 'traite'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {doc.status === 'traite' ? 'Analysé' : 'Analyse en cours...'}
                    </span>
                    <button
                      onClick={() => handleAnalyze(doc)}
                      className="flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-green"
                    >
                      <ScanSearch size={14.5} />
                      {expandedId === doc.id ? 'Fermer' : 'Analyser'}
                    </button>
                    <button
                      onClick={() => handleToggleShare(doc)}
                      className="flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-green"
                    >
                      <Share2 size={14.5} />
                      {shareExpandedId === doc.id ? 'Fermer' : 'Partager'}
                    </button>
                    <button
                      onClick={() => handleView(doc)}
                      disabled={openingId === doc.id}
                      className="flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-green disabled:opacity-60"
                    >
                      {openingId === doc.id ? <Loader2 size={14.5} className="animate-spin" /> : <Eye size={14.5} />}
                      {openingId === doc.id ? 'Ouverture...' : 'Voir'}
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-danger"
                    >
                      <Trash2 size={14.5} />
                      Supprimer
                    </button>
                  </div>
                </div>

                <SuggestedDeadline document={doc} onSettled={onRefresh} />

                {expandedId === doc.id && (
                  <div className="mt-3 rounded-lg border border-brand-border bg-brand-mint/40 p-4">
                    {analyzing && (
                      <p className="text-sm text-brand-muted">
                        Analyse en cours (OCR + extraction)... ça peut prendre jusqu'à une minute
                        la première fois.
                      </p>
                    )}
                    {analysisError && (
                      <p className="text-sm text-brand-danger">{analysisError}</p>
                    )}
                    {analysis && (
                      <div className="space-y-3">
                        {analysis.warning && (
                          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            {analysis.warning}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                          <div>
                            <p className="text-xs font-medium text-brand-muted">Type suggéré</p>
                            <p className="text-brand-ink">
                              {analysis.suggestedType ? typeLabels[analysis.suggestedType] : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-brand-muted">Organisme</p>
                            <p className="text-brand-ink">{analysis.suggestedProvider ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-brand-muted">Date du document</p>
                            <p className="text-brand-ink">
                              {analysis.suggestedDocumentDate
                                ? formatDate(analysis.suggestedDocumentDate)
                                : '—'}
                            </p>
                          </div>
                          {/* La liste brute des dates n'apprenait rien : elle
                              répétait le plus souvent la date du document. La
                              référence, elle, est ce qu'un service client
                              réclame au téléphone. */}
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-brand-muted">
                              {analysis.suggestedReferenceLabel ?? 'Référence'}
                            </p>
                            <p className="truncate text-brand-ink" title={analysis.suggestedReference ?? undefined}>
                              {analysis.suggestedReference ?? '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-brand-muted">Montant</p>
                            <p className="text-brand-ink">
                              {analysis.suggestedAmount !== null
                                ? formatAmount(analysis.suggestedAmount)
                                : '—'}
                            </p>
                          </div>
                        </div>

                        {analysis.rawTextPreview && (
                          <details className="text-xs text-brand-muted">
                            <summary className="cursor-pointer select-none">
                              Voir le texte extrait
                            </summary>
                            <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md bg-white p-2 font-mono text-[11px] text-brand-ink">
                              {analysis.rawTextPreview}
                            </pre>
                          </details>
                        )}

                        <p className="text-xs text-brand-muted">
                          L'émetteur, le montant, la date et le texte lu sont conservés pour la
                          recherche. Aucune échéance ni aucun contrat n'est créé sans toi :
                          vérifie ces valeurs avant de les reprendre.
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleCreateDeadlineFromSuggestion(doc)}
                            disabled={
                              analysis.suggestedDates.length === 0 ||
                              creatingSuggestion === 'deadline'
                            }
                            className="rounded-md border border-brand-border bg-white px-3 py-1.5 text-xs font-medium text-brand-deep hover:bg-brand-mint disabled:opacity-50"
                          >
                            {creatingSuggestion === 'deadline'
                              ? 'Création...'
                              : 'Créer une échéance avec cette date'}
                          </button>
                          <button
                            onClick={() => handleCreateContractFromSuggestion(doc)}
                            disabled={
                              !analysis.suggestedProvider ||
                              analysis.suggestedDates.length === 0 ||
                              analysis.suggestedAmount === null ||
                              creatingSuggestion === 'contract'
                            }
                            className="rounded-md border border-brand-border bg-white px-3 py-1.5 text-xs font-medium text-brand-deep hover:bg-brand-mint disabled:opacity-50"
                          >
                            {creatingSuggestion === 'contract'
                              ? 'Création...'
                              : 'Créer un contrat avec ces informations'}
                          </button>
                        </div>

                        {suggestionMessage && (
                          <p className="text-xs font-medium text-brand-green">
                            {suggestionMessage}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {shareExpandedId === doc.id && (
                  <div className="mt-3 rounded-lg border border-brand-border bg-brand-mint/40 p-4">
                    {shareError && (
                      <p className="mb-2 text-sm text-brand-danger">{shareError}</p>
                    )}
                    {!createdShareUrl ? (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-brand-deep">
                            Durée de validité du lien
                          </label>
                          <div className="flex gap-2">
                            {([24, 168, 720] as const).map((hours) => (
                              <button
                                key={hours}
                                onClick={() => setShareDuration(hours)}
                                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                                  shareDuration === hours
                                    ? 'brand-gradient text-white'
                                    : 'border border-brand-border bg-white text-brand-deep hover:bg-brand-mint'
                                }`}
                              >
                                {shareDurationLabels[hours]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => handleCreateShare(doc)}
                          disabled={creatingShare}
                          className="brand-gradient rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {creatingShare ? 'Création...' : 'Créer le lien de partage'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-brand-muted">
                          Lien valide {shareDurationLabels[shareDuration]}, révocable à tout
                          moment depuis la page Partages.
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            readOnly
                            value={createdShareUrl}
                            onFocus={(e) => e.target.select()}
                            className="flex-1 rounded-md border border-brand-border bg-white px-3 py-2 text-xs text-brand-ink"
                          />
                          <button
                            onClick={handleCopyShareUrl}
                            className="rounded-md border border-brand-border bg-white px-3 py-2 text-xs font-medium text-brand-deep hover:bg-brand-mint"
                          >
                            {copied ? 'Copié !' : 'Copier'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
