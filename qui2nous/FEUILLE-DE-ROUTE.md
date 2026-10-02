# 🎮 Feuille de route — Qui2Nous ?

> **Principe directeur.** On ne construit pas d'abord une grosse application.
> On construit d'abord une partie de 10 minutes qui donne envie d'en refaire une.
> Si cette boucle fonctionne (« Allez, encore une ! »), tout le reste n'est que
> de l'enrichissement.

**Objectif :** un jeu d'ambiance **multijoueur local de 3 à 8 joueurs**, où
chaque joueur utilise **son téléphone** et rejoint la partie avec un **code de
salon**.

Légende : ✅ fait · 🟡 en partie · ⬜ à faire

---

## Ordre de développement

Le point crucial : **ne pas essayer de tout faire d'un coup.**

| Étape | Contenu | État |
|---|---|---|
| 1 | Question → réponse → vote → révélation → points | ✅ |
| 2 | Salon de 3 à 8 joueurs | ✅ |
| 3 | Classement + système de manches | ✅ |
| 4 | Questions personnalisées | ✅ |
| 5 | Photos (Qui2Photo ?) | ⬜ |
| 6 | Dessins (Qui2Dessine ?) | ⬜ |
| 7 | Grande finale | 🟡 points doublés sur la dernière manche ; révélation progressive à faire |
| 8 | Animations + sons + identité graphique | 🟡 animations de base ; sons et logo à faire |
| 9 | Tests réels | ⬜ |
| 10 | Version 1.0 | ⬜ |

---

## 🟢 Phase 1 — Concept et règles du jeu

But : définir exactement les règles avant de développer.

- ✅ 3 à 8 joueurs
- ✅ Un téléphone par joueur
- ✅ Salon avec code
- ✅ Questions automatiques
- ✅ Questions personnalisées
- ✅ Créateur seul ou tous les joueurs selon le mode
- ✅ Système de points
- ✅ Classement final

**Modes de jeu**

| Mode | Principe | État |
|---|---|---|
| **Qui2Nous ?** | Qui correspond à la question ? | ✅ |
| **Qui a répondu ?** | Retrouver l'auteur d'une réponse | ✅ |
| **Qui2Photo ?** | Retrouver le propriétaire d'une photo | ⬜ |
| **Qui2Dessine ?** | Retrouver l'auteur d'un dessin | ⬜ |
| **Qui2Nous a dit ça ?** | Identifier une réponse anonyme | ⬜ à distinguer de « Qui a répondu ? » |
| **Grande finale** | Dernière manche spéciale | 🟡 |

