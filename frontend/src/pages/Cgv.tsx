import { Link } from 'react-router-dom'
import LegalPageShell from '../components/LegalPageShell'

export default function Cgv() {
  return (
    <LegalPageShell title="Conditions générales de vente" lastUpdated="16 août 2026">
      <p>
        Les présentes conditions régissent la souscription aux offres payantes de SYNeco. Elles
        s'appliquent à compter de leur acceptation lors de la commande, et complètent les{' '}
        <Link to="/mentions-legales">mentions légales</Link> et la{' '}
        <Link to="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>1. Vendeur</h2>
      <p>
        Le service est vendu par <strong>Monsieur Loïc Vincent</strong>, entrepreneur individuel
        exerçant sous le nom commercial VincentLV, 9 rue Poincaré, 57240 Nilvange, France — SIREN
        941 471 112, immatriculé au Registre national des entreprises. Contact :{' '}
        <a href="mailto:syneco.pro@outlook.fr">syneco.pro@outlook.fr</a> — 06 74 33 74 99.
      </p>

      <h2>2. Objet du service</h2>
      <p>
        SYNeco est une application accessible en ligne permettant de conserver des documents
        administratifs, d'en extraire des informations et de suivre leurs échéances. Le service est
        fourni à distance, sans installation ni support matériel.
      </p>
      <p>
        Il constitue une aide à l'organisation. Les informations extraites automatiquement sont
        indicatives et ne dispensent pas de consulter les documents d'origine ; les rappels ne
        garantissent pas qu'une échéance sera respectée.
      </p>
      <p>
        Les dépenses présentées comme récurrentes, leur périodicité et les montants annuels associés
        sont des estimations calculées à partir des seuls documents déposés par l'utilisateur.
        SYNeco n'a accès à aucun compte bancaire et ne constate aucun prélèvement : ces indications
        ne remplacent ni un relevé bancaire ni un décompte du fournisseur.
      </p>

      <h2>3. Offres et tarifs</h2>
      <table>
        <thead>
          <tr>
            <th>Offre</th>
            <th>Prix mensuel</th>
            <th>Contenu</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Gratuit</td>
            <td>0 €</td>
            <td>Jusqu'à 10 documents, échéances, rappels et dépenses récurrentes</td>
          </tr>
          <tr>
            <td>Particulier Premium</td>
            <td>4,99 €</td>
            <td>
              Documents illimités, assistant d'analyse automatique, recherche en langage naturel,
              partage sécurisé
            </td>
          </tr>
          <tr>
            <td>Professionnel</td>
            <td>19,99 €</td>
            <td>
              Offre Premium, complétée de la gestion d'entreprise, des clients et des factures
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>TVA non applicable, article 293 B du Code général des impôts.</strong> Les prix
        indiqués sont nets : aucune taxe ne s'ajoute au montant affiché, qui est celui réellement
        prélevé.
      </p>
      <p>
        Les fichiers déposés sont limités à 10 Mo par document, aux formats PDF, JPEG, PNG et WEBP.
      </p>

      <h2>4. Commande</h2>
      <p>
        La souscription suppose un compte SYNeco. Elle s'effectue depuis la page Abonnement, par
        sélection d'une offre puis paiement. Le récapitulatif affiché avant validation indique
        l'offre, son prix et sa périodicité ; la commande n'est ferme qu'après confirmation du
        paiement.
      </p>

      <h2>5. Paiement</h2>
      <p>
        Les paiements sont traités par <strong>Stripe Payments Europe, Ltd.</strong> SYNeco n'a
        jamais accès à vos données bancaires et n'en conserve aucune.
      </p>
      <p>
        L'abonnement est prélevé d'avance, à la souscription puis à chaque échéance mensuelle. En cas
        d'échec de paiement, l'accès aux fonctionnalités payantes est suspendu et le compte revient à
        l'offre gratuite ; les documents déjà déposés restent accessibles dans la limite de cette
        offre.
      </p>

      <h2>6. Durée et reconduction</h2>
      <p>
        L'abonnement est conclu pour un mois, <strong>reconduit tacitement</strong> chaque mois à sa
        date anniversaire, sans engagement de durée.
      </p>

      <h2>7. Résiliation</h2>
      <p>
        Vous pouvez résilier à tout moment, directement depuis la page Abonnement, rubrique « Gérer
        mon abonnement ». Aucune démarche écrite n'est nécessaire et aucun motif n'est demandé.
      </p>
      <p>
        La résiliation prend effet <strong>à la fin de la période déjà payée</strong> : l'accès est
        conservé jusqu'à cette date, puis le compte revient à l'offre gratuite. Aucun prélèvement
        n'intervient ensuite.
      </p>
      <p>
        Conformément à l'article L. 215-1 du Code de la consommation, vous êtes informé de la date de
        reconduction, affichée sur la page Abonnement.
      </p>

      <h2>8. Droit de rétractation</h2>
      <p>
        Vous disposez d'un délai de <strong>quatorze jours</strong> à compter de la souscription pour
        vous rétracter, sans motif ni pénalité, par simple message à{' '}
        <a href="mailto:syneco.pro@outlook.fr">syneco.pro@outlook.fr</a>.
      </p>
      <p>
        Le service étant fourni immédiatement après le paiement, vous demandez expressément son
        exécution avant l'expiration de ce délai et reconnaissez, en cochant la case prévue lors de
        la commande, <strong>perdre votre droit de rétractation une fois le service pleinement
        exécuté</strong>, conformément aux articles L. 221-25 et L. 221-28 du Code de la
        consommation. Si vous vous rétractez alors que le service a été partiellement fourni, le
        montant dû est calculé au prorata de la période utilisée.
      </p>

      <h2>9. Disponibilité</h2>
      <p>
        Le vendeur met en œuvre les moyens raisonnables pour assurer l'accessibilité du service, sans
        garantir une disponibilité ininterrompue. Des interruptions peuvent survenir pour
        maintenance, en cas de défaillance d'un prestataire technique ou de force majeure.
      </p>

      <h2>10. Obligations de l'utilisateur</h2>
      <ul>
        <li>Fournir des informations exactes lors de la création du compte ;</li>
        <li>Préserver la confidentialité de ses identifiants ;</li>
        <li>
          Ne déposer que des documents dont il détient les droits, à l'exclusion de tout contenu
          illicite ;
        </li>
        <li>
          Informer les personnes dont il enregistre les données lorsqu'il utilise le module de
          facturation.
        </li>
      </ul>

      <h2>11. Garantie légale de conformité</h2>
      <p>
        Le service est fourni conformément aux articles L. 224-25-12 et suivants du Code de la
        consommation, qui garantissent sa conformité pendant toute la durée de fourniture. En cas de
        défaut de conformité, vous pouvez en exiger la mise en conformité et, à défaut, obtenir une
        réduction du prix ou la résolution du contrat. Cette garantie s'applique indépendamment des
        présentes conditions.
      </p>

      <h2>12. Responsabilité</h2>
      <p>
        Le vendeur répond des dommages résultant d'un manquement à ses obligations. Il ne saurait en
        revanche être tenu responsable des conséquences d'informations erronées saisies par
        l'utilisateur, ni de l'usage qu'il fait des documents conservés. Les présentes limitations
        s'appliquent dans les limites permises par la loi et ne privent pas le consommateur des
        droits qu'il tient du Code de la consommation.
      </p>

      <h2>13. Suspension par le vendeur</h2>
      <p>
        En cas de manquement grave, notamment de dépôt de contenus illicites, l'accès peut être
        suspendu après information de l'utilisateur, sauf urgence ou obligation légale contraire.
      </p>

      <h2>14. Données personnelles</h2>
      <p>
        Les traitements réalisés sont décrits dans la{' '}
        <Link to="/confidentialite">politique de confidentialité</Link>. La suppression du compte
        entraîne l'effacement définitif des documents et données associées.
      </p>

      <h2>15. Modification des conditions et des prix</h2>
      <p>
        Les présentes conditions peuvent évoluer. Toute modification substantielle, ainsi que toute
        évolution tarifaire, est communiquée au moins <strong>trente jours</strong> avant son entrée
        en vigueur. Vous pouvez alors résilier sans frais avant cette date ; le tarif en cours reste
        appliqué jusqu'à l'échéance déjà payée.
      </p>

      <h2>16. Réclamations et médiation</h2>
      <p>
        Toute réclamation peut être adressée à{' '}
        <a href="mailto:syneco.pro@outlook.fr">syneco.pro@outlook.fr</a>. En l'absence de solution
        dans un délai de deux mois, vous pouvez recourir gratuitement à un médiateur de la
        consommation :
      </p>
      <p>
        L'éditeur procède actuellement à son adhésion auprès du CM2C (Centre de la médiation de la
        consommation de conciliateurs de justice). Les coordonnées du médiateur seront publiées ici
        dès qu'elle sera effective, courant septembre 2026. Dans l'intervalle, toute réclamation
        restée sans solution peut être adressée à{' '}
        <a href="mailto:syneco.pro@outlook.fr">syneco.pro@outlook.fr</a>, et vous conservez
        l'intégralité des voies de recours ci-dessous.
      </p>
      <p>
        La plateforme européenne de règlement en ligne des litiges est également accessible à
        l'adresse{' '}
        <a href="https://consumer-redress.ec.europa.eu" target="_blank" rel="noopener noreferrer">
          consumer-redress.ec.europa.eu
        </a>
        .
      </p>

      <h2>17. Droit applicable</h2>
      <p>
        Les présentes conditions sont soumises au droit français. À défaut de résolution amiable, les
        tribunaux français sont compétents, le consommateur pouvant saisir la juridiction de son lieu
        de résidence.
      </p>
    </LegalPageShell>
  )
}
