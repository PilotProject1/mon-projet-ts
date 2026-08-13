import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type {
  Document,
  DocumentType,
  DocumentAnalysis,
  PlanUsage,
  RenewalType,
  ShareLink,
} from '../types'
import { ApiError, documentsApi } from '../services/api'
import { formatDate } from '../utils/formatDate'
import PlanUsageCard from '../components/PlanUsageCard'

interface DocumentsProps {
  documents: Document[]
  planUsage: PlanUsage | null
  onAdd: (data: { name: string; type: DocumentType; file: File }) => Promise<void>
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

export default function Documents({
  documents,
  planUsage,
  onAdd,
  onDelete,
  onCreateDeadline,
  onCreateContract,
  onCreateShare,
}: DocumentsProps) {
  const quotaReached =
    planUsage !== null &&
    planUsage.documents.max !== null &&
    planUsage.documents.used >= planUsage.documents.max

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'tous'>('tous')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<DocumentType>('autre')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const filtered = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'tous' || doc.type === typeFilter
    return matchesSearch && matchesType
  })

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setError(null)
    if (selected && !ALLOWED_MIME_TYPES.includes(selected.type)) {
      setError('Type de fichier non autorisé (PDF, JPG, PNG ou WEBP uniquement)')
      setFile(null)
      e.target.value = ''
      return
    }
    if (selected && selected.size > MAX_FILE_SIZE_BYTES) {
      setError('Fichier trop volumineux (10 Mo maximum)')
      setFile(null)
      e.target.value = ''
      return
    }
    setFile(selected)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !file) return
    setError(null)
    setSubmitting(true)
    try {
      await onAdd({ name: name.trim(), type, file })
      setName('')
      setType('autre')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setShowForm(false)
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
        <h1 className="text-[28px] font-bold text-brand-deep">Documents</h1>
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

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 space-y-3 rounded-lg border border-brand-border bg-white p-4"
        >
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
              onChange={(e) => setType(e.target.value as DocumentType)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="doc-file" className="mb-1 block text-sm font-medium text-brand-deep">
              Fichier (PDF, JPG, PNG ou WEBP, 10 Mo max)
            </label>
            <input
              id="doc-file"
              ref={fileInputRef}
              type="file"
              required
              accept={ALLOWED_MIME_TYPES.join(',')}
              onChange={handleFileChange}
              className="w-full text-sm text-brand-ink file:mr-3 file:rounded-md file:border-0 file:bg-brand-mint file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-deep hover:file:bg-brand-border"
            />
            {file && (
              <p className="mt-1 text-xs text-brand-muted">
                {file.name} · {formatSize(file.size)}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting || !file}
            className="brand-gradient rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? 'Envoi...' : 'Enregistrer'}
          </button>
        </form>
      )}

      <div className="mb-4 flex gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un document..."
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

      <div className="rounded-lg border border-brand-border bg-white">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-brand-muted">Aucun document trouvé.</p>
        ) : (
          <ul className="divide-y divide-brand-border">
            {filtered.map((doc) => (
              <li key={doc.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-brand-ink">{doc.name}</p>
                    <p className="text-xs text-brand-muted">
                      {typeLabels[doc.type]} · {formatSize(doc.sizeBytes)} · Ajouté le{' '}
                      {formatDate(doc.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        doc.status === 'traite'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {doc.status === 'traite' ? 'Traité' : 'En attente'}
                    </span>
                    <button
                      onClick={() => handleAnalyze(doc)}
                      className="text-sm text-brand-muted hover:text-brand-green"
                    >
                      {expandedId === doc.id ? 'Fermer' : 'Analyser'}
                    </button>
                    <button
                      onClick={() => handleToggleShare(doc)}
                      className="text-sm text-brand-muted hover:text-brand-green"
                    >
                      {shareExpandedId === doc.id ? 'Fermer' : 'Partager'}
                    </button>
                    <button
                      onClick={() => handleView(doc)}
                      disabled={openingId === doc.id}
                      className="text-sm text-brand-muted hover:text-brand-green disabled:opacity-60"
                    >
                      {openingId === doc.id ? 'Ouverture...' : 'Voir'}
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-sm text-brand-muted hover:text-brand-danger"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

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
                            <p className="text-xs font-medium text-brand-muted">Dates trouvées</p>
                            <p className="text-brand-ink">
                              {analysis.suggestedDates.length > 0
                                ? analysis.suggestedDates.join(', ')
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-brand-muted">Montant</p>
                            <p className="text-brand-ink">
                              {analysis.suggestedAmount !== null
                                ? `${analysis.suggestedAmount.toFixed(2)} €`
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
                          Ces suggestions ne sont pas enregistrées automatiquement — vérifie-les
                          avant de créer une échéance ou un contrat.
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
