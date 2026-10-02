import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POINTS, Salon, type Horloge } from './salon.ts';

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
      for (const id of [a, b, c]) s.repondre(id, `réponse ${id}`);
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
      s.repondre(moi, 'Ma réponse');
      avancer(15_000);
      assert.equal(s.phase, 'vote');
      const vue = s.vuePour(moi);
      assert.equal(new Set(vue.reponsesAnonymes.map((r) => r.texte)).size, 3);
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
