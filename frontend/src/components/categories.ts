import { Home, User, Users } from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'
import type { DocumentCategory } from '../types'

/*
 * Les trois pans de vie, décrits une seule fois.
 *
 * La page d'accueil promet ce rangement depuis longtemps — « Maison :
 * électricité, assurance habitation, bail », « Famille : école, santé,
 * documents des enfants » — sans que rien n'existe derrière. Ce fichier est
 * l'endroit unique où ces trois cases sont définies : leur intitulé, leur
 * couleur et leur icône. Les redéclarer dans chaque écran, c'est se garantir
 * qu'ils finiront par diverger.
 *
 * Les couleurs sont celles de la charte, prises dans les jetons existants —
 * aucune teinte inventée pour l'occasion.
 */

export interface DescriptionCategorie {
  cle: DocumentCategory
  libelle: string
  /** Ce que la case contient, dans les mots de la page d'accueil. */
  exemples: string
  icone: ComponentType<{
    size?: number
    className?: string
    strokeWidth?: number
    /** La couleur se pose parfois en ligne, la teinte n'étant connue qu'ici. */
    style?: CSSProperties
  }>
  /** Teinte d'accompagnement, en dur : elle sert aussi aux halos en CSS. */
  teinte: string
}

export const CATEGORIES: DescriptionCategorie[] = [
  {
    cle: 'maison',
    libelle: 'Maison',
    exemples: 'électricité, assurance habitation, bail, garanties',
    icone: Home,
    teinte: '#12514F',
  },
  {
    cle: 'personnel',
    libelle: 'Personnel',
    exemples: 'mutuelle, assurance auto, impôts, contrats',
    icone: User,
    teinte: '#2F8F6F',
  },
  {
    cle: 'famille',
    libelle: 'Famille',
    exemples: 'école, santé, documents des enfants',
    icone: Users,
    teinte: '#C98A3E',
  },
]

/** Retrouve une case par sa clé, ou rien si le document n'est pas rangé. */
export function categorie(cle: DocumentCategory | null): DescriptionCategorie | null {
  return CATEGORIES.find((c) => c.cle === cle) ?? null
}
