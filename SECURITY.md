# Sécurité de SYNeco

Ce document décrit ce que le code fait réellement, et ce qu'il ne fait pas
encore. Il s'adresse à un lecteur technique : un client qui pose des
questions précises, un prestataire, un auditeur.

Il est tenu à jour avec le code. **Une ligne de ce document qui ne serait plus
vraie est un défaut au même titre qu'un test qui échoue.**

Dernière revue : 17 août 2026.

## Signaler une faille

Écrire à <syneco.pro@outlook.fr>, si possible avec de quoi reproduire. Aucune
divulgation publique avant correction, s'il vous plaît. Réponse sous 72 heures.

---

## Ce qui est en place

### Authentification et sessions

| Point | État |
|---|---|
| Mots de passe | Empreinte **bcrypt**, coût 10. Jamais conservés en clair, jamais journalisés. |
| Jeton d'accès | **15 minutes**. |
| Jeton de renouvellement | **7 jours**. |
| Tentatives de connexion | **5 par minute** et par adresse IP. |
| Créations de compte | **8 par minute** et par adresse IP. |
| Limite générale | **100 requêtes par minute** et par adresse IP. |

Le rôle d'un compte est relu **en base à chaque requête**, jamais porté par le
jeton : un rôle retiré prend effet immédiatement, sans attendre l'expiration
d'un jeton déjà émis. Vérifié par un test.

### Contrôle d'accès (IDOR / BOLA)

Chaque lecture, modification et suppression est filtrée par l'identifiant du
propriétaire, au niveau de la requête en base — pas après coup dans le code
appelant.

Une suite de tests de bout en bout vérifie qu'un utilisateur ne peut ni lire,
ni modifier, ni supprimer le document, l'échéance, le contrat ou le partage
d'un autre, et qu'un accès sans jeton est refusé. Ces tests s'exécutent à
chaque intégration continue : une régression bloque la fusion.

Les fichiers ne sont **pas** servis par des URL signées de l'espace de
stockage. Chaque téléchargement transite par l'application, qui revérifie la
propriété à ce moment-là. C'est plus coûteux qu'une URL signée, mais une URL
signée reste valide si elle fuite, alors qu'ici le droit est réévalué à chaque
requête.

### Dépôt de fichiers

| Point | État |
|---|---|
| Taille maximale | **10 Mo**, refusée au niveau du décodeur, avant tout écrit. |
| Types acceptés | PDF, JPEG, PNG, WEBP. |
| Type déclaré | Vérifié. |
| **Type réel** | **Vérifié par la signature du contenu** (nombres magiques). |
| Exécutables | Refusés : aucun exécutable ne porte l'une des signatures admises. |
| Analyse antivirale | **Absente** — voir plus bas. |

Le type annoncé dans la requête vient du client et se modifie en une ligne.
Les premiers octets du fichier, eux, ne mentent pas : un exécutable renommé
`facture.pdf` et déclaré `application/pdf` est refusé. Un conteneur RIFF qui
n'est pas une image WEBP l'est également.

### Partages publics

Jeton de **24 octets aléatoires** (192 bits), tiré du générateur
cryptographique du système. Expiration **obligatoire** : 24 heures, 7 jours ou
30 jours. Chaque consultation est horodatée et consultable par le
propriétaire, qui peut révoquer le lien à tout moment.

### Web

| Point | État |
|---|---|
| En-têtes de sécurité | `helmet` (CSP, `X-Content-Type-Options`, `Referrer-Policy`…). |
| CORS | Liste blanche d'origines, définie par variable d'environnement. |
| CSRF | **Sans objet** : l'authentification passe par un en-tête `Authorization`, jamais par un cookie. Un site tiers ne peut pas le faire envoyer par le navigateur. |
| XSS | React échappe toute interpolation ; `dangerouslySetInnerHTML` n'est utilisé nulle part. |
| Validation des entrées | `ValidationPipe` en liste blanche : tout champ non déclaré est **rejeté**, pas ignoré. |
| Transport | HTTPS de bout en bout, terminé par l'hébergeur. |

### Erreurs et journaux

Un filtre global intercepte toute exception. Une erreur non prévue renvoie
`« Erreur interne du serveur »` — la trace d'appel n'est écrite que dans les
journaux du serveur, jamais renvoyée au client.

Les journaux d'accès contiennent la méthode, la route, le code de réponse et
la durée. **Aucun corps de requête, aucun mot de passe, aucun jeton, aucun
contenu de document.**

### Paiement

Le plan d'un compte ne change **que** dans le gestionnaire de webhooks Stripe,
dont la signature est vérifiée sur le corps brut de la requête. Une redirection
de retour forgée ne fait rien changer — testé.

