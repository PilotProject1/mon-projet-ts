import { Link } from 'react-router-dom'
import LegalPageShell from '../components/LegalPageShell'

export default function Confidentialite() {
  return (
    <LegalPageShell
      title="Politique de confidentialité"
      description="Quelles données SYNeco conserve, pourquoi, combien de temps, avec quels prestataires, et comment les récupérer ou les supprimer."
      lastUpdated="21 août 2026"
    >
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
              Adresse e-mail, nom, mot de passe (conservé uniquement sous forme d'une
              empreinte cryptographique irréversible, calculée avec bcrypt, et jamais en
              clair), date de création. Si vous activez la double authentification : le
              secret qui produit vos codes (chiffré) et l'empreinte de vos codes de
              secours, selon les mêmes principes que le mot de passe
            </td>
          </tr>
          <tr>
            <td>Documents</td>
            <td>
              Le fichier lui-même et son contenu, son nom, son type, sa catégorie (maison,
              personnel ou famille), son format, sa taille et sa date d'ajout. À la lecture
              automatique s'ajoutent, enregistrés dans la base de données, le texte lu dans le
              document (tronqué à 20 000 caractères) ainsi que l'émetteur, le montant et la date
              qui y ont été reconnus
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
            <td>Abonnement (si vous souscrivez)</td>
            <td>
              Offre souscrite, périodicité mensuelle ou annuelle, date de reconduction, et les
              identifiants qui vous désignent chez notre prestataire de paiement. Aucune donnée
              bancaire n'est enregistrée par SYNeco : le numéro de votre carte est saisi chez
              Stripe et ne transite jamais par nos serveurs
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

      <h2>5. Outil public de résiliation</h2>
      <p>
        La page <strong>syneco.pro/resilier</strong> est accessible sans compte. Le document que
        vous y déposez est lu <strong>en mémoire vive le temps de la requête, puis oublié</strong> :
        il n'est écrit sur aucun disque, rattaché à aucun compte, et ne peut donc être ni retrouvé
        ni consulté ensuite — y compris par l'éditeur. Aucun compte n'est créé, aucune adresse
        e-mail n'est demandée.
      </p>
      <p>
        Le texte extrait de ce document est transmis au prestataire mentionné à l'article 4 pour en
        déduire l'organisme, la référence et la date d'échéance, puis rédiger la lettre. Lorsque la
        fonctionnalité n'est pas disponible, l'analyse et la lettre sont produites localement, sans
        transmission à un tiers. La base légale de ce traitement est votre demande explicite, le
        dépôt du document valant demande d'analyse.
      </p>
      <p>
        Le nombre d'analyses est limité par adresse IP afin de prévenir les usages abusifs. Cette
        limitation repose sur un compteur temporaire, non conservé au-delà de sa durée de validité
        et non associé à votre identité.
      </p>
      <p>
        La lettre produite est un <strong>projet</strong>, à relire et à compléter. Elle n'est jamais
        envoyée pour vous, et les délais de résiliation applicables dépendent de votre contrat :
        l'outil reproduit la date lue sur votre document, il ne se prononce pas sur le droit qui
        vous est applicable.
      </p>

      <h2>6. Photographie d'un document</h2>
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

      <h2>7. Rappels d'échéance</h2>
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
      <p>
        Un <strong>point hebdomadaire</strong> peut par ailleurs vous être adressé le lundi. Il
        rassemble ce qui appelle une décision : échéances dépassées ou proches, échéances repérées
        dans un document et non tranchées, hausses constatées sur une dépense récurrente, offre
        bientôt pleine. Il ne contient aucun document et n'est envoyé que les semaines où l'un de
        ces points existe. Ce message se refuse indépendamment des rappels, depuis la page
        Échéances ou par le lien figurant à son pied.
      </p>

      <h2>8. Destinataires et sous-traitants</h2>
      <p>
        Aucun autre utilisateur n'accède à vos données : chaque requête vérifie que vous en êtes le propriétaire. Elles restent en revanche accessibles aux prestataires
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
            <td>Hébergement de l'interface et mesure d'audience sans cookie</td>
            <td>États-Unis</td>
          </tr>
          <tr>
            <td>Render Services, Inc.</td>
            <td>Hébergement du serveur applicatif</td>
            <td>États-Unis — Virginie (US East)</td>
          </tr>
          <tr>
            <td>Neon (Databricks, Inc.)</td>
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
            <td>Stripe Payments Europe, Ltd.</td>
            <td>
              Paiement des abonnements : coordonnées bancaires, factures et état de l'abonnement.
              SYNeco n'a jamais accès au numéro de votre carte
            </td>
            <td>Irlande (Union européenne)</td>
          </tr>
          <tr>
            <td>Brevo (Sendinblue SAS)</td>
            <td>Acheminement des rappels d'échéance et du point hebdomadaire par e-mail</td>
            <td>France (Union européenne)</td>
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
        est paramétré pour une juridiction européenne, option prévue par notre prestataire pour restreindre l'emplacement des fichiers à ce territoire. Les journaux techniques et les métadonnées de service peuvent, eux, être traités ailleurs.
      </p>
      <p>
        <strong>Le serveur applicatif, lui, est hébergé aux États-Unis</strong>, en Virginie. C'est
        lui qui reçoit et traite chaque demande : vos données y transitent en clair le temps du
        traitement, avant d'être écrites dans la base européenne ou renvoyées à votre navigateur.
        Elles n'y sont pas conservées, mais elles y passent — nous préférons l'écrire plutôt que de
        laisser entendre le contraire.
      </p>
      <p>
        Ce transfert, comme celui vers l'assistant IA lorsqu'il est activé et comme l'hébergement de
        l'interface, s'effectue sur la base des clauses contractuelles types de la Commission
        européenne ou d'un mécanisme d'adéquation équivalent. Les liaisons sont chiffrées de bout en
        bout (HTTPS).
      </p>

      <h2>9. Données de vos propres clients</h2>
      <p>
        Si vous utilisez le module de facturation, vous enregistrez des données concernant vos
        clients. Pour ces données, <strong>vous êtes responsable du traitement</strong> et SYNeco
        agit comme sous-traitant : il vous appartient d'informer vos clients et de disposer d'une
        base légale pour enregistrer leurs coordonnées.
      </p>

      <h2>10. Durée de conservation</h2>
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
          <strong>Données de paiement</strong> : votre abonnement est résilié et votre client
          Stripe effacé lors de la suppression du compte — le moyen de paiement enregistré
          disparaît avec lui. Les factures déjà émises restent conservées chez Stripe : la loi
          impose à l'éditeur de tenir ses pièces comptables pendant dix ans, et cette obligation
          ne dépend pas de votre compte.
        </li>
        <li>
          <strong>Documents déposés sur l'outil public de résiliation</strong> : aucune
          conservation. Le fichier n'existe qu'en mémoire vive pendant le traitement de la requête
          et disparaît avec elle ; il n'apparaît donc dans aucune sauvegarde.
        </li>
        <li>
          <strong>Journaux techniques</strong> : 12 mois au maximum.
        </li>
        <li>
          <strong>Sauvegardes</strong> : la base de données conserve un historique de{' '}
          <strong>6 heures</strong>, qui permet de la restaurer à n'importe quel instant de cette
          fenêtre. S'y ajoute une sauvegarde chiffrée quotidienne, conservée{' '}
          <strong>14 jours</strong>, destinée à faire face à un incident majeur. Une donnée que vous
          supprimez peut donc subsister jusqu'à quatorze jours dans ces sauvegardes ; passé ce
          délai, elle ne subsiste nulle part. Ces sauvegardes ne sont jamais consultées pour un
          autre motif que le rétablissement du service après un incident.
        </li>
      </ul>

      <h2>11. Vos droits</h2>
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

      <h2>12. Cookies et traceurs</h2>
      <p>
        SYNeco n'utilise <strong>aucun cookie publicitaire</strong> et ne pratique aucun suivi
        d'un site à l'autre. Votre session est maintenue au moyen de jetons d'authentification
        stockés localement dans votre navigateur, strictement nécessaires au fonctionnement du
        service. À ce titre, ils sont dispensés de consentement préalable et aucune bannière de
        cookies n'est nécessaire.
      </p>
      <p>Ces jetons sont effacés lorsque vous vous déconnectez.</p>
      <p>
        Une <strong>mesure d'audience</strong> est en revanche effectuée, afin de savoir combien
        de personnes consultent le site et quelles pages elles ouvrent. Elle est assurée par
        Vercel Inc., déjà hébergeur de l'interface, et <strong>ne dépose aucun cookie</strong> :
        un identifiant est dérivé de la requête elle-même, effacé au bout de vingt-quatre heures,
        et seuls des totaux sont conservés. Aucun profil individuel n'est constitué et ces
        données ne sont pas recoupées avec votre compte.
      </p>
      <p>
        Ce qui est transmis se limite à l'adresse de la page consultée, sans ses paramètres, et à
        deux gestes comptés sans rien qui vous désigne : le <strong>clic sur un bouton
        d'inscription</strong> (avec l'endroit de la page d'où il part) et la{' '}
        <strong>création effective d'un compte</strong>. Ils servent à savoir à quelle étape les
        visiteurs renoncent. Ni votre adresse e-mail, ni votre nom, ni aucun identifiant ne les
        accompagne : ces mesures répondent à « combien », jamais à « qui ».
      </p>
      <p>
        <strong>Les adresses de partage sont exclues</strong> de tout envoi, parce qu'elles
        contiennent le jeton qui donne accès au document : elles ne sont jamais transmises à la
        mesure d'audience.
      </p>

      <h2>13. Sécurité</h2>
      <ul>
        <li>Les échanges entre votre navigateur et le service sont chiffrés (HTTPS).</li>
        <li>
          Les mots de passe ne sont jamais stockés en clair, mais sous forme d'empreinte
          cryptographique irréversible.
        </li>
        <li>
          Vous pouvez activer une double authentification (code à usage unique, en plus du
          mot de passe) depuis la page Sécurité.
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

      <h2>14. Mineurs</h2>
      <p>
        Le service n'est pas destiné aux personnes de moins de 15 ans. Aucune inscription n'est
        sollicitée auprès de mineurs.
      </p>

      <h2>15. Modification de cette politique</h2>
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
