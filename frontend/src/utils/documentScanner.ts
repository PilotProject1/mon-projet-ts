/*
 * Numérisation automatique d'un document photographié.
 *
 * Tout se passe dans le navigateur, sans dépendance ni envoi préalable au
 * serveur : la photo brute ne quitte jamais l'appareil, seule l'image
 * nettoyée est déposée.
 *
 * Le traitement se fait en quatre temps :
 *   1. détection du fond par propagation depuis les bords de la photo, ce qui
 *      isole la feuille quel que soit le support (table claire ou sombre) ;
 *   2. recherche du quadrilatère de plus grande aire sur l'enveloppe convexe
 *      de la feuille, puis validation de sa forme ;
 *   3. redressement par transformation perspective (la feuille photographiée
 *      de biais redevient un rectangle) ;
 *   4. correction de l'éclairage — division par le fond basse fréquence, ce
 *      qui efface ombres et dominantes de couleur — puis étalement des
 *      niveaux pour un blanc franc et un texte contrasté.
 *
 * Aucune de ces étapes ne demande d'intervention : si la feuille n'est pas
 * reconnue de façon fiable, l'image est nettoyée mais pas recadrée, ce qui
 * reste toujours meilleur que la photo d'origine.
 */

export interface ScanResult {
  /** Image finale, prête à être déposée. */
  file: File
  /** URL d'aperçu ; à révoquer par l'appelant. */
  previewUrl: string
  /** URL d'aperçu de la photo d'origine, pour l'avant/après. */
  originalUrl: string
  /** true si les bords ont été reconnus et l'image redressée. */
  cropped: boolean
  width: number
  height: number
}

/** Côté long de l'image utilisée pour la détection des bords. */
const ANALYSIS_SIZE = 480
/** Côté long de l'image produite : lisible à l'écran comme à l'impression. */
const OUTPUT_SIZE = 2000
/** Le serveur refuse au-delà de 10 Mo ; on garde une marge. */
const MAX_OUTPUT_BYTES = 9 * 1024 * 1024
/** Rupture de luminosité à partir de laquelle un pixel est tenu pour un bord. */
const EDGE_THRESHOLD = 14

interface Point {
  x: number
  y: number
}

type Quad = [Point, Point, Point, Point]

/* ------------------------------------------------------------------ */
/* Chargement                                                          */
/* ------------------------------------------------------------------ */

/**
 * Décode la photo en respectant son orientation EXIF : un téléphone tenu à la
 * verticale enregistre souvent l'image couchée avec une balise de rotation.
 */
