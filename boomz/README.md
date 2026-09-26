# Boomz — prototype jouable (phase 1)

Jeu d'action en labyrinthe : chaque joueur pose des bombes pour détruire les
blocs et piéger son adversaire, le dernier debout gagne la manche.

Ce dossier est indépendant de SYNeco (`frontend/`, `backend/`) : il n'est ni
déployé ni relié à leur code.

## Périmètre de la phase 1 (roadmap)

> 1 arène, 2 joueurs en local sur le même appareil (multi-touch),
> mécanique bombe/flamme/blocs fonctionnelle.

- Grille 13 × 11 : piliers indestructibles en damier, blocs destructibles
  répartis aléatoirement (départs toujours dégagés).
- Bombes à retardement (2,5 s), flammes en croix (portée 2) arrêtées par les
  murs, premier bloc touché détruit, réactions en chaîne entre bombes.
- Une bombe à la fois par joueur ; on peut quitter sa bombe mais pas y revenir.
- Élimination au contact d'une flamme, manche au dernier survivant, match en
  3 manches gagnantes (best of 5).
- Resserrement de l'arène : à 2:00, des murs tombent en spirale.

Pas encore de bonus : ils arrivent en phase 3 (Alpha). Les caractéristiques
des joueurs (`speed`, `range`, `maxBombs`) sont déjà en place pour les recevoir.

## Personnages

La planche de référence est dans [`docs/personnages.jpg`](docs/personnages.jpg) :
Boomer (01, personnage principal) puis les 19 autres, avec les pouvoirs
décrits dans la roadmap.

Dans le prototype, le joueur 1 incarne **Boomer** et le joueur 2 **Blaster**
(03), dessinés en version simplifiée à partir de la planche (couleurs, casquette,
pompon, grands yeux). Leurs pouvoirs ne sont pas encore actifs : les capacités
avec temps de recharge viendront dans une phase ultérieure, sur la base des
mêmes règles communes.

## Commandes

| | Joueur 1 | Joueur 2 |
|---|---|---|
| Tactile | manette du bas (portrait) / de gauche (paysage) | manette du haut, tournée vers lui (portrait) / de droite (paysage) |
| Clavier | ZQSD (WASD en QWERTY) + Espace | Flèches + Entrée |

En portrait, le téléphone est posé à plat entre les deux joueurs, face à face.
Le joystick apparaît sous le pouce ; chaque contact est suivi séparément, donc
les deux joueurs jouent en même temps.

## Lancer

```bash
cd boomz
npm install
npm run dev      # puis ouvrir l'adresse affichée (ajouter --host pour un téléphone du même Wi-Fi)
npm test         # tests de la simulation
npm run build    # vérification des types + version de production dans dist/
```

## Organisation

- `src/game/` — la simulation, sans aucun accès au navigateur : pas de temps
  fixe (60 ticks/s), graine aléatoire, donc parties reproductibles. C'est ce
  qui permettra en phase 2 de la faire tourner sur un serveur qui fait
  autorité, les téléphones n'envoyant que leurs commandes.
- `src/render/` — dessin de l'arène sur un canvas 2D (graphismes provisoires :
  la direction artistique finale arrive en phase 2).
- `src/input/` — clavier et manettes tactiles.
- `src/main.ts` — boucle de jeu et interface.

## Vérifié

- 390 × 844 (portrait), 844 × 390 (paysage), 1280 × 800 : aucun débordement
  horizontal.
- Deux contacts tactiles simultanés (un joueur se déplace pendant que l'autre
  pose une bombe), clavier, fin de manche, fin de match et « Rejouer ».
