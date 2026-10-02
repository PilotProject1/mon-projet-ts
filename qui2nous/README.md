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

## Production

```bash
npm run build && npm start   # le serveur sert aussi l'interface compilée
```

Le serveur écoute sur `PORT` (3001 par défaut). L'hébergeur doit accepter les
WebSockets : un service web Render convient, Vercel non. Les parties sont
gardées en mémoire, donc un redémarrage du serveur interrompt les parties en
cours, et il ne faut qu'une seule instance.
