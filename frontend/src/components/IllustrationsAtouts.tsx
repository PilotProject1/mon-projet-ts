/*
 * Illustrations des quatre atouts de la page d'accueil.
 *
 * Dessinées plutôt que photographiées : une capture d'écran vieillit à
 * chaque changement d'interface, et à cette taille elle serait illisible.
 * Chacune montre le geste lui-même — une feuille qui se redresse, un
 * montant reconnu, un compte à rebours, une hausse — au lieu de le
 * symboliser par un pictogramme interchangeable.
 *
 * Le tracé est en SVG : net à toutes les densités, sans requête réseau, et
 * il suit les couleurs de la marque sans jamais s'en écarter.
 */

/** Couleurs reprises des jetons de la marque, pour que rien ne dérive. */
const DEEP = '#0b2e2f'
const GREEN = '#2f8f6f'
const SOFT = '#e3f1eb'
const BORDER = '#dfe7e3'
const MUTED = '#93a39d'
const AMBER = '#c98a3e'

const cadre = 'h-auto w-full'

/** Une photo de travers qui devient une page droite. */
export function IllustrationCadrage() {
  return (
    <svg viewBox="0 0 260 120" className={cadre} role="img" aria-label="Photo redressée">
      <g transform="rotate(-9 78 60)">
        <rect x="34" y="24" width="70" height="88" rx="4" fill="#fff" stroke={BORDER} />
        {[38, 48, 58, 68, 78, 88].map((y) => (
          <rect key={y} x="43" y={y} width={y % 20 === 8 ? 38 : 52} height="3.5" rx="1.75" fill="#eef3f1" />
        ))}
        {[
          [34, 24],
          [104, 24],
          [104, 112],
          [34, 112],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill={GREEN} stroke="#fff" strokeWidth="1.5" />
        ))}
      </g>

      <path
        d="M124 62 h16"
        stroke={GREEN}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M136 57 l6 5 -6 5" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

      <rect x="156" y="16" width="76" height="94" rx="5" fill="#fff" stroke={GREEN} strokeWidth="1.5" />
      <rect x="156" y="16" width="76" height="94" rx="5" fill={SOFT} opacity="0.45" />
      {[30, 41, 52, 63, 74, 85].map((y) => (
        <rect key={y} x="166" y={y} width={y === 85 ? 34 : 56} height="4" rx="2" fill={y < 41 ? GREEN : '#c9dbd4'} />
      ))}
    </svg>
  )
}

/** Un document dont trois informations ressortent, étiquetées. */
export function IllustrationLecture() {
  return (
    <svg viewBox="0 0 260 120" className={cadre} role="img" aria-label="Informations reconnues">
      <rect x="16" y="10" width="128" height="102" rx="6" fill="#fff" stroke={BORDER} />
      <rect x="28" y="24" width="42" height="8" rx="4" fill={DEEP} />
      {[44, 55, 66].map((y) => (
        <rect key={y} x="28" y={y} width={y === 66 ? 62 : 84} height="4" rx="2" fill="#eef3f1" />
      ))}
      <rect x="28" y="82" width="52" height="10" rx="3" fill={SOFT} stroke={GREEN} strokeWidth="0.8" />
      <rect x="88" y="82" width="40" height="10" rx="3" fill={SOFT} stroke={GREEN} strokeWidth="0.8" />

      {[
        { y: 20, w: 66, t: 'Émetteur' },
        { y: 52, w: 66, t: 'Montant' },
        { y: 84, w: 66, t: 'Échéance' },
      ].map(({ y, w, t }) => (
        <g key={t}>
          <path d={`M144 ${y + 9} H164`} stroke={GREEN} strokeWidth="1.2" strokeDasharray="3 3" />
          <rect x="164" y={y} width={w} height="18" rx="9" fill={GREEN} />
          <text
            x={164 + w / 2}
            y={y + 12.5}
            textAnchor="middle"
            fill="#fff"
            fontSize="9"
            fontFamily="Inter, system-ui, sans-serif"
            fontWeight="600"
          >
            {t}
          </text>
        </g>
      ))}
    </svg>
  )
}

/** Le compte à rebours des rappels avant l'échéance. */
export function IllustrationRappels() {
  const jalons = [
    { x: 34, t: '30 j' },
    { x: 92, t: '7 j' },
    { x: 150, t: '1 j' },
    { x: 208, t: 'Jour J' },
  ]
  return (
    <svg viewBox="0 0 260 120" className={cadre} role="img" aria-label="Rappels avant l’échéance">
      <path d="M34 62 H208" stroke={BORDER} strokeWidth="3" strokeLinecap="round" />
      <path d="M34 62 H150" stroke={GREEN} strokeWidth="3" strokeLinecap="round" />

      {jalons.map(({ x, t }, i) => {
        const dernier = i === jalons.length - 1
        return (
          <g key={t}>
            {dernier && <circle cx={x} cy="62" r="13" fill={SOFT} />}
            <circle
              cx={x}
              cy="62"
              r={dernier ? 8 : 6}
              fill={dernier ? DEEP : GREEN}
              stroke="#fff"
              strokeWidth="2"
            />
            <text
              x={x}
              y="90"
              textAnchor="middle"
              fill={dernier ? DEEP : MUTED}
              fontSize="10"
              fontFamily="Inter, system-ui, sans-serif"
              fontWeight={dernier ? '700' : '500'}
            >
              {t}
            </text>
          </g>
        )
      })}

      {/* Une cloche au-dessus de chaque rappel envoyé. */}
      {jalons.slice(0, 3).map(({ x }) => (
        <g key={`c${x}`} transform={`translate(${x - 6} 30)`}>
          <path
            d="M6 1 C9.3 1 12 3.7 12 7 v4 l1.6 2.4 H-1.6 L0 11 V7 C0 3.7 2.7 1 6 1 Z"
            fill={GREEN}
            opacity="0.85"
          />
          <path d="M4.4 15.5 a1.8 1.8 0 0 0 3.2 0" stroke={GREEN} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  )
}

/** Une série de factures dont la dernière augmente. */
export function IllustrationHausse() {
  const barres = [
    { x: 26, h: 34 },
    { x: 62, h: 36 },
    { x: 98, h: 35 },
    { x: 134, h: 37 },
    { x: 170, h: 58, hausse: true },
  ]
  return (
    <svg viewBox="0 0 260 120" className={cadre} role="img" aria-label="Hausse détectée">
      <path d="M20 96 H236" stroke={BORDER} strokeWidth="1.5" strokeLinecap="round" />
      {barres.map(({ x, h, hausse }) => (
        <rect
          key={x}
          x={x}
          y={96 - h}
          width="26"
          height={h}
          rx="4"
          fill={hausse ? AMBER : SOFT}
          stroke={hausse ? AMBER : '#cfe0d9'}
          strokeWidth={hausse ? 0 : 1}
        />
      ))}

      <path
        d="M39 52 C 80 48, 130 46, 176 26"
        stroke={GREEN}
        strokeWidth="2"
        strokeDasharray="4 4"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="150" y="6" width="78" height="20" rx="10" fill={DEEP} />
      <text
        x="189"
        y="19.5"
        textAnchor="middle"
        fill="#fff"
        fontSize="10.5"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
      >
        + 2,40 €
      </text>
    </svg>
  )
}
