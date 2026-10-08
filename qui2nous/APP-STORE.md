# Qui2Nous sur l'App Store

L'appli iOS est une coque **Capacitor** autour du jeu web : l'interface est
embarquée dans l'appli (dossier `dist/`), et seule la partie en ligne passe par
le serveur Render. Elle utilise aussi des fonctions natives (vibrations
Haptics, feuille de partage iOS) pour ne pas être vue comme un simple site
emballé (règle 4.2 d'Apple).

## Déjà prêt dans le dépôt

| Élément | Où |
| --- | --- |
| Projet Xcode | `ios/App/App.xcodeproj` (Swift Package Manager, pas de CocoaPods) |
| Identifiant (bundle ID) | `fr.qui2nous.jeu` — à changer dans `capacitor.config.ts` **et** Xcode si besoin |
| Version | 1.0 (build 1) |
| Appareils | iPhone uniquement, portrait uniquement, iOS 15 minimum |
| Icône 1024 × 1024 | `ios/App/App/Assets.xcassets/AppIcon.appiconset/` (copie dans `store/icone-1024.png`) |
| Écran de lancement | `ios/App/App/Assets.xcassets/Splash.imageset/` |
| Textes d'autorisation photo / appareil photo | `ios/App/App/Info.plist` |
| Chiffrement | `ITSAppUsesNonExemptEncryption = NO` (plus de question à chaque envoi) |
| Politique de confidentialité | `https://qui2nous.onrender.com/confidentialite.html` |
| Page d'aide (URL d'assistance) | `https://qui2nous.onrender.com/support.html` |

Les deux pages sont aussi accessibles depuis l'accueil du jeu. Les champs
surlignés en jaune (éditeur, e-mail de contact) **doivent être remplis avant
l'envoi**.

## Côté Render

- Rien à configurer : le serveur accepte déjà les connexions venant de l'appli
  (CORS `capacitor://localhost`). Il suffit que cette version soit déployée.
- Le service est en offre **Starter** (`plan: starter` dans `render.yaml`) :
  il reste toujours éveillé, ce qui évite au testeur d'Apple de tomber sur
  « Connexion perdue ». Ne pas repasser en offre gratuite tant que l'appli
  est publiée.

## Construire et envoyer (sur un Mac avec Xcode)

```sh
git clone … && cd mon-projet-ts/qui2nous
git checkout claude/qui2nous-ios
npm ci
npm run build
npx cap sync ios
open ios/App/App.xcodeproj
```

L'appli se connecte d'office au serveur `https://qui2nous.onrender.com`. Pour
la brancher sur un autre serveur (tests), construire avec
`VITE_URL_SERVEUR=https://autre-adresse npm run build`.

Dans Xcode :

1. Cible **App** → *Signing & Capabilities* : cocher *Automatically manage
   signing* et choisir l'équipe (la même que pour Boomz).
2. En haut, choisir *Any iOS Device (arm64)*.
3. *Product* → *Archive*, puis *Distribute App* → *App Store Connect* →
   *Upload*.
4. Pour chaque nouvelle version, augmenter *Build* (1, 2, 3…) et, si besoin,
   *Version*.

Tester avant sur un vrai iPhone (câble ou TestFlight) : créer une partie,
inviter des robots ou d'autres téléphones, jouer une manche de chaque mode,
envoyer une photo.

## Fiche App Store Connect

- **Nom** : Qui2Nous
- **Sous-titre** (30 caractères max) : Le jeu d'ambiance entre amis
- **Catégorie** : Jeux → Société (secondaire : Jeux → Famille)
- **Mots-clés** (100 caractères max) :
  `soirée,ambiance,amis,party game,quiz,dessin,photo,apéro,vote,devinette,jeu de groupe`
- **Texte promotionnel** : Qui de nous est le plus susceptible de… ? Votez,
  devinez, dessinez et riez entre amis !
- **Description** :

  > Qui2Nous, c'est le jeu de soirée qui révèle ce que vous pensez vraiment les
  > uns des autres !
  >
  > De 3 à 8 joueurs, chacun sur son téléphone : un joueur crée le salon, les
  > autres le rejoignent avec un code. Pas de compte, pas d'inscription.
  >
  > 4 MODES DE JEU
  > • Qui2Nous ? — « Qui de nous est le plus susceptible de… ? » Votez pour un
  >   ami et découvrez ce que le groupe pense de vous.
  > • Qui a répondu ? — Tout le monde répond en secret… à vous de deviner qui a
  >   écrit quoi.
  > • Qui2Photo ? — Une photo s'affiche : à qui appartient-elle ?
  > • Qui2Dessine ? — Dessinez la consigne, les autres devinent l'artiste.
  >
  > ET AUSSI
  > • Vos propres questions pour personnaliser la partie
  > • Une grande finale pour départager les meilleurs
  > • Des animations, des sons et un chrono qui fait monter la pression
  >
  > Parfait pour l'apéro, les soirées, les anniversaires et les week-ends entre
  > amis !

- **URL d'assistance** : `https://qui2nous.onrender.com/support.html`
- **URL de confidentialité** : `https://qui2nous.onrender.com/confidentialite.html`
- **Copyright** : 2026 Loïc Vincent

## Questionnaires

**Confidentialité de l'app (« App Privacy »)** : *Données non collectées*.
Rien n'est conservé au-delà de la partie (photos effacées à la fin de la
manche, salon supprimé au plus tard 30 minutes après le départ du dernier
joueur), aucun suivi, aucune publicité, aucun compte. Apple ne considère pas
comme « collectées » des données traitées de façon éphémère pour faire
fonctionner le service en temps réel.

**Classification par âge** : répondre honnêtement ; pour un jeu d'ambiance
avec un humour un peu cru et du contenu écrit par les joueurs, on obtient en
général **12+** (« Humour grossier ou cru : rare/léger », contenu généré par
les utilisateurs : oui).

**Informations pour l'examen (App Review)** : le jeu demande au moins
3 joueurs. Mettre dans les notes :

> Qui2Nous est un jeu à plusieurs téléphones. Pour tester seul : appuyez sur
> « Créer une partie », puis dans le salon sur « 🤖 Ajouter un robot » (deux
> fois) pour compléter la partie. Aucun compte n'est nécessaire.

## Captures d'écran

Obligatoires : iPhone 6,9 pouces (1320 × 2868 ou 1290 × 2796). Apple réduit
ensuite automatiquement pour les autres tailles. Prévoir 4 à 6 captures :
intro, accueil, salon, une question en cours, un vote, le podium.

## Risque connu : contenu généré par les joueurs (règle 1.2)

Les photos, dessins, réponses libres et questions personnalisées sont du
contenu créé par les joueurs. Apple demande en principe, pour ce type
d'appli : un moyen de **signaler** un contenu, de **bloquer / exclure** un
joueur, et un **contact** publié. Les parties étant privées (code du salon,
entre amis, rien de conservé), il est possible que l'appli passe sans, mais si
Apple refuse sur ce point, la réponse la plus simple est d'ajouter :

- pour l'hôte, un bouton « Exclure » à côté de chaque joueur ;
- un bouton « Masquer / signaler » sur les photos et dessins affichés.
