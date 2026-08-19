# Dépôt de documents par e-mail — mise en service

Transférer un message à SYNeco pour que sa pièce jointe soit déposée et lue
automatiquement.

Ce document décrit ce qu'il reste à faire **en dehors du code** : la
configuration DNS et celle du prestataire de réception. Le code, lui, est en
place et testé.

---

## Ce qu'il faut savoir avant de commencer

**Vos DNS sont chez Gandi**, pas chez Cloudflare. Les serveurs de noms de
`syneco.pro` sont `ns-115-c.gandi.net`, `ns-160-a.gandi.net` et
`ns-69-b.gandi.net`. Cloudflare Email Routing, qui aurait été le choix
naturel puisque le stockage est déjà chez eux, **exige que le domaine soit
entièrement délégué à Cloudflare** : ce n'est pas envisageable ici sans
déplacer toute la zone, y compris les enregistrements de Vercel.

**Le domaine porte déjà du courrier.** `syneco.pro` a des enregistrements MX
qui pointent vers `spool.mail.gandi.net` et `fb.mail.gandi.net`. **Il ne faut
y toucher sous aucun prétexte** : les remplacer ferait disparaître le
courrier existant.

**D'où le sous-domaine.** Toute la réception se fera sur
`depot.syneco.pro`, qui n'existe pas encore et dont les enregistrements MX
sont indépendants de ceux du domaine principal. Le courrier de `syneco.pro`
continue de fonctionner exactement comme aujourd'hui.

**Le prestataire retenu est Brevo**, déjà utilisé pour l'envoi des rappels :
un compte de moins à créer et à surveiller.

---

## 1. Les enregistrements DNS, chez Gandi

Dans l'interface Gandi : **Domaines → syneco.pro → Enregistrements DNS**.

Ajoutez ces deux lignes, et **rien d'autre** :

| Type | Nom | Priorité | Valeur | TTL |
|---|---|---|---|---|
| `MX` | `depot` | `10` | `inbound1.sendinblue.com.` | 10800 |
| `MX` | `depot` | `20` | `inbound2.sendinblue.com.` | 10800 |

Trois précautions :

- Le nom est **`depot`**, pas `depot.syneco.pro` : Gandi complète le domaine
  tout seul. Écrire le nom complet créerait `depot.syneco.pro.syneco.pro`.
- La valeur se termine par un **point**. C'est ce qui la rend absolue ; sans
  lui, certains éditeurs y ajoutent le domaine.
- **Ne modifiez ni ne supprimez les MX existants sur `@`.** Ce sont ceux de
  votre messagerie.

La propagation demande de quelques minutes à quelques heures. Pour vérifier
depuis un terminal :

```
dig MX depot.syneco.pro +short
```

Vous devez voir les deux hôtes `sendinblue`. Tant que la commande ne rend
rien, inutile de passer à la suite.

---

## 2. La réception, chez Brevo

1. **Ajoutez le domaine de réception.** Dans Brevo, section *Inbound parsing*
   (Transactionnel → Paramètres → Inbound parsing), déclarez
   `depot.syneco.pro`.

2. **Créez le webhook.** Il doit pointer vers votre serveur applicatif :

   ```
   https://syneco.onrender.com/depot-email/reception
   ```

   Type : `inbound`. Événement : `inboundEmailProcessed`.

3. **Ajoutez l'en-tête d'authentification** si Brevo le permet dans votre
   interface :

   ```
   x-depot-cle: <valeur de INBOUND_WEBHOOK_KEY>
   ```

   > Si l'interface ne permet pas d'en-tête personnalisé, le webhook devra
   > être créé par l'API `POST /v3/webhooks`. Dites-le-moi, la commande est
   > courte.

4. **Récupérez une clé d'API Brevo** (Paramètres → Clés API). Elle sert à
   télécharger les pièces jointes, que le webhook ne transporte pas : il
   n'envoie qu'un jeton de téléchargement.

---

## 3. Les variables d'environnement, sur Render

| Clé | Valeur |
|---|---|
| `INBOUND_DOMAIN` | `depot.syneco.pro` |
| `INBOUND_WEBHOOK_KEY` | chaîne aléatoire — bouton « Generate » |
| `BREVO_API_KEY` | la clé d'API récupérée à l'étape 2.4 |

**Sans ces trois variables, la fonctionnalité reste éteinte** et le bloc
n'apparaît pas dans l'application. Rien ne casse : c'est le comportement
voulu, comme pour la double authentification et les sauvegardes.

---

## 4. Vérifier

1. Dans l'application, page **Documents** : un bloc « Envoyer un document par
   e-mail » doit apparaître avec votre adresse personnelle.
2. Copiez-la, et transférez-vous un message avec une facture en pièce jointe.
3. Le document doit apparaître dans la liste en une minute, son type reconnu.

Si rien n'arrive, l'ordre de diagnostic est celui-ci :

| Symptôme | Cause la plus probable |
|---|---|
| Le bloc n'apparaît pas | `INBOUND_DOMAIN` ou `BREVO_API_KEY` absente sur Render |
| Le message revient en erreur de distribution | Les MX ne sont pas encore propagés |
| Brevo reçoit mais le webhook échoue en 403 | L'en-tête `x-depot-cle` ne correspond pas |
| Le webhook répond 200 mais rien n'est déposé | Voir les journaux Render : le motif du rejet y est écrit |

Les journaux Render nomment précisément ce qui a été écarté : *destinataire
inconnu*, *aucune pièce jointe*, *type de fichier refusé*, *pièce non
récupérée*.

---

## Ce que le code fait, et ne fait pas

**L'adresse contient un secret.** L'expéditeur d'un courriel se falsifie en
trois lignes : accepter « tout message venant de l'adresse du compte »
permettrait à n'importe qui de déposer un document chez quelqu'un d'autre.
C'est donc la **destination** qui identifie le compte, et sa partie secrète
fait seize caractères tirés au hasard, soit environ 76 bits.

Elle n'est créée qu'à la première demande — une adresse qui existe est une
porte ouverte — et se renouvelle depuis l'application, l'ancienne cessant
aussitôt de fonctionner.

**Les pièces jointes ne sont pas crues sur parole.** Le type annoncé ne
décide de rien : c'est la signature du contenu qui tranche, exactement comme
pour un dépôt fait depuis le site. Un exécutable renommé `facture.pdf` est
refusé. Le plafond de 10 Mo et le quota de l'offre s'appliquent également.

**Ce que cela ne couvrira pas**, et qu'il faut savoir avant de le promettre :
beaucoup de fournisseurs — EDF, les banques — n'envoient plus la facture en
pièce jointe mais un message annonçant qu'elle est disponible, avec un lien.
Sur ceux-là, le transfert n'apportera rien. La fonctionnalité vise les
factures réellement jointes : artisans, indépendants, OVH, assurances, petits
fournisseurs.

**Un message sans pièce jointe est ignoré silencieusement.** Aucune réponse
n'est renvoyée à l'expéditeur : le serveur ne doit pas devenir un moyen
d'envoyer du courrier à des tiers.
