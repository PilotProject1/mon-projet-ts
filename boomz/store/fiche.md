# Boomz — fiches des stores

Textes prêts à copier dans la Google Play Console et App Store Connect. Les
captures sont dans [`captures/`](captures/), aux formats exigés.

## Textes communs

**Nom** : Boomz

**Accroche courte** (Google Play, 80 caractères max — 77) :

> Posez des bombes, piégez vos amis ! Jusqu'à 6 joueurs, chacun sur son mobile.

**Sous-titre** (App Store, 30 caractères max — 27) :

> Bombes et pièges entre amis

**Texte promotionnel** (App Store, 170 caractères max, modifiable sans nouvelle version — 123) :

> Invitez jusqu'à 5 amis d'un simple lien : chacun joue sur son téléphone, sans compte ni inscription. Dernier debout gagne !

**Description** (les deux stores, 4 000 caractères max) :

> Posez des bombes, faites sauter les caisses et piégez vos amis : le dernier
> debout gagne la manche !
>
> Boomz est un jeu d'action en labyrinthe, rapide et nerveux, pensé pour jouer
> entre amis. Chacun joue sur son propre téléphone, en même temps : créez une
> partie, envoyez le lien d'invitation par WhatsApp ou SMS, et c'est parti.
> Pas de compte, pas d'inscription.
>
> ◆ JUSQU'À 6 JOUEURS
> Des parties de 2 à 4 minutes, en 3 manches gagnantes. Parfait pour une pause,
> une soirée ou un trajet.
>
> ◆ 4 ARÈNES
> • Chantier : l'arène classique.
> • Laboratoire : des téléporteurs relient les coins de l'arène.
> • Temple englouti : les dalles fissurées s'effondrent derrière vous.
> • Station spatiale : des tapis roulants vous emportent.
>
> ◆ 8 BONUS
> Flamme+, Bombe+, Vitesse+, Gilet pare-flamme, Détonateur, Traverse-mur,
> Traverse-bombe et Kick : ramassez-les sous les caisses… avant les autres.
> Et poussez vos bombes pour piéger vos adversaires à distance !
>
> ◆ MÊME SANS INTERNET
> Dans le train, en vacances, sans réseau : jouez à côté les uns des autres,
> en Bluetooth et Wi-Fi direct. Un téléphone crée le salon, les autres le
> rejoignent d'une touche.
>
> ◆ FACILE À PRENDRE EN MAIN
> Un doigt n'importe où à gauche de l'écran pour bouger, un bouton pour poser
> une bombe. L'arène s'adapte à votre écran, en portrait comme en paysage.
>
> ◆ VOS PERSONNAGES
> Boomer, Blaster, Frost, Toxic, Boomette et Omega, chacun en trois
> apparences. Purement esthétiques : tout le monde joue à armes égales.
>
> ◆ RESPECT DE LA VIE PRIVÉE
> Aucun compte, aucune publicité, aucun traceur. Votre pseudo n'est connu que
> des joueurs de votre partie.
>
> Une connexion internet est nécessaire pour jouer en ligne ; le jeu sans
> internet est réservé à l'iPhone pour l'instant.

**Mots-clés** (App Store, 100 caractères max, séparés par des virgules — 96) :

> bombe,multijoueur,amis,arcade,labyrinthe,explosion,party,fête,piège,rapide,duel,stratégie,action

## Google Play

- **Catégorie** : Jeux › Action (ou Arcade).
- **Balises** : Multijoueur, Hors ligne non, Occasionnel.
- **Classification (questionnaire IARC)** : violence de dessin animé, sans sang
  ni blessure réaliste (personnages éliminés par des explosions) ; aucune
  interaction non modérée hors pseudo ; aucun achat, aucune publicité.
  Classification attendue : PEGI 7.
- **Sécurité des données** :
  - Données collectées : **Nom** (le pseudo) — traité de manière éphémère,
    non partagé, obligatoire pour jouer, finalité « Fonctionnalités de
    l'application ».
  - Données chiffrées en transit : oui (HTTPS / WSS).
  - Suppression des données : rien n'est conservé après la partie.
- **Règles de confidentialité** : https://boomz.onrender.com/confidentialite
- **Images** : icône 512 × 512 (`icone-play-512.png`), bannière
  1024 × 500 (`captures/play-banniere-1024x500.png`), captures
  `captures/play-*.png` (1080 × 1920 et 1920 × 1080).

## App Store

- **Catégorie** : Jeux › Action (secondaire : Famille ou Arcade).
- **Âge** : violence de dessin animé ou fantastique « rare/légère » → 9+.
- **Confidentialité de l'app** : « Données non collectées » (le pseudo n'est
  utilisé que le temps de la partie, sans être conservé).
- **URL de confidentialité** : https://boomz.onrender.com/confidentialite
- **URL d'assistance** : la même page, une fois l'adresse e-mail de contact
  renseignée.
- **Captures** : `captures/iphone-6.9-*.png` (1290 × 2796 et 2796 × 1290,
  format iPhone 6,9 pouces, accepté pour toutes les tailles d'iPhone).

## Avant de publier

| Étape | Qui | Détail |
|---|---|---|
| Compte développeur Google Play | toi | 25 $, une fois ; vérification d'identité (quelques jours) |
| Compte développeur Apple | toi | 99 $ par an ; nécessaire aussi pour tester sur iPhone au-delà de 7 jours |
| Clé d'API App Store Connect (rôle Admin) et identifiant d'équipe → secrets GitHub `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `APPLE_TEAM_ID` | toi | pas besoin de Mac : le workflow « Boomz iOS » fabrique, signe et envoie l'application sur TestFlight |
| Fiche de l'app dans App Store Connect (Apps › + › Nouvelle app, identifiant `fr.boomz.jeu`) | toi | à créer avant le premier envoi sur TestFlight |
| Identifiant de l'application | toi | `fr.boomz.jeu` par défaut ; **définitif** une fois publiée |
| Champs « À REMPLIR » de /confidentialite | toi | éditeur (non professionnel, sans adresse publiée) et région Render faits ; reste l'e-mail de contact et l'adresse de Render à vérifier |
| Recherche d'antériorité sur le nom « Boomz » (INPI, EUIPO) et avis sur la ressemblance de la mascotte avec un personnage existant | toi | à faire avant une publication publique |
| ~~Serveur sans mise en veille (offre payante Render)~~ | toi | **fait** |
| Clé de signature Android de publication | ensemble | à créer et garder précieusement ; je peux ensuite la brancher dans GitHub Actions (secrets) pour produire le fichier .aab du Play Store |
| Empreinte de cette clé → `ANDROID_CERT_SHA256` chez Render | toi | pour que les liens d'invitation ouvrent l'application |
| Identifiant d'équipe Apple → `APPLE_TEAM_ID` chez Render, et domaine associé dans Xcode | ensemble | même chose sur iPhone |
