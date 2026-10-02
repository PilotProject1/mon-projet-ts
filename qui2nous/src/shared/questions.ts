import type { Mode, Question } from './protocol.ts';

// Première bibliothèque (phase 6). Les catégories reprennent la feuille de
// route ; Photos et Dessins viendront avec leurs propres modes.

const qui2nous: Record<string, string[]> = {
  '😂 Humour': [
    'Qui de nous rirait à un enterrement ?',
    'Qui de nous raconte les pires blagues ?',
    'Qui de nous rit avant la fin de sa propre blague ?',
    'Qui de nous pourrait devenir humoriste ?',
  ],
  '🧠 Personnalité': [
    'Qui de nous a le plus mauvais caractère le matin ?',
    'Qui de nous serait le meilleur chef de bande ?',
    'Qui de nous change d’avis le plus souvent ?',
    'Qui de nous survivrait le plus longtemps sur une île déserte ?',
  ],
  '❤️ Amitié': [
    'Qui de nous est toujours là quand il faut ?',
    'Qui de nous oublie tous les anniversaires ?',
    'Qui de nous garde le mieux un secret ?',
  ],
  '🤦 Dossiers': [
    'Qui de nous a la photo la plus gênante de soirée ?',
    'Qui de nous a déjà envoyé un message à la mauvaise personne ?',
    'Qui de nous s’est déjà endormi à un endroit improbable ?',
  ],
  '🏠 Vie quotidienne': [
    'Qui de nous a le frigo le plus vide ?',
    'Qui de nous est toujours en retard ?',
    'Qui de nous perd ses clés le plus souvent ?',
  ],
  '💰 Argent': [
    'Qui de nous dépenserait tout s’il gagnait au loto ?',
    'Qui de nous compte chaque centime ?',
    'Qui de nous finira millionnaire ?',
  ],
  '💘 Couple': [
    'Qui de nous est le plus romantique ?',
    'Qui de nous se marierait sur un coup de tête ?',
  ],
  '🎉 Soirée': [
    'Qui de nous finit toujours la soirée en dernier ?',
    'Qui de nous monopolise la musique ?',
    'Qui de nous danse sur les tables ?',
  ],
};

const quiARepondu: Record<string, string[]> = {
  '😂 Humour': [
    'Le pire cadeau que tu aies reçu ?',
    'Ton surnom le plus ridicule ?',
    'Le mot que tu prononces mal depuis toujours ?',
  ],
  '🧠 Personnalité': [
    'Ta plus grande peur irrationnelle ?',
    'Le défaut que tu assumes complètement ?',
    'Le métier que tu voulais faire enfant ?',
  ],
  '❤️ Amitié': [
    'Le meilleur souvenir avec ce groupe ?',
    'Le talent caché que personne ici ne te connaît ?',
  ],
  '🤦 Dossiers': [
    'Ta pire honte en public ?',
    'La pire excuse que tu aies déjà donnée ?',
    'Le mensonge que tu racontes encore aujourd’hui ?',
  ],
  '🏠 Vie quotidienne': [
    'Le plat que tu ne supportes pas ?',
    'Ton rituel bizarre du matin ?',
    'La chanson que tu écoutes en boucle en ce moment ?',
  ],
  '💰 Argent': [
    'Ton achat le plus inutile ?',
    'Ce que tu ferais en premier avec un million ?',
  ],
  '💘 Couple': [
    'La pire phrase de drague que tu aies entendue ?',
    'Ton premier date idéal ?',
  ],
  '🎉 Soirée': [
    'Ta chanson de karaoké ?',
    'Le cocktail qui te fait le plus peur ?',
  ],
};

const qui2photo: Record<string, string[]> = {
  '📸 Photos': [
    'Une photo dont personne ne connaît l’histoire.',
    'La dernière photo de nourriture de ta galerie.',
    'Un paysage que tu adores.',
    'Une photo qui te fait rire à chaque fois.',
    'La photo la plus floue de ta galerie.',
    'Une capture d’écran qui résume ta semaine.',
    'Un animal (le tien ou celui d’un autre).',
    'Ton plus beau coucher de soleil.',
    'Un objet de chez toi que personne ici n’a jamais vu.',
    'Une photo de vacances, sans personne dessus.',
  ],
};

const qui2dessine: Record<string, string[]> = {
  '✏️ Dessins': [
    'Dessine ton animal préféré, sans écrire de lettres.',
    'Dessine ton plat préféré.',
    'Dessine-toi en vacances.',
    'Dessine le métier de tes rêves.',
    'Dessine ta plus grande peur.',
    'Dessine ta maison idéale.',
    'Dessine ton super-pouvoir.',
    'Dessine le dernier rêve dont tu te souviens.',
    'Dessine ton week-end parfait.',
    'Dessine l’objet que tu emporterais sur une île déserte.',
  ],
};

function aplatir(mode: Mode, banque: Record<string, string[]>): Question[] {
  return Object.entries(banque).flatMap(([categorie, textes]) =>
    textes.map((texte) => ({ mode, categorie, texte })),
  );
}

export const QUESTIONS: Record<Mode, Question[]> = {
  qui2nous: aplatir('qui2nous', qui2nous),
  quiARepondu: aplatir('quiARepondu', quiARepondu),
  qui2photo: aplatir('qui2photo', qui2photo),
  qui2dessine: aplatir('qui2dessine', qui2dessine),
};

// Grande finale (étape 7) : des questions plus marquantes, réservées à la
// dernière manche.
const finale: Record<Mode, string[]> = {
  qui2nous: [
    'Qui de nous sera le plus célèbre dans 10 ans ?',
    'Qui de nous survivrait le plus longtemps à une invasion de zombies ?',
    'Qui de nous cache le plus de secrets ?',
    'Qui de nous deviendrait président… et le regretterait ?',
  ],
  quiARepondu: [
    'Le secret que personne ici ne connaît sur toi ?',
    'Ce que tu ferais si tu étais invisible une journée ?',
    'Le plus gros mensonge que tu aies dit à quelqu’un ici ?',
  ],
  qui2photo: ['La photo la plus improbable de toute ta galerie.', 'La photo dont tu es le plus fier.'],
  qui2dessine: ['Dessine le joueur à ta gauche.', 'Dessine ce groupe dans 20 ans.'],
};

export const QUESTIONS_FINALE: Record<Mode, Question[]> = Object.fromEntries(
  Object.entries(finale).map(([mode, textes]) => [
    mode,
    textes.map((texte) => ({ mode: mode as Mode, categorie: '👑 Grande finale', texte })),
  ]),
) as Record<Mode, Question[]>;
