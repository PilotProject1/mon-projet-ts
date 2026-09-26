# Boomz

Jeu d'action en labyrinthe : chaque joueur pose des bombes pour détruire les
caisses et piéger ses adversaires, le dernier debout gagne la manche.

Ce dossier est indépendant de SYNeco (`frontend/`, `backend/`) : il n'est ni
déployé ni relié à leur code.

## Où en est-on (roadmap)

| Phase | Contenu | État |
|---|---|---|
| 1. Prototype jouable | 1 arène, 2 joueurs sur le même appareil, bombes/flammes/blocs | fait — `local.html` |
| 2. MVP multijoueur | en ligne à 2-4 joueurs via lien d'invitation, salon d'attente, 1 arène finalisée | fait — page d'accueil |
| 3. Alpha | 6 joueurs, 3-4 arènes, bonus classiques, tests externes | à venir |

### Règles communes

- Grille 13 × 11 : piliers indestructibles en damier, caisses destructibles
  réparties aléatoirement (départs toujours dégagés).
- Bombes à retardement (2,5 s), flammes en croix (portée 2) arrêtées par les
  murs, première caisse touchée détruite, réactions en chaîne.
- Une bombe à la fois par joueur ; on peut quitter sa bombe mais pas y revenir.
- Élimination au contact d'une flamme, manche au dernier survivant, match en
  3 manches gagnantes.
- Resserrement de l'arène : à 2:00, des murs tombent en spirale.

Pas encore de bonus ni de pouvoirs : ils arrivent en phase 3 et au-delà. Les
caractéristiques des joueurs (`speed`, `range`, `maxBombs`) sont prêtes à les
recevoir.

## Jouer en ligne (phase 2)

Chacun joue sur son propre téléphone et voit la partie sur son écran.

1. Un joueur choisit un pseudo et **crée une partie** : il obtient un code de
   5 caractères et un lien d'invitation (bouton **Partager**, qui ouvre le
   partage du téléphone : SMS, WhatsApp…).
2. Les autres ouvrent le lien, ou saisissent le code, et rejoignent le salon
   (2 à 4 joueurs). Le personnage dépend de l'ordre d'arrivée : Boomer,
   Blaster, Frost, Toxic.
3. Chacun appuie sur **Je suis prêt** ; l'hôte **lance la partie**.
4. En fin de match, **Retour au salon** permet d'enchaîner.

Commandes : joystick à gauche, bouton bombe à droite (paysage conseillé), ou
clavier (flèches / ZQSD + Espace).

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
- Les salons vivent en mémoire : un redémarrage du serveur ferme les parties en
  cours. Une seule instance du serveur doit tourner.

Limite connue : sans prédiction côté téléphone, son propre personnage réagit
avec le délai du réseau plus 100 ms. Correct sur un bon réseau ; à améliorer
en Alpha (prédiction locale et réconciliation).

## Jouer à deux sur un téléphone (phase 1)

Page `/local.html` (lien en bas de l'accueil). En portrait, le téléphone est
posé à plat entre les deux joueurs, face à face, la manette du joueur 2 tournée
vers lui ; en paysage, une manette de chaque côté.

| | Joueur 1 (Boomer) | Joueur 2 (Blaster) |
|---|---|---|
| Clavier | ZQSD (WASD en QWERTY) + Espace | Flèches + Entrée |

## Arène « Chantier »

Première arène finalisée graphiquement (phase 2) : vue 3/4, sol de terre
battue, piliers en béton, bordure cerclée de bandes de sécurité, caisses en
bois. Explosions avec halo, étincelles, fumée, éclats de bois et légère secousse
de l'écran. Tout est dessiné en Canvas 2D, sans image à télécharger.

## Personnages

La planche de référence est dans [`docs/personnages.jpg`](docs/personnages.jpg) :
Boomer (01, personnage principal) puis les 19 autres, avec les pouvoirs
décrits dans la roadmap. Le jeu dessine pour l'instant une version simplifiée
des quatre premiers personnages attribués dans le salon (couleurs, casquette,
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

## Mise en ligne

Non faite : c'est une décision à prendre. Le jeu a besoin d'un hébergeur qui
fait tourner un serveur Node en continu avec WebSocket (un hébergement de
fichiers statiques comme Vercel ne suffit pas). Exemple avec Render, déjà
utilisé pour SYNeco, en créant un **service Web séparé** :

- répertoire racine : `boomz` ;
- commande de build : `npm ci && npm run build` ;
- commande de démarrage : `npm start` ;
- aucune variable d'environnement à définir (Render fournit `PORT`) ;
- une seule instance (les salons sont en mémoire).

Sur une offre gratuite, le service s'endort après une période d'inactivité :
la première connexion suivante prend alors quelques dizaines de secondes.

## Organisation

- `src/game/` — la simulation, sans aucun accès au navigateur : pas de temps
  fixe (60 ticks/s), graine aléatoire, donc parties reproductibles. Partagée
  par le serveur et la page locale.
- `server/` — serveur de jeu : salons, reconnexion, boucle de simulation.
- `src/net/` — protocole et client réseau (connexion, interpolation).
- `src/render/` — arène et personnages (Canvas 2D).
- `src/input/` — clavier et manettes tactiles.
- `src/online.ts` / `index.html` — jeu en ligne ; `src/local.ts` /
  `local.html` — partie à deux sur un écran.

## Vérifié

- 390 × 844 (portrait), 844 × 390 (paysage), 1280 × 800 : aucun débordement
  horizontal, sur l'accueil, le salon et la partie.
- Quatre navigateurs séparés (deux téléphones en portrait, un en paysage, un
  ordinateur) : salon rejoint par lien et par code, « prêt », lancement, même
  état sur tous les écrans, match complet jusqu'à la victoire, retour au salon.
- Page rechargée en pleine partie : le joueur reprend sa place. Téléphone
  déconnecté : éliminé après 8 secondes.