async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* navigateur sans l'option : on retombe sur <img>, qui applique l'EXIF */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Image illisible'))
      img.src = url
    })
  } finally {
    // L'image est décodée : l'URL n'a plus d'utilité.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

function drawTo(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas indisponible')
  ctx.drawImage(source, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height)
}

function fitWithin(width: number, height: number, longSide: number) {
  const scale = Math.min(1, longSide / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/* ------------------------------------------------------------------ */
/* Détection de la feuille                                             */
/* ------------------------------------------------------------------ */

/** Distance quadratique entre deux pixels RVB du même tampon. */
function colorDistance2(data: Uint8ClampedArray, a: number, b: number): number {
  const dr = data[a] - data[b]
  const dg = data[a + 1] - data[b + 1]
  const db = data[a + 2] - data[b + 2]
  return dr * dr + dg * dg + db * db
}

function distanceToColor2(
  data: Uint8ClampedArray,
  index: number,
  color: [number, number, number],
): number {
  const dr = data[index] - color[0]
  const dg = data[index + 1] - color[1]
  const db = data[index + 2] - color[2]
  return dr * dr + dg * dg + db * db
}

/**
 * Marque le fond de la photo : on part de tous les pixels du bord et on
 * progresse tant que la couleur varie peu, à la fois d'un pixel au suivant et
 * par rapport à la teinte médiane du pourtour. Le double critère évite de
 * traverser un dégradé d'ombre pour se répandre dans la feuille.
 */
function backgroundMask(image: ImageData): Uint8Array {
  const { width: w, height: h, data } = image
  const mask = new Uint8Array(w * h)
  const stack: number[] = []

  // Teinte de référence : médiane du pourtour, insensible à quelques pixels
  // aberrants (un coin de la feuille qui touche le bord, par exemple).
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  const pushBorder = (x: number, y: number) => {
    const i = (y * w + x) * 4
    rs.push(data[i])
    gs.push(data[i + 1])
    bs.push(data[i + 2])
    const p = y * w + x
    if (!mask[p]) {
      mask[p] = 1
      stack.push(p)
    }
  }
  for (let x = 0; x < w; x++) {
    pushBorder(x, 0)
    pushBorder(x, h - 1)
  }
  for (let y = 1; y < h - 1; y++) {
    pushBorder(0, y)
    pushBorder(w - 1, y)
  }

  const median = (values: number[]) => {
    values.sort((a, b) => a - b)
    return values[Math.floor(values.length / 2)]
  }
  const reference: [number, number, number] = [median(rs), median(gs), median(bs)]

  // Tolérance globale calée sur la dispersion réelle du pourtour : un fond
  // très uniforme resserre le critère, un fond texturé le desserre.
  const spread: number[] = []
  for (let x = 0; x < w; x += 2) {
    spread.push(Math.sqrt(distanceToColor2(data, x * 4, reference)))
    spread.push(Math.sqrt(distanceToColor2(data, ((h - 1) * w + x) * 4, reference)))
  }
  spread.sort((a, b) => a - b)
  const p80 = spread[Math.floor(spread.length * 0.8)] ?? 0
  const globalTolerance = Math.min(120, Math.max(34, p80 * 2.4))
  const globalTolerance2 = globalTolerance * globalTolerance
  const localTolerance2 = 30 * 30

  while (stack.length > 0) {
    const p = stack.pop()!
    const x = p % w
    const y = (p - x) / w
    const i = p * 4

    const visit = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return
      const np = ny * w + nx
      if (mask[np]) return
      const ni = np * 4
      if (colorDistance2(data, ni, i) > localTolerance2) return
      if (distanceToColor2(data, ni, reference) > globalTolerance2) return
      mask[np] = 1
      stack.push(np)
    }
    visit(x - 1, y)
    visit(x + 1, y)
    visit(x, y - 1)
    visit(x, y + 1)
  }

  return mask
}

/**
 * Plus grande zone d'un seul tenant parmi les pixels qui ne sont pas du fond,
 * puis contour de cette zone. Les autres taches (une main, un objet posé à
 * côté) sont écartées.
 */
function largestForegroundBoundary(
  mask: Uint8Array,
  w: number,
  h: number,
): { boundary: Point[]; area: number } | null {
  const label = new Int32Array(w * h).fill(-1)
  let best: number[] = []
  let current = 0

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] || label[start] !== -1) continue
    const component: number[] = []
    const stack = [start]
    label[start] = current
    while (stack.length > 0) {
      const p = stack.pop()!
      component.push(p)
      const x = p % w
      const y = (p - x) / w
      const visit = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return
        const np = ny * w + nx
        if (mask[np] || label[np] !== -1) return
        label[np] = current
        stack.push(np)
      }
      visit(x - 1, y)
      visit(x + 1, y)
      visit(x, y - 1)
      visit(x, y + 1)
    }
    if (component.length > best.length) best = component
    current++
  }

  if (best.length === 0) return null

  const inComponent = new Uint8Array(w * h)
  for (const p of best) inComponent[p] = 1

  const boundary: Point[] = []
  for (const p of best) {
    const x = p % w
    const y = (p - x) / w
    const isEdge =
      x === 0 ||
      y === 0 ||
      x === w - 1 ||
      y === h - 1 ||
      !inComponent[p - 1] ||
      !inComponent[p + 1] ||
      !inComponent[p - w] ||
      !inComponent[p + w]
    if (isEdge) boundary.push({ x, y })
  }

  return { boundary, area: best.length }
}

