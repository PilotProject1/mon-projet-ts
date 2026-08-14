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
```

**Frontend**
```
VITE_API_URL=https://ton-backend.example.com
```

Ne jamais commiter ces valeurs réelles dans le dépôt — elles se configurent dans l'interface de chaque plateforme d'hébergement.
