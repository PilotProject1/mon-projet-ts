# SYNeco

Application de gestion documentaire : conservation de documents administratifs,
extraction de leurs échéances et rappels avant expiration. Vendue par abonnement
mensuel à des particuliers et des indépendants.

- `frontend/` — React, TypeScript, Vite, Tailwind CSS v4, déployé sur Vercel
- `backend/` — NestJS, Prisma, PostgreSQL (Neon), déployé sur Render
- Documents stockés sur Cloudflare R2, paiements par Stripe

## Toute modification d'interface se vérifie sur mobile ET sur ordinateur

C'est la règle la plus importante de ce dépôt. La majorité des utilisateurs
consultent le site depuis un téléphone, et **plusieurs défauts sérieux sont
passés en production faute de cette vérification** : libellés écrasés dans une
colonne de quelques caractères, menus masqués derrière d'autres éléments,
panneaux débordant hors de l'écran.

Une fonctionnalité qui « marche » sur un écran large n'est pas terminée.

Concrètement, avant de considérer un changement d'interface comme abouti :

- le vérifier à **390 px** (téléphone) **et 1280 px** (ordinateur) ;
- contrôler qu'il n'y a **aucun débordement horizontal** :
  `document.documentElement.scrollWidth === clientWidth` ;
- se méfier des rangées `flex` qui placent un libellé et des actions côte à
  côte : sur téléphone, les actions écrasent le libellé. Empiler sur mobile
  (`flex-col`) et revenir en ligne à partir de `sm:` ;
- ajouter `min-w-0` et `truncate` sur un texte de longueur variable, sinon il
  déforme la mise en page ;
- vérifier qu'un correctif d'affichage n'a pas régressé l'autre taille d'écran.

Le projet utilise majoritairement le point de rupture `sm:` (640 px), plus
rarement `md:` (768 px) pour la bascule de la barre latérale.

## Vérifier dans l'application réelle, pas seulement à la compilation

Une compilation réussie ne prouve rien sur le rendu. Lancer l'application et
observer le résultat — captures d'écran comprises — a permis de détecter des
défauts invisibles autrement, y compris dans du code fraîchement écrit.

## Points de vigilance connus

- **Migrations** : `start:prod` applique `prisma migrate deploy` avant de
  démarrer. La commande de démarrage chez l'hébergeur doit rester
  `npm run start:prod`, jamais `node dist/main` — sinon le code part sans que
  le schéma de la base suive.
- **Variables d'environnement** : toute fonctionnalité qui en introduit une
  suppose une modification côté Render ou Vercel. Se demander systématiquement
  ce qui doit changer là-bas en même temps que le code.
- **Stripe** : le plan d'un compte ne change que dans le gestionnaire de
  webhooks, jamais depuis la redirection de retour, qu'un visiteur peut
  atteindre sans avoir payé.
- **TVA** : l'éditeur est en franchise en base (article 293 B du CGI). Les prix
  affichés sont nets et aucune taxe ne doit s'y ajouter.
- Ne jamais commiter de fichier `.env` ni de secret.

## Pages légales

`/mentions-legales`, `/confidentialite` et `/cgv` sont publiques et décrivent le
comportement réel du code. Toute évolution qui change les données collectées,
les prestataires utilisés ou les limites du service doit s'y refléter.

Les champs restant à renseigner apparaissent en surbrillance dans les pages
(composant `ARemplir`) : c'est délibéré, pour qu'aucune valeur manquante ne
passe inaperçue en production.
