/**
 * Prégénère une page HTML par prestataire, après `vite build`.
 *
 * Le site est une application à page unique et Vercel réécrit toute adresse
 * inconnue vers index.html. Sans ce script, /resilier/maif serait donc servi
 * avec le titre et la description de la page d'accueil : c'est le code
 * JavaScript qui les corrige une fois chargé, ce qui ne suffit pas. Les
 * aperçus de liens (LinkedIn, WhatsApp, Slack) n'exécutent aucun script, et
 * un moteur de recherche indexe d'abord ce qu'on lui sert.
 *
 * Vercel donne la priorité à un fichier existant sur une réécriture : écrire
 * dist/resilier/maif/index.html suffit donc à le servir tel quel, puis
 * l'application reprend la main normalement.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = join(ICI, '..')
const DIST = join(RACINE, 'dist')
const SITE = 'https://syneco.pro'

/*
 * Les données vivent dans un module TypeScript, que Node ne sait pas charger
 * tel quel. Plutôt qu'ajouter une étape de compilation pour une liste, on
 * lit le fichier et on en extrait les entrées : la source reste unique, et
 * une divergence entre la liste affichée et la liste prégénérée devient
 * impossible.
 */
function lirePrestataires() {
  const source = readFileSync(join(RACINE, 'src/data/prestataires.ts'), 'utf8')
  const bloc = source.match(/export const PRESTATAIRES[^=]*=\s*\[([\s\S]*?)\n\]/)
  if (!bloc) throw new Error('Liste PRESTATAIRES introuvable')
  const entrees = [...bloc[1].matchAll(
    /\{\s*slug:\s*'([^']+)',\s*nom:\s*'([^']+)',\s*secteur:\s*'([^']+)'\s*\}/g,
  )]
  if (entrees.length === 0) throw new Error('Aucun prestataire reconnu')
  return entrees.map(([, slug, nom, secteur]) => ({ slug, nom, secteur }))
}

function lireContrats() {
  const source = readFileSync(join(RACINE, 'src/data/prestataires.ts'), 'utf8')
  const contrats = {}
  for (const [, secteur, contrat] of source.matchAll(
    /(assurance|telecom|energie):\s*\{\s*\n\s*contrat:\s*'([^']+)'/g,
  )) {
    contrats[secteur] = contrat
  }
  return contrats
}

/** Échappe ce qui part dans un attribut HTML. */
function attr(valeur) {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const gabarit = readFileSync(join(DIST, 'index.html'), 'utf8')
const prestataires = lirePrestataires()
const contrats = lireContrats()

for (const p of prestataires) {
  const contrat = contrats[p.secteur] ?? 'contrat'
  const titre = `Résilier ${p.nom} : lettre de résiliation gratuite | SYNeco`
  const description =
    `Résilier votre ${contrat} ${p.nom} : déposez le document, SYNeco y lit la date ` +
    `qui compte et rédige votre lettre. Gratuit, sans inscription.`
  const url = `${SITE}/resilier/${p.slug}`

  const html = gabarit
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${attr(titre)}</title>`)
    .replace(
      /(<meta\s+name="description"\s+content=")[\s\S]*?(")/,
      `$1${attr(description)}$2`,
    )
    .replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
      `$1${attr(url)}$2`,
    )
    .replace(
      /(<meta\s+property="og:title"\s*\n?\s*content=")[\s\S]*?(")/,
      `$1${attr(titre)}$2`,
    )
    .replace(
      /(<meta\s+property="og:description"\s*\n?\s*content=")[\s\S]*?(")/,
      `$1${attr(description)}$2`,
    )
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${attr(url)}$2`)

  const dossier = join(DIST, 'resilier', p.slug)
  mkdirSync(dossier, { recursive: true })
  writeFileSync(join(dossier, 'index.html'), html)
}

/* Le plan du site est réécrit avec les pages prégénérées : les déclarer sans
   les servir, ou l'inverse, revient à se contredire vis-à-vis des moteurs. */
const chemin = join(DIST, 'sitemap.xml')
const plan = readFileSync(chemin, 'utf8')
const ajouts = prestataires
  .map(
    (p) =>
      `  <url>\n    <loc>${SITE}/resilier/${p.slug}</loc>\n` +
      `    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
  )
  .join('\n')
writeFileSync(chemin, plan.replace('</urlset>', `${ajouts}\n</urlset>`))

console.log(
  `Prégénéré ${prestataires.length} pages de résiliation + plan du site mis à jour.`,
)
