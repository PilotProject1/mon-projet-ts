import { ShieldCheck } from 'lucide-react'
import DoubleAuthentification from '../components/DoubleAuthentification'
import { useTitrePage } from '../utils/useTitrePage'

/*
 * La sécurité du compte, à un endroit qui porte ce nom.
 *
 * La double authentification se réglait jusqu'ici depuis la page Abonnement,
 * au milieu de la facturation. Personne ne cherche à protéger son compte dans
 * une page de paiement — la politique de confidentialité devait d'ailleurs
 * préciser « depuis la page Abonnement », ce qui disait assez la gêne.
 *
 * Une protection qu'on ne trouve pas ne protège personne. Elle a donc sa
 * propre entrée, au même rang que le reste.
 */
export default function Securite() {
  useTitrePage('Sécurité — SYNeco')

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="font-heading text-[28px] font-semibold text-brand-deep">Sécurité</h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          Ce qui protège l’accès à vos documents.
        </p>
      </div>

      <DoubleAuthentification />

      <div className="neon-carte mt-4 rounded-[14px] border border-brand-border bg-white px-5 py-5">
        <div className="flex items-start gap-2.5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-green" />
          <div className="min-w-0">
            <h2 className="font-heading text-[15.5px] font-semibold text-brand-ink">
              Ce qui s’applique déjà, sans rien régler
            </h2>
            {/* Chaque ligne renvoie à un comportement réel du serveur. Rien
                n'est annoncé ici qui ne soit vérifiable dans le code. */}
            <ul className="mt-2 space-y-1.5 text-[13.5px] leading-relaxed text-brand-muted">
              <li>
                Vos documents ne sont jamais accessibles par une adresse publique : chaque
                ouverture passe par votre session et vérifie qu’ils vous appartiennent.
              </li>
              <li>
                Votre mot de passe n’est pas conservé en clair, mais sous forme d’empreinte
                irréversible.
              </li>
              <li>
                Les liens de partage expirent, se révoquent d’un clic, et chaque consultation
                est horodatée.
              </li>
              <li>
                Une sauvegarde chiffrée de vos données est effectuée chaque jour, dans l’Union
                européenne.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
