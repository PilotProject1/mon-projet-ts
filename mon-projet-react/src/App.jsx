import { useState } from 'react'
import Echeance from './Echeance'
import './App.css'

function App() {
  const [echeances, setEcheances] = useState([])
  const [texte, setTexte] = useState('')

  function ajouterEcheance() {
    if (texte !== '') {
      setEcheances([...echeances, texte])
      setTexte('')
    }
  }

  function supprimerEcheance(index) {
    const nouvelleListe = echeances.filter((_, i) => i !== index)
    setEcheances(nouvelleListe)
  }

  return (
    <div>
      <h1>Mes échéances</h1>

      <input
        type="text"
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        placeholder="Nom de l'échéance"
      />
      <button onClick={ajouterEcheance}>Ajouter</button>

      <ul>
        {echeances.map((echeance, index) => (
          <Echeance
            key={index}
            texte={echeance}
            onSupprimer={() => supprimerEcheance(index)}
          />
        ))}
      </ul>
    </div>
  )
}

export default App