/** Enveloppe convexe (parcours monotone d'Andrew). */
function convexHull(points: Point[]): Point[] {
  if (points.length < 4) return points.slice()
  const sorted = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

  const build = (list: Point[]) => {
    const stack: Point[] = []
    for (const point of list) {
      while (stack.length >= 2 && cross(stack[stack.length - 2], stack[stack.length - 1], point) <= 0) {
        stack.pop()
      }
      stack.push(point)
    }
    stack.pop()
    return stack
  }

  return build(sorted).concat(build(sorted.slice().reverse()))
}

/** Réduit l'enveloppe à un nombre de sommets exploitable par force brute. */
function reduceHull(hull: Point[], maxPoints: number): Point[] {
  if (hull.length <= maxPoints) return hull
  const step = hull.length / maxPoints
  const reduced: Point[] = []
  for (let i = 0; i < maxPoints; i++) {
    reduced.push(hull[Math.floor(i * step)])
  }
  return reduced
}

function polygonArea(points: Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

/**
 * Quadrilatère de plus grande aire inscrit dans l'enveloppe convexe. Les
 * sommets de l'enveloppe étant déjà ordonnés, toute sélection croissante de
 * quatre d'entre eux forme un quadrilatère convexe : il suffit de les
 * énumérer.
 */
function largestQuad(hull: Point[]): Quad | null {
  const points = reduceHull(hull, 28)
  const n = points.length
  if (n < 4) return null

  let bestArea = 0
  let best: Quad | null = null
  for (let a = 0; a < n - 3; a++) {
    for (let b = a + 1; b < n - 2; b++) {
      for (let c = b + 1; c < n - 1; c++) {
        for (let d = c + 1; d < n; d++) {
          const area = polygonArea([points[a], points[b], points[c], points[d]])
          if (area > bestArea) {
            bestArea = area
            best = [points[a], points[b], points[c], points[d]]
          }
        }
      }
    }
  }
  return best
}

/** Réordonne les sommets en haut-gauche, haut-droit, bas-droit, bas-gauche. */
function orderCorners(quad: Quad): Quad {
  const cx = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4
  const cy = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4
  // L'axe vertical est orienté vers le bas : trier par angle croissant décrit
  // le contour dans le sens des aiguilles d'une montre.
  const sorted = quad
    .slice()
    .sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))
  let topLeft = 0
  for (let i = 1; i < 4; i++) {
    if (sorted[i].x + sorted[i].y < sorted[topLeft].x + sorted[topLeft].y) topLeft = i
  }
  return [
    sorted[topLeft],
    sorted[(topLeft + 1) % 4],
    sorted[(topLeft + 2) % 4],
    sorted[(topLeft + 3) % 4],
  ]
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Norme du gradient (Sobel) : elle est forte là où l'image change vite. */
function gradientMagnitude(image: ImageData): Float32Array {
  const { width: w, height: h, data } = image
  const gray = new Float32Array(w * h)
  for (let p = 0; p < w * h; p++) {
    const i = p * 4
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }

  const magnitude = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x
      const gx =
        gray[p - w + 1] + 2 * gray[p + 1] + gray[p + w + 1] -
        (gray[p - w - 1] + 2 * gray[p - 1] + gray[p + w - 1])
      const gy =
        gray[p + w - 1] + 2 * gray[p + w] + gray[p + w + 1] -
        (gray[p - w - 1] + 2 * gray[p - w] + gray[p - w + 1])
      magnitude[p] = Math.hypot(gx, gy) / 4
    }
  }
  return magnitude
}

/**
 * Part de chaque côté du quadrilatère réellement posée sur un contour de
 * l'image.
 *
 * C'est le garde-fou décisif : un simple dégradé d'éclairage sur une page qui
 * remplit le cadre suffit à tromper la détection par couleur, et produirait
 * alors un rognage en plein milieu du texte. Le bord d'une feuille, lui,
 * marque toujours une rupture nette.
 */
