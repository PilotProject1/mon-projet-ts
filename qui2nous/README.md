# Qui2Nous ?

Jeu d'ambiance de 3 à 8 joueurs : chacun joue sur son téléphone et rejoint la
partie avec un code de salon. La feuille de route complète est dans
[FEUILLE-DE-ROUTE.md](FEUILLE-DE-ROUTE.md).

- `src/server/` : serveur de jeu (Node, Express, Socket.IO). Il est seul maître
  de l'état de la partie et envoie à chaque téléphone uniquement ce que ce
  joueur a le droit de voir.
- `src/client/` : interface (React, Vite, Tailwind CSS v4), pensée d'abord pour
  le téléphone.
- `src/shared/` : contrat d'échange entre les deux, et banque de questions.

## Développement

```bash
npm install
npm run dev:server   # serveur de jeu sur le port 3001
npm run dev:client   # interface sur http://localhost:5173
```

Pour jouer à plusieurs depuis de vrais téléphones, ils doivent être sur le
même Wi-Fi que l'ordinateur. Ouvrez l'adresse « Network » affichée par Vite.

```bash
npm test            # règles du jeu (points, phases, déconnexions…)
npm run typecheck
```

## Tester seul

Dans le lobby, le créateur du salon touche **🤖 Ajouter un robot** deux fois :
avec deux robots, on atteint les 3 joueurs nécessaires pour lancer. Les robots
répondent et votent au hasard, quelques secondes après le début de chaque phase.

## Mise en ligne sur Render

La configuration est dans [`render.yaml`](../render.yaml), à la racine du
dépôt. À faire une seule fois :

1. Sur [dashboard.render.com](https://dashboard.render.com) : **New** >
   **Blueprint**.
2. Choisir le dépôt `mon-projet-ts`, puis la branche **`claude/qui2nous`**.
3. Valider (**Apply**). Render installe, compile et démarre le service
   `qui2nous`, puis donne son adresse (`https://qui2nous-xxxx.onrender.com`).

Ensuite, chaque push sur la branche redéploie automatiquement. L'adresse
`/sante` indique si le serveur répond.

Aucune variable d'environnement n'est à renseigner : Render fournit `PORT`.

À savoir sur l'offre gratuite :

- le service s'endort après 15 minutes sans visite. Le premier chargement
  suivant prend alors environ une minute ;
- les parties sont gardées en mémoire. Un redéploiement ou une mise en veille
  interrompt les parties en cours, d'où une seule instance (`numInstances: 1`).

Pour reproduire la production en local :

```bash
npm run build && npm start   # le serveur sert aussi l'interface compilée
```