Aucune donnée bancaire ne transite par l'application ni n'est conservée : la
saisie a lieu chez Stripe.

### Effacement

L'utilisateur supprime son compte depuis la page Abonnement. Trois obstacles
protègent ce geste irréversible : dépliage explicite du bloc, saisie du mot
« SUPPRIMER », puis **du mot de passe** — un jeton volé ne suffit donc pas à
effacer les documents de quelqu'un.

La suppression enchaîne, dans cet ordre : résiliation de l'abonnement Stripe
— sans quoi un compte effacé continuerait d'être prélevé —, retrait des
fichiers du stockage tant que la base sait encore où ils sont, puis
suppression du compte. Si la résiliation échoue, **la suppression est
interrompue** plutôt que de laisser un prélèvement sans compte.

Quatorze relations sont déclarées en suppression en cascade : documents,
échéances, contrats, partages, factures, clients, notifications et
abonnements aux notifications partent avec le compte.

Six tests de bout en bout le vérifient, dont le refus d'un mot de passe
erroné sans rien effacer, l'inutilisabilité du jeton ensuite, et la
libération de l'adresse e-mail pour une nouvelle inscription.

L'historique de restauration de la base est de **6 heures**. Passé ce délai,
une donnée supprimée ne subsiste nulle part.

### Vie privée

Aucun traqueur : ni Google Analytics, ni Meta, ni outil de mesure tiers.
Aucune donnée n'est vendue ni cédée.

Le contenu des notifications poussées est chiffré (VAPID) : le service
d'acheminement du navigateur ne peut pas le lire.

---

## Ce qui n'est pas en place

Cette section est la plus importante du document. Elle est tenue à jour avec
la même exigence que la précédente.

| Manque | Portée | Priorité |
|---|---|---|
| **Export de ses données** | Article 20 du RGPD, portabilité. Absent. | Haute |
| **Double authentification** | Mot de passe seul. | Haute |
| **Analyse antivirale des fichiers** | Aucune. Le contrôle de signature écarte les exécutables, pas un PDF piégé. | Moyenne |
| **Chiffrement applicatif des documents** | Le stockage chiffre au repos, mais l'éditeur et l'hébergeur peuvent techniquement lire les fichiers. **Ne jamais prétendre à un chiffrement de bout en bout.** | Moyenne |
| **Sauvegardes autonomes** | Un script `pg_dump` existe mais n'est ni planifié, ni chiffré, ni déporté. La seule protection réelle est la fenêtre de 6 heures de l'hébergeur — courte pour un incident découvert tardivement. | Haute |
| **Environnement de préproduction** | Développement et production seulement. | Moyenne |
| **Rotation des secrets** | Manuelle, sans calendrier ni procédure écrite. | Moyenne |
| **Procédure de violation de données** | Non écrite. L'article 33 impose une notification sous 72 heures. | Haute |
| **Registre des traitements** | Article 30. Absent. | Haute |
| **Contrat de sous-traitance (DPA)** | Article 28. SYNeco est sous-traitant pour les données clients du module de facturation ; aucun contrat type n'est proposé. | Haute |
| **Audit externe / test d'intrusion** | Jamais réalisé. | Moyenne |

### Transferts hors Union européenne

La base (Francfort) et les fichiers (juridiction européenne) sont en Europe au
repos. **Le serveur applicatif est en Virginie** : chaque requête y est traitée.
S'y ajoutent l'hébergement de l'interface (Vercel) et, si l'assistant IA est
activé, l'envoi de texte à Anthropic.

**Le mécanisme de transfert doit être vérifié prestataire par prestataire** —
clauses contractuelles types, décision d'adéquation, DPA signé — et cette
vérification n'a pas encore été faite. La politique de confidentialité emploie
aujourd'hui une formulation générale, à préciser une fois les contrats
examinés.

---

## Ce qu'il ne faut pas affirmer

Pour éviter toute promesse que le code ne tient pas :

- ❌ « Chiffrement de bout en bout » — faux.
- ❌ « Personne d'autre que vous ne peut lire vos documents » — faux, l'éditeur et l'hébergeur le peuvent techniquement.
- ❌ « Vos données ne quittent jamais l'Europe » — faux, le serveur applicatif est aux États-Unis.
- ❌ « Vos données ne sont accessibles qu'à vous » — à nuancer : aucun **autre utilisateur** n'y accède, mais des prestataires techniques interviennent.
- ✅ « Aucun autre utilisateur n'accède à vos données, et chaque requête le vérifie » — vrai, et testé.
- ✅ « Vos documents et votre base restent en Europe au repos » — vrai.
- ✅ « Aucun traqueur, aucune revente de données » — vrai.