function edgeSupport(
  magnitude: Float32Array,
  w: number,
  h: number,
  quad: Quad,
  threshold: number,
): number {
  const SAMPLES = 48
  let worst = 1

  for (let side = 0; side < 4; side++) {
    const from = quad[side]
    const to = quad[(side + 1) % 4]
    let supported = 0
    let counted = 0

    for (let s = 0; s < SAMPLES; s++) {
      // Les abords immédiats des coins sont ignorés : c'est là que la position
      // estimée est la moins sûre.
      const t = 0.08 + (0.84 * s) / (SAMPLES - 1)
      const x = from.x + (to.x - from.x) * t
      const y = from.y + (to.y - from.y) * t

      let best = 0
      for (let offset = -2; offset <= 2; offset++) {
        const length = Math.hypot(to.x - from.x, to.y - from.y) || 1
        const nx = Math.round(x + (-(to.y - from.y) / length) * offset)
        const ny = Math.round(y + ((to.x - from.x) / length) * offset)
        if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue
        const value = magnitude[ny * w + nx]
        if (value > best) best = value
      }
      counted++
      if (best >= threshold) supported++
    }

    if (counted > 0) worst = Math.min(worst, supported / counted)
  }

  return worst
}

/**
 * Vérifie que la forme trouvée ressemble vraiment à une feuille vue de biais.
 * Un contour trop petit, trop allongé ou trop éloigné d'un rectangle est
 * rejeté : mieux vaut ne pas recadrer que rogner de travers.
 */
function isPlausibleDocument(
  quad: Quad,
  imageWidth: number,
  imageHeight: number,
  componentArea: number,
): boolean {
  const imageArea = imageWidth * imageHeight
  const area = polygonArea(quad)
  if (area < imageArea * 0.18) return false
  if (area > imageArea * 0.995) return false

  // Le quadrilatère doit épouser la zone détectée : si celle-ci déborde
  // largement, ce n'est pas une feuille rectangulaire.
  if (componentArea > 0 && area < componentArea * 0.72) return false

  const diagonal = Math.hypot(imageWidth, imageHeight)
  for (let i = 0; i < 4; i++) {
    const previous = quad[(i + 3) % 4]
    const corner = quad[i]
    const next = quad[(i + 1) % 4]

    if (distance(corner, next) < diagonal * 0.1) return false

    const v1 = { x: previous.x - corner.x, y: previous.y - corner.y }
    const v2 = { x: next.x - corner.x, y: next.y - corner.y }
    const cos =
      (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1)
    const angle = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
    if (angle < 55 || angle > 125) return false
  }

  return true
}

/**
 * Resserre légèrement le cadrage vers le centre. Les coins sont relevés sur
 * une image réduite : à pleine résolution, l'imprécision laisserait un liseré
 * de fond le long des bords. Quelques pixels pris sur la marge du document
 * coûtent moins qu'une bordure sombre sur chaque page.
 */
function shrinkQuad(quad: Quad, factor: number): Quad {
  const cx = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4
  const cy = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4
  return quad.map((p) => ({
    x: cx + (p.x - cx) * factor,
    y: cy + (p.y - cy) * factor,
  })) as Quad
}

function detectDocumentQuad(image: ImageData): Quad | null {
  const mask = backgroundMask(image)
  const foreground = largestForegroundBoundary(mask, image.width, image.height)
  if (!foreground || foreground.boundary.length < 8) return null

  const hull = convexHull(foreground.boundary)
  const quad = largestQuad(hull)
  if (!quad) return null

  const ordered = orderCorners(quad)
  if (!isPlausibleDocument(ordered, image.width, image.height, foreground.area)) return null

  const magnitude = gradientMagnitude(image)
  if (edgeSupport(magnitude, image.width, image.height, ordered, EDGE_THRESHOLD) < 0.6) {
    return null
  }
  return ordered
}

