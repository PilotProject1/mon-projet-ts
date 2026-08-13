import { Link } from 'react-router-dom'
import LegalPageShell, { ARemplir } from '../components/LegalPageShell'

export default function MentionsLegales() {
  return (
    <LegalPageShell title="Mentions légales" lastUpdated="13 août 2026">
      <h2>1. Éditeur du site</h2>
      <p>
        Le site SYNeco est édité par <ARemplir>prénom et nom, ou dénomination sociale</ARemplir>,{' '}
        <ARemplir>forme juridique, ex. entrepreneur individuel</ARemplir>, dont le siège est situé{' '}
        <ARemplir>adresse complète du siège</ARemplir>.
      </p>
      <table>
        <tbody>
          <tr>
            <th>SIREN</th>
            <td>
              <ARemplir>numéro SIREN à 9 chiffres</ARemplir>
            </td>
          </tr>
          <tr>
            <th>SIRET (siège)</th>
            <td>
              <ARemplir>numéro SIRET à 14 chiffres</ARemplir>
            </td>
          </tr>
          <tr>
            <th>Immatriculation</th>
            <td>
              <ARemplir>RCS de [ville] si activité commerciale, sinon RNE</ARemplir>
            </td>
          </tr>
          <tr>
            <th>TVA intracommunautaire</th>
            <td>
              <ARemplir>
                numéro de TVA, ou « TVA non applicable, article 293 B du CGI » en franchise
              </ARemplir>
            </td>
          </tr>
          <tr>
            <th>Téléphone</th>
            <td>
              <ARemplir>numéro de téléphone</ARemplir>
            </td>
          </tr>
          <tr>
            <th>E-mail</th>
            <td>
              <ARemplir>adresse e-mail de contact</ARemplir>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Directeur de la publication : <ARemplir>prénom et nom</ARemplir>.
      </p>
      <p>
        Ces informations sont publiées en application de l'article 6 III-1 de la loi n° 2004-575 du
        21 juin 2004 pour la confiance dans l'économie numérique, qui impose à tout éditeur
        professionnel de se rendre identifiable auprès du public.
      </p>

      <h2>2. Hébergement</h2>
      <p>
        Le site s'appuie sur les prestataires suivants. Les coordonnées complètes de chacun sont à
        reprendre depuis leurs propres mentions légales, afin qu'elles restent exactes dans le temps.
      </p>
      <table>
        <thead>
          <tr>
            <th>Rôle</th>
            <th>Prestataire</th>
            <th>Coordonnées</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Hébergement du site</td>
            <td>Vercel Inc. (États-Unis)</td>
            <td>
              <ARemplir>adresse postale</ARemplir>
            </td>
          </tr>
          <tr>
            <td>Hébergement du serveur applicatif</td>
            <td>
              <ARemplir>Render, Railway ou autre</ARemplir>
            </td>
            <td>
              <ARemplir>adresse postale</ARemplir>
            </td>
          </tr>
          <tr>
            <td>Base de données</td>
            <td>
              <ARemplir>Neon, Supabase ou autre</ARemplir>
            </td>
            <td>
              <ARemplir>adresse postale</ARemplir>
            </td>
          </tr>
        </tbody>
      </table>

      <h2>3. Propriété intellectuelle</h2>
      <p>
        La structure du site, son identité visuelle, ses textes et son code source sont la propriété
        de l'éditeur, sauf mention contraire. Toute reproduction ou représentation, totale ou
        partielle, sans autorisation préalable est interdite.
      </p>
      <p>
        Les documents que vous déposez sur SYNeco vous appartiennent. L'éditeur ne revendique aucun
        droit de propriété sur ces contenus et ne les exploite à aucune autre fin que la fourniture
        du service.
      </p>

      <h2>4. Responsabilité</h2>
      <p>
        SYNeco est un outil d'organisation documentaire. Les informations qu'il extrait
        automatiquement des documents (dates, montants, échéances) sont fournies à titre indicatif et
        peuvent comporter des erreurs : elles ne remplacent pas la lecture du document d'origine et
        il vous appartient de les vérifier. Les rappels constituent une aide et ne garantissent pas
        qu'une échéance sera respectée.
      </p>
      <p>
        L'éditeur reste tenu des obligations prévues par la loi, notamment en matière de conformité
        du service et de protection des données. Les limitations énoncées ci-dessus s'appliquent dans
        les limites permises par la réglementation et ne privent pas le consommateur des droits qu'il
        tient du Code de la consommation.
      </p>
      <p>
        L'éditeur s'efforce d'assurer la disponibilité du service sans pouvoir la garantir, notamment
        en cas de maintenance, de panne d'un prestataire ou de force majeure.
      </p>

      <h2>5. Données personnelles</h2>
      <p>
        Le traitement de vos données est détaillé dans la{' '}
        <Link to="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>6. Contact</h2>
      <p>
        Pour toute question relative au site : <ARemplir>adresse e-mail de contact</ARemplir>.
      </p>
    </LegalPageShell>
  )
}
