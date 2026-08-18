# Registre des activités de traitement — SYNeco

Établi en application de **l'article 30 du RGPD**. Document interne, à
présenter sur demande de la CNIL. Il ne se publie pas sur le site.

**Responsable du traitement :** Monsieur Loïc Vincent, entrepreneur individuel
exerçant sous le nom commercial VincentLV — SIREN 941 471 112 — 9 rue
Poincaré, 57240 Nilvange — syneco.pro@outlook.fr — 06 74 33 74 99.

**Délégué à la protection des données :** aucun. La désignation n'est pas
obligatoire : l'activité ne consiste ni en un suivi systématique à grande
échelle, ni en un traitement de données sensibles à grande échelle.

**Dernière mise à jour :** 18 août 2026.

> Ce registre décrit ce que le code fait. Toute évolution qui change les
> données collectées, les prestataires ou les durées doit s'y refléter le jour
> même — au même titre que dans la politique de confidentialité.

---

## 1. Gestion des comptes utilisateurs

| | |
|---|---|
| **Finalité** | Créer et gérer un compte, authentifier son titulaire |
| **Base légale** | Exécution du contrat (art. 6.1.b) |
| **Personnes concernées** | Utilisateurs du service |
| **Catégories de données** | Nom, adresse e-mail, empreinte bcrypt du mot de passe, date de création, offre souscrite, rôle. Si la double authentification est activée : secret chiffré, date d'activation, empreintes des codes de secours |
| **Destinataires** | Neon (base), Render (serveur) |
| **Transferts hors UE** | Serveur applicatif aux États-Unis (Virginie) |
| **Conservation** | Durée de vie du compte. Suppression immédiate et définitive à la demande, depuis l'application |
| **Sécurité** | Mot de passe jamais conservé en clair ; jeton d'accès de 15 min ; 5 connexions/min et par IP ; double authentification disponible (code à usage unique, secret chiffré) |

## 2. Conservation et lecture des documents

| | |
|---|---|
| **Finalité** | Conserver les documents administratifs, en extraire les échéances, les rendre consultables et cherchables |
| **Base légale** | Exécution du contrat |
| **Personnes concernées** | Utilisateurs, et toute personne mentionnée dans un document déposé |
| **Catégories de données** | Fichier et son contenu ; nom, type, format, taille, date d'ajout ; texte lu tronqué à 20 000 caractères ; émetteur, montant, date, référence, statut de règlement reconnus |
| **Destinataires** | Cloudflare R2 (fichiers), Neon (métadonnées et texte lu), Render (traitement) |
| **Transferts hors UE** | Traitement aux États-Unis (Virginie). Fichiers et base au repos dans l'Union |
| **Conservation** | Durée de vie du compte ; effacement immédiat à la suppression du document ou du compte |
| **Sécurité** | Contrôle de propriété à chaque requête ; type réel du fichier vérifié par sa signature ; plafond de 10 Mo |

> **Point de vigilance.** Un utilisateur peut déposer un document contenant
> des données de santé, une opinion syndicale ou une infraction — un
> décompte de mutuelle, un contrat, une décision de justice. Ces catégories
> particulières (art. 9) ne sont ni sollicitées, ni recherchées, ni indexées
> comme telles : elles se trouvent dans un fichier que l'utilisateur choisit
> de conserver, pour son propre usage. Le service ne les traite pas au sens
> de l'article 9.

## 3. Rappels d'échéance

| | |
|---|---|
| **Finalité** | Prévenir avant qu'une échéance n'arrive : 30 jours, 7 jours, 1 jour avant, puis le jour même |
| **Base légale** | Exécution du contrat — c'est la raison d'être du service |
| **Catégories de données** | Intitulé de l'échéance, date, statut, adresse e-mail du destinataire |
| **Destinataires** | Brevo (Sendinblue SAS, France) pour l'e-mail ; éditeur du navigateur pour la notification poussée |
| **Transferts hors UE** | Aucun pour l'e-mail. Notification poussée : selon le navigateur, contenu chiffré et illisible par l'acheminement |
| **Conservation** | Durée de vie de l'échéance |
| **Refus** | Les rappels par e-mail et le point hebdomadaire se désactivent séparément |

## 4. Analyse automatisée par intelligence artificielle *(offres payantes)*

