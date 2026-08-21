import { Link } from 'react-router-dom'
import {
  ShieldCheck,
  Check,
  ArrowRight,
  FileText,
  Clock,
  CheckCircle2,
  Lock,
  KeyRound,
  Smartphone,
  Link2,
  FileCheck2,
  DatabaseBackup,
} from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'
import BrandLogo from '../components/BrandLogo'
import {
  IllustrationCadrage,
  IllustrationLecture,
  IllustrationRappels,
  IllustrationHausse,
} from '../components/IllustrationsAtouts'
import {
  IllustrationActions,
  IllustrationDepotEmail,
  IllustrationDeuxUsages,
  IllustrationFichierBrut,
  IllustrationInformationsLues,
  IllustrationPartageCible,
  IllustrationRangement,
} from '../components/IllustrationsParcours'
import AmbientBackground from '../components/AmbientBackground'
import { useTitrePage } from '../utils/useTitrePage'
import { useApparition, useEntree } from '../utils/useApparition'

/*
 * Page vue par un visiteur qui n'a pas de compte.
 *
 * Jusqu'ici, l'adresse du site menait directement à l'écran de connexion :
 * personne ne pouvait comprendre ce qu'est SYNeco sans s'inscrire, et les
 * moteurs de recherche n'avaient rien à indexer. C'est la seule page dont le
 * travail est d'expliquer.
 *
 * Elle ne promet que ce que le code fait réellement. Une page d'accueil qui
 * exagère se paie deux fois : à l'inscription, puis à la résiliation.
 */

interface AtoutProps {
  /** Illustration du geste décrit, affichée en tête de la case. */
  illustration: ComponentType
  titre: string
  texte: string
}

const ATOUTS: AtoutProps[] = [
  {
    illustration: IllustrationCadrage,
    titre: 'Photographiez, c’est rangé',
    texte:
      'Le document est cadré, redressé et éclairci automatiquement. Aucune retouche à faire, aucun scanner à sortir.',
  },
  {
    illustration: IllustrationLecture,
    titre: 'Le document est lu',
    texte:
      'Son type, son émetteur, son montant et sa date sont reconnus dans le texte. Vous n’avez rien à saisir.',
  },
  {
    illustration: IllustrationRappels,
    titre: 'Vous êtes prévenu à temps',
    texte:
      'L’échéance repérée devient un rappel : trente jours, sept jours et un jour avant, puis le jour même — par notification et par e-mail. Une fois par semaine, un point vous résume ce qui demande une décision, et rien ne part quand il n’y a rien à dire.',
  },
  {
    illustration: IllustrationHausse,
    titre: 'Les hausses ne passent plus',
    texte:
      'Vos dépenses qui reviennent sont reconstituées à partir de vos factures, et une augmentation vous est signalée en euros.',
  },
]

const OFFRES = [
  {
    nom: 'Gratuit',
    prix: '0 €',
    detail: 'Jusqu’à 10 documents',
    inclus: [
      'Lecture par intelligence artificielle',
      'Recherche en langage naturel',
      'Échéances et rappels',
      'Partage sécurisé',
    ],
  },
  {
    nom: 'Particulier Premium',
    prix: '4,99 €',
    detail: 'par mois, sans engagement',
    inclus: [
      'Documents illimités',
      'Tout ce que contient l’offre gratuite',
      'Dépenses récurrentes et hausses détectées',
      'Application installable',
    ],
    vedette: true,
  },
  {
    nom: 'Professionnel',
    prix: '19,99 €',
    detail: 'par mois, sans engagement',
    // Pas de devis dans le code : ne pas l'annoncer ici.
    inclus: ['Tout Premium', 'Entreprise et clients', 'Factures émises et suivies'],
  },
]