/* ------------------------------------------------------------------ */
/* Redressement                                                        */
/* ------------------------------------------------------------------ */

/** Résout un système linéaire carré par élimination de Gauss avec pivot. */
function solve(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length
  const a = matrix.map((row, i) => [...row, vector[i]])

  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row
    }
    if (Math.abs(a[pivot][col]) < 1e-9) return null
    ;[a[col], a[pivot]] = [a[pivot], a[col]]

    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = a[row][col] / a[col][col]
      for (let k = col; k <= n; k++) a[row][k] -= factor * a[col][k]
    }
  }

  return a.map((row, i) => row[n] / row[i])
}

/**
 * Homographie envoyant le rectangle de destination sur les quatre coins
 * relevés dans la photo. C'est bien ce sens qu'il faut calculer : le
 * rééchantillonnage parcourt l'image de sortie et va lire dans la source.
 */
function perspectiveTransform(quad: Quad, width: number, height: number): number[] | null {
  const destination: Point[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]

  const matrix: number[][] = []
  const vector: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = destination[i]
    const { x: u, y: v } = quad[i]
    matrix.push([x, y, 1, 0, 0, 0, -x * u, -y * u])
    vector.push(u)
    matrix.push([0, 0, 0, x, y, 1, -x * v, -y * v])
    vector.push(v)
  }

  const solution = solve(matrix, vector)
  return solution ? [...solution, 1] : null
}

/** Rééchantillonnage bilinéaire de la source vers l'image redressée. */
function warp(source: ImageData, quad: Quad, width: number, height: number): ImageData | null {
  const h = perspectiveTransform(quad, width, height)
  if (!h) return null

  const output = new ImageData(width, height)
  const src = source.data
  const dst = output.data
  const sw = source.width
  const sh = source.height

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const denominator = h[6] * x + h[7] * y + h[8]
      const u = (h[0] * x + h[1] * y + h[2]) / denominator
      const v = (h[3] * x + h[4] * y + h[5]) / denominator

      const x0 = Math.floor(u)
      const y0 = Math.floor(v)
      const dx = u - x0
      const dy = v - y0
      const out = (y * width + x) * 4

      if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) {
        // Hors cadre : blanc, plutôt qu'une bande noire au bord du document.
        dst[out] = 255
        dst[out + 1] = 255
        dst[out + 2] = 255
        dst[out + 3] = 255
        continue
      }

      const i00 = (y0 * sw + x0) * 4
      const i10 = i00 + 4
      const i01 = i00 + sw * 4
      const i11 = i01 + 4
      const w00 = (1 - dx) * (1 - dy)
      const w10 = dx * (1 - dy)
      const w01 = (1 - dx) * dy
      const w11 = dx * dy

      for (let c = 0; c < 3; c++) {
        dst[out + c] =
          src[i00 + c] * w00 + src[i10 + c] * w10 + src[i01 + c] * w01 + src[i11 + c] * w11
      }
      dst[out + 3] = 255
    }
  }

  return output
}

/* ------------------------------------------------------------------ */
/* Nettoyage : ombres, dominantes, contraste                           */
/* ------------------------------------------------------------------ */

/**
 * Estime l'éclairage par canal. Le fond lumineux n'a que des variations
 * lentes : il est calculé sur une vignette puis relu en bilinéaire, ce qui
 * revient à un flou de très grand rayon pour une fraction du coût.
 */
