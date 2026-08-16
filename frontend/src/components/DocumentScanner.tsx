import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Camera, Crop, Loader2, RefreshCw, ScanLine } from 'lucide-react'
import { scanDocument, type ScanResult } from '../utils/documentScanner'
import CornerAdjuster from './CornerAdjuster'

interface DocumentScannerProps {
  /** Appelé dès que l'image nettoyée est prête : rien à valider. */
  onScanned: (file: File) => void
  /** Prévient le parent qu'une numérisation est en cours. */
  onProcessingChange?: (processing: boolean) => void
  disabled?: boolean
}

export default function DocumentScanner({
  onScanned,
  onProcessingChange,
  disabled = false,
}: DocumentScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  // Photo d'origine conservée : le réglage manuel repart d'elle, jamais de
  // l'image déjà recadrée, qu'on ne pourrait plus élargir.
  const [photo, setPhoto] = useState<File | null>(null)
  const [reglage, setReglage] = useState(false)

  // Les URL d'aperçu retiennent l'image en mémoire tant qu'elles existent.
  useEffect(() => {
    return () => {
      if (result) {
        URL.revokeObjectURL(result.previewUrl)
        URL.revokeObjectURL(result.originalUrl)
      }
    }
  }, [result])

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const photo = event.target.files?.[0]
    // Le champ est réinitialisé tout de suite : reprendre deux fois la même
    // photo doit relancer le traitement.
    event.target.value = ''
    if (!photo) return

    setError(null)
    setShowOriginal(false)
    setReglage(false)
    setPhoto(photo)
    setProcessing(true)
    onProcessingChange?.(true)
    try {
      const scanned = await scanDocument(photo)
      setResult((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous.previewUrl)
          URL.revokeObjectURL(previous.originalUrl)
        }
        return scanned
      })
      onScanned(scanned.file)
    } catch {
      setError("Cette image n'a pas pu être traitée. Reprenez la photo, ou déposez le fichier.")
    } finally {
      setProcessing(false)
      onProcessingChange?.(false)
    }
  }

  return (
    <div className="rounded-lg border border-brand-border bg-brand-mint/50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-brand-deep">
            <ScanLine size={16} className="shrink-0 text-brand-green" />
            Photographier le document
          </p>
          <p className="mt-0.5 text-xs text-brand-muted">
            Les bords sont détectés, l'image redressée et l'éclairage corrigé. Le cadrage reste
            ajustable à la main.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || processing}
          className="brand-gradient flex shrink-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {processing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Traitement...
            </>
          ) : (
            <>
              {result ? <RefreshCw size={16} /> : <Camera size={16} />}
              {result ? 'Reprendre la photo' : 'Ouvrir l’appareil photo'}
            </>
          )}
        </button>
      </div>

      {/* capture indique au téléphone d'ouvrir directement la caméra arrière ;
          sur ordinateur, l'attribut est ignoré et le sélecteur de fichiers
          s'ouvre normalement. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {error && <p className="mt-2 text-xs text-brand-danger">{error}</p>}

      {result && !processing && (
        <div className="mt-3 space-y-2">
          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-md border border-brand-border bg-white">
            <img
              src={showOriginal ? result.originalUrl : result.previewUrl}
              alt={showOriginal ? 'Photo d’origine' : 'Document numérisé'}
              className="mx-auto max-h-72 w-full object-contain"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-xs text-brand-muted">
              {result.cropped
                ? `Bords détectés, document redressé (${result.width} × ${result.height} px).`
                : 'Bords non reconnus : image nettoyée, mais pas recadrée.'}
            </p>
            <button
              type="button"
              onClick={() => setShowOriginal((v) => !v)}
              className="shrink-0 text-left text-xs font-medium text-brand-green underline-offset-2 hover:underline sm:text-right"
            >
              {showOriginal ? 'Voir le résultat' : 'Voir la photo d’origine'}
            </button>
          </div>

          {/* Toujours proposé, pas seulement en cas d'échec : la détection peut
              aussi se tromper de quelques millimètres, et c'est l'œil qui
              tranche. Mis en avant lorsqu'elle a renoncé. */}
          {!reglage && photo && (
            <button
              type="button"
              onClick={() => setReglage(true)}
              className={`flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                result.cropped
                  ? 'border border-brand-border bg-white text-brand-deep hover:bg-brand-mint'
                  : 'brand-gradient text-white'
              }`}
            >
              <Crop size={15} />
              {result.cropped ? 'Ajuster les bords' : 'Cadrer le document moi-même'}
            </button>
          )}

          {reglage && photo && (
            <CornerAdjuster
              photo={photo}
              photoUrl={result.originalUrl}
              initialQuad={result.quad}
              onApply={(ajuste) => {
                // Le nouveau résultat crée ses propres URL d'aperçu : celles
                // du précédent retiendraient l'image en mémoire pour rien.
                URL.revokeObjectURL(result.previewUrl)
                URL.revokeObjectURL(result.originalUrl)
                setResult(ajuste)
                onScanned(ajuste.file)
                setReglage(false)
                setShowOriginal(false)
              }}
              onCancel={() => setReglage(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}
