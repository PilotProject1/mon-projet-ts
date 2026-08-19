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

import type { CSSProperties, ReactNode } from 'react'

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
          className={`at-anim at-fondu at-d${Math.min(i + 1, 5)}`}
          x="60"
          y={y}
          width={i % 3 === 2 ? 42 : 80}
          height="5"
          rx="2.5"
          fill="#eef3f1"
        />
      ))}
      <g transform="translate(100 96)">
        <g className="at-anim at-badge">
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
          <g key={libelle} className={`at-anim at-pastille at-d${i + 1}`}>
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

/*
 * Ce que le service en fait : ranger, rappeler, partager, retrouver.
 *
 * Les pictogrammes sont dessinés au complet — le cadran de l'horloge, le
 * cercle de la loupe — et non réduits à ce qui les distingue. Deux aiguilles
 * sans cadran ne sont pas une horloge : ce sont deux traits dans le vide.
 */
export function IllustrationActions() {
  const actions: { icone: ReactNode; libelle: string }[] = [
    {
      libelle: 'Classé',
      icone: <path d="M3 6h6l2 2.5h9V19H3z" strokeLinejoin="round" />,
    },
    {
      libelle: 'Rappel posé',
      icone: (
        <g className="at-anim at-cloche">
          <circle cx="12" cy="12.5" r="8" />
          <path d="M12 8v4.5l3 1.8" strokeLinecap="round" />
        </g>
      ),
    },
    {
      libelle: 'Partageable',
      icone: (
        <g>
          <circle cx="6.5" cy="12.5" r="2.6" />
          <circle cx="17.5" cy="7" r="2.6" />
          <circle cx="17.5" cy="18" r="2.6" />
          <path d="M9 11.2l6-3.1M9 13.8l6 3.1" strokeLinecap="round" />
        </g>
      ),
    },
    {
      libelle: 'Retrouvable',
      icone: (
        <g>
          <circle cx="11" cy="11" r="6.2" />
          <path d="M15.6 15.6L20 20" strokeLinecap="round" />
        </g>
      ),
    },
  ]
  return (
    <svg viewBox="0 0 200 150" className={cadre} role="img" aria-label="Ce que SYNeco en fait">
      {actions.map(({ icone, libelle }, i) => {
        const y = 22 + i * 32
        return (
          /*
           * Deux groupes imbriqués, et non un seul : une animation CSS qui
           * pose un `transform` remplace l'attribut `transform` du même
           * élément au lieu de s'y ajouter, et tout se retrouverait empilé à
           * l'origine. Le placement reste dehors, le mouvement dedans.
           */
          <g key={libelle} transform={`translate(20 ${y})`}>
            <g className={`at-anim at-pastille at-d${i + 1}`}>
              <rect
                width="160"
                height="24"
                rx="7"
                fill={i === 1 ? SOFT : '#fbfdfc'}
                stroke={BORDER}
              />
              <g transform="translate(7 2) scale(0.83)" stroke={GREEN} strokeWidth="1.7" fill="none">
                {icone}
              </g>
              <text x="34" y="16" fill={DEEP} fontSize="10" fontWeight="500">
                {libelle}
              </text>
            </g>
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
      {piles.map(([nom, x, elements], i) => (
        <g key={nom} className={`at-anim at-jalon at-d${i + 1}`}>
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
            {/* --longueur : la longueur du tracé, que l'animation consomme. */}
            <path
              className={`at-anim at-trace at-d${i + 1}`}
              style={{ '--longueur': 80 } as CSSProperties}
              d={`M72 73 C 100 73, 108 ${y + 12}, 132 ${y + 12}`}
              fill="none"
              stroke={GREEN}
              strokeWidth="1.6"
              strokeDasharray="3 3"
              opacity="0.75"
            />
            <rect
              className={`at-anim at-pastille at-d${i + 2}`}
              x="132"
              y={y}
              width="76"
              height="24"
              rx="7"
              fill={SOFT}
              stroke={BORDER}
            />
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
        <g className="at-anim at-badge">
          <rect x="-46" y="-9" width="92" height="18" rx="9" fill="#fff" stroke={BORDER} />
          <path d="M-32 0a4 4 0 118 0 4 4 0 01-8 0" fill="none" stroke={AMBER} strokeWidth="1.4" />
          <text x="4" y="3" textAnchor="middle" fill={MUTED} fontSize="7.5">
            Le lien expire
          </text>
        </g>
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
          <g key={nom} className={`at-anim at-jalon at-d${i + 1}`}>
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

/**
 * Le trajet d'une facture, de la boîte mail au coffre.
 *
 * Le dessin raconte un mouvement, pas un état : le message part de la boîte
 * de réception, traverse, et ressort lu. Le tracé pointillé se dessine à
 * l'apparition, ce qui fait le trajet sous les yeux au lieu de le suggérer.
 */
export function IllustrationDepotEmail() {
  const lignes: [string, string][] = [
    ['EDF', GREEN],
    ['84,30 €', DEEP],
    ['5 sept.', AMBER],
  ]
  return (
    <svg
      viewBox="0 0 320 170"
      className={cadre}
      role="img"
      aria-label="Une facture reçue par e-mail, transférée puis lue"
    >
      {/* La boîte de réception */}
      <rect x="10" y="26" width="112" height="118" rx="9" fill="#fff" stroke={BORDER} />
      <rect x="10" y="26" width="112" height="20" rx="9" fill={SOFT} />
      <rect x="10" y="38" width="112" height="8" fill={SOFT} />
      <text x="22" y="40" fill={DEEP} fontSize="8" fontWeight="600">
        Boîte de réception
      </text>

      {[56, 80].map((y, i) => (
        <g key={y} className={`at-anim at-fondu at-d${i + 1}`}>
          <rect x="19" y={y} width="94" height="17" rx="5" fill="#fbfdfc" stroke={BORDER} />
          <rect x="25" y={y + 5} width="42" height="3.5" rx="1.75" fill="#eef3f1" />
          <rect x="25" y={y + 10} width="62" height="3" rx="1.5" fill="#f4f8f6" />
        </g>
      ))}

      {/* Le message qui porte la facture : c'est lui qu'on transfère. */}
      <g className="at-anim at-pastille at-d3">
        <rect x="19" y="104" width="94" height="26" rx="6" fill={SOFT} stroke={GREEN} />
        <text x="26" y="115" fill={DEEP} fontSize="7.5" fontWeight="600">
          Votre facture EDF
        </text>
        {/* Le trombone : ce qui distingue un message utile d'un autre. */}
        <g transform="translate(26 119)" stroke={GREEN} strokeWidth="1.1" fill="none">
          <path d="M0 4.5V2a2 2 0 014 0v4a3.6 3.6 0 01-7.2 0V2" transform="translate(3 0)" />
        </g>
        <text x="38" y="125" fill={MUTED} fontSize="6.5">
          facture-aout.pdf
        </text>
      </g>

      {/* Le trajet */}
      <g className="at-anim at-trace at-d4" style={{ '--longueur': 90 } as CSSProperties}>
        <path
          d="M124 117 C 152 117, 158 85, 186 85"
          fill="none"
          stroke={GREEN}
          strokeWidth="1.8"
          strokeDasharray="4 4"
        />
      </g>
      <g className="at-anim at-badge at-d4">
        <rect x="128" y="128" width="56" height="18" rx="9" fill="#fff" stroke={BORDER} />
        <text x="156" y="140" textAnchor="middle" fill={GREEN} fontSize="7.5" fontWeight="600">
          Transférer
        </text>
      </g>

      {/* Le résultat, dans le coffre */}
      <rect x="186" y="26" width="124" height="118" rx="9" fill="#fff" stroke={BORDER} />
      <rect x="186" y="26" width="124" height="20" rx="9" fill={DEEP} />
      <rect x="186" y="38" width="124" height="8" fill={DEEP} />
      <text x="198" y="40" fill="#fff" fontSize="8" fontWeight="600">
        SYNeco
      </text>

      <g className="at-anim at-pastille at-d5">
        <rect x="196" y="56" width="104" height="20" rx="5" fill="#fbfdfc" stroke={BORDER} />
        <text x="204" y="69" fill={DEEP} fontSize="7.5" fontWeight="600">
          Facture · EDF
        </text>
      </g>

      {lignes.map(([valeur, couleur], i) => (
        <g key={valeur} className={`at-anim at-pastille at-d${i + 3}`}>
          <rect
            x="196"
            y={84 + i * 20}
            width="104"
            height="16"
            rx="5"
            fill={i === 2 ? SOFT : '#fbfdfc'}
          />
          <circle cx="205" cy={92 + i * 20} r="2.4" fill={couleur} />
          <text x="213" y={95 + i * 20} fill={couleur} fontSize="7.5" fontWeight="600">
            {valeur}
          </text>
        </g>
      ))}
    </svg>
  )
}
