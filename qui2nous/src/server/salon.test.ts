import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POINTS, Salon, lireImage, nettoyerModes, type Horloge } from './salon.ts';
import { IMAGE_TAILLE_MAX, estModeImage } from '../shared/protocol.ts';

/** Plus petit « JPEG » accepté : seule la signature est vérifiée. */
const PHOTO = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]).toString('base64')}`;

/** Une réponse valable pour le mode de la manche en cours (hors Qui2Nous). */
function reponseLibre(s: Salon, id: string) {
  return estModeImage(s.question!.mode) ? PHOTO : `réponse ${id}`;
}

function horlogeFactice() {
  let t = 0;
  let minuteurs: { a: number; fn: () => void }[] = [];
  const horloge: Horloge = {
    maintenant: () => t,
    planifier: (ms, fn) => {
      const m = { a: t + ms, fn };
      minuteurs.push(m);
      return () => (minuteurs = minuteurs.filter((x) => x !== m));
    },
  };
  const avancer = (ms: number) => {
    t += ms;
    for (const m of minuteurs.filter((x) => x.a <= t)) {
      minuteurs = minuteurs.filter((x) => x !== m);
      m.fn();
    }
  };
  return { horloge, avancer };
}

function partieA3() {
  const { horloge, avancer } = horlogeFactice();
  const s = new Salon('ABCD', () => {}, horloge, () => 0);
  const [a, b, c] = ['Lucas', 'Sarah', 'Léa'].map((n) => s.ajouter(n, '🦊').id);
  return { s, a, b, c, avancer };
}

test('il faut 3 joueurs connectés pour lancer, et seul l’hôte lance', () => {
  const { horloge } = horlogeFactice();
  const s = new Salon('ABCD', () => {}, horloge);
  const a = s.ajouter('A', '🦊').id;
  const b = s.ajouter('B', '🦊').id;
  assert.throws(() => s.lancer(a, 4), /au moins 3/);
  s.ajouter('C', '🦊');
  assert.throws(() => s.lancer(b, 4), /créateur/);
  s.lancer(a, 4);
  assert.equal(s.phase, 'decompte');
});

test('pseudo en double refusé', () => {
  const { s } = partieA3();
  assert.throws(() => s.ajouter('lucas', '🐼'), /déjà pris/);
});

test('la question reste cachée pendant le décompte', () => {
  const { s, a, avancer } = partieA3();
  s.lancer(a, 4);
  assert.equal(s.vuePour(a).question, null);
  avancer(3_500);
  assert.equal(s.phase, 'reponse');
  assert.equal(s.vuePour(a).question?.mode, 'qui2nous');
});

test('Qui2Nous : la majorité rapporte l’anticipation, plus un bonus de rapidité', () => {
  const { s, a, b, c, avancer } = partieA3();
  s.lancer(a, 4);
  avancer(3_500);
  s.repondre(a, b); // immédiat : bonus max
  s.repondre(b, c);
  assert.equal(s.phase, 'reponse');
  assert.equal(s.vuePour(a).ontRepondu.length, 2);
  s.repondre(c, b);
  assert.equal(s.phase, 'resultat');
  const r = s.resultat!;
  assert.equal(r.mode, 'qui2nous');
  assert.equal(r.gains[a].points, POINTS.anticipation + POINTS.rapiditeMax);
  assert.equal(r.gains[b], undefined);
  assert.equal(s.joueurs.get(b)!.score, 0);
});

test('Qui a répondu ? : réponses anonymes, puis points d’identification', () => {
  const { s, a, b, c, avancer } = partieA3();
  s.lancer(a, 4);
  avancer(3_500);
  for (const id of [a, b, c]) s.repondre(id, a);
  s.suivant(a);
  avancer(3_500);
  assert.equal(s.question?.mode, 'quiARepondu');
  s.repondre(a, 'Les épinards');
  s.repondre(b, 'Le chou');
  s.repondre(c, 'La betterave');
  assert.equal(s.phase, 'vote');

  const vueA = s.vuePour(a);
  assert.equal(vueA.reponsesAnonymes.length, 3);
  assert.ok(!('auteurId' in vueA.reponsesAnonymes[0]));
  const id = (texte: string) => vueA.reponsesAnonymes.find((r) => r.texte === texte)!.id;

  assert.throws(() => s.voter(a, { [id('Le chou')]: b }), /chaque réponse/);
  s.voter(a, { [id('Le chou')]: b, [id('La betterave')]: c }); // 2 bonnes
  s.voter(b, { [id('Les épinards')]: c, [id('La betterave')]: a }); // 0
  s.voter(c, { [id('Les épinards')]: b, [id('Le chou')]: a }); // 0
  assert.equal(s.phase, 'resultat');
  // a est le seul sur deux votants à trouver chaque réponse : pas « difficile » (1 n'est pas < 2/2).
  assert.equal(s.resultat!.gains[a].points, 2 * POINTS.identification);
});

test('un joueur déconnecté n’est pas attendu', () => {
  const { s, a, b, c, avancer } = partieA3();
  s.lancer(a, 4);
  avancer(3_500);
  s.repondre(a, b);
  s.repondre(b, b);
  s.connexion(c, false);
  assert.equal(s.phase, 'resultat');
});

test('le temps écoulé clôt la phase de réponse', () => {
  const { s, a, b, avancer } = partieA3();
  s.lancer(a, 4);
  avancer(3_500);
  s.repondre(a, b);
  avancer(25_000);
  assert.equal(s.phase, 'resultat');
});

test('un joueur qui arrive en cours de partie joue à la manche suivante', () => {
  const { s, a, b, c, avancer } = partieA3();
  s.lancer(a, 4);
  avancer(3_500);
  const d = s.ajouter('Thomas', '🐸').id;
  assert.equal(s.vuePour(d).joueurs.find((j) => j.id === d)!.enAttente, true);
  assert.throws(() => s.repondre(d, a), /prochaine manche/);
  for (const id of [a, b, c]) s.repondre(id, a);
  s.suivant(a);
  assert.ok(s.participants.includes(d));
});

test('la dernière manche est la grande finale à points doublés, puis podium et titres', () => {
  const { s, a, b, c, avancer } = partieA3();
  s.lancer(a, 4);
  for (let m = 1; m <= 4; m++) {
    avancer(3_500);
    if (s.question!.mode === 'qui2nous') {
      avancer(25_000); // personne ne répond
    } else {
      for (const id of [a, b, c]) s.repondre(id, reponseLibre(s, id));
      avancer(60_000);
    }
    assert.equal(s.grandeFinale, m === 4);
    s.suivant(a);
  }
  assert.equal(s.phase, 'podium');
  s.rejouer(a);
  assert.equal(s.phase, 'lobby');
});

test('si l’hôte part, un autre joueur devient hôte', () => {
  const { s, a, b } = partieA3();
  s.retirer(a);
  assert.equal(s.hoteId, b);
});

test('robots : une seule personne peut lancer et jouer une partie entière', () => {
  const { horloge, avancer } = horlogeFactice();
  let hasard = 0.37;
  const s = new Salon('ABCD', () => {}, horloge, () => (hasard = (hasard * 9301 + 0.49297) % 1));
  const moi = s.ajouter('Moi', '🦊').id;
  assert.throws(() => s.lancer(moi, 4), /au moins 3/);
  const bob = s.ajouterRobot(moi);
  s.ajouterRobot(moi);
  assert.equal(bob.nom, 'Robot Bob');
  assert.equal(s.vuePour(moi).joueurs.filter((j) => j.robot).length, 2);
  s.lancer(moi, 4);
  for (let m = 1; m <= 4; m++) {
    avancer(3_500);
    assert.equal(s.phase, 'reponse');
    if (s.question!.mode === 'qui2nous') {
      s.repondre(moi, bob.id);
      avancer(9_000); // les robots ont tous répondu avant la fin du temps
      assert.equal(s.phase, 'resultat');
    } else {
      s.repondre(moi, reponseLibre(s, moi));
      avancer(20_000); // le plus lent : un robot qui dessine
      assert.equal(s.phase, 'vote');
      const vue = s.vuePour(moi);
      assert.equal(new Set(vue.reponsesAnonymes.map((r) => r.id)).size, 3);
      const attributions: Record<string, string> = {};
      for (const r of vue.reponsesAnonymes) if (!r.estLaMienne) attributions[r.id] = bob.id;
      s.voter(moi, attributions);
      avancer(10_000);
      assert.equal(s.phase, 'resultat');
    }
    s.suivant(moi);
  }
  assert.equal(s.phase, 'podium');
});

test('robots : seul l’hôte en ajoute, avant le lancement, et ils ne gardent pas un salon en vie', () => {
  const { s, a, b } = partieA3();
  assert.throws(() => s.ajouterRobot(b), /créateur/);
  const r = s.ajouterRobot(a);
  assert.throws(() => s.retirerRobot(a, b), /pas un robot/);
  s.retirerRobot(a, r.id);
  assert.equal(s.joueurs.has(r.id), false);
  s.ajouterRobot(a);
  s.lancer(a, 4);
  assert.throws(() => s.ajouterRobot(a), /avant de lancer/);
  for (const j of [...s.joueurs.values()].filter((j) => !j.robot)) s.retirer(j.id);
  assert.equal(s.vide, true);
});

test('questions automatiques : les modes alternent', () => {
  const { s, a, avancer } = partieA3();
  s.lancer(a, 4, 'auto');
  avancer(3_500);
  assert.equal(s.question!.mode, 'qui2nous');
  assert.equal(s.question!.perso, undefined);
});

test('mode créateur : seul le créateur écrit, puis ses questions sont jouées', () => {
  const { s, a, b, c, avancer } = partieA3();
  s.lancer(a, 4, 'createur');
  assert.equal(s.phase, 'redaction');
  assert.deepEqual(s.redacteurs, [a]);
  assert.throws(() => s.proposerQuestion(b, 'Qui de nous ronfle ?', 'qui2nous'), /créateur/);
  assert.throws(() => s.proposerQuestion(a, 'Qui ?', 'qui2nous'), /trop courte/);
  s.proposerQuestion(a, 'Qui de nous ronfle le plus ?', 'qui2nous');
  s.proposerQuestion(a, 'Ton pire souvenir de camping ?', 'quiARepondu');
  assert.throws(() => s.proposerQuestion(a, 'qui de nous ronfle le plus ?', 'qui2nous'), /déjà proposée/);
  // Les autres ne voient ni le texte ni l'auteur, seulement le nombre.
  assert.equal(s.vuePour(b).mesQuestions.length, 0);
  assert.equal(s.vuePour(b).nbQuestionsGroupe, 2);
  s.finirRedaction(a);
  assert.equal(s.phase, 'decompte');
  const jouees: string[] = [];
  for (let m = 1; m <= 4; m++) {
    avancer(3_500);
    jouees.push(s.question!.texte);
    if (s.question!.mode === 'qui2nous') {
      for (const id of [a, b, c]) s.repondre(id, a);
    } else {
      for (const id of [a, b, c]) s.repondre(id, reponseLibre(s, id));
      avancer(60_000);
    }
    s.suivant(a);
  }
  assert.ok(jouees.includes('Qui de nous ronfle le plus ?'));
  assert.ok(jouees.includes('Ton pire souvenir de camping ?'));
  assert.equal(new Set(jouees).size, 4);
});

test('mode collectif : tout le monde écrit, la phase finit quand tous ont terminé ou au bout du temps', () => {
  const { s, a, b, c, avancer } = partieA3();
  s.lancer(a, 4, 'collectif');
  assert.equal(s.redacteurs.length, 3);
  for (let i = 1; i <= 5; i++) s.proposerQuestion(b, `Question numéro ${i} ?`, 'quiARepondu');
  assert.throws(() => s.proposerQuestion(b, 'Une de trop ?', 'quiARepondu'), /5 questions maximum/);
  const id = s.vuePour(b).mesQuestions[0].id;
  assert.throws(() => s.retirerQuestion(a, id), /introuvable/);
  s.retirerQuestion(b, id);
  s.finirRedaction(a);
  s.finirRedaction(b);
  assert.equal(s.phase, 'redaction');
  avancer(120_000); // c n'a pas fini : le temps tranche
  assert.equal(s.phase, 'decompte');
  avancer(3_500);
  assert.equal(s.question!.perso, true);
  void c;
});

test('mode collectif avec robots : ils proposent leurs questions tout seuls', () => {
  const { horloge, avancer } = horlogeFactice();
  const s = new Salon('ABCD', () => {}, horloge, () => 0.5);
  const moi = s.ajouter('Moi', '🦊').id;
  s.ajouterRobot(moi);
  s.ajouterRobot(moi);
  s.lancer(moi, 4, 'collectif');
  avancer(8_000);
  assert.equal(s.vuePour(moi).nbQuestionsGroupe, 4);
  assert.equal(s.phase, 'redaction'); // on m'attend encore
  s.finirRedaction(moi);
  assert.equal(s.phase, 'decompte');
});

test('Qui2Photo : la 3e manche, photos anonymes servies pendant le vote puis effacées', () => {
  const { s, a, b, c, avancer } = partieA3();
  s.lancer(a, 4);
  for (let m = 1; m <= 2; m++) {
    avancer(3_500);
    if (s.question!.mode === 'qui2nous') for (const id of [a, b, c]) s.repondre(id, a);
    else {
      for (const id of [a, b, c]) s.repondre(id, `réponse ${id}`);
      avancer(60_000);
    }
    s.suivant(a);
  }
  avancer(3_500);
  assert.equal(s.question!.mode, 'qui2photo');
  assert.throws(() => s.repondre(a, 'data:image/svg+xml;base64,PHN2Zz4='), /pas une image/);
  assert.throws(() => s.repondre(a, 'data:image/jpeg;base64,AAAA'), /pas une image/);
  for (const id of [a, b, c]) s.repondre(id, PHOTO);
  assert.equal(s.vuePour(a).maReponse, 'image');
  assert.equal(s.phase, 'vote');
  const vue = s.vuePour(a);
  assert.ok(vue.reponsesAnonymes.every((r) => r.image && r.texte === ''));
  const idPhoto = vue.reponsesAnonymes[0].id;
  assert.equal(s.image(idPhoto)?.type, 'image/jpeg');
  avancer(60_000);
  assert.equal(s.resultat!.mode, 'qui2photo');
  assert.ok(s.image(idPhoto)); // encore visible sur l'écran de résultat
  s.suivant(a);
  assert.equal(s.image(idPhoto), undefined); // effacée à la manche suivante
});

test('Qui2Photo désactivé par le créateur : jamais de manche photo', () => {
  const { s, a, b, c, avancer } = partieA3();
  s.lancer(a, 8, 'auto', ['qui2nous', 'quiARepondu']);
  assert.deepEqual(s.vuePour(a).modes, ['qui2nous', 'quiARepondu']);
  for (let m = 1; m <= 8; m++) {
    avancer(3_500);
    assert.notEqual(s.question!.mode, 'qui2photo');
    for (const id of [a, b, c]) s.repondre(id, s.question!.mode === 'qui2nous' ? a : `r ${id}`);
    avancer(60_000);
    s.suivant(a);
  }
});

test('lirePhoto refuse une photo trop lourde', () => {
  assert.throws(() => lireImage(`data:image/jpeg;base64,${'A'.repeat(IMAGE_TAILLE_MAX)}`), /trop lourde/);
  assert.equal(lireImage(PHOTO).type, 'image/jpeg');
});

test('robots : ils envoient une image PNG valable en Qui2Photo', () => {
  const { horloge, avancer } = horlogeFactice();
  const s = new Salon('ABCD', () => {}, horloge, () => 0.42);
  const moi = s.ajouter('Moi', '🦊').id;
  s.ajouterRobot(moi);
  s.ajouterRobot(moi);
  s.lancer(moi, 4, 'createur');
  s.proposerQuestion(moi, 'Une photo de ton petit-déjeuner.', 'qui2photo');
  assert.throws(() => s.proposerQuestion(moi, 'Inconnu du tout ?', 'qui2chante'), /indisponible/);
  s.finirRedaction(moi);
  // Le plan est mélangé : on joue jusqu'à tomber sur la manche photo.
  for (let m = 1; m <= 4; m++) {
    avancer(3_500);
    const mode = s.question!.mode;
    if (mode === 'qui2nous') s.repondre(moi, moi);
    else s.repondre(moi, reponseLibre(s, moi));
    avancer(15_000);
    if (mode === 'qui2photo') {
      assert.equal(s.phase, 'vote');
      const robot = s.vuePour(moi).reponsesAnonymes.find((r) => !r.estLaMienne)!;
      assert.equal(s.image(robot.id)?.type, 'image/png');
      return;
    }
    if (s.phase === 'vote') {
      const attributions: Record<string, string> = {};
      const autre = s.participants.find((p) => p !== moi)!;
      for (const r of s.vuePour(moi).reponsesAnonymes) if (!r.estLaMienne) attributions[r.id] = autre;
      s.voter(moi, attributions);
      avancer(10_000);
    }
    s.suivant(moi);
  }
  assert.fail('aucune manche photo jouée');
});

/** Joue la manche en cours jusqu'au résultat : tout le monde répond, puis vote pour `cible`. */
function jouerManche(s: Salon, joueurs: string[], avancer: (ms: number) => void, cible: (id: string) => string) {
  avancer(3_500);
  for (const id of joueurs) s.repondre(id, s.question!.mode === 'qui2nous' ? cible(id) : reponseLibre(s, id));
  if (s.phase === 'vote') {
    for (const id of joueurs) {
      const attributions: Record<string, string> = {};
      for (const r of s.vuePour(id).reponsesAnonymes) if (!r.estLaMienne) attributions[r.id] = cible(id);
      s.voter(id, attributions);
    }
  }
  assert.equal(s.phase, 'resultat');
}

test('les quatre modes tournent dans l’ordre, la dernière manche est la grande finale', () => {
  const { s, a, b, c, avancer } = partieA3();
  s.lancer(a, 6);
  const modes: string[] = [];
  for (let m = 1; m <= 6; m++) {
    jouerManche(s, [a, b, c], avancer, (id) => (id === a ? b : a));
    modes.push(s.question!.mode);
    if (m === 6) {
      assert.equal(s.grandeFinale, true);
      assert.equal(s.question!.categorie, '👑 Grande finale');
    }
    s.suivant(a);
  }
  assert.deepEqual(modes.slice(0, 5), ['qui2nous', 'quiARepondu', 'qui2photo', 'qui2dessine', 'qui2nous']);
  assert.equal(modes[5], 'quiARepondu'); // la finale prend le mode le moins joué
});

test('partie de 4 manches : les 4 modes passent, le dessin en finale', () => {
  const { s, a, b, c, avancer } = partieA3();
  s.lancer(a, 4);
  const modes: string[] = [];
  for (let m = 1; m <= 4; m++) {
    jouerManche(s, [a, b, c], avancer, (id) => (id === a ? b : a));
    modes.push(s.question!.mode);
    s.suivant(a);
  }
  assert.deepEqual(modes, ['qui2nous', 'quiARepondu', 'qui2photo', 'qui2dessine']);
});

test('Qui2Dessine : dessins anonymes, points doublés en finale, Picasso et statistiques au podium', () => {
  const { s, a, b, c, avancer } = partieA3();
  s.lancer(a, 4, 'auto', ['qui2dessine']);
  for (let m = 1; m <= 4; m++) {
    // b et c reconnaissent toujours le dessin de a ; a se trompe.
    jouerManche(s, [a, b, c], avancer, (id) => (id === a ? b : a));
    const r = s.resultat!;
    assert.equal(r.mode, 'qui2dessine');
    assert.ok('reponses' in r && r.reponses.every((x) => x.image && x.texte === ''));
    const attendu = POINTS.identification * (m === 4 ? 2 : 1);
    assert.equal(r.gains[b].points, attendu);
    if (m === 4) assert.equal(s.question!.categorie, '👑 Grande finale');
    s.suivant(a);
  }
  assert.equal(s.phase, 'podium');
  const vue = s.vuePour(a);
  assert.deepEqual(
    vue.titres.find((t) => t.intitule === 'Picasso du groupe'),
    { emoji: '🎨', intitule: 'Picasso du groupe', joueurId: a },
  );
  assert.equal(vue.statistiques[a].dessins, 8); // reconnu 2 fois par manche
  assert.equal(vue.statistiques[b].trouves, 4);
  assert.deepEqual(s.vuePour(a).statistiques, vue.statistiques);
});

test('statistiques visibles seulement au podium', () => {
  const { s, a } = partieA3();
  assert.deepEqual(s.vuePour(a).statistiques, {});
});

test('choix des modes : ordre imposé, liste vide ou invalide = tous les modes', () => {
  assert.deepEqual(nettoyerModes(['qui2dessine', 'qui2nous']), ['qui2nous', 'qui2dessine']);
  assert.deepEqual(nettoyerModes([]), ['qui2nous', 'quiARepondu', 'qui2photo', 'qui2dessine']);
  assert.deepEqual(nettoyerModes('n’importe quoi'), ['qui2nous', 'quiARepondu', 'qui2photo', 'qui2dessine']);
});

test('mode créateur : les questions du groupe n’occupent jamais la finale', () => {
  const { s, a, b, c, avancer } = partieA3();
  s.lancer(a, 4, 'createur');
  for (let i = 1; i <= 5; i++) s.proposerQuestion(a, `Qui de nous numéro ${i} ?`, 'qui2nous');
  s.finirRedaction(a);
  for (let m = 1; m <= 4; m++) {
    jouerManche(s, [a, b, c], avancer, (id) => (id === a ? b : a));
    assert.equal(s.question!.perso === true, m < 4);
    s.suivant(a);
  }
});