function illuminationMap(image: ImageData, small: number) {
  const { width: w, height: h, data } = image
  const scale = Math.max(w, h) / small
  const sw = Math.max(2, Math.round(w / scale))
  const sh = Math.max(2, Math.round(h / scale))

  const sums = new Float64Array(sw * sh * 3)
  const counts = new Float64Array(sw * sh)
  for (let y = 0; y < h; y++) {
    const ty = Math.min(sh - 1, Math.floor((y * sh) / h))
    for (let x = 0; x < w; x++) {
      const tx = Math.min(sw - 1, Math.floor((x * sw) / w))
      const t = ty * sw + tx
      const i = (y * w + x) * 4
      sums[t * 3] += data[i]
      sums[t * 3 + 1] += data[i + 1]
      sums[t * 3 + 2] += data[i + 2]
      counts[t]++
    }
  }

  // Maximum local : l'éclairage est mesuré sur le papier, pas sur l'encre.
  // Sans cette dilatation, un bloc de texte dense assombrirait l'estimation
  // et ressortirait comme une tache grise.
  const radius = 2
  const map = new Float64Array(sw * sh * 3)
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const maxima = [1, 1, 1]
      for (let ny = Math.max(0, y - radius); ny <= Math.min(sh - 1, y + radius); ny++) {
        for (let nx = Math.max(0, x - radius); nx <= Math.min(sw - 1, x + radius); nx++) {
          const t = ny * sw + nx
          const n = counts[t] || 1
          for (let c = 0; c < 3; c++) {
            const value = sums[t * 3 + c] / n
            if (value > maxima[c]) maxima[c] = value
          }
        }
      }
      const t = y * sw + x
      map[t * 3] = maxima[0]
      map[t * 3 + 1] = maxima[1]
      map[t * 3 + 2] = maxima[2]
    }
  }

  // Un lissage final évite que la dilatation ne laisse des marches visibles.
  const smoothed = new Float64Array(map.length)
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const totals = [0, 0, 0]
      let n = 0
      for (let ny = Math.max(0, y - 1); ny <= Math.min(sh - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(sw - 1, x + 1); nx++) {
          const t = ny * sw + nx
          totals[0] += map[t * 3]
          totals[1] += map[t * 3 + 1]
          totals[2] += map[t * 3 + 2]
          n++
        }
      }
      const t = y * sw + x
      smoothed[t * 3] = totals[0] / n
      smoothed[t * 3 + 1] = totals[1] / n
      smoothed[t * 3 + 2] = totals[2] / n
    }
  }

  return { map: smoothed, sw, sh }
}

/**
 * Efface ombres et dominantes de couleur, puis étale les niveaux. Le résultat
 * reste en couleur : tampons, cachets et signatures restent identifiables sur
 * un document administratif.
 */
function enhance(image: ImageData): ImageData {
  const { width: w, height: h, data } = image
  const { map, sw, sh } = illuminationMap(image, 96)

  const normalized = new Float32Array(w * h * 3)
  const histogram = new Uint32Array(256)

  for (let y = 0; y < h; y++) {
    const fy = Math.min(sh - 1.001, (y * sh) / h)
    const y0 = Math.floor(fy)
    const dy = fy - y0
    const y1 = Math.min(sh - 1, y0 + 1)

    for (let x = 0; x < w; x++) {
      const fx = Math.min(sw - 1.001, (x * sw) / w)
      const x0 = Math.floor(fx)
      const dx = fx - x0
      const x1 = Math.min(sw - 1, x0 + 1)

      const t00 = (y0 * sw + x0) * 3
      const t10 = (y0 * sw + x1) * 3
      const t01 = (y1 * sw + x0) * 3
      const t11 = (y1 * sw + x1) * 3

      const i = (y * w + x) * 4
      const o = (y * w + x) * 3
      for (let c = 0; c < 3; c++) {
        const background =
          map[t00 + c] * (1 - dx) * (1 - dy) +
          map[t10 + c] * dx * (1 - dy) +
          map[t01 + c] * (1 - dx) * dy +
          map[t11 + c] * dx * dy
        const value = Math.min(255, (data[i + c] * 255) / Math.max(background, 1))
        normalized[o + c] = value
      }
      const luminance =
        0.299 * normalized[o] + 0.587 * normalized[o + 1] + 0.114 * normalized[o + 2]
      histogram[Math.max(0, Math.min(255, Math.round(luminance)))]++
    }
  }

  // Points noir et blanc pris sur les centiles, avec des garde-fous : sur une
  // page presque vide, un centile brut écraserait le peu de texte présent.
  const total = w * h
  let cumulative = 0
  let low = 0
  let high = 255
  for (let v = 0; v < 256; v++) {
    cumulative += histogram[v]
    if (cumulative >= total * 0.02) {
      low = v
      break
    }
  }
  cumulative = 0
  for (let v = 255; v >= 0; v--) {
    cumulative += histogram[v]
    if (cumulative >= total * 0.02) {
      high = v
      break
    }
  }
  low = Math.min(low, 110)
  high = Math.max(high, 200)
  const range = Math.max(1, high - low)

  const output = new ImageData(w, h)
  const dst = output.data
  for (let p = 0; p < total; p++) {
    const o = p * 3
    const i = p * 4
    for (let c = 0; c < 3; c++) {
      dst[i + c] = Math.max(0, Math.min(255, ((normalized[o + c] - low) * 255) / range))
    }
    dst[i + 3] = 255
  }
  return output
}

