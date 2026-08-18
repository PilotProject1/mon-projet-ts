/*
 * Illustrations du parcours d'un document, et des usages qui en découlent.
 *
 * Même langage que les illustrations des atouts : du SVG tracé à la main,
 * aux couleurs de la marque, net à toutes les densités et sans requête
 * réseau. Elles montrent le mécanisme — un fichier qui devient des
 * informations nommées, des documents qui se rangent, un lien qui part vers
 * une personne précise — plutôt que de le symboliser par un pictogramme
 * interchangeable.
 *
 * Aucune ne représente une fonctionnalité qui n'existe pas.
 */

/** Couleurs reprises des jetons de la marque, pour que rien ne dérive. */
const DEEP = '#0b2e2f'
const GREEN = '#2f8f6f'
const SOFT = '#e3f1eb'
const BORDER = '#dfe7e3'
const MUTED = '#93a39d'
const AMBER = '#c98a3e'

const cadre = 'h-auto w-full'

/** Un fichier opaque : un nom, et rien qu'on puisse en faire. */
export function IllustrationFichierBrut() {
  return (
    <svg viewBox="0 0 200 150" className={cadre} role="img" aria-label="Un fichier PDF fermé">
      <rect x="46" y="16" width="108" height="126" rx="7" fill="#fff" stroke={BORDER} />
      <path d="M124 16v22h30" fill="none" stroke={BORDER} strokeWidth="1.5" />
      <path d="M124 16l30 22" fill="#f4f8f6" stroke={BORDER} strokeWidth="1.5" />
      {[58, 70, 82, 94, 106, 118].map((y, i) => (
        <rect
          key={y}
          x="60"
          y={y}
          width={i % 3 === 2 ? 42 : 80}
          height="5"
          rx="2.5"
          fill="#eef3f1"
        />
      ))}
      <g transform="translate(100 96)">
        <rect x="-31" y="-11" width="62" height="22" rx="5" fill={DEEP} />
        <text
          x="0"
          y="4"
          textAnchor="middle"
          fill="#fff"
          fontSize="10"
          fontFamily="ui-monospace, monospace"
        >
          PDF
        </text>
      </g>
    </svg>
  )
}

