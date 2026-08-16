import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { applyQuad, type RelativeQuad, type ScanResult } from '../utils/documentScanner'

interface CornerAdjusterProps {
  /** Photo d'origine, telle qu'elle a été prise. */
  photo: File
  /** Aperçu de cette photo, déjà chargé par le parent. */
  photoUrl: string
  /** Cadre de départ, s'il en a été reconnu un. */
  initialQuad: RelativeQuad | null
  onApply: (result: ScanResult) => void
  onCancel: () => void
}

/** Cadre proposé à défaut : une marge confortable sur les quatre côtés. */
const DEFAUT: RelativeQuad = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
]

const LIBELLES = ['coin haut gauche', 'coin haut droit', 'coin bas droit', 'coin bas gauche']

/** Déplacement d'un coin à la flèche du clavier, en fraction de l'image. */
const PAS_CLAVIER = 0.01

/**
 * Réglage des quatre coins du document, à la main.
 *
 * La détection automatique échoue nécessairement dans certains cas — une
 * feuille blanche sur un plaid crème, par exemple, où l'écart entre le papier
 * et le tissu est plus faible que celui entre deux mèches voisines. Aucun
 * réglage de seuil ne franchit cette limite : c'est l'œil qui tranche.
 *
 * Le redressement, lui, est exactement le même que celui de la détection
 * automatique — seuls les coins changent d'origine.
 */
export default function CornerAdjuster({
  photo,
  photoUrl,
  initialQuad,
  onApply,
  onCancel,
}: CornerAdjusterProps) {
  const [quad, setQuad] = useState<RelativeQuad>(initialQuad ?? DEFAUT)
  const [actif, setActif] = useState<number | null>(null)
  const [traitement, setTraitement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const zoneRef = useRef<HTMLDivElement>(null)

  function positionRelative(event: ReactPointerEvent) {
    const zone = zoneRef.current?.getBoundingClientRect()
    if (!zone || zone.width === 0 || zone.height === 0) return null
    return {
      x: Math.min(1, Math.max(0, (event.clientX - zone.left) / zone.width)),
      y: Math.min(1, Math.max(0, (event.clientY - zone.top) / zone.height)),
    }
  }

  function deplacer(index: number, event: ReactPointerEvent) {
    const point = positionRelative(event)
    if (!point) return
    setQuad((precedent) => {
      const suivant = [...precedent] as RelativeQuad
      suivant[index] = point
      return suivant
    })
  }

  function auClavier(index: number, dx: number, dy: number) {
    setQuad((precedent) => {
      const suivant = [...precedent] as RelativeQuad
      suivant[index] = {
        x: Math.min(1, Math.max(0, precedent[index].x + dx)),
        y: Math.min(1, Math.max(0, precedent[index].y + dy)),
      }
      return suivant
    })
  }

  async function appliquer() {
    setTraitement(true)
    setErreur(null)
    try {
      onApply(await applyQuad(photo, quad))
    } catch {
      setErreur('Ce cadre est trop petit ou trop aplati pour être redressé.')
      setTraitement(false)
    }
  }

  const points = quad.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')

  return (
    <div className="mt-3">
      <p className="mb-2 text-xs text-brand-muted">
        Placez les quatre coins sur ceux du document, puis appliquez. Le reste — redressement,
        éclairage — est fait pour vous.
      </p>

      <div
        ref={zoneRef}
        className="relative mx-auto w-full max-w-sm touch-none overflow-hidden rounded-md border border-brand-border bg-white select-none"
      >
        <img
          src={photoUrl}
          alt="Photo d’origine"
          className="block w-full object-contain"
          draggable={false}
        />

        {/* La grille se superpose exactement à l'image : un repère en
            pourcentage suit le redimensionnement sans calcul. */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <polygon
            points={points}
            fill="rgba(47,143,111,0.18)"
            stroke="#2f8f6f"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {quad.map((point, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Déplacer le ${LIBELLES[index]}`}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              setActif(index)
              deplacer(index, event)
            }}
            onPointerMove={(event) => {
              if (actif === index) deplacer(index, event)
            }}
            onPointerUp={() => setActif(null)}
            onPointerCancel={() => setActif(null)}
            onKeyDown={(event) => {
              const pas: Record<string, [number, number]> = {
                ArrowLeft: [-PAS_CLAVIER, 0],
                ArrowRight: [PAS_CLAVIER, 0],
                ArrowUp: [0, -PAS_CLAVIER],
                ArrowDown: [0, PAS_CLAVIER],
              }
              const mouvement = pas[event.key]
              if (!mouvement) return
              event.preventDefault()
              auClavier(index, mouvement[0], mouvement[1])
            }}
            // Cible tactile large, marque visuelle petite : le doigt ne doit
            // pas masquer le coin qu'il place.
            className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus:outline-none"
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
          >
            <span
              className={`block rounded-full border-2 border-white bg-brand-green shadow-md transition-all ${
                actif === index ? 'h-6 w-6' : 'h-4 w-4'
              }`}
            />
          </button>
        ))}
      </div>

      {erreur && <p className="mt-2 text-xs text-brand-danger">{erreur}</p>}

      {/* Sur téléphone les deux boutons s'empilent : côte à côte, leurs
          intitulés seraient tronqués. */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={appliquer}
          disabled={traitement}
          className="brand-gradient flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {traitement ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Appliquer le cadrage
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={traitement}
          className="flex items-center justify-center gap-2 rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-muted hover:bg-brand-mint disabled:opacity-60"
        >
          <X size={15} />
          Annuler
        </button>
      </div>
    </div>
  )
}
