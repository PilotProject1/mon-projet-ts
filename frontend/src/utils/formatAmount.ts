/**
 * Montant en euros, écrit à la française : « 128,40 € ».
 *
 * Les montants viennent tantôt d'un champ saisi, tantôt d'une lecture de
 * document — d'où la valeur inconnue acceptée en entrée plutôt qu'un nombre.
 */
export function formatAmount(value: unknown): string {
  const montant = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(montant)) return '—'
  return `${montant.toFixed(2).replace('.', ',')} €`
}