| | |
|---|---|
| **Finalité** | Reconnaître le type, l'émetteur, les montants et les dates d'un document ; répondre à une question en langage naturel |
| **Base légale** | Exécution du contrat |
| **Catégories de données** | Texte du document (extrait) ; question posée et catalogue des données de l'utilisateur |
| **Destinataire** | Anthropic PBC (États-Unis) |
| **Transferts hors UE** | Oui. **Mécanisme à confirmer contractuellement** — voir tâches ouvertes |
| **Conservation** | Aucune conservation par le prestataire à des fins d'entraînement |
| **Décision automatisée** | Non. Les informations extraites sont des suggestions, corrigeables et refusables ; aucune échéance ni aucun contrat n'est créé sans validation |
| **Repli** | Sans cette fonctionnalité, l'analyse s'effectue localement et aucune donnée n'est transmise |

## 5. Facturation et gestion des clients *(offres professionnelles)*

| | |
|---|---|
| **Finalité** | Permettre à un indépendant d'émettre et suivre ses factures |
| **Base légale** | Exécution du contrat |
| **Personnes concernées** | **Les clients de l'utilisateur** |
| **Rôle de SYNeco** | **Sous-traitant** (art. 28). L'utilisateur est responsable du traitement |
| **Catégories de données** | Nom, e-mail, téléphone du client ; factures émises |
| **Conservation** | Durée de vie du compte de l'utilisateur |
| **Obligation** | Un contrat de sous-traitance doit être conclu — voir `docs/contrat-sous-traitance.md` |

## 6. Paiement des abonnements

| | |
|---|---|
| **Finalité** | Encaisser l'abonnement, gérer résiliations et remboursements |
| **Base légale** | Exécution du contrat ; obligation légale pour la conservation comptable |
| **Catégories de données** | Identifiant client et identifiant d'abonnement Stripe. **Aucune donnée bancaire** ne transite par l'application ni n'y est conservée |
| **Destinataire** | Stripe |
| **Conservation** | 10 ans pour les pièces comptables (art. L123-22 du Code de commerce) |

## 7. Partages de documents

| | |
|---|---|
| **Finalité** | Transmettre un document par lien à durée limitée |
| **Base légale** | Exécution du contrat |
| **Catégories de données** | Jeton du lien, date d'expiration, horodatage de chaque consultation |
| **Conservation** | Jusqu'à expiration ou révocation ; journal conservé le temps du partage |
| **Sécurité** | Jeton de 192 bits ; expiration obligatoire ; révocation à tout moment |

## 8. Journaux techniques et sécurité

| | |
|---|---|
| **Finalité** | Diagnostiquer les pannes, détecter les abus |
| **Base légale** | Intérêt légitime (art. 6.1.f) |
| **Catégories de données** | Méthode, route appelée, code de réponse, durée. **Aucun corps de requête, aucun mot de passe, aucun jeton, aucun contenu de document** |
| **Conservation** | 12 mois au maximum |

---

## Sous-traitants

| Prestataire | Rôle | Localisation |
|---|---|---|
| Vercel Inc. | Hébergement de l'interface | États-Unis |
| Render Services, Inc. | Serveur applicatif | États-Unis (Virginie) |
| Neon (Databricks, Inc.) | Base de données | Union européenne (Francfort) |
| Cloudflare, Inc. | Stockage des fichiers | Juridiction européenne |
| Brevo (Sendinblue SAS) | Acheminement des e-mails | France |
| Anthropic PBC | Analyse documentaire, si activée | États-Unis |
| Stripe | Paiement | États-Unis / Irlande |

---

## Mesures de sécurité

Décrites en détail dans [`SECURITY.md`](../SECURITY.md), qui distingue
explicitement ce qui est en place de ce qui manque encore.

---

## Tâches ouvertes

| Tâche | Échéance |
|---|---|
| Confirmer le mécanisme de transfert de chaque sous-traitant hors UE (clauses contractuelles types, adéquation, DPA signé) | À faire |
| Signer un contrat de sous-traitance avec chaque prestataire traitant des données pour le compte de SYNeco | À faire |
| Rédiger la procédure de notification de violation (art. 33 — 72 heures) | ✅ Faite — `docs/procedure-violation-donnees.md` |
| Adhérer à un médiateur de la consommation (CM2C) | Fin août 2026 |
