# Boomz

Jeu d'action en labyrinthe : chaque joueur pose des bombes pour détruire les
caisses et piéger ses adversaires, le dernier debout gagne la manche.

**Un joueur par téléphone** : chacun voit la partie sur son propre écran. On
joue ensemble en ligne, en simultané, via un code ou un lien d'invitation ; le
mode Bluetooth (sans internet) est prévu en phase 4.

Ce dossier est indépendant de SYNeco (`frontend/`, `backend/`) : il n'est ni
déployé ni relié à leur code.

## Où en est-on (roadmap)

| Phase | Contenu | État |
|---|---|---|
| 1. Prototype jouable | mécanique bombe/flamme/blocs, testée à 2 sur un même écran | fait (le mode test a été retiré depuis) |
| 2. MVP multijoueur | en ligne à 2-4 joueurs via lien d'invitation, salon d'attente, 1 arène finalisée | fait |
| 3. Alpha | 6 joueurs, 3-4 arènes, bonus classiques, tests externes | fait, sauf les tests avec des joueurs externes (à organiser) |
| 4. Bêta | mode Bluetooth / local sans internet, équilibrage, cosmétiques | à venir |

### Règles communes

- Grille 13 × 11 : piliers indestructibles en damier, caisses destructibles
  réparties aléatoirement (départs toujours dégagés).
- Bombes à retardement (2,5 s), flammes en croix (portée 2) arrêtées par les
  murs, première caisse touchée détruite, réactions en chaîne.
- Une bombe à la fois au départ ; on peut quitter sa bombe mais pas y revenir.
- Élimination au contact d'une flamme, manche au dernier survivant, match en
  3 manches gagnantes.
- Resserrement de l'arène : à 2:00, des murs tombent en spirale.

### Bonus (phase 3)

Environ une caisse sur trois cache un bonus, révélé quand elle a brûlé. On le
ramasse en marchant dessus ; une flamme le détruit. Le tirage est fait par le
serveur, qui ne dévoile jamais aux téléphones ce que cachent les caisses.

| Bonus | Effet |
|---|---|
| Flamme+ | Portée des explosions +1 (jusqu'à 8) |
| Bombe+ | Une bombe de plus en même temps (jusqu'à 8) |
| Vitesse+ | Déplacement plus rapide (plafonné) |
| Gilet pare-flamme | Encaisse une explosion ; clignote 1 s ensuite |
| Détonateur | Les bombes n'explosent que sur commande (bouton **Boum**, touche E), ou au bout de 10 s |
| Traverse-mur | Passe à travers les caisses (pas les piliers) |
| Traverse-bombe | Passe sur ses propres bombes |
| Kick | Pousse une bombe en marchant dessus : elle glisse jusqu'au prochain obstacle |

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

Dernier jalon de l'Alpha, à organiser : faire jouer des personnes qui ne
connaissent pas le jeu, sur leur propre téléphone et leur propre réseau, et
noter :

- s'ils comprennent sans explication comment rejoindre, bouger et poser une
  bombe ;
- si le délai de réaction de leur personnage les gêne (réseau mobile) ;
- les bonus qui paraissent trop forts ou inutiles, les arènes qu'ils préfèrent ;
- tout affichage cassé, avec le modèle de téléphone.

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

## Mode Bluetooth (phase 4) : contrainte à connaître

Un navigateur ne peut pas relier des téléphones entre eux en Bluetooth : le
Web Bluetooth ne sait parler qu'à des objets connectés (montre, capteur), pas
à un autre téléphone, et il n'existe pas sur iPhone. Le mode sans internet
demandera donc d'emballer le jeu dans une **application installée** (par
exemple avec Capacitor, qui réutilise ce code tel quel) et d'utiliser les
briques natives citées dans la roadmap : Nearby Connections sur Android,
Multipeer Connectivity sur iPhone. Ces deux briques ne se parlent pas entre
elles : pour mêler Android et iPhone dans une même partie, il faudra une brique
commune aux deux (Google propose une version iPhone de Nearby Connections),
à valider au début de la phase 4.

Le code est déjà organisé pour ce mode : la simulation ne dépend ni du
navigateur ni du serveur, le téléphone hôte pourra la faire tourner et relayer
l'état aux autres, comme le fait aujourd'hui le serveur en ligne.

## Mise en ligne

Le jeu est en ligne sur **https://boomz.onrender.com** (service Web Render
séparé de SYNeco, offre gratuite). Render redéploie à chaque envoi sur la
branche suivie ; un redéploiement ferme les parties en cours.

Le jeu a besoin d'un hébergeur qui
fait tourner un serveur Node en continu avec WebSocket (un hébergement de
fichiers statiques comme Vercel ne suffit pas). Réglages du service Render :

- répertoire racine : `boomz` ;
- commande de build : `npm ci && npm run build` ;
- commande de démarrage : `npm start` ;
- aucune variable d'environnement à définir (Render fournit `PORT`) ;
- une seule instance (les salons sont en mémoire).

Sur une offre gratuite, le service s'endort après une période d'inactivité :
la première connexion suivante prend alors quelques dizaines de secondes.

## Organisation

- `src/game/` — la simulation, sans aucun accès au navigateur : pas de temps
  fixe (60 ticks/s), graine aléatoire, donc parties reproductibles. Elle tourne
  sur le serveur ; en mode Bluetooth, elle tournera sur le téléphone hôte.
- `server/` — serveur de jeu : salons, reconnexion, boucle de simulation.
- `src/net/` — protocole et client réseau (connexion, interpolation).
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
