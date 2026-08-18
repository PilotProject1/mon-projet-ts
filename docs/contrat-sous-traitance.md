# Contrat de sous-traitance — Annexe RGPD

**Modèle. À faire relire par un juriste avant toute signature.**

Ce document est destiné aux utilisateurs professionnels de SYNeco qui
enregistrent, via le module de facturation, des données concernant **leurs
propres clients**. Dans ce cas précis, et dans celui-là seulement, les rôles
s'inversent : l'utilisateur devient responsable du traitement, et SYNeco son
sous-traitant.

Il est conclu en application de **l'article 28 du RGPD**, et complète les
conditions générales de vente sans s'y substituer.

---

## Article 1 — Objet

Le présent contrat encadre le traitement, par SYNeco, des données à caractère
personnel dont le Client est responsable, aux seules fins d'exécution du
service souscrit.

## Article 2 — Qualité des parties

**Le Client** est responsable du traitement des données de ses propres clients
qu'il enregistre dans le module de facturation. Il lui appartient de disposer
d'une base légale et d'informer les personnes concernées.

**SYNeco**, édité par Monsieur Loïc Vincent (VincentLV, SIREN 941 471 112,
9 rue Poincaré, 57240 Nilvange), agit en qualité de sous-traitant pour ces
données.

Pour toutes les autres données — compte, documents personnels, échéances,
contrats — SYNeco est responsable du traitement, et sa
[politique de confidentialité](https://syneco.pro/confidentialite)
s'applique.

## Article 3 — Description du traitement

| | |
|---|---|
| **Nature** | Conservation, affichage, modification et suppression |
| **Finalité** | Permettre au Client d'émettre et suivre ses factures |
| **Durée** | Durée du compte du Client |
| **Catégories de personnes** | Clients du Client |
| **Catégories de données** | Nom, adresse e-mail, numéro de téléphone, factures émises et leur statut |
| **Données sensibles** | Aucune n'est sollicitée ni requise |

## Article 4 — Obligations de SYNeco

SYNeco s'engage à :

1. **Ne traiter les données que sur instruction documentée du Client**, l'usage
   du service valant instruction. SYNeco informe le Client si une instruction
   lui paraît constituer une violation du règlement.
2. **Ne pas utiliser ces données à ses propres fins**, ni pour de la
   prospection, ni pour entraîner un modèle, ni pour les céder à un tiers.
3. **Garantir la confidentialité**, et n'y donner accès qu'aux personnes
   strictement nécessaires, tenues à une obligation de confidentialité.
4. **Mettre en œuvre les mesures de sécurité** décrites à l'article 6.
5. **Assister le Client** dans la réponse aux demandes d'exercice de droits
   (accès, rectification, effacement, portabilité, opposition), dans un délai
   raisonnable.
6. **Notifier au Client toute violation de données** le concernant, **sans
   délai injustifié et au plus tard 48 heures** après en avoir pris
   connaissance, avec la nature de la violation, les catégories et le nombre
   approximatif de personnes concernées, les conséquences probables et les
   mesures prises.
7. **Supprimer ou restituer les données** au terme du contrat, au choix du
   Client. La suppression du compte, opérée par le Client depuis
   l'application, entraîne l'effacement définitif de l'ensemble de ces
   données.
8. **Tenir à disposition** les informations nécessaires pour démontrer le
   respect de ces obligations.

## Article 5 — Sous-traitants ultérieurs

Le Client autorise SYNeco à recourir aux sous-traitants suivants :

| Prestataire | Rôle | Localisation |
|---|---|---|
| Vercel Inc. | Hébergement de l'interface | États-Unis |
| Render Services, Inc. | Serveur applicatif | États-Unis (Virginie) |
| Neon (Databricks, Inc.) | Base de données | Union européenne (Francfort) |
| Cloudflare, Inc. | Stockage des fichiers | Juridiction européenne |
| Brevo (Sendinblue SAS) | Acheminement des e-mails | France |
| Stripe | Paiement | États-Unis / Irlande |

Le module de facturation **ne fait pas appel à l'assistant IA** : les données
des clients du Client ne sont pas transmises à Anthropic.

SYNeco informe le Client de tout changement envisagé dans cette liste, avec un
préavis de **trente jours** permettant de s'y opposer. En cas d'opposition, le
Client peut résilier sans frais.

## Article 6 — Sécurité

Les mesures en vigueur sont décrites publiquement et sans complaisance dans le
document [`SECURITY.md`](https://github.com/PilotProject1/mon-projet-ts/blob/main/SECURITY.md),
qui distingue explicitement ce qui est en place de ce qui ne l'est pas encore.

En résumé : cloisonnement des comptes vérifié à chaque requête et couvert par
des tests automatisés ; mots de passe conservés sous forme d'empreinte bcrypt
uniquement ; chiffrement des échanges (HTTPS) et du stockage au repos ;
limitation des tentatives d'authentification ; vérification du type réel des
fichiers déposés ; journaux dépourvus de données personnelles.

**Ce qui n'est pas en place**, et que le Client doit connaître : ni
authentification à deux facteurs, ni chiffrement applicatif des documents —
l'éditeur et l'hébergeur peuvent techniquement les lire —, ni analyse
antivirale, ni audit externe. La liste complète figure dans le document cité.

## Article 7 — Transferts hors Union européenne

Le serveur applicatif est situé aux États-Unis, ainsi que l'hébergement de
l'interface. La base de données et les fichiers sont, au repos, dans l'Union
européenne.

Ces transferts s'effectuent sur la base des clauses contractuelles types de la
Commission européenne ou d'un mécanisme d'adéquation équivalent, selon le
prestataire.

> **À compléter avant signature :** le mécanisme applicable à chaque
> prestataire doit être vérifié dans son propre contrat de sous-traitance, et
> nommé ici précisément.

## Article 8 — Audit

Le Client peut demander, une fois par an et moyennant un préavis de trente
jours, la communication des éléments permettant de vérifier le respect du
présent contrat. Un audit sur site n'est pas praticable, le service étant
hébergé chez des tiers.

## Article 9 — Responsabilité

Chaque partie assume la responsabilité des manquements qui lui sont propres.
Le Client garantit avoir recueilli une base légale valable et informé les
personnes concernées.

---

**Fait à ……………………, le ……………………, en deux exemplaires.**

| Le Client | SYNeco |
|---|---|
| Nom : | Loïc Vincent |
| Qualité : | Éditeur |
| Signature : | Signature : |
