import { Link } from 'react-router-dom'
import LegalPageShell, { ARemplir } from '../components/LegalPageShell'

export default function Confidentialite() {
  return (
    <LegalPageShell title="Politique de confidentialité" lastUpdated="16 août 2026">
      <p>
        SYNeco sert à centraliser des documents personnels (contrats, factures, assurances) et à en
        suivre les échéances. Ces documents sont sensibles par nature : cette page décrit précisément
        ce qui est collecté, pourquoi, où cela est stocké et ce que vous pouvez exiger à tout moment.
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement est <strong>Monsieur Loïc Vincent</strong>, entrepreneur
        individuel exerçant sous le nom commercial VincentLV, immatriculé sous le numéro SIREN
        941 471 112, dont le siège est situé 9 rue Poincaré, 57240 Nilvange, France, joignable à{' '}
        <a href="mailto:syneco.pro@outlook.fr">syneco.pro@outlook.fr</a> ou au 06 74 33 74 99.
      </p>
      <p>
        Aucun délégué à la protection des données n'a été désigné, cette désignation n'étant pas
        obligatoire au regard de l'activité exercée. Les demandes relatives aux données personnelles
        sont à adresser directement au responsable du traitement.
      </p>

      <h2>2. Données collectées</h2>
      <p>SYNeco ne collecte que les données nécessaires à son fonctionnement :</p>
      <table>
        <thead>
          <tr>
            <th>Catégorie</th>
            <th>Données concernées</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Compte</td>
            <td>
              Adresse e-mail, nom, mot de passe (stocké uniquement sous forme d'empreinte chiffrée,
              jamais en clair), date de création
            </td>
          </tr>
          <tr>
            <td>Documents</td>
            <td>
              Le fichier lui-même et son contenu, son nom, son type, son format, sa taille et sa date
              d'ajout. À la lecture automatique s'ajoutent, enregistrés dans la base de données, le
              texte lu dans le document (tronqué à 20 000 caractères) ainsi que l'émetteur, le
              montant et la date qui y ont été reconnus
            </td>
          </tr>
          <tr>
            <td>Échéances</td>
            <td>Intitulé, date d'échéance, statut, document associé</td>
          </tr>
          <tr>
            <td>Contrats</td>
            <td>Fournisseur, dates de début et de fin, montant, mode de reconduction</td>
          </tr>
          <tr>
            <td>Entreprise et facturation (optionnel)</td>
            <td>
              Nom et informations légales de votre entreprise, coordonnées de vos clients (nom,
              e-mail, téléphone), factures émises
            </td>
          </tr>
          <tr>
            <td>Partages</td>
            <td>
              Liens de partage créés, leur date d'expiration, et un journal des consultations (date
              et heure de chaque accès)
            </td>
          </tr>
          <tr>
            <td>Notifications</td>
            <td>Rappels d'échéance générés, leur statut et leur date de lecture</td>
          </tr>
          <tr>
            <td>Données techniques</td>
            <td>
              Journaux serveur (route appelée, code de réponse, durée), conservés à des fins de
              sécurité et de diagnostic
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Aucun profilage publicitaire n'est réalisé et vos données ne sont ni vendues ni cédées à des
        tiers à des fins commerciales.
      </p>

      <h2>3. Finalités et bases légales</h2>
      <table>
        <thead>
          <tr>
            <th>Finalité</th>
            <th>Base légale</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Créer et gérer votre compte, fournir le service</td>
            <td>Exécution du contrat</td>
          </tr>
          <tr>
            <td>Stocker vos documents et vous alerter des échéances</td>
            <td>Exécution du contrat</td>
          </tr>
          <tr>
            <td>Sécuriser le service, prévenir les abus, diagnostiquer les pannes</td>
            <td>Intérêt légitime</td>
          </tr>
          <tr>
            <td>Respecter nos obligations légales et comptables</td>
            <td>Obligation légale</td>
          </tr>
        </tbody>
      </table>

      <h2>4. Analyse automatisée des documents</h2>
      <p>
        Lorsque la fonctionnalité d'assistance par intelligence artificielle est activée, deux
        traitements font appel à un prestataire externe, <strong>Anthropic PBC</strong> (États-Unis),
        éditeur du modèle Claude :
      </p>
      <ul>
        <li>
          <strong>Extraction automatique à l'ajout d'un document</strong> : le texte du document
          (limité à ses premiers milliers de caractères) est transmis afin d'en déduire le type, le
          fournisseur, les dates et les montants.
        </li>
        <li>
          <strong>Recherche en langage naturel</strong> : votre question ainsi qu'un catalogue de vos
          données (noms de documents, émetteurs, montants et dates lus dans vos documents, intitulés
          d'échéances, fournisseurs et montants de contrats, numéros de factures et noms de clients)
          sont transmis pour produire une réponse. Lorsque les mots de votre question figurent dans
          le texte lu d'un document, le passage correspondant — environ quatre cents caractères
          autour de ces mots — est joint à la demande.
        </li>
      </ul>
      <p>
        Ces données ne sont pas utilisées pour entraîner des modèles. Ces traitements n'ont pas
        d'effet juridique automatique : les informations extraites sont des suggestions, que vous
        pouvez corriger ou refuser. Si la fonctionnalité n'est pas activée, aucune donnée n'est
        transmise à ce prestataire et l'application bascule sur une analyse locale.
      </p>

      <h2>5. Photographie d'un document</h2>
      <p>
        L'application permet de photographier un document, dont les bords sont alors détectés,
        l'image redressée et l'éclairage corrigé. <strong>Ce traitement s'effectue entièrement sur votre
        appareil</strong>, dans le navigateur. La photo d'origine n'est jamais transmise : seule
        l'image nettoyée est déposée, et elle suit ensuite le même parcours que n'importe quel
        fichier ajouté manuellement.
      </p>
      <p>
        L'accès à l'appareil photo relève de l'autorisation que vous accordez à votre navigateur ou
        à votre système. Il n'est demandé qu'au moment où vous choisissez de prendre une photo,
        aucune capture n'a lieu en dehors de cette action, et le refuser laisse le dépôt de fichiers
        pleinement utilisable.
      </p>

      <h2>6. Rappels d'échéance</h2>
      <p>
        Lorsqu'une échéance approche, un rappel est créé dans l'application et, si vous ne l'avez
        pas désactivé, envoyé à votre adresse e-mail — trente jours, sept jours et un jour avant
        l'échéance, puis le jour même. L'e-mail contient l'intitulé de l'échéance et sa date ; il
        ne contient jamais le document lui-même.
      </p>
      <p>
        Ce traitement repose sur l'exécution du contrat : il constitue la raison d'être du service.
        Vous pouvez néanmoins <strong>désactiver les rappels par e-mail à tout moment</strong>,
        depuis la page Échéances ; le lien figure également au bas de chaque message. Les rappels
        restent alors consultables dans l'application.
      </p>
      <p>
        Si vous l'autorisez, le rappel peut également s'afficher <strong>directement sur l'écran de
        votre appareil</strong>. L'autorisation est demandée appareil par appareil et n'est jamais
        présumée : sans elle, rien n'est enregistré et rien n'est envoyé. Nous conservons alors
        l'adresse technique fournie par votre navigateur et les clés de chiffrement associées, sans
        aucun autre identifiant d'appareil. Désactiver l'option supprime cet enregistrement, et un
        appareil qui se désabonne est retiré automatiquement.
      </p>
      <p>
        Le contenu de ces notifications est <strong>chiffré</strong> : le service de notification de
        votre navigateur l'achemine sans pouvoir le lire.
      </p>

      <h2>7. Destinataires et sous-traitants</h2>
      <p>
        Vos données ne sont accessibles qu'à vous. Elles transitent toutefois par les prestataires
        techniques nécessaires au fonctionnement du service :
      </p>
      <table>
        <thead>
          <tr>
            <th>Prestataire</th>
            <th>Rôle</th>
            <th>Localisation</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Vercel Inc.</td>
            <td>Hébergement de l'interface</td>
            <td>États-Unis</td>
          </tr>
          <tr>
            <td>Render Services, Inc.</td>
            <td>Hébergement du serveur applicatif</td>
            <td>
              <ARemplir>région du service Render</ARemplir>
            </td>
          </tr>
          <tr>
            <td>Neon Inc.</td>
            <td>Base de données (comptes, échéances, contrats, métadonnées)</td>
            <td>Union européenne — Francfort (AWS eu-central-1)</td>
          </tr>
          <tr>
            <td>Cloudflare, Inc. (service R2)</td>
            <td>Stockage des fichiers que vous déposez</td>
            <td>Union européenne (juridiction européenne)</td>
          </tr>
          <tr>
            <td>Anthropic PBC</td>
            <td>Analyse documentaire et recherche (si activée)</td>
            <td>États-Unis</td>
          </tr>
          <tr>
            <td>
              <ARemplir>expéditeur d'e-mails retenu</ARemplir>
            </td>
            <td>Acheminement des rappels d'échéance par e-mail</td>
            <td>
              <ARemplir>localisation de l'expéditeur d'e-mails</ARemplir>
            </td>
          </tr>
          <tr>
            <td>Éditeur de votre navigateur (Google, Mozilla, Apple, Microsoft)</td>
            <td>
              Acheminement des notifications affichées sur votre appareil, si vous les avez
              autorisées — le contenu leur est illisible
            </td>
            <td>Selon le navigateur utilisé</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>La base de données est hébergée dans l'Union européenne</strong>, à Francfort : vos
        comptes, échéances, contrats et métadonnées de documents ne quittent pas le territoire
        européen au repos.
      </p>
      <p>
        <strong>Vos documents sont eux aussi conservés dans l'Union européenne.</strong> Le stockage
        est configuré sous juridiction européenne : notre prestataire s'engage à ne les placer que
        dans des centres de données situés sur ce territoire.
      </p>
      <p>
        Certains prestataires restent toutefois établis aux États-Unis, et l'assistant IA y transmet
        des données lorsqu'il est activé. Ces transferts s'effectuent sur la base des clauses
        contractuelles types de la Commission européenne ou d'un mécanisme d'adéquation équivalent.
      </p>

      <h2>8. Données de vos propres clients</h2>
      <p>
        Si vous utilisez le module de facturation, vous enregistrez des données concernant vos
        clients. Pour ces données, <strong>vous êtes responsable du traitement</strong> et SYNeco
        agit comme sous-traitant : il vous appartient d'informer vos clients et de disposer d'une
        base légale pour enregistrer leurs coordonnées.
      </p>

      <h2>9. Durée de conservation</h2>
      <ul>
        <li>
          <strong>Données de compte, documents et données associées</strong> : conservés tant que
          votre compte existe.
        </li>
        <li>
          <strong>Après suppression du compte</strong> : l'ensemble de vos documents, échéances,
          contrats, partages, factures et notifications est supprimé automatiquement et de façon
          définitive.
        </li>
        <li>
          <strong>Journaux techniques</strong> : 12 mois au maximum.
        </li>
        <li>
          <strong>Sauvegardes</strong> : les sauvegardes de la base de données peuvent conserver vos
          données pendant <ARemplir>durée de rétention des sauvegardes</ARemplir> avant rotation.
        </li>
      </ul>

      <h2>10. Vos droits</h2>
      <p>
        Conformément au Règlement général sur la protection des données, vous disposez des droits
        d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos
        données, ainsi que du droit de définir des directives relatives à leur sort après votre
        décès.
      </p>
      <p>
        Une partie de ces droits s'exerce directement depuis l'application : vous pouvez consulter,
        modifier et supprimer vos documents et vos données à tout moment. Pour toute autre demande,
        écrivez à <a href="mailto:syneco.pro@outlook.fr">syneco.pro@outlook.fr</a>. Une réponse vous
        sera apportée dans
        un délai maximum d'un mois.
      </p>
      <p>
        Si vous estimez, après nous avoir contactés, que vos droits ne sont pas respectés, vous
        pouvez adresser une réclamation à la CNIL (3 place de Fontenoy, TSA 80715, 75334 Paris Cedex
        07 —{' '}
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
          www.cnil.fr
        </a>
        ).
      </p>

      <h2>11. Cookies et traceurs</h2>
      <p>
        SYNeco n'utilise <strong>aucun cookie publicitaire ni outil de mesure d'audience</strong>.
        Votre session est maintenue au moyen de jetons d'authentification stockés localement dans
        votre navigateur, strictement nécessaires au fonctionnement du service. À ce titre, ils sont
        dispensés de consentement préalable et aucune bannière de cookies n'est nécessaire.
      </p>
      <p>Ces jetons sont effacés lorsque vous vous déconnectez.</p>

      <h2>12. Sécurité</h2>
      <ul>
        <li>Les échanges entre votre navigateur et le service sont chiffrés (HTTPS).</li>
        <li>
          Les mots de passe ne sont jamais stockés en clair, mais sous forme d'empreinte
          cryptographique irréversible.
        </li>
        <li>
          Chaque requête est contrôlée pour garantir qu'un utilisateur ne peut accéder qu'à ses
          propres données.
        </li>
        <li>
          Les liens de partage sont limités dans le temps, révocables à tout moment, et leurs accès
          sont journalisés.
        </li>
      </ul>

      <h2>13. Mineurs</h2>
      <p>
        Le service n'est pas destiné aux personnes de moins de 15 ans. Aucune inscription n'est
        sollicitée auprès de mineurs.
      </p>

      <h2>14. Modification de cette politique</h2>
      <p>
        Cette politique peut évoluer, notamment en cas d'ajout de nouvelles fonctionnalités. La date
        de dernière mise à jour figure en haut de cette page ; en cas de changement substantiel, vous
        en serez informé au sein de l'application.
      </p>
      <p>
        Voir également les <Link to="/mentions-legales">mentions légales</Link>.
      </p>
    </LegalPageShell>
  )
}
