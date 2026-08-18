# Procédure en cas de violation de données

Établie en application des **articles 33 et 34 du RGPD**. Document interne.

Elle existe pour une raison simple : le jour où cela arrive, on est seul, il
est tard, et on a très envie de commencer par réparer. La loi, elle, fait
courir un délai de **72 heures** à partir du moment où l'on prend
connaissance des faits. Ce document sert à ne pas perdre ces heures-là à se
demander quoi faire.

**Responsable du traitement :** Monsieur Loïc Vincent (VincentLV,
SIREN 941 471 112) — syneco.pro@outlook.fr — 06 74 33 74 99.

**Dernière mise à jour :** 18 août 2026.

---

## 1. Ce qui compte comme une violation

Toute atteinte à des données personnelles, qu'elle soit malveillante ou
accidentelle. Trois formes, et la troisième est celle qu'on oublie :

| Forme | Ce que c'est | Exemple chez SYNeco |
|---|---|---|
| **Confidentialité** | Des données ont été vues par qui ne devait pas | Un défaut de cloisonnement laisse lire les documents d'un autre compte |
| **Intégrité** | Des données ont été altérées | Une migration fautive écrase des échéances |
| **Disponibilité** | Des données sont perdues ou inaccessibles | Une suppression accidentelle en base, au-delà de la fenêtre de restauration de 6 heures |

**Une perte définitive est une violation, même si personne n'a rien vu.**
C'est le point le plus souvent manqué.

À l'inverse, ne sont pas des violations : une panne de quelques minutes sans
perte, une tentative d'intrusion qui a échoué, un courriel de rappel parti en
double.

---

## 2. Les premières heures

Dans cet ordre. Le premier point n'est pas une formalité : c'est lui qui fixe
le délai, et c'est le seul qu'on ne peut pas reconstituer après coup.

### 2.1 Noter l'heure

Écrire, tout de suite, dans le registre du point 7 : **date et heure
auxquelles j'ai eu connaissance des faits**, et comment. Un message d'un
utilisateur, une alerte d'un prestataire, une découverte en lisant les
journaux.

### 2.2 Contenir, sans détruire

Arrêter l'hémorragie avant de comprendre : retirer la fonctionnalité fautive,
révoquer la clé, fermer l'accès, couper le service si nécessaire.

**Ne pas effacer les journaux, ne pas réinstaller le serveur.** Ce sont les
seules preuves de ce qui s'est passé, et il faudra les décrire à la CNIL.
Copier les journaux utiles hors de l'instance avant toute remise en état.

### 2.3 Constater

Répondre à ces cinq questions, par écrit, même partiellement :

1. **Quelles données ?** Comptes, documents, contenu des fichiers, échéances,
   données des clients d'un utilisateur professionnel ?
2. **Combien de personnes ?** Un nombre approximatif suffit.
3. **Depuis quand, et pendant combien de temps ?**
4. **Qui a pu y accéder ?** Un autre utilisateur, un tiers non identifié,
   personne (une perte sans divulgation) ?
5. **Est-ce terminé ?**

Ne pas attendre d'avoir tout compris pour passer à la suite. L'article 33
autorise explicitement une notification **par étapes** : on notifie ce qu'on
sait, on complète ensuite.

### 2.4 Le compte à rebours

Les 72 heures courent à partir du moment où l'on a **un degré raisonnable de
certitude** qu'une violation s'est produite — pas à partir du moment où l'on
a fini de l'analyser. Un doute sérieux fait courir le délai.

Passé 72 heures, on peut encore notifier, mais il faut **motiver le retard**
dans la notification elle-même.

---

## 3. Faut-il notifier la CNIL ?

**Oui, sauf si la violation est peu susceptible d'engendrer un risque pour
les droits et libertés des personnes.** L'exception est étroite : dans le
doute, on notifie.

Ce qui pousse vers la notification :

- des **documents administratifs** sont concernés — c'est le cœur du service,
  et un document peut contenir un RIB, un décompte de mutuelle, une adresse,
  une situation familiale ;
- les personnes sont **identifiables** ;
- le volume est important ;
- les données permettent une **usurpation d'identité** ou une **fraude** ;
- les données étaient **lisibles** (non chiffrées de bout en bout — c'est le
  cas ici, et `SECURITY.md` le dit sans détour).

Ce qui peut permettre de s'en dispenser :

- les données étaient inutilisables pour qui les a obtenues (empreintes de
  mots de passe bcrypt seules, par exemple) ;
- la perte est intégralement rattrapée par une restauration, sans divulgation.

> **Le cas particulier des mots de passe.** Une fuite de la table des comptes
> expose des empreintes bcrypt, pas des mots de passe. Le risque immédiat est
> faible, mais il n'est pas nul — les mots de passe faibles se cassent. Une
> notification reste la position prudente, accompagnée d'une invitation à
> changer de mot de passe.

### Comment notifier