/* ------------------------------------------------------------------ */
/* Enchaînement                                                        */
/* ------------------------------------------------------------------ */

function toCanvas(image: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  canvas.getContext('2d')!.putImageData(image, 0, 0)
  return canvas
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encodage impossible'))),
      'image/jpeg',
      quality,
    )
  })
}

function scanFileName(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `scan-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}.jpg`
}

/**
 * Numérise une photo : détection des bords, redressement et nettoyage.
 * Ne rejette jamais une image lisible — au pire, elle est seulement nettoyée.
 */
export async function scanDocument(file: File): Promise<ScanResult> {
  const source = await loadImage(file)
  const sourceWidth = 'naturalWidth' in source ? source.naturalWidth : source.width
  const sourceHeight = 'naturalHeight' in source ? source.naturalHeight : source.height
  if (!sourceWidth || !sourceHeight) throw new Error('Image illisible')

  const full = fitWithin(sourceWidth, sourceHeight, OUTPUT_SIZE)
  const fullImage = drawTo(source, full.width, full.height)

  const analysisSize = fitWithin(sourceWidth, sourceHeight, ANALYSIS_SIZE)
  const analysisImage = drawTo(source, analysisSize.width, analysisSize.height)

  const quad = detectDocumentQuad(analysisImage)

  let working = fullImage
  let cropped = false

  if (quad) {
    const ratio = full.width / analysisSize.width
    const scaled = shrinkQuad(
      quad.map((p) => ({ x: p.x * ratio, y: p.y * ratio })) as Quad,
      0.99,
    )

    // Dimensions du document redressé : on garde le plus grand des deux côtés
    // opposés, celui qui était le plus proche de l'objectif.
    const targetWidth = Math.round(
      Math.max(distance(scaled[0], scaled[1]), distance(scaled[3], scaled[2])),
    )
    const targetHeight = Math.round(
      Math.max(distance(scaled[0], scaled[3]), distance(scaled[1], scaled[2])),
    )

    if (targetWidth > 80 && targetHeight > 80) {
      const warped = warp(fullImage, scaled, targetWidth, targetHeight)
      if (warped) {
        working = warped
        cropped = true
      }
    }
  }

  const cleaned = enhance(working)
  const canvas = toCanvas(cleaned)

  let blob = await toBlob(canvas, 0.86)
  if (blob.size > MAX_OUTPUT_BYTES) blob = await toBlob(canvas, 0.7)
  if (blob.size > MAX_OUTPUT_BYTES) blob = await toBlob(canvas, 0.55)

  if ('close' in source) source.close()

  return {
    file: new File([blob], scanFileName(), { type: 'image/jpeg' }),
    previewUrl: URL.createObjectURL(blob),
    originalUrl: URL.createObjectURL(file),
    cropped,
    width: cleaned.width,
    height: cleaned.height,
  }
}