/** Les informations reconnues, nommées une à une. */
export function IllustrationInformationsLues() {
  const lignes: [string, string, string][] = [
    ['Fournisseur', 'EDF', GREEN],
    ['Montant', '84,30 €', DEEP],
    ['Échéance', '05/09/2026', AMBER],
    ['Référence', 'FA2026081234', MUTED],
  ]
  return (
    <svg viewBox="0 0 200 150" className={cadre} role="img" aria-label="Informations reconnues">
      <rect x="14" y="16" width="172" height="126" rx="9" fill="#fff" stroke={BORDER} />
      {lignes.map(([libelle, valeur, couleur], i) => {
        const y = 34 + i * 28
        return (
          <g key={libelle}>
            <rect x="26" y={y - 11} width="148" height="22" rx="6" fill={i % 2 ? '#fbfdfc' : SOFT} />
            <text x="34" y={y + 4} fill={MUTED} fontSize="9">
              {libelle}
            </text>
            <text x="166" y={y + 4} textAnchor="end" fill={couleur} fontSize="10" fontWeight="600">
              {valeur}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Ce que le service en fait : ranger, rappeler, partager, retrouver. */
export function IllustrationActions() {
  const actions: [string, string][] = [
    ['M4 7h7l2 2h7v9H4z', 'Classé'],
    ['M12 6v6l4 2', 'Rappel posé'],
    ['M7 12h10M13 8l4 4-4 4', 'Partageable'],
    ['M11 4a7 7 0 105 12l4 4', 'Retrouvable'],
  ]
  return (
    <svg viewBox="0 0 200 150" className={cadre} role="img" aria-label="Ce que SYNeco en fait">
      {actions.map(([trace, libelle], i) => {
        const y = 22 + i * 32
        return (
          <g key={libelle} transform={`translate(20 ${y})`}>
            <rect width="160" height="24" rx="7" fill={i === 1 ? SOFT : '#fbfdfc'} stroke={BORDER} />
            <g transform="translate(8 3) scale(0.78)" stroke={GREEN} strokeWidth="1.8" fill="none">
              <path d={trace} strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <text x="34" y="16" fill={DEEP} fontSize="10" fontWeight="500">
              {libelle}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Trois foyers de documents, réunis sous un même toit. */
export function IllustrationRangement() {
  const piles: [string, number, string[]][] = [
    ['Maison', 24, ['Électricité', 'Habitation', 'Bail']],
    ['Personnel', 88, ['Auto', 'Impôts', 'Mutuelle']],
    ['Famille', 152, ['École', 'Santé', 'Garanties']],
  ]
  return (
    <svg viewBox="0 0 220 150" className={cadre} role="img" aria-label="Documents rangés par foyer">
      {piles.map(([nom, x, elements]) => (
        <g key={nom}>
          <rect x={x} y="30" width="52" height="96" rx="7" fill="#fff" stroke={BORDER} />
          <rect x={x} y="30" width="52" height="17" rx="7" fill={SOFT} />
          <rect x={x} y="40" width="52" height="7" fill={SOFT} />
          <text x={x + 26} y="42" textAnchor="middle" fill={DEEP} fontSize="8.5" fontWeight="600">
            {nom}
          </text>
          {elements.map((element, j) => (
            <g key={element}>
              <rect
                x={x + 7}
                y={57 + j * 21}
                width="38"
                height="15"
                rx="4"
                fill="#fbfdfc"
                stroke={BORDER}
              />
              <text x={x + 26} y={67 + j * 21} textAnchor="middle" fill={MUTED} fontSize="6.5">
                {element}
              </text>
            </g>
          ))}
        </g>
      ))}
      <path
        d="M14 22h192"
        stroke={GREEN}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  )
}

/** Un document, un lien, une personne — et une date de fin. */
export function IllustrationPartageCible() {
  const cibles = ['Comptable', 'Conjoint', 'Assurance']
  return (
    <svg viewBox="0 0 220 150" className={cadre} role="img" aria-label="Partage vers une personne">
      <rect x="12" y="40" width="56" height="66" rx="6" fill="#fff" stroke={BORDER} />
      {[52, 62, 72, 82].map((y, i) => (
        <rect key={y} x="20" y={y} width={i === 3 ? 24 : 40} height="4" rx="2" fill="#eef3f1" />
      ))}
      <text x="40" y="99" textAnchor="middle" fill={MUTED} fontSize="7">
        Facture
      </text>

      {cibles.map((cible, i) => {
        const y = 30 + i * 32
        return (
          <g key={cible}>
            <path
              d={`M72 73 C 100 73, 108 ${y + 12}, 132 ${y + 12}`}
              fill="none"
              stroke={GREEN}
              strokeWidth="1.6"
              strokeDasharray="3 3"
              opacity="0.75"
            />
            <rect x="132" y={y} width="76" height="24" rx="7" fill={SOFT} stroke={BORDER} />
            <circle cx="146" cy={y + 12} r="6" fill="#fff" stroke={GREEN} strokeWidth="1.4" />
            <circle cx="146" cy={y + 10} r="2.1" fill={GREEN} />
            <path
              d={`M142.4 ${y + 16.5}a4.2 4.2 0 017.2 0`}
              fill="none"
              stroke={GREEN}
              strokeWidth="1.2"
            />
            <text x="158" y={y + 15} fill={DEEP} fontSize="8.5" fontWeight="500">
              {cible}
            </text>
          </g>
        )
      })}

      <g transform="translate(110 136)">
        <rect x="-46" y="-9" width="92" height="18" rx="9" fill="#fff" stroke={BORDER} />
        <path
          d="M-32 0a4 4 0 118 0 4 4 0 01-8 0"
          fill="none"
          stroke={AMBER}
          strokeWidth="1.4"
        />
        <text x="4" y="3" textAnchor="middle" fill={MUTED} fontSize="7.5">
          Le lien expire
        </text>
      </g>
    </svg>
  )
}

/** Les deux usages, côte à côte, avec ce qui les distingue. */
export function IllustrationDeuxUsages() {
  const colonnes: [string, string[], string][] = [
    ['Particulier', ['Factures', 'Assurances', 'Garanties'], GREEN],
    ['Indépendant', ['Fournisseurs', 'Devis', 'Clients'], DEEP],
  ]
  return (
    <svg viewBox="0 0 220 140" className={cadre} role="img" aria-label="Particulier et indépendant">
      {colonnes.map(([nom, elements, couleur], i) => {
        const x = 14 + i * 110
        return (
          <g key={nom}>
            <rect x={x} y="16" width="92" height="108" rx="9" fill="#fff" stroke={BORDER} />
            <rect x={x + 12} y="28" width="68" height="20" rx="6" fill={couleur} />
            <text x={x + 46} y="42" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="600">
              {nom}
            </text>
            {elements.map((element, j) => (
              <g key={element}>
                <rect
                  x={x + 12}
                  y={58 + j * 20}
                  width="68"
                  height="15"
                  rx="4"
                  fill="#fbfdfc"
                  stroke={BORDER}
                />
                <circle cx={x + 21} cy={65.5 + j * 20} r="2.4" fill={couleur} opacity="0.6" />
                <text x={x + 28} y={68 + j * 20} fill={MUTED} fontSize="7">
                  {element}
                </text>
              </g>
            ))}
          </g>
        )
      })}
      <path d="M110 60v36" stroke={BORDER} strokeWidth="1.5" strokeDasharray="4 4" />
    </svg>
  )
}