Par le téléservice de la CNIL, depuis `cnil.fr`, rubrique **« Notifier une
violation de données »** (aujourd'hui `notifications.cnil.fr`). Un compte est
nécessaire : **le créer à froid, maintenant, pas le jour J.**

La notification doit contenir, au minimum (article 33.3) :

- la **nature** de la violation ;
- les **catégories** et le **nombre approximatif** de personnes concernées ;
- les **catégories** et le **nombre approximatif** d'enregistrements ;
- les **coordonnées** du point de contact — ici, les miennes ;
- les **conséquences probables** ;
- les **mesures prises ou proposées**, y compris pour en atténuer les effets.

---

## 4. Faut-il prévenir les personnes concernées ?

**Oui si la violation est susceptible d'engendrer un risque élevé** pour
elles (article 34). Le seuil est plus haut que pour la CNIL : toute violation
notifiée à la CNIL n'a pas à être annoncée aux utilisateurs.

Il faut les prévenir, **dans les meilleurs délais**, si le contenu de
documents a pu être lu par un tiers, si les données permettent une fraude, ou
si l'on ne peut pas exclure ces hypothèses.

Le message doit être **en langage clair** — pas un communiqué juridique — et
contenir la nature de la violation, le point de contact, les conséquences
probables et les mesures prises. Ce que la personne doit faire de son côté,
s'il y a lieu, se met en tête.

### Modèle de message

> **Objet : Incident de sécurité concernant votre compte SYNeco**
>
> Bonjour,
>
> Le [date], j'ai constaté que [description factuelle, une phrase]. Votre
> compte fait partie de ceux concernés.
>
> **Ce qui a pu être vu :** [préciser — nom et adresse e-mail, ou aussi le
> contenu de vos documents].
>
> **Ce que j'ai fait :** [mesures, avec l'heure]. La faille est corrigée
> depuis le [date/heure].
>
> **Ce que je vous conseille de faire :** [changer votre mot de passe /
> activer la double authentification / surveiller vos relevés]. Rien, si
> aucune action n'est utile — le dire aussi.
>
> J'ai notifié la CNIL le [date], comme la loi m'y oblige.
>
> Je suis joignable à syneco.pro@outlook.fr pour toute question. Je suis
> sincèrement désolé de cet incident.
>
> Loïc Vincent, éditeur de SYNeco

**Ne pas minimiser, ne pas noyer.** Un utilisateur qui apprend par ailleurs
ce qu'on lui a caché ne revient pas.

---

## 5. Si la violation vient d'un prestataire

Vercel, Render, Neon, Cloudflare, Brevo, Stripe et Anthropic sont
sous-traitants. S'ils notifient une violation, **le délai de 72 heures court
à partir de leur notification**, et c'est à moi — responsable du traitement —
de notifier la CNIL, pas à eux.

Conserver leur message : il fait partie des preuves.

## 6. Si la violation touche les données des clients d'un utilisateur professionnel

Pour le module de facturation, les rôles s'inversent : **l'utilisateur est
responsable du traitement, SYNeco est sous-traitant.**

Dans ce cas, je ne notifie pas la CNIL pour ces données — je **notifie
l'utilisateur concerné**, à charge pour lui de décider de la suite.

Le contrat de sous-traitance (`contrat-sous-traitance.md`, article 4.6)
engage sur **48 heures**, pas 72. C'est le délai le plus court des deux, et
c'est celui qui s'applique.

---

## 7. Registre des violations

**L'article 33.5 impose de consigner toute violation, y compris celles qui
n'ont pas été notifiées** — et, pour celles-là, la raison de ne pas l'avoir
fait. La CNIL peut demander ce registre à tout moment ; son absence est un
manquement en soi, indépendamment de l'incident.

Il se tient ci-dessous, dans ce fichier. Une ligne par incident, ajoutée le
jour même.

| Date et heure de connaissance | Nature | Données et personnes concernées | Conséquences probables | Mesures prises | CNIL notifiée ? | Personnes prévenues ? |
|---|---|---|---|---|---|---|
| _(aucune violation à ce jour)_ | | | | | | |

---

## 8. À préparer maintenant, pas le jour J

- [ ] Créer le compte sur le téléservice de notification de la CNIL.
- [ ] Vérifier que les journaux de Render sont consultables et exportables.
- [ ] Savoir où couper : mettre le service hors ligne, révoquer les clés
      (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `TWO_FACTOR_KEY`, accès R2,
      mot de passe Neon, clés Stripe).
- [ ] Savoir envoyer un courriel à tous les utilisateurs — la liste est en
      base, mais l'envoi en masse n'est pas outillé aujourd'hui.

> **Ce dernier point est un manque réel.** Prévenir les personnes concernées
> est une obligation légale, et aujourd'hui elle se ferait à la main. Tant
> que le nombre d'utilisateurs le permet, c'est tenable ; cela cessera de
> l'être.

## 9. Ce qu'il ne faut pas faire

- ❌ Attendre de tout comprendre avant de notifier — la notification par
  étapes est prévue par le texte.
- ❌ Effacer les journaux ou réinstaller avant d'avoir copié les preuves.
- ❌ Décider seul que « ce n'est pas grave » sans écrire pourquoi : cette
  motivation doit figurer au registre.
- ❌ Prévenir les utilisateurs avant d'avoir colmaté — cela indique la faille
  à qui ne l'avait pas trouvée.
- ❌ Promettre dans le message plus que ce que le code fait. `SECURITY.md`
  tient la liste de ce qu'il ne faut jamais affirmer.
