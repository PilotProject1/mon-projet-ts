# Boomz

Jeu d'action en labyrinthe : chaque joueur pose des bombes pour détruire les
caisses et piéger ses adversaires, le dernier debout gagne la manche.

**Un joueur par téléphone** : chacun voit la partie sur son propre écran. On
joue ensemble en ligne, en simultané, via un code ou un lien d'invitation, ou
en local entre iPhone proches (Bluetooth et Wi-Fi direct).

**Le jeu se joue uniquement dans l'application iPhone** (TestFlight, puis App
Store). Le site https://boomz.onrender.com ne sert plus de version jouable :
il présente le jeu, renvoie vers l'application et affiche le code des liens
d'invitation. Le serveur Render reste indispensable : c'est lui qui fait
tourner les parties en ligne de l'application. L'application Android est en
pause.

Ce dossier est indépendant de SYNeco (`frontend/`, `backend/`) : il n'est ni
déployé ni relié à leur code.

## Où en est-on (roadmap)

| Phase | Contenu | État |
|---|---|---|
| 1. Prototype jouable | mécanique bombe/flamme/blocs, testée à 2 sur un même écran | fait (le mode test a été retiré depuis) |
| 2. MVP multijoueur | en ligne à 2-4 joueurs via lien d'invitation, salon d'attente, 1 arène finalisée | fait |
| 3. Alpha | 6 joueurs, 3-4 arènes, bonus classiques, tests externes | fait, sauf les tests avec des joueurs externes (à organiser) |
| 4. Bêta | mode Bluetooth / local sans internet, équilibrage, perf/batterie, cosmétiques | en cours : cosmétiques, perf/batterie et statistiques d'équilibrage faits ; équilibrage à faire sur les chiffres des tests ; mode sans internet fait sur iPhone (application), Android à venir |
| 5. Lancement | polish final, fiches des stores, analytics, sortie iOS/Android | en cours : application Android/iOS, APK de test, site installable, confidentialité et fiches prêts ; publication en attente des comptes développeur |

### Règles communes

- Grille 13 × 11 : piliers indestructibles en damier, caisses destructibles
  réparties aléatoirement (départs toujours dégagés).
- Bombes à retardement (2,5 s), flammes en croix (portée 2) arrêtées par les
  murs, première caisse touchée détruite, réactions en chaîne.
- Une bombe à la fois au départ ; on peut quitter sa bombe mais pas y revenir.
- On peut **pousser sa propre bombe** : en revenant marcher dessus, elle glisse
  jusqu'au premier obstacle (mur, caisse, joueur ou autre bombe).
- Élimination au contact d'une flamme, manche au dernier survivant, match en
  3 manches gagnantes.
- Resserrement de l'arène : à 2:00, des murs tombent en spirale.

### Bonus (phase 3)

Environ une caisse sur trois cache un bonus, révélé quand elle a brûlé. On le
ramasse en marchant dessus ; une flamme le détruit. **Chaque bonus dure
10 secondes**, sauf le Gilet pare-flamme, qui reste jusqu'à ce qu'une explosion
l'use ; reprendre le même relance le compteur (et, pour Flamme+,
Bombe+ et Vitesse+, ajoute un niveau). Les bonus actifs s'affichent avec leurs
secondes restantes et clignotent les 3 dernières. Le tirage est fait par le
serveur, qui ne dévoile jamais aux téléphones ce que cachent les caisses.