/** Une case d'atout, qui rejoue son illustration en entrant dans l'écran. */
function CaseAtout({ illustration: Illustration, titre, texte }: AtoutProps) {
  const { ref, classe } = useApparition<HTMLDivElement>()
  return (
    <div className="brand-card-shadow mvt-carte neon-carte overflow-hidden rounded-[14px] border border-brand-border bg-white">
      {/* L'illustration occupe toute la largeur de la case : à cette taille,
          un dessin encadré perdrait sa lisibilité. */}
      <div ref={ref} className={`border-b border-brand-border bg-brand-mint/60 px-5 pt-4 pb-2 ${classe}`}>
        <Illustration />
      </div>
      <div className="px-5 pt-4 pb-5">
        <h2 className="font-heading text-[15.5px] font-semibold text-brand-ink">{titre}</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-muted">{texte}</p>
      </div>
    </div>
  )
}

/*
 * Le parcours d'un document, en trois temps.
 *
 * C'est ce qui distingue ce service d'un dossier partagé, et cela se montre
 * mieux que cela ne se raconte : un fichier dont on ne peut rien faire, les
 * informations qu'on en tire, ce qu'elles permettent ensuite.
 *
 * Les flèches basculent à la verticale sur téléphone : trois colonnes de
 * cent trente pixels seraient illisibles, et un défilement latéral sur la
 * section la plus explicative serait le pire endroit pour en imposer un.
 */
const ETAPES = [
  {
    illustration: IllustrationFichierBrut,
    surtitre: 'Ce que vous déposez',
    titre: 'Un fichier, et rien de plus',
    texte:
      'Facture_EDF_08_2026.pdf. Un nom, un poids. Rien qui se cherche, rien qui prévienne.',
  },
  {
    illustration: IllustrationInformationsLues,
    surtitre: 'Ce que SYNeco lit',
    titre: 'Des informations nommées',
    texte:
      'L’émetteur, le montant, l’échéance, la référence. Reconnus dans le texte du document, et corrigeables d’un geste.',
  },
  {
    illustration: IllustrationActions,
    surtitre: 'Ce que ça permet',
    titre: 'Un document qui agit',
    texte:
      'Classé sans que vous choisissiez le dossier, rappelé avant l’échéance, partageable par lien, retrouvable en une recherche.',
  },
]

function Etape({
  illustration: Illustration,
  surtitre,
  titre,
  texte,
  rang,
}: {
  illustration: ComponentType
  surtitre: string
  titre: string
  texte: string
  rang: number
}) {
  const { ref, classe } = useApparition<HTMLDivElement>()
  return (
    <div className="flex flex-1 flex-col">
      <div
        ref={ref}
        className={`neon-carte rounded-[16px] border border-brand-border bg-white px-4 pt-4 pb-3 ${classe}`}
      >
        <Illustration />
      </div>
      <p className="mt-3.5 text-[11.5px] font-semibold tracking-wide text-brand-green uppercase">
        {surtitre}
      </p>
      <h3 className="font-heading mt-1 text-[16px] font-semibold text-brand-ink">{titre}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-muted">{texte}</p>
      <span className="sr-only">Étape {rang}</span>
    </div>
  )
}

