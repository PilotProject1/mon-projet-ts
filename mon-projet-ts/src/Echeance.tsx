interface EcheanceProps {
  texte: string
  onSupprimer: () => void
}

function Echeance({ texte, onSupprimer }: EcheanceProps) {
  return (
    <li>
      {texte}
      <button onClick={onSupprimer}>Supprimer</button>
    </li>
  )
}

export default Echeance