| Bonus | Effet |
|---|---|
| Flamme+ | Portée des explosions +1 (jusqu'à 8) |
| Bombe+ | Une bombe de plus en même temps (jusqu'à 8) |
| Vitesse+ | Déplacement plus rapide (plafonné) |
| Gilet pare-flamme | Encaisse une explosion, sans limite de temps (il disparaît alors) ; clignote 1 s ensuite |
| Détonateur | Les bombes n'explosent que sur commande (bouton **Boum**, touche E) ; à la fin des 10 s, celles encore posées redeviennent des bombes normales |
| Traverse-mur | Passe à travers les caisses (pas les piliers) |
| Traverse-bombe | Passe sur ses propres bombes |
| Kick | Pousse aussi les bombes des **autres** joueurs (les siennes se poussent toujours) |

Les bonus du joueur s'affichent sous l'arène (portrait) ou au-dessus du
joystick (paysage). Les « nouvelles idées » de la roadmap (bombe téléguidée,
bouclier à charges…) et les pouvoirs des personnages viendront plus tard.

### Arènes (phase 3)

| Arène | Obstacle |
|---|---|
| Chantier | aucun : l'arène classique |
| Laboratoire | deux paires de téléporteurs (même couleur = reliés) |
| Temple englouti | une croix de dalles fissurées qui s'effondrent derrière le joueur |
| Station spatiale | deux tapis roulants en sens opposés |

L'hôte choisit l'arène dans le salon, ou « une différente à chaque manche »
(par défaut, conformément à la roadmap : un match se joue sur des arènes
différentes).

## Jouer en ligne

1. Un joueur choisit un pseudo et **crée une partie** : il obtient un code de
   5 caractères et un lien d'invitation (bouton **Partager**, qui ouvre le
   partage du téléphone : SMS, WhatsApp…).
2. Les autres ouvrent le lien, ou saisissent le code, et rejoignent le salon
   (2 à 6 joueurs). Le personnage dépend de l'ordre d'arrivée : Boomer,
   Blaster, Frost, Toxic, Boomette, Omega.
3. L'hôte choisit l'arène ; chacun appuie sur **Je suis prêt** ; l'hôte
   **lance la partie**.
4. En fin de match, **Retour au salon** permet d'enchaîner.

Commandes : posez le pouce n'importe où sur la **moitié gauche** de l'écran
(carte comprise) et faites-le glisser : le joystick apparaît sous le doigt et
disparaît quand on le lève. Seul le bouton bombe reste affiché, à droite. Sur
ordinateur : flèches / ZQSD + Espace, E pour le Détonateur.

L'arène occupe tout l'espace libre, quitte à étirer légèrement les cases
(jusqu'à 45 %) ; personnages, bombes et bonus gardent leurs proportions. Sur un
téléphone tenu en hauteur, l'arène est affichée **pivotée d'un quart de tour**
(11 cases de large, 13 de haut) pour occuper la hauteur de l'écran : pousser
vers le haut fait toujours monter le personnage à l'écran. Seul l'affichage de
ce téléphone change, la partie est la même pour tous.

### Coupures réseau

Un téléphone qui perd la connexion (tunnel, changement de réseau, page
rechargée) garde sa place **8 secondes** : il se reconnecte seul et reprend la
partie. Passé ce délai, son personnage est éliminé et la partie continue sans
lui. Un joueur qui quitte volontairement le salon libère sa place tout de suite.

### Architecture réseau

- **Serveur qui fait autorité** (`server/`) : lui seul fait avancer la
  simulation. Les téléphones n'envoient que leurs commandes (direction, bombe)
  et affichent l'état reçu : un joueur ne peut pas tricher en modifiant sa
  position.
- 60 pas de simulation par seconde côté serveur, état envoyé 20 fois par
  seconde. Chaque téléphone affiche l'état avec 100 ms de retard et
  **interpole** les positions entre deux envois : les personnages glissent au
  lieu de sauter (la roadmap demande cette gestion de la latence dès le début).
- Le même serveur sert les pages du jeu et les connexions WebSocket (`/ws`).
- Les messages sont compressés (permessage-deflate) : l'état passe d'environ
  4 Ko à 0,5 Ko, soit 7 fois moins de données mobiles consommées.
- Les salons vivent en mémoire : un redémarrage du serveur ferme les parties en
  cours. Une seule instance du serveur doit tourner.

Limite connue : sans prédiction côté téléphone, son propre personnage réagit
avec le délai du réseau plus 100 ms. Correct sur un bon réseau ; à améliorer
si les tests externes le jugent gênant (prédiction locale et réconciliation).

### Tests avec des joueurs externes

Objectif : savoir si des personnes qui ne connaissent pas le jeu le prennent en
main seules, si le délai de réaction les gêne sur leur réseau, et quels bonus
ou arènes sont trop forts ou mal aimés.

**Qui** : 4 à 6 personnes par session, idéalement des téléphones variés
(iPhone et Android, récents et anciens), certaines en Wi-Fi, d'autres en 4G/5G,
et au moins une qui ne joue jamais aux jeux vidéo.

**Déroulé d'une session (≈ 20 minutes)**

1. Ouvrir https://boomz.onrender.com et créer une partie.
2. Envoyer le lien d'invitation (bouton « Partager ») avec le message
   ci-dessous. **Ne rien expliquer** : regarder qui bloque, et où.
3. Jouer 2 ou 3 matchs, arène « Une différente à chaque manche », son activé.
4. À la fin, chacun appuie sur **« Donner mon avis »** (fin de match ou
   accueil) : réponse en quelques touches, envoyée par WhatsApp/SMS à celui qui
   a invité, avec le modèle de téléphone, le réseau et le délai mesuré.
5. Relever **https://boomz.onrender.com/stats** tout de suite après (elles
   repartent à zéro quand le serveur s'endort, environ 15 minutes sans joueur).

**Message d'invitation à copier**

> Salut ! Je teste un petit jeu multijoueur, Boomz : pose des bombes, fais
> sauter les caisses et piège les autres. Ça se joue dans le navigateur du
> téléphone, rien à installer. Mets le son ! Clique ici pour rejoindre ma
> partie : [lien d'invitation]. À la fin, un bouton « Donner mon avis » me
> renvoie ton ressenti en 30 secondes. Merci !

**À observer pendant la partie** : hésitations pour rejoindre ou bouger,
remarques spontanées (« ça lag », « c'est quoi ce truc ? »), bonus ramassés
puis incompris, parties qui s'éternisent ou finissent trop vite.

**Ce qu'on en fera** : les avis et les chiffres de /stats décideront de
l'équilibrage (bonus trop forts, durée des manches, arènes) et, si le délai
gêne sur réseau mobile, de la prédiction des déplacements côté téléphone.

## Son et musique

Rien de tel n'était prévu dans la roadmap : ajouté après la phase 3. Tout est
synthétisé dans le navigateur (Web Audio) : aucun fichier à télécharger, aucune
question de droits.

- Bruitages : bombe posée, explosion (plus forte quand plusieurs bombes sautent
  ensemble), caisse brisée, Kick, téléporteur, dalle qui s'effondre, gilet
  perdu, élimination, alarme du resserrement, compte à rebours, fin de manche
  et de match (victoire ou défaite).
- Un son propre à chacun des 8 bonus, joué quand on le ramasse soi-même.
- Deux musiques en boucle : une posée pour le menu et le salon, une plus
  rythmée pendant la partie.
- Réglages séparés pour les bruitages et la musique sur l'accueil, et un bouton
  qui coupe tout pendant la partie ; ils sont mémorisés sur le téléphone. Le son
  s'arrête quand le téléphone est verrouillé.

Les sons sont déduits de la comparaison de deux états successifs reçus du
serveur (une bombe apparaît, la portée d'un joueur augmente, un joueur saute
de plusieurs cases…), sans rien changer au serveur.

## Menu de départ

Une petite partie jouée par des personnages automatiques défile en fond, sur
une arène différente à chaque manche. Au premier plan : Boomer et le logo, le
formulaire (pseudo, créer ou rejoindre), les réglages du son et une fenêtre
« Comment jouer » (commandes, règles, bonus, arènes). Arrivé par un lien
d'invitation, on n'a plus qu'à saisir son pseudo et « Rejoindre le salon ».

## Phase 4 (Bêta)

### Cosmétiques de base

Chaque personnage a trois apparences : Classique, Nuit et Or. Dans le salon,
on touche son propre personnage pour les faire défiler ; les autres voient le
changement aussitôt. Aucun effet sur le jeu, conformément à la roadmap (pas de
pay-to-win). Elles sont gratuites pour l'instant.

### Performances et batterie

- Rendu plafonné à 2 pixels par point : un écran « 3x » calcule 2,25 fois moins
  de pixels, sans différence visible. Une image se calcule en moins d'une
  milliseconde sur ordinateur, de quoi garder une bonne marge sur téléphone.
- Sol pré-dessiné, nombre de particules plafonné, fond du menu à 30 images
  par seconde.
- Son coupé et rendu suspendu quand le téléphone est verrouillé ou l'onglet
  caché ; l'écran reste allumé pendant une partie (et seulement là).
- Messages réseau compressés (voir plus haut).

### Statistiques pour l'équilibrage

Le serveur tient des statistiques **anonymes** (aucun pseudo, aucune adresse),
consultables sur **https://boomz.onrender.com/stats** :

- nombre de matchs, de joueurs par match, de manches et d'égalités ;
- part des manches qui vont jusqu'au resserrement de l'arène ;
- pour chaque bonus : combien de fois il est ramassé, et la part des manches
  gagnées par ceux qui le possèdent, à comparer à la « chance normale de
  gagner » (1 sur le nombre de joueurs) : un bonus nettement au-dessus est
  trop fort, un bonus au niveau de la chance normale ne sert pas à grand-chose ;
- durée moyenne des manches par arène.

Elles sont en mémoire : un redémarrage du serveur (redéploiement) les remet
à zéro. Relever les chiffres après une session de tests, avant d'envoyer une
nouvelle version.

### Mode sans internet (Bluetooth)

Voir « Jouer sans internet » plus bas.

## Phase 5 (lancement)

### Application Android et iOS

Le jeu est emballé avec **Capacitor** (projets `android/` et `ios/`) :
l'application embarque le jeu compilé et se connecte à
`https://boomz.onrender.com`. Identifiant : `fr.boomz.jeu`
(`capacitor.config.ts`, **définitif** une fois publié).

- **APK Android de test** : fabriqué par GitHub Actions (workflow
  « Boomz Android ») à chaque changement du jeu. Onglet **Actions** du dépôt ›
  dernière exécution « Boomz Android » › **Artifacts** › `boomz-android-debug`
  (un .zip contenant `app-debug.apk`). Sur le téléphone Android : ouvrir
  l'APK et autoriser l'installation depuis cette source. Il est signé avec
  une clé de débogage : bon pour tester, pas pour le Play Store.
- **Application iPhone, sans Mac** : le workflow « Boomz iOS » compile
  l'application sur un Mac de GitHub à chaque changement du jeu. Lancé à la
  main (Actions › Boomz iOS › **Run workflow**), il la signe et l'envoie sur
  **TestFlight**, d'où les testeurs l'installent sur leur iPhone. Il lui faut
  quatre secrets du dépôt (Settings › Secrets and variables › Actions) :
  `APPLE_TEAM_ID` (identifiant d'équipe, 10 caractères, page « Membership »
  du compte développeur), et une clé d'API App Store Connect de rôle
  **Admin** (Utilisateurs et accès › Intégrations › Clés) : `ASC_KEY_ID`,
  `ASC_ISSUER_ID` et `ASC_KEY_P8` (contenu complet du fichier `.p8`, qui ne
  se télécharge qu'une fois). La signature est préparée à chaque envoi par
  l'API App Store Connect (`scripts/asc-signing.mjs`) : un certificat de
  distribution neuf (le plus ancien est révoqué si Apple en refuse un de
  plus, sans effet sur les versions déjà envoyées) et le profil « Boomz App
  Store (GitHub) ». L'application cible l'iPhone seul (elle
  tourne aussi sur iPad, en mode iPhone) : pas de captures iPad à fournir.
- **En local** : `npm run build:app` (compile le jeu pour l'application et le
  copie dans les projets natifs), puis `npx cap open android` (Android Studio)
  ou `npx cap open ios` (Xcode, sur Mac).
- **Icônes et écrans de démarrage** : sources dans `assets/` (icône d'origine :
  `assets/source/icone-originale.png`), déclinés avec
  `npx capacitor-assets generate --android --ios`.
- **Liens d'invitation** : quand l'application est installée, un lien
  `https://boomz.onrender.com/?salon=…` l'ouvre directement, une fois
  renseignées chez Render les variables `ANDROID_CERT_SHA256` (empreinte
  SHA-256 de la clé de signature de publication) et `APPLE_TEAM_ID` (et le
  domaine associé ajouté dans Xcode). Sans elles, les liens s'ouvrent dans le
  navigateur, ce qui fonctionne aussi.

### Site (page d'accueil)

Le site ne sert que `public/invitation.html` (présentation, code du salon
d'un lien d'invitation, bouton d'installation) et `/confidentialite`. Le
bouton « Installer Boomz sur iPhone » pointe vers la variable
**`APP_STORE_URL`** à renseigner chez Render (lien public TestFlight, puis
lien App Store) ; sans elle, la page affiche « Bientôt sur l'App Store ».
`public/sw.js` désinstalle l'ancienne version installable du site chez ceux
qui l'avaient ajoutée à leur écran d'accueil.

### Confidentialité

`/confidentialite` (exigée par les stores) décrit ce que fait réellement le
jeu : pseudo le temps de la partie, statistiques anonymes, stockage sur le
téléphone, hébergeur, aucun compte ni traceur. Les informations à fournir
(éditeur, contact, région de l'hébergeur) sont surlignées « À REMPLIR ».
Toute évolution qui change les données traitées doit s'y refléter.

### Fiches des stores

`store/fiche.md` : nom, accroches, description, mots-clés, catégories,
réponses aux questionnaires (âge, données) et liste de ce qui reste à faire
avant de publier. `store/captures/` : captures aux formats Google Play
(1080 × 1920, 1920 × 1080, bannière 1024 × 500) et iPhone 6,9 pouces
(1290 × 2796, 2796 × 1290).

### Statistiques d'usage

Les statistiques anonymes de `/stats` (voir phase 4) servent d'« analytics »
pour l'instant. Elles sont en mémoire : pour les garder dans la durée après le
lancement, il faudra une petite base de données (par exemple Neon, déjà
utilisée pour SYNeco) — décision à prendre.

## Graphismes des arènes

Chaque arène a son ambiance (vue 3/4) : Chantier (terre battue, béton, bandes
de sécurité, caisses en bois), Laboratoire (carrelage blanc, machines,
conteneurs ambrés), Temple englouti (dalles moussues, grès sculpté, blocs de
terre cuite, bassins là où le sol s'est effondré), Station spatiale (métal
sombre, néons, conteneurs de fret). Les caisses destructibles sont toujours
d'une couleur nettement différente des piliers. Explosions avec halo,
étincelles, fumée, éclats et légère secousse de l'écran. Tout est dessiné en Canvas 2D, sans image à télécharger.

## Personnages

La planche de référence est dans [`docs/personnages.jpg`](docs/personnages.jpg) :
Boomer (01, personnage principal) puis les 19 autres, avec les pouvoirs
décrits dans la roadmap. Le jeu dessine pour l'instant une version simplifiée
des six premiers personnages attribués dans le salon (couleurs, casquette,
pompon, grands yeux) ; les pouvoirs ne sont pas encore actifs.

## Lancer en local

```bash
cd boomz
npm install
npm run dev:server   # serveur de jeu sur le port 8787 (redémarre à chaque modification)
npm run dev          # dans un second terminal : pages du jeu, avec relais vers le serveur
```

Ouvrir l'adresse affichée par `npm run dev` ; pour des téléphones sur le même
Wi-Fi, lancer `npm run dev -- --host` et ouvrir l'adresse réseau affichée.

```bash
npm test             # simulation et salons
npm run build        # vérification des types + version de production dans dist/
npm start            # serveur de production : sert dist/ et les parties (variable PORT)
```

## Robots

L'hôte peut compléter la partie avec des robots, **seulement s'il le
souhaite** : dans le salon, choisir le niveau puis « 🤖 Ajouter un robot »
(jusqu'à 6 joueurs en tout ; ✕ pour en retirer un). Un joueur seul peut
ainsi jouer, en ligne comme en local. Les robots tournent sur le serveur (ou
sur le téléphone hôte en local), avec les mêmes règles que les joueurs
(`src/game/bot.ts`).

| Niveau | Réaction | Comportement |
|---|---|---|
| Débutant | lente (¼ s), parfois distrait | casse des caisses, n'attaque pas exprès, flâne |
| Professionnel | rapide (0,1 s) | ramasse les bonus, attaque quand l'occasion se présente |
| Expert | quasi immédiate | chasse les adversaires, ne se laisse pas enfermer |

Tous prévoient leur fuite en posant une bombe, évitent les flammes et les
réactions en chaîne, et les murs du resserrement. Simulations robot contre
robot : l'Expert bat le Professionnel, qui bat le Débutant ; un robot ne se
fait presque jamais sauter lui-même (`src/game/bot.test.ts`).

## Chat vocal (parties en ligne)

Dans le salon, « 🎙 Rejoindre le vocal » ouvre le micro (l'iPhone demande
l'autorisation la première fois). La voix passe **directement d'un téléphone
à l'autre** (WebRTC, `src/voice/voice.ts`) : le serveur ne fait que relayer
leur mise en relation (messages `voice` et `signal`), il ne reçoit pas le son
et rien n'est enregistré. Un lien par autre joueur présent dans le vocal.

- Chacun peut **couper son micro** (dans le salon, ou bouton micro en haut de
  l'écran en partie) et **ne plus entendre un joueur** (toucher sa pastille
  🔊 dans le salon). Le personnage de celui qui parle s'entoure de vert.
- Pas de vocal en local (sans connexion) : on est à côté les uns des autres.
- **Relais TURN** : certains réseaux mobiles empêchent la liaison directe.
  Si des joueurs ne s'entendent pas en 4G/5G, renseigner chez Render
  `TURN_URLS` (adresses séparées par des virgules, ex.
  `turn:relais.exemple:3478,turns:relais.exemple:443`), `TURN_USERNAME` et
  `TURN_CREDENTIAL` d'un service de relais : le serveur les transmet aux
  téléphones, sans nouvelle version de l'application.
- « Tester mon micro » (seul) : enregistre 3 s avec les réglages du vocal
  puis les fait réécouter, micro ouvert — de quoi vérifier l'autorisation,
  la qualité et le son du jeu pendant le vocal sans second joueur.
- Vérifié dans le navigateur avec des micros simulés (liaison établie, son
  transmis dans les deux sens, détection de la parole) ; à vérifier sur de
  vrais iPhone : qualité, écho, volume du jeu pendant le vocal.

## Jouer sans internet (Bluetooth et Wi-Fi direct)

Dans l'**application iPhone**, le bouton « Jouer en local »
permet de jouer à quelques mètres les uns des autres, sans réseau mobile ni
box : un téléphone crée le salon, les autres le voient apparaître (« Rejoindre
le salon de Léa ») et le touchent. Jusqu'à 6 joueurs, mêmes règles, arènes et
bonus qu'en ligne.

- **Transport** : Multipeer Connectivity d'Apple
  (`ios/App/App/NearbyPlugin.swift`), qui passe par le Bluetooth et le Wi-Fi
  direct entre iPhone ; messages chiffrés et compressés (zlib). Au premier
  usage, l'iPhone demande l'autorisation « réseau local ».
- **Le téléphone hôte fait le serveur** : il fait tourner le même salon
  (`src/net/room.ts`) et la même logique de connexion (`src/net/session.ts`)
  que le serveur en ligne, y joue lui-même et envoie l'état aux autres
  (`src/net/nearby.ts`). S'il quitte, les autres sont prévenus aussitôt. Un
  invité qui perd le contact quelques secondes reprend sa place.
- **Android** : pas encore. Il faudra la brique Nearby Connections de Google ;
  elle ne parle pas à Multipeer, donc une partie sans internet ne mêlera pas
  Android et iPhone. Le bouton n'apparaît que là où le mode fonctionne.
- **Navigateur** : impossible (le Web Bluetooth ne relie pas deux
  téléphones). En développement seulement (`npm run dev`), le mode est simulé
  entre onglets du même navigateur (`src/net/nearby-web.ts`), ce qui permet de
  tout vérifier sans iPhone.
- **Limite** : l'hôte fait tourner la partie ; s'il met l'application en
  arrière-plan, la partie s'interrompt pour tous.

À vérifier sur de vrais iPhone : la portée, la fluidité à 4–6 joueurs et la
batterie de l'hôte (le code compile sur le Mac de GitHub, mais Multipeer ne
fonctionne pas dans le simulateur de la CI).

## Mise en ligne

Le jeu est en ligne sur **https://boomz.onrender.com** (service Web Render
séparé de SYNeco, offre payante sans mise en veille). Render redéploie à chaque envoi sur la
branche suivie ; un redéploiement ferme les parties en cours.

Le jeu a besoin d'un hébergeur qui
fait tourner un serveur Node en continu avec WebSocket (un hébergement de
fichiers statiques comme Vercel ne suffit pas). Réglages du service Render :

- répertoire racine : `boomz` ;
- commande de build : `npm ci && npm run build` ;
- commande de démarrage : `npm start` ;
- aucune variable d'environnement à définir (Render fournit `PORT`) ;
- une seule instance (les salons sont en mémoire).

Le service est sur une offre payante : il ne s'endort pas, la première
connexion est immédiate. (Sur l'offre gratuite, il s'endormait après une
période d'inactivité et mettait jusqu'à une minute à se réveiller.)

## Organisation

- `src/game/` — la simulation, sans aucun accès au navigateur : pas de temps
  fixe (60 ticks/s), graine aléatoire, donc parties reproductibles. Elle tourne
  sur le serveur, ou sur le téléphone hôte d'une partie sans internet.
- `server/` — serveur en ligne : fichiers du jeu, WebSocket, boucle de
  simulation, statistiques.
- `src/net/` — protocole, salon (`room.ts`) et connexion d'un téléphone
  (`session.ts`) partagés par le serveur et l'hôte sans internet ; client
  réseau (connexion, interpolation) ; mode sans internet (`nearby.ts`).
- `src/render/` — arène et personnages (Canvas 2D).
- `src/input/` — clavier et manettes tactiles.
- `src/online.ts` / `index.html` — l'application : accueil, salon, partie.

## Vérifié

- 360 × 740 et 390 × 844 (portrait), 667 × 375 et 844 × 390 (paysage),
  1280 × 800 : aucun débordement, sur l'accueil, le salon et la partie, y
  compris à 6 joueurs.
- Six navigateurs séparés : salon rejoint par lien et par code, choix de
  l'arène, « prêt », lancement, rotation des arènes d'une manche à l'autre,
  match complet jusqu'à la victoire.
- Page rechargée en pleine partie : le joueur reprend sa place. Téléphone
  déconnecté : éliminé après 8 secondes.
- Chaque bonus et chaque obstacle d'arène a son test automatique (`npm test`).