**Livrable :** 📄 cahier des règles complet. Les règles déjà implémentées sont
décrites dans [« Règles actuelles »](#règles-actuelles-du-prototype) plus bas.

## 🟡 Phase 2 — Structure du jeu

Comment se déroule une partie :

```
AVANT            PENDANT UNE MANCHE          FIN
Accueil          Question                    Dernière manche
  ↓                ↓                           ↓
Créer/Rejoindre  Réponse secrète             Grande finale
  ↓                ↓                           ↓
Code du salon    Tout le monde a répondu     Podium
  ↓                ↓                           ↓
Lobby            Révélation                  Rejouer
  ↓                ↓
Choix des modes  Vote
  ↓                ↓
Lancer           Résultat → Points → Classement
```

**Livrable :** 🗺️ architecture complète du gameplay. ✅ Elle est en place dans
le prototype, sauf le choix des modes (pour l'instant, ils alternent).

## 🔵 Phase 3 — Design de l'application

**Écrans principaux**

| # | Écran | État |
|---|---|---|
| 1 | 🏠 Accueil | ✅ |
| 2 | ➕ Créer une partie | ✅ |
| 3 | 🔑 Rejoindre une partie | ✅ (code ou lien d'invitation) |
| 4 | 👥 Lobby | ✅ |
| 5 | ⚙️ Configuration | 🟡 nombre de manches et source des questions |
| 6 | ❓ Question | ✅ |
| 7 | ✍️ Réponse | ✅ |
| 8 | 🗳️ Vote | ✅ |
| 9 | 🔎 Révélation | ✅ |
| 10 | ⭐ Résultat | ✅ |
| 11 | 🏆 Classement | ✅ |
| 12 | ✏️ Création de question | ✅ |
| 13 | 📸 Sélection de photo | ⬜ |
| 14 | 🎨 Dessin | ⬜ |
| 15 | 👑 Podium final | ✅ |

**À créer :** ⬜ logo Qui2Nous · 🟡 avatars (emojis pour l'instant) · ✅ boutons ·
✅ cartes de questions · 🟡 animations · ✅ écrans de révélation · ✅ écran de
classement.

**Livrable :** 🎨 maquette complète de l'application.

## 🟣 Phase 4 — Premier prototype ✅

On ne cherche **pas** encore à faire le jeu parfait. Objectif :

> **3 personnes avec 3 téléphones peuvent créer ou rejoindre une partie et
> jouer une manche.**

Création du salon ✅ · Code de salon ✅ · Connexion des joueurs ✅ · Pseudos ✅ ·
Avatars ✅ · Question ✅ · Réponse secrète ✅ · Vote ✅ · Révélation ✅ ·
Points ✅ · Classement ✅

**Livrable :** 🎮 premier Qui2Nous jouable. ✅ Une partie complète à 3
téléphones a été jouée de bout en bout, sur téléphone (390 px) et sur
ordinateur (1 280 px).

## 🔴 Phase 5 — Système multijoueur complet

**Gestion du salon**

- ✅ 3 à 8 joueurs
- ✅ Joueur qui rejoint (y compris en cours de partie : il entre à la manche suivante)
- ✅ Joueur qui quitte (le rôle de créateur passe à un autre joueur)
- ✅ Reconnexion (écran éteint, page rechargée, réseau coupé)
- ✅ Maître de partie (le créateur ; s'il perd la connexion, n'importe qui peut faire avancer la partie)
- ✅ Lancement de la partie
- ✅ Robots pour tester seul : le créateur ajoute de faux joueurs depuis le lobby
- ✅ Synchronisation des téléphones

**Synchronisation :** tous les joueurs reçoivent en même temps « 3… 2… 1… »
puis **QUESTION !** ✅ La question n'est envoyée qu'à la fin du décompte, et le
chronomètre est corrigé du décalage d'horloge de chaque téléphone.

## 🟠 Phase 6 — Système de questions

**Questions automatiques** — bibliothèque par catégorie :

- ✅ 😂 Humour · 🧠 Personnalité · ❤️ Amitié · 🤦 Dossiers · 🏠 Vie quotidienne ·
  💰 Argent · 💘 Couple · 🎉 Soirée (45 questions au départ)
- ⬜ 📸 Photos · ✏️ Dessins (avec leurs modes)
- ⬜ Étoffer la bibliothèque (viser plusieurs centaines de questions)
- ⬜ Choix des catégories par le créateur

**Questions personnalisées** — deux modes :

- ✅ **Mode créateur :** seul le créateur écrit les questions.
- ✅ **Mode collectif :** chaque joueur peut proposer ses propres questions.

Les questions sont ensuite mélangées pour ne pas révéler leur auteur.

## 🟤 Phase 7 — Photos 📸

Chaque joueur reçoit une consigne : *« Choisis une photo de ta galerie
correspondant à la question »* (ex. « Une photo dont personne ne connaît
l'histoire »).

- ⬜ Le joueur choisit **une photo précise**. Le jeu ne demande **pas** l'accès à toute la galerie.
- ⬜ Les photos 1 à 5 s'affichent ; les joueurs doivent trouver leur propriétaire.
- ⬜ Compresser la photo sur le téléphone avant l'envoi (cas « photo trop lourde »).
- ⬜ Ne jamais stocker les photos durablement : les supprimer à la fin de la partie.

**Livrable :** 📸 mode Qui2Photo fonctionnel.

## 🟩 Phase 8 — Dessin ✏️

Un mini outil de dessin. Exemple : *« Dessine ton animal préféré sans écrire
de lettres. »* Les autres voient le « dessin mystérieux » et votent pour son
auteur.

- ⬜ Zone de dessin tactile (pinceau, couleurs, gomme)
- ⬜ Vote sur l'auteur, comme dans « Qui a répondu ? »

**Livrable :** ✏️ mode Qui2Dessine fonctionnel.

## 🟦 Phase 9 — Système de score 🏆

| Action | Points | État |
|---|---|---|
| Bonne identification | +500 | ✅ |
| Bonne anticipation | +300 | ✅ |
| Identification difficile | +400 | ✅ (bonus si moins de la moitié des votants trouvent) |
| Bonus rapidité | +0 à +200 | ✅ (mode Qui2Nous ?) |

Le classement doit être clair sans casser le rythme de la partie. ✅ Il est
affiché après chaque manche, sur le même écran que le résultat.

## 🟨 Phase 10 — Grande finale 👑

Dernière manche spéciale : plus de points, question particulière, révélation
progressive.

- ✅ Points doublés et bandeau « GRANDE FINALE »
- ⬜ Question particulière
- ⬜ Révélation progressive (une réponse après l'autre, avec suspense)

Puis **🏆 PARTIE TERMINÉE**, avec :

- ✅ le classement
- ✅ le gagnant
- ⬜ des statistiques
- ✅ des titres amusants : 🕵️ Meilleur détective · 🔮 Lit dans les pensées ·
  😂 Plus prévisible · 👑 Le plus désigné
- ⬜ 📸 Roi des dossiers · 🎨 Picasso du groupe (avec les modes photo et dessin)

## 🟪 Phase 11 — Tests

Faire jouer de vraies personnes.

- ⬜ **Tests à 3 joueurs :** vérifier que le jeu fonctionne avec le minimum.
- ⬜ **Tests à 4 ou 5 joueurs :** voir si le rythme reste bon.
- ⬜ **Tests à 8 joueurs :** tester la charge maximale prévue.

**Tester aussi :**

| Cas | État |
|---|---|
| Téléphone qui se déconnecte | 🟡 géré dans le code ; à confirmer en réel |
| Joueur qui ferme l'application | 🟡 géré (reprise automatique) ; à confirmer |
| Mauvaise connexion | ⬜ |
| Joueur qui rejoint tard | ✅ |
| Temps de réponse | ✅ chronomètre par phase |
| Photo trop lourde | ⬜ (avec la phase 7) |
| Joueur qui ne répond pas | ✅ la phase se termine à la fin du temps |
| Partie abandonnée | ✅ salon supprimé 30 min après le départ du dernier joueur |

## 🟥 Phase 12 — Finitions (le côté « waouh »)

**🎨 Visuel :** 🟡 animations · 🟡 avatars · ⬜ transitions · ⬜ effets ·
⬜ identité graphique

**🔊 Audio :** ⬜ sons de boutons · ⬜ compte à rebours · ⬜ son de révélation ·
⬜ son de bonne réponse · ⬜ son du podium

**📱 UX :** tout doit être extrêmement rapide. Objectif : **créer une partie
en moins d'une minute.** 🟡 aujourd'hui : un pseudo, un avatar, un bouton, puis
un lien à partager.

## 🚀 Phase 13 — Bêta

Faire tester Qui2Nous à plusieurs groupes et recueillir notamment :

- « Est-ce que tu as compris les règles sans qu'on te les explique ? »
- « Quelle manche tu as préférée ? »
- « Quelle manche était ennuyante ? »
- « Est-ce que tu avais envie de refaire une partie ? »
- « Qu'est-ce qui t'a frustré ? »

## 🏁 Phase 14 — Qui2Nous v1.0

**Obligatoire :** ✅ 3 à 8 joueurs · ✅ code de salon · ✅ lobby · ✅ questions
automatiques · ✅ questions personnalisées · ✅ votes · ✅ réponses anonymes ·
✅ révélations · ✅ score · ✅ classement · ⬜ photos · ⬜ dessins · 🟡 grande finale

**Puis v2 :** ⏳ statistiques personnelles · ⏳ historique des parties ·
⏳ nouveaux packs de questions · ⏳ nouveaux modes · ⏳ nouveaux thèmes ·
⏳ avatars avancés · ⏳ réactions · ⏳ éventuellement le jeu à distance

---

## Règles actuelles du prototype

- **Salon :** le créateur obtient un code de 4 caractères (sans I, O, 0 ni 1,
  pour qu'il se lise à voix haute) et un lien d'invitation. Il faut au moins
  3 joueurs connectés pour lancer, et 8 au maximum.
- **Manches :** 4, 6 ou 8 au choix. Les modes alternent : Qui2Nous ?, puis
  Qui a répondu ?, etc. La dernière manche est la grande finale, à points
  doublés.
- **Décompte :** 3… 2… 1… puis la question apparaît en même temps sur tous les
  téléphones.
- **Qui2Nous ? (25 s) :** chacun désigne en secret un joueur, lui-même compris.
  Le ou les joueurs les plus désignés sont révélés, avec qui les a désignés.
  Ceux qui ont voté comme la majorité gagnent **+300** (bonne anticipation),
  plus **jusqu'à +200** selon leur rapidité. Il faut qu'au moins deux voix se
  rejoignent pour qu'il y ait une majorité.
- **Qui a répondu ? (60 s, puis 60 s de vote) :** chacun écrit une réponse
  secrète (80 caractères au plus). Les réponses sont mélangées puis affichées
  sans leur auteur, et chacun attribue un auteur à chaque réponse sauf la
  sienne. Chaque bonne attribution rapporte **+500**, plus **+400** si moins de
  la moitié des votants l'ont trouvée.
- **Fin d'une phase :** dès que tous les joueurs connectés ont agi, ou quand le
  temps est écoulé. Un joueur déconnecté n'est pas attendu.
- **Robots :** dans le lobby, le créateur peut ajouter jusqu'à 7 robots
  (Robot Bob, Robot Zoé…), ou les retirer. Ils comptent comme des joueurs :
  avec deux robots, une seule personne peut lancer une partie. Ils répondent et
  votent au hasard, après quelques secondes de « réflexion ».
- **Questions :** le créateur choisit dans le lobby entre trois options :
  - **Automatiques** : la bibliothèque du jeu.
  - **Mode créateur** : lui seul écrit les questions.
  - **Mode collectif** : chaque joueur écrit les siennes.

  Dans les deux derniers cas, une phase de préparation (2 minutes) précède la
  première manche. Chacun écrit jusqu'à 5 questions, de type « Qui de nous… ? »
  ou ouvertes, puis touche « J'ai fini ». La phase s'arrête quand tous ont
  terminé, ou à la fin du temps. Les questions du groupe passent en priorité,
  une par manche, et la bibliothèque complète en équilibrant les deux modes.
  L'ensemble est ensuite mélangé, et chaque question du groupe s'affiche avec
  la mention « ✏️ Question du groupe », sans nom d'auteur. Les robots
  proposent deux questions chacun.
- **Suite :** le créateur passe à la manche suivante. S'il est déconnecté,
  n'importe quel joueur peut le faire.

## Hébergement

Render (offre gratuite pour commencer), depuis la branche `claude/qui2nous` :
voir le [README](README.md#mise-en-ligne-sur-render).

## Questions ouvertes à trancher

1. **Qui a répondu ? / Qui2Nous a dit ça ?** La feuille de route d'origine
   distingue ces deux modes sans dire en quoi ils diffèrent. Proposition :
   dans « Qui2Nous a dit ça ? », on montre une seule réponse anonyme à la
   fois, en révélation progressive.
2. **Choix des modes** dans le lobby : liste à cocher, ou mélange automatique ?
3. **Photos :** prévoir un avertissement sur le contenu des photos partagées,
   et une modération minimale si le jeu devient public.