function SectionParcours() {
  return (
    <section className="mx-auto max-w-5xl px-5 pb-16 sm:px-8">
      <h2 className="font-heading text-[22px] font-semibold text-brand-deep">
        SYNeco ne range pas vos documents. Il les lit.
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-brand-muted">
        Un espace de stockage vous rend le fichier que vous lui avez confié. SYNeco vous rend
        ce qu’il y a dedans.
      </p>

      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:gap-4">
        {ETAPES.map((etape, i) => (
          <div key={etape.titre} className="flex flex-1 flex-col sm:flex-row sm:items-stretch">
            <Etape {...etape} rang={i + 1} />
            {i < ETAPES.length - 1 && (
              <div
                aria-hidden
                className="flex items-center justify-center py-2 sm:px-1 sm:py-0"
              >
                <ArrowRight
                  size={20}
                  className="rotate-90 text-brand-green/45 sm:rotate-0"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/** Une section illustrée : le dessin d'un côté, le propos de l'autre. */
function SectionIllustree({
  illustration: Illustration,
  titre,
  texte,
  points,
  inverse,
}: {
  illustration: ComponentType
  titre: string
  texte: string
  points: string[]
  /** Place le dessin à droite : alterner évite la colonne monotone. */
  inverse?: boolean
}) {
  const { ref, classe } = useApparition<HTMLDivElement>()
  return (
    <section className="mx-auto max-w-5xl px-5 pb-16 sm:px-8">
      <div
        ref={ref}
        className={`flex flex-col gap-6 sm:items-center sm:gap-10 ${
          inverse ? 'sm:flex-row-reverse' : 'sm:flex-row'
        } ${classe}`}
      >
        <div className="neon-carte w-full shrink-0 rounded-[16px] border border-brand-border bg-white px-4 py-4 sm:w-[46%]">
          <Illustration />
        </div>
        <div className="min-w-0">
          <h2 className="font-heading text-[22px] font-semibold text-brand-deep">{titre}</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-brand-muted">{texte}</p>
          <ul className="mt-3.5 space-y-2">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2 text-[13.5px] text-brand-ink">
                <Check size={15} className="mt-0.5 shrink-0 text-brand-green" />
                <span className="min-w-0">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/*
 * Le trajet d'une facture reçue par courriel.
 *
 * Section pleine largeur et fond appuyé, à la différence des autres : c'est
 * le geste qui supprime le plus de friction — plus rien à télécharger, plus
 * rien à redéposer — et il mérite qu'on s'arrête dessus en descendant la
 * page.
 */
function SectionDepotEmail() {
  const { ref, classe } = useApparition<HTMLDivElement>()
  return (
    <section className="mb-16 bg-brand-mint/45 py-14">
      <div ref={ref} className={`mx-auto max-w-5xl px-5 sm:px-8 ${classe}`}>
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:gap-12">
          <div className="min-w-0 sm:w-[42%]">
            <p className="text-[11.5px] font-semibold tracking-wide text-brand-green uppercase">
              Sans rien télécharger
            </p>
            <h2 className="font-heading mt-1.5 text-[22px] leading-tight font-semibold text-brand-deep">
              Transférez. SYNeco s’occupe du reste.
            </h2>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-brand-muted">
              Vos factures arrivent par e-mail. Plutôt que de télécharger la pièce jointe,
              d’ouvrir le site et de la redéposer, transférez simplement le message à
              votre adresse SYNeco.
            </p>
            <ul className="mt-4 space-y-2">
              {[
                'Une adresse personnelle, à vous seul',
                'La pièce jointe est déposée et lue automatiquement',
                'Depuis n’importe quelle messagerie, sur téléphone comme sur ordinateur',
              ].map((point) => (
                <li key={point} className="flex items-start gap-2 text-[13.5px] text-brand-ink">
                  <Check size={15} className="mt-0.5 shrink-0 text-brand-green" />
                  <span className="min-w-0">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full min-w-0 rounded-[18px] border border-brand-border bg-white px-4 py-5 shadow-[0_20px_50px_-30px_rgba(11,46,47,0.45)] sm:w-[58%]">
            <IllustrationDepotEmail />
          </div>
        </div>
      </div>
    </section>
  )
}

/*
 * Aperçu de l'espace, montré dans le hero.
 *
 * Le premier écran de la page n'avait jusqu'ici aucun visuel : du texte, deux
 * boutons, rien qui montre ce que devient un document une fois dans SYNeco.
 * Cette carte reprend le langage visuel du vrai tableau de bord (mêmes puces
 * d'icônes teintées) pour donner un aperçu crédible sans dupliquer une vraie
 * capture d'écran, qui se périmerait au premier changement d'interface.
 */
function HeroApercu() {
  const lignes = [
    { icon: FileText, tint: '#12514F', label: 'Documents rangés', valeur: '12' },
    { icon: Clock, tint: '#C98A3E', label: 'Prochaine échéance', valeur: 'dans 6 jours' },
    { icon: CheckCircle2, tint: '#2F8F6F', label: 'Lus automatiquement', valeur: '12/12' },
  ]
  return (
    <div className="brand-card-shadow neon-carte w-full shrink-0 rounded-[18px] border border-brand-border bg-white p-5 sm:w-[360px]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold tracking-wide text-brand-muted uppercase">
          Votre espace
        </p>
        <span className="flex items-center gap-1.5 rounded-full bg-brand-green-soft px-2.5 py-1 text-[11px] font-semibold text-brand-green-deep">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-green" />À jour
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {lignes.map(({ icon: Icon, tint, label, valeur }) => (
          <div key={label} className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
              style={{ background: `${tint}1A` }}
            >
              <Icon size={16} color={tint} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] text-brand-muted">{label}</p>
            </div>
            <p className="shrink-0 text-[12.5px] font-semibold text-brand-ink">{valeur}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2.5 rounded-[12px] border border-brand-border bg-brand-mint/50 px-3 py-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-white">
          <FileText size={14} className="text-brand-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-brand-ink">
            Facture_EDF_08_2026.pdf
          </p>
          <p className="text-[11px] text-brand-muted">84,30 € · échéance le 5 sept.</p>
        </div>
        <Check size={15} className="shrink-0 text-brand-green" />
      </div>
    </div>
  )
}

/*
 * Ce qui protège les documents, dit en clair.
 *
 * Ces mesures existaient déjà toutes, mais seule la politique de
 * confidentialité les décrivait — que personne ne lit avant de s'inscrire. La
 * page d'accueil ne disait jusqu'ici que ce que le service refuse de faire.
 * Or on confie ici des avis d'imposition et des contrats d'assurance : la
 * question « qui peut voir mes papiers » se pose avant toutes les autres, et
 * ne pas y répondre, c'est laisser le visiteur y répondre seul.
 *
 * Chaque ligne renvoie à quelque chose que le code fait vraiment. Une
 * promesse de sécurité invérifiable coûterait plus cher que le silence.
 */
const PROTECTIONS = [
  {
    icone: Lock,
    titre: 'Vos documents ne sont jamais publics',
    texte:
      'Aucun fichier n’est accessible par une adresse devinable. Chaque ouverture passe par votre session, et vérifie que le document vous appartient.',
  },
  {
    icone: KeyRound,
    titre: 'Mot de passe jamais conservé en clair',
    texte:
      'Il est remplacé par une empreinte irréversible. Personne — nous compris — ne peut le relire.',
  },
  {
    icone: Smartphone,
    titre: 'Double authentification',
    texte:
      'Un code à usage unique en plus du mot de passe. Le secret qui produit ces codes est lui-même chiffré : une copie de la base ne permettrait pas d’en fabriquer.',
  },
  {
    icone: Link2,
    titre: 'Partages limités et révocables',
    texte:
      'Un lien expire au bout de 24 heures, 7 jours ou 30 jours. Vous voyez qui l’a ouvert, et vous le coupez quand vous voulez.',
  },
  {
    icone: FileCheck2,
    titre: 'Fichiers vérifiés au contenu',
    texte:
      'Le type annoncé ne décide de rien : c’est la signature du fichier qui tranche. Un programme renommé en « facture.pdf » est refusé.',
  },
  {
    icone: DatabaseBackup,
    titre: 'Sauvegarde chiffrée quotidienne',
    texte:
      'Vos données sont copiées chaque jour, chiffrées, et hébergées dans l’Union européenne.',
  },
]

function SectionSecurite() {
  // useEntree, et non useApparition : c'est le vocabulaire mvt-* qu'attend
  // la grille mvt-liste. Les deux jeux de classes ne se répondent pas.
  const { ref, classe } = useEntree<HTMLDivElement>()
  return (
    <section className="mx-auto max-w-5xl px-5 pb-16 sm:px-8">
      <p className="text-[11.5px] font-semibold tracking-wide text-brand-green uppercase">
        Ce qui protège vos papiers
      </p>
      <h2 className="font-heading mt-1.5 text-[22px] font-semibold text-brand-deep">
        Un coffre-fort, pas un dossier partagé
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-brand-muted">
        Vous y déposez des avis d’imposition, des contrats et des attestations. Voici ce qui
        les garde, sans jargon.
      </p>

      {/* Empilées sur téléphone : deux colonnes de 170 px hacheraient chaque
          explication en mots isolés. */}
      <div ref={ref} className={`mvt-liste mt-6 grid gap-3.5 sm:grid-cols-2 ${classe}`}>
        {PROTECTIONS.map(({ icone: Icone, titre, texte }, rang) => (
          <div
            key={titre}
            className="mvt-carte neon-carte rounded-[14px] border border-brand-border bg-white px-5 py-4.5"
            style={{ '--rang': rang } as CSSProperties}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-green-soft">
                <Icone size={17} className="text-brand-green-deep" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <h3 className="font-heading text-[14.5px] font-semibold text-brand-ink">
                  {titre}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-brand-muted">{texte}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Accueil() {
  useTitrePage(
    'SYNeco — Le coffre-fort administratif du particulier et de l’indépendant',
    'Photographiez un document : SYNeco le lit, repère son échéance et vous prévient avant qu’elle n’arrive. Gratuit jusqu’à 10 documents.',
  )

  return (
    <div className="min-h-screen bg-brand-mint">
      <header className="relative z-10 border-b border-brand-border/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 pt-[calc(0.875rem+var(--zone-sure-haut))] pb-3.5 sm:px-8">
          <BrandLogo iconSize={32} wordmarkClassName="text-base" />
          <div className="flex shrink-0 items-center gap-3">
            <Link
              to="/connexion"
              className="text-[13.5px] font-medium text-brand-muted hover:text-brand-green"
            >
              Se connecter
            </Link>
            <Link
              to="/inscription"
              className="brand-gradient rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-white"
            >
              Créer un compte
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <AmbientBackground variant="auth" />
        <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-10 px-5 pt-14 pb-16 sm:flex-row sm:items-center sm:px-8 sm:pt-20 sm:pb-20">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading max-w-3xl text-[30px] leading-[1.15] font-bold text-brand-deep sm:text-[44px]">
              Le coffre-fort administratif du particulier et de l’indépendant
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-brand-muted sm:text-[17px]">
              Photographiez un document : SYNeco le lit, repère son échéance et vous prévient
              avant qu’elle n’arrive. Vos contrats, factures et attestations au même endroit,
              consultables depuis votre téléphone.
            </p>

            {/* Sur téléphone les deux boutons s'empilent : côte à côte, leurs
                intitulés seraient tronqués. */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/inscription"
                className="brand-gradient flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold text-white"
              >
                Commencer gratuitement
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/connexion"
                className="flex items-center justify-center rounded-xl border border-brand-border bg-white px-5 py-3 text-[15px] font-semibold text-brand-deep hover:bg-white/70"
              >
                J’ai déjà un compte
              </Link>
            </div>
            <p className="mt-4 text-[13px] text-brand-muted">
              Sans carte bancaire · 10 documents offerts, toutes fonctions comprises
            </p>
          </div>

          <div className="flex justify-center sm:block">
            <HeroApercu />
          </div>
        </div>
      </section>

      <SectionDepotEmail />

      <SectionParcours />

      <section className="mx-auto max-w-5xl px-5 pb-16 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {ATOUTS.map((atout) => (
            <CaseAtout key={atout.titre} {...atout} />
          ))}
        </div>
      </section>

      <SectionIllustree
        illustration={IllustrationRangement}
        titre="Votre administratif, enfin au même endroit"
        texte="Vos papiers sont aujourd’hui répartis entre votre boîte mail, votre téléphone et un tiroir. SYNeco les réunit, et surtout les rend cherchables."
        points={[
          'Maison : électricité, assurance habitation, bail, garanties',
          'Personnel : mutuelle, assurance auto, impôts, contrats',
          'Famille : école, santé, documents des enfants',
        ]}
      />

      <SectionIllustree
        illustration={IllustrationPartageCible}
        titre="Le bon document, à la bonne personne"
        texte="Un lien plutôt qu’une pièce jointe qui traîne dans une boîte mail pendant des années. Vous voyez qui l’a ouvert, et vous pouvez le couper à tout moment."
        points={[
          'Un lien qui expire au bout de 24 heures, 7 jours ou 30 jours',
          'Chaque consultation horodatée, visible depuis votre espace',
          'Révocable d’un clic, sans avoir à demander la suppression du mail',
        ]}
        inverse
      />

      <SectionIllustree
        illustration={IllustrationDeuxUsages}
        titre="Le même outil, que vous soyez seul ou à votre compte"
        texte="Les papiers d’un foyer et ceux d’un indépendant se ressemblent plus qu’on ne croit : ils arrivent sans prévenir, et ils ont tous une date."
        points={[
          'Particulier : factures, assurances, garanties, justificatifs',
          'Indépendant : factures fournisseurs, devis, contrats, documents clients',
          'La facturation de vos propres clients s’ajoute avec l’offre Professionnelle',
        ]}
      />

      <section className="mx-auto max-w-5xl px-5 pb-16 sm:px-8">
        <h2 className="font-heading text-[22px] font-semibold text-brand-deep">
          Des offres lisibles
        </h2>
        <p className="mt-1.5 text-[13.5px] text-brand-muted">
          TVA non applicable, article 293 B du Code général des impôts : les prix affichés sont
          ceux réellement prélevés.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {OFFRES.map((offre) => (
            <div
              key={offre.nom}
              className={`mvt-carte neon-carte relative rounded-[14px] border px-5 py-5 ${
                offre.vedette
                  ? 'border-brand-green bg-brand-green-soft/40 shadow-[0_18px_40px_-24px_rgba(47,143,111,0.55)]'
                  : 'border-brand-border bg-white'
              }`}
            >
              {offre.vedette && (
                <span className="brand-gradient absolute -top-3 left-5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white">
                  Le plus choisi
                </span>
              )}
              <p className="text-[13px] font-semibold text-brand-muted">{offre.nom}</p>
              <p className="font-heading mt-1 text-[26px] font-semibold text-brand-ink">
                {offre.prix}
              </p>
              <p className="text-[12.5px] text-brand-muted">{offre.detail}</p>
              <ul className="mt-4 space-y-2">
                {offre.inclus.map((ligne) => (
                  <li key={ligne} className="flex items-start gap-2 text-[13px] text-brand-ink">
                    <Check size={14} className="mt-0.5 shrink-0 text-brand-green" />
                    <span className="min-w-0">{ligne}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <SectionSecurite />

      <section className="mx-auto max-w-5xl px-5 pb-16 sm:px-8">
        <div className="rounded-[14px] border border-brand-border bg-white px-5 py-5">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-green" />
            <div className="min-w-0">
              <h2 className="font-heading text-[15.5px] font-semibold text-brand-ink">
                Ce que SYNeco ne fait pas
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-muted">
                Aucun accès à vos comptes bancaires, aucune publicité, aucune revente de vos
                données. La base de données est hébergée dans l’Union européenne. Vous pouvez
                supprimer vos documents et votre compte à tout moment.{' '}
                <Link to="/confidentialite" className="font-medium text-brand-green hover:underline">
                  Politique de confidentialité
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-20 sm:px-8">
        <div className="brand-gradient rounded-[16px] px-6 py-8 text-center">
          <h2 className="font-heading text-[20px] font-semibold text-white sm:text-[24px]">
            Le premier document prend deux minutes
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[13.5px] leading-relaxed text-white/85">
            Photographiez une facture ou une attestation : vous verrez tout de suite ce que SYNeco
            en tire.
          </p>
          <Link
            to="/inscription"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[15px] font-semibold text-brand-deep"
          >
            Créer un compte gratuit
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-brand-border bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-6 text-[13px] text-brand-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} SYNeco — VincentLV</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/mentions-legales" className="hover:text-brand-green hover:underline">
              Mentions légales
            </Link>
            <Link to="/confidentialite" className="hover:text-brand-green hover:underline">
              Confidentialité
            </Link>
            <Link to="/cgv" className="hover:text-brand-green hover:underline">
              CGV
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
