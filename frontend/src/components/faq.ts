/*
 * Les questions qu'on se pose avant de confier ses papiers à un inconnu.
 *
 * Ce ne sont pas des questions décoratives : ce sont les objections réelles
 * — que devient mon coffre si j'arrête de payer, qui peut lire mes documents,
 * puis-je repartir avec. Chaque réponse décrit ce que le code fait, et a été
 * vérifiée contre lui. Une FAQ rassurante mais fausse se retourne au premier
 * client qui la prend au mot.
 *
 * ⚠ Ces questions sont dupliquées en JSON-LD dans `frontend/index.html`, et
 * les deux doivent rester identiques mot pour mot : Google écarte une fiche
 * dont les données structurées ne correspondent pas au texte affiché. La
 * duplication est volontaire — placer le JSON-LD dans le HTML servi le rend
 * lisible par les robots qui n'exécutent pas le JavaScript, ce que ni la
 * section affichée ni un JSON-LD posé par l'application ne seraient.
 */

export interface Question {
  question: string
  reponse: string
}

export const FAQ: Question[] = [
  {
    question: 'Que deviennent mes documents si j’arrête de payer ?',
    reponse:
      'Ils restent là, et restent consultables. Repasser à l’offre gratuite ne supprime jamais un document : la limite de dix ne fait qu’empêcher d’en ajouter de nouveaux tant que vous êtes au-dessus. Rien n’est effacé sans que vous le demandiez.',
  },
  {
    question: 'Puis-je récupérer mes documents et m’en aller ?',
    reponse:
      'Oui, à tout moment et sans rien demander à personne. Chaque fichier se télécharge depuis la liste des documents, et un export récupère l’ensemble de vos données — documents, échéances, contrats, partages. La suppression du compte efface les fichiers du stockage.',
  },
  {
    question: 'Qui peut lire mes documents ?',
    reponse:
      'Vous seul. Aucun fichier n’est accessible par une adresse publique : chaque ouverture passe par votre session et vérifie que le document vous appartient. Ce que vous partagez par lien expire au bout de 24 heures, 7 jours ou 30 jours, se révoque d’un clic, et chaque consultation est horodatée.',
  },
  {
    question: 'SYNeco lit-il vraiment le contenu de mes documents ?',
    reponse:
      'Oui, c’est ce qui distingue le service d’un simple espace de stockage : le type, l’émetteur, le montant et l’échéance sont reconnus dans le texte. Ces informations sont des suggestions, corrigeables d’un geste. Rien n’est utilisé pour entraîner un modèle, et la politique de confidentialité détaille précisément ce qui est transmis.',
  },
  {
    question: 'Faut-il installer une application ?',
    reponse:
      'Non. SYNeco fonctionne dans le navigateur, sur téléphone comme sur ordinateur. Vous pouvez l’ajouter à votre écran d’accueil pour l’ouvrir comme une application, mais rien ne vous y oblige.',
  },
  {
    question: 'Comment envoyer une facture reçue par e-mail ?',
    reponse:
      'En transférant le message à votre adresse SYNeco personnelle. La pièce jointe est déposée et lue automatiquement, sans que vous ayez à la télécharger ni à ouvrir le site. Cela fonctionne depuis n’importe quelle messagerie.',
  },
]
