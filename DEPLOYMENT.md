# Déploiement en production (Phase 12)

Ce guide liste les étapes à faire toi-même pour mettre SYNeco en ligne. Le code est déjà prêt (variables d'environnement, CORS, stockage S3 optionnel, health-check, CI) — il reste à créer les comptes et à connecter les services.

## Vue d'ensemble

| Composant | Exemple de plateforme | Pourquoi |
|---|---|---|
| Frontend (React/Vite) | Vercel | Recommandé dans le cahier, gratuit pour un projet perso, déploiement automatique à chaque push |
| Backend (NestJS) | Render ou Railway | Supportent Node.js directement, un plan gratuit/pas cher suffit pour démarrer |
| Base de données | Neon, Supabase ou le Postgres managé de Render/Railway | Postgres managé avec sauvegardes automatiques incluses |
| Stockage fichiers | Cloudflare R2 (S3-compatible) | Gratuit jusqu'à 10 Go, la plupart des hébergeurs backend n'ont pas de disque persistant |

Tu n'es pas obligé de suivre exactement ces plateformes, mais le code est écrit pour fonctionner avec n'importe quel équivalent (tout hébergeur Node.js, tout Postgres, tout stockage S3-compatible).

## Étape 1 — Base de données de production

1. Crée un compte chez un fournisseur Postgres managé (Neon, Supabase, ou l'add-on Postgres de ton hébergeur backend).
2. Récupère l'URL de connexion (`DATABASE_URL`).
3. Les migrations sont appliquées automatiquement à chaque démarrage du serveur (voir étape 3), tu n'as rien à lancer à la main. Pour les appliquer ponctuellement depuis ta machine :
   ```bash
   cd backend
   DATABASE_URL="<ton-url-de-prod>" npx prisma migrate deploy
   ```
4. Vérifie que les sauvegardes automatiques sont activées côté fournisseur (c'est le cas par défaut chez Neon/Supabase/Render).

## Étape 2 — Stockage des fichiers

Par défaut l'application stocke les fichiers sur disque (`STORAGE_DRIVER=local`), ce qui ne fonctionne que si ton hébergeur a un disque persistant. La plupart n'en ont pas (le disque est effacé à chaque redéploiement).

Pour la prod, deux choix :
- **Ton hébergeur a un disque persistant** (volume monté) → tu peux garder `STORAGE_DRIVER=local`.
- **Sinon** → crée un bucket S3-compatible (Cloudflare R2 recommandé) et configure :

  > ⚠️ Sur R2, la **juridiction** du bucket (« European Union ») se choisit **à la création et ne peut plus être modifiée ensuite**. Sans elle, le bucket reçoit une simple indication de placement régional, qui ne garantit pas contractuellement que les fichiers restent dans l'Union européenne. Comme l'application stocke des documents personnels, ce choix se fait au moment de créer le bucket : y revenir plus tard impose d'en créer un nouveau et d'y recopier tous les fichiers. L'endpoint à reporter dans `S3_ENDPOINT` est celui affiché par Cloudflare dans les réglages du bucket.
  ```
  STORAGE_DRIVER=s3
  S3_ENDPOINT=https://xxxx.r2.cloudflarestorage.com
  S3_BUCKET=syneco-documents
  S3_REGION=auto
  S3_ACCESS_KEY_ID=...
  S3_SECRET_ACCESS_KEY=...
  ```

## Étape 3 — Déployer le backend

1. Crée un compte sur ton hébergeur (Render, Railway...) et connecte ton dépôt GitHub.
2. Configure le service :
   - Répertoire racine : `backend`
   - Commande de build : `npm run build`
   - Commande de démarrage : `npm run start:prod`

   > ⚠️ La commande de démarrage doit bien être `npm run start:prod`, et non `node dist/main`. C'est elle qui applique les migrations Prisma en attente avant de lancer le serveur. Avec `node dist/main`, le code est déployé mais le schéma de la base ne suit pas : les requêtes échouent alors avec des erreurs du type « The column `X` does not exist in the current database ».
3. Renseigne les variables d'environnement (voir la checklist en bas de page).
4. Déploie. Vérifie que `https://ton-backend.example.com/health` répond `{"status":"ok", ...}`.

## Étape 4 — Déployer le frontend (Vercel)

1. Connecte ton dépôt GitHub sur Vercel.
2. Répertoire racine : `frontend`.
3. Variable d'environnement : `VITE_API_URL=https://ton-backend.example.com`.
4. Déploie. Vercel te donne une URL du type `syneco.vercel.app`.

## Étape 5 — Reconnecter CORS

Une fois l'URL du frontend connue, mets à jour la variable `FRONTEND_ORIGIN` côté backend avec cette URL exacte (sinon le navigateur bloquera les appels API). Redéploie le backend après ce changement.

## Étape 6 — Domaine personnalisé et HTTPS

- Si tu as un nom de domaine, connecte-le dans les réglages de ton projet Vercel (frontend) et éventuellement de ton hébergeur backend.
- HTTPS est mis en place automatiquement par Vercel/Render/Railway (certificat généré et renouvelé pour toi), rien à faire de plus.
- Pense à mettre à jour `FRONTEND_ORIGIN` avec le domaine final une fois connecté.

## Étape 7 — Monitoring

- Le backend expose `GET /health` (vérifie la connexion à la base de données). Branche un service de monitoring gratuit dessus, par exemple [UptimeRobot](https://uptimerobot.com), pour être alerté si l'application tombe.
- Les logs de requêtes (méthode, route, code, durée) sont déjà écrits sur la sortie standard — consultables directement dans les logs de ta plateforme d'hébergement.

## Étape 8 — Sauvegardes

- La base de données est sauvegardée automatiquement par le fournisseur managé (vérifie cette option dans ses réglages).
- Pour une sauvegarde manuelle ponctuelle (avant une migration risquée par exemple), tu peux toujours lancer depuis ta machine :
  ```bash
  cd backend
  DATABASE_URL="<ton-url-de-prod>" npm run backup
  ```

## Étape 9 — Déploiement continu

Déjà en place : [.github/workflows/ci.yml](.github/workflows/ci.yml) fait tourner les tests (backend + frontend) à chaque push sur `main`. Une fois ton dépôt connecté à Vercel et à ton hébergeur backend, chaque push sur `main` redéploie automatiquement — il n'y a rien de plus à configurer.

Les deux plateformes redéploient en parallèle, et rien ne garantit laquelle
finit la première. L'interface doit donc rester debout devant une API encore
antérieure : lorsqu'un champ attendu manque, elle s'en passe — la formule
annuelle, par exemple, n'apparaît qu'une fois le backend à jour — plutôt que
de tomber. C'est une contrainte à garder en tête pour toute donnée nouvelle
servie par l'API et lue par le frontend.

## Checklist des variables d'environnement en production

**Backend**
```
NODE_ENV=production
DATABASE_URL=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
FRONTEND_ORIGIN=https://ton-frontend.example.com
STORAGE_DRIVER=local ou s3
# si s3 :
S3_ENDPOINT=...
S3_BUCKET=...
S3_REGION=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
# optionnel — active l'extraction IA des documents et la recherche en langage naturel
# sans cette clé, l'application fonctionne normalement (repli sur le moteur heuristique)
ANTHROPIC_API_KEY=...
# optionnel — paiement des abonnements
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_PREMIUM=...
STRIPE_PRICE_PRO=...
# tarifs annuels (récurrence « yearly » côté Stripe) — sans eux, seul le
# mensuel est proposé et la bascule « Annuel » ne s'affiche pas
STRIPE_PRICE_PREMIUM_ANNUEL=...
STRIPE_PRICE_PRO_ANNUEL=...
# optionnel — rappels d'échéance par e-mail
# sans ces variables, les rappels restent visibles dans l'application mais aucun e-mail ne part
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
MAIL_FROM=SYNeco <rappels@ton-domaine.example.com>
# nécessaire si l'instance s'endort : déclenchement des rappels depuis l'extérieur
REMINDERS_TRIGGER_TOKEN=...
# optionnel — notifications push (générées par `npm run vapid`)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:contact@ton-domaine.example.com
```

## Étape 11 — Rappels d'échéance par e-mail

Les rappels partent d'une tournée quotidienne exécutée par le backend, **à 8 h heure de Paris**, aux paliers 30 jours, 7 jours, 1 jour, puis le jour de l'échéance. Une échéance ne déclenche qu'un rappel par palier, et seules les échéances encore à faire sont concernées.

1. Ouvre un compte chez un expéditeur d'e-mails transactionnels — **Brevo** convient bien (offre gratuite, hébergement en France). Un compte Outlook ou Gmail fonctionne aussi, mais les quotas sont bas et les messages partent plus souvent en indésirable.
2. Fais valider ton domaine chez le fournisseur (enregistrements SPF et DKIM à ajouter chez Gandi). Sans cette étape, les rappels arriveront en indésirable, voire pas du tout.
3. Renseigne les cinq variables ci-dessus côté hébergeur, puis redéploie. `MAIL_FROM` doit être une adresse **autorisée par le fournisseur**, sans quoi l'envoi est refusé.
4. Vérifie l'envoi sans attendre 8 h : le bouton « Rappel » d'une échéance emprunte exactement le même chemin, e-mail compris. En local, `npm run rappels` déclenche la tournée complète.

> Un utilisateur peut couper les rappels par e-mail depuis la page Échéances. Ses rappels restent alors consultables dans l'application.

### Faire partir les rappels sans offre payante

Sur une offre Render gratuite, l'instance s'endort après quelques minutes sans trafic : le planificateur interne ne s'exécute alors pas à 8 h. Plutôt que de payer, ou de maintenir le service éveillé toute la journée en le pinguant, **un appel programmé depuis l'extérieur réveille le serveur et déclenche la tournée dans le même mouvement**.

1. Choisis une chaîne longue et aléatoire, par exemple avec `openssl rand -hex 32`, et déclare-la côté hébergeur sous `REMINDERS_TRIGGER_TOKEN`. Sans elle, le point d'entrée reste fermé.
2. Crée un compte gratuit sur [cron-job.org](https://cron-job.org) (ou équivalent), puis une tâche :
   - **URL** : `https://ton-backend.example.com/rappels/executer`
   - **Méthode** : `POST`
   - **En-tête** : `x-rappels-token: <ta chaîne>`
   - **Horaire** : tous les jours à 8 h
   - **Délai d'attente** : au moins 60 secondes — une instance endormie met une trentaine de secondes à se réveiller.
3. Déclenche la tâche une fois à la main : la réponse indique le nombre de rappels envoyés.

La tournée reste idempotente : que ce soit l'appel externe, le planificateur interne ou les deux qui l'exécutent, **un palier ne donne jamais lieu à deux rappels**. Il n'y a donc rien à désactiver.

## Étape 12 — Notifications push

Le rappel s'affiche alors sur l'écran de l'appareil, application fermée.

1. Génère la paire de clés **une seule fois** : `npm run vapid`. En changer invaliderait tous les appareils déjà autorisés, qui cesseraient d'être notifiés.
2. Déclare `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` côté hébergeur, puis redéploie. La clé privée est un secret : jamais dans le dépôt.
3. Sur le site, page Échéances, active « Notifications sur cet appareil ». Le navigateur demande l'autorisation ; l'accepter enregistre l'appareil.

> **Sur iPhone**, les notifications ne fonctionnent qu'après avoir ajouté SYNeco à l'écran d'accueil : Safari ne les autorise pas sur un simple onglet. L'interface le rappelle si le cas se présente.

> Le contenu est chiffré de bout en bout : le service de notification du navigateur (Google, Mozilla, Apple) achemine le message sans pouvoir le lire. Un appareil qui se désabonne est retiré automatiquement au premier envoi refusé.

## Étape 10 — Paiement des abonnements (Stripe)

1. Crée les deux produits dans Stripe (Premium et Professionnel), chacun avec un tarif **récurrent mensuel en euros**, et relève leur identifiant `price_...`.
   Pour la formule annuelle, ajoute à ces mêmes produits un second tarif **récurrent annuel** — 49,90 € pour Premium, 199 € pour Professionnel — et relève aussi leur `price_...`.
2. Déclare un webhook vers `https://ton-backend.example.com/billing/webhook`, abonné aux événements `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` et `customer.subscription.deleted`. Stripe fournit alors le secret `whsec_...`.
3. Renseigne les quatre variables ci-dessus côté hébergeur, puis redéploie.
4. Active le **portail client** dans les réglages Stripe : c'est lui qui permet à un abonné de changer de carte, récupérer ses factures et résilier sans intervention de ta part.
   Le portail a une **configuration par mode** : celle du mode test ne vaut pas pour la production, et inversement. Sans elle, le bouton « Ouvrir le portail de facturation » échoue.
   Le changement d'offre, lui, ne dépend pas du portail : il passe par l'API depuis la page Abonnement, et fonctionne y compris sur un abonnement dont la résiliation est programmée — cas que le portail refuse.

> Le plan d'un compte n'est jamais modifié par la redirection de retour après paiement, qu'un visiteur peut atteindre sans avoir payé, mais uniquement par les webhooks dont la signature a été vérifiée. Un abonnement impayé ou résilié ramène automatiquement le compte au plan gratuit.

### Contrôle des tarifs au démarrage

Une erreur de configuration Stripe ne se voit pas à l'œil nu : un identifiant
collé dans la mauvaise variable reste un identifiant valide, et le paiement
aboutit — au mauvais montant, ou pour la mauvaise durée. L'application compare
donc au démarrage chaque tarif configuré à ce que Stripe en dit (existence,
activité, devise, périodicité, montant) et écrit dans les journaux ce qui ne
concorde pas :

```
ERROR [BillingService] Tarif premium annuel (STRIPE_PRICE_PREMIUM_ANNUEL) : périodicité month au lieu de year, montant 4.99 € au lieu de 49.9 €
```

Après avoir renseigné les tarifs chez l'hébergeur, **relire les journaux de
démarrage est la vérification la plus rapide** : sans ligne `Tarif …`, tout
concorde. Le contrôle ne bloque jamais le démarrage — une panne Stripe au
lancement empêcherait de servir des pages qui n'ont rien à voir avec le
paiement — et se contente alors d'un avertissement.

Une variable annuelle absente n'est pas une erreur : la formule n'est
simplement pas vendue, et la bascule « Annuel » disparaît de la page
Abonnement plutôt que de mener à un paiement refusé.

**Frontend**
```
VITE_API_URL=https://ton-backend.example.com
```

Ne jamais commiter ces valeurs réelles dans le dépôt — elles se configurent dans l'interface de chaque plateforme d'hébergement.
