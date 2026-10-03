// Sons du jeu, fabriqués à la volée avec Web Audio : aucun fichier à
// télécharger. Les navigateurs n'autorisent le son qu'après un premier
// toucher de l'écran ; tant que ce n'est pas fait, le contexte reste suspendu.

let contexte: AudioContext | null = null;

/** Contexte audio partagé (créé à la première demande), ou null si le navigateur n'en a pas. */
export function contexteAudio(): AudioContext | null {
  if (contexte) return contexte;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  contexte = new Ctor();
  return contexte;
}

/** Sortie commune : un compresseur évite la saturation quand les sons se chevauchent. */
function sortieAudio(ctx: BaseAudioContext, volume: number) {
  const sortie = ctx.createGain();
  sortie.gain.value = volume;
  const compresseur = ctx.createDynamicsCompressor();
  compresseur.threshold.value = -12;
  compresseur.ratio.value = 8;
  sortie.connect(compresseur).connect(ctx.destination);
  return sortie;
}

/** Tampon de bruit blanc dont l'enveloppe est donnée par `forme(p)`, p allant de 0 à 1. */
function bruit(ctx: BaseAudioContext, duree: number, forme: (p: number) => number) {
  const n = Math.floor(ctx.sampleRate * duree);
  const tampon = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = tampon.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * forme(i / n);
  const source = ctx.createBufferSource();
  source.buffer = tampon;
  return source;
}

/**
 * Le sifflement d'une bombe qui tombe du ciel : une note aiguë qui descend
 * en s'amplifiant, avec un léger souffle d'air, et qui se coupe net à l'impact.
 */
export function sifflement(ctx: BaseAudioContext, debut: number, duree: number) {
  const sortie = sortieAudio(ctx, 0.4);
  const fin = debut + duree;

  const note = ctx.createOscillator();
  note.type = 'sine';
  note.frequency.setValueAtTime(2300, debut);
  note.frequency.exponentialRampToValueAtTime(420, fin);
  // Petit vibrato : le sifflement « flotte » un peu, comme dans les dessins animés.
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 9;
  const ampleur = ctx.createGain();
  ampleur.gain.value = 18;
  vibrato.connect(ampleur).connect(note.frequency);
  const gainNote = ctx.createGain();
  gainNote.gain.setValueAtTime(0.0001, debut);
  gainNote.gain.exponentialRampToValueAtTime(0.18, debut + 0.12);
  gainNote.gain.exponentialRampToValueAtTime(0.4, fin - 0.03);
  gainNote.gain.exponentialRampToValueAtTime(0.0001, fin);
  note.connect(gainNote).connect(sortie);

  // Le souffle de l'air, filtré autour de la note.
  const air = bruit(ctx, duree, (p) => p);
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'bandpass';
  filtre.Q.value = 6;
  filtre.frequency.setValueAtTime(2300, debut);
  filtre.frequency.exponentialRampToValueAtTime(420, fin);
  const gainAir = ctx.createGain();
  gainAir.gain.value = 0.25;
  air.connect(filtre).connect(gainAir).connect(sortie);

  for (const o of [note, vibrato]) {
    o.start(debut);
    o.stop(fin + 0.02);
  }
  air.start(debut);
}

/**
 * Une explosion de feu d'artifice : la détonation sèche, un coup sourd
 * dessous, puis le crépitement des étincelles qui retombent.
 * `force` va de 1 à 1.6 (le plus gros pour le dernier mot).
 */
export function feuDArtifice(ctx: BaseAudioContext, quand: number, force = 1) {
  const sortie = sortieAudio(ctx, 0.38);

  // La détonation : un bruit très bref et puissant.
  const detonation = bruit(ctx, 0.7, (p) => (1 - p) ** 6);
  const filtreDetonation = ctx.createBiquadFilter();
  filtreDetonation.type = 'lowpass';
  filtreDetonation.frequency.setValueAtTime(5000, quand);
  filtreDetonation.frequency.exponentialRampToValueAtTime(400, quand + 0.5);
  const gainDetonation = ctx.createGain();
  gainDetonation.gain.value = 0.9 * force;
  detonation.connect(filtreDetonation).connect(gainDetonation).connect(sortie);
  detonation.start(quand);

  // Le coup sourd sous la détonation.
  const coup = ctx.createOscillator();
  coup.type = 'sine';
  coup.frequency.setValueAtTime(110, quand);
  coup.frequency.exponentialRampToValueAtTime(40, quand + 0.3);
  const gainCoup = ctx.createGain();
  gainCoup.gain.setValueAtTime(0.0001, quand);
  gainCoup.gain.exponentialRampToValueAtTime(0.8, quand + 0.005);
  gainCoup.gain.exponentialRampToValueAtTime(0.0001, quand + 0.4);
  coup.connect(gainCoup).connect(sortie);
  coup.start(quand);
  coup.stop(quand + 0.45);

  // Le crépitement : de petits claquements qui s'espacent et s'éteignent.
  const duree = 1.1 + 0.5 * force;
  const n = Math.floor(ctx.sampleRate * duree);
  const tampon = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = tampon.getChannelData(0);
  const nbClaquements = Math.round(70 * force);
  for (let k = 0; k < nbClaquements; k++) {
    const p = Math.random() ** 1.6; // plus dense au début
    const debutGrain = Math.floor((0.12 + p * 0.85) * n);
    const longueurGrain = Math.floor(ctx.sampleRate * (0.002 + Math.random() * 0.006));
    const amplitude = (0.25 + Math.random() * 0.75) * (1 - p);
    for (let i = 0; i < longueurGrain && debutGrain + i < n; i++) {
      d[debutGrain + i] += (Math.random() * 2 - 1) * amplitude * (1 - i / longueurGrain);
    }
  }
  const crepitement = ctx.createBufferSource();
  crepitement.buffer = tampon;
  const filtreCrepitement = ctx.createBiquadFilter();
  filtreCrepitement.type = 'highpass';
  filtreCrepitement.frequency.value = 1800;
  const gainCrepitement = ctx.createGain();
  gainCrepitement.gain.value = 0.55;
  crepitement.connect(filtreCrepitement).connect(gainCrepitement).connect(sortie);
  crepitement.start(quand);
}

/** Le sifflement unique du début (s) : il se termine quand le premier mot touche le sol. */
export const DUREE_SIFFLEMENT = 1.3;

/**
 * Toute la bande-son de l'intro : un seul sifflement de bombe au début,
 * qui s'achève sur le premier impact, puis une explosion de feu d'artifice à
 * chaque mot. `impacts` : instants d'impact (s) comptés depuis `t0`.
 */
export function bandeSonIntro(ctx: BaseAudioContext, t0: number, impacts: number[]) {
  const premier = impacts[0];
  sifflement(ctx, t0 + Math.max(0, premier - DUREE_SIFFLEMENT), Math.min(DUREE_SIFFLEMENT, premier));
  impacts.forEach((impact, i) => feuDArtifice(ctx, t0 + impact, 1 + i * 0.3));
}

/** Durée de la musique de fin de chrono (s). */
export const DUREE_STRESS = 10;

/** Une note brève (oscillateur + enveloppe percussive) envoyée vers `sortie`. */
function note(ctx: BaseAudioContext, sortie: AudioNode, quand: number, freq: number, duree: number, type: OscillatorType, volume: number) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, quand);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, quand);
  g.gain.exponentialRampToValueAtTime(volume, quand + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, quand + duree);
  o.connect(g).connect(sortie);
  o.start(quand);
  o.stop(quand + duree + 0.02);
}

/**
 * Musique stressante des 10 dernières secondes : un tic-tac d'horloge, une
 * basse qui pulse et un petit motif aigu qui monte d'un demi-ton chaque
 * seconde ; le tempo double pendant les 3 dernières secondes, puis un buzzer
 * annonce la fin. `restant` : secondes avant la fin à partir de `debut`
 * (la musique démarre en cours de route si on la lance après les 10 s).
 * Renvoie une fonction qui l'arrête en fondu (tout le monde a répondu).
 */
export function musiqueStress(ctx: BaseAudioContext, debut: number, restant: number) {
  const general = ctx.createGain();
  general.gain.value = 1;
  const sortie = sortieAudio(ctx, 0.6);
  general.connect(sortie);
  const fin = debut + restant;

  for (let s = Math.ceil(restant) - 1; s >= 0; s--) {
    // `s` : secondes restantes au début de ce battement (9, 8, … 0).
    const t = fin - s - 1;
    if (t < debut - 0.01) continue;
    const pressant = s < 3;
    const pas = pressant ? 0.25 : 0.5;
    const montee = 2 ** ((DUREE_STRESS - 1 - s) / 12); // un demi-ton de plus par seconde
    for (let k = 0; k < 1 / pas; k++) {
      const q = t + k * pas;
      // Tic-tac : clic aigu puis plus grave.
      note(ctx, general, q, k % 2 ? 1500 : 2100, 0.04, 'square', 0.25);
      // Basse qui pulse, plus forte à la fin.
      note(ctx, general, q, 55 * montee, pas * 0.9, 'sawtooth', pressant ? 0.6 : 0.42);
    }
    // Petit motif aigu de deux notes, qui monte à chaque seconde.
    note(ctx, general, t, 440 * montee, 0.18, 'triangle', 0.35);
    note(ctx, general, t + 0.5, 466 * montee, 0.18, 'triangle', 0.35);
  }

  // Le buzzer final.
  const buzzer = ctx.createOscillator();
  buzzer.type = 'sawtooth';
  buzzer.frequency.setValueAtTime(180, fin);
  buzzer.frequency.linearRampToValueAtTime(120, fin + 0.6);
  const gBuzzer = ctx.createGain();
  gBuzzer.gain.setValueAtTime(0.0001, fin);
  gBuzzer.gain.exponentialRampToValueAtTime(0.6, fin + 0.02);
  gBuzzer.gain.setValueAtTime(0.6, fin + 0.45);
  gBuzzer.gain.exponentialRampToValueAtTime(0.0001, fin + 0.65);
  buzzer.connect(gBuzzer).connect(general);
  buzzer.start(fin);
  buzzer.stop(fin + 0.7);

  return () => {
    const now = ctx.currentTime;
    general.gain.cancelScheduledValues(now);
    general.gain.setValueAtTime(general.gain.value, now);
    general.gain.linearRampToValueAtTime(0, now + 0.25);
    setTimeout(() => general.disconnect(), 400);
  };
}

/** Petite vibration du téléphone (Android ; l'iPhone ne le permet pas aux sites web). */
export function vibrer(motif: number | number[]) {
  try {
    navigator.vibrate?.(motif);
  } catch {
    /* pas de vibreur : tant pis */
  }
}

/**
 * Les téléphones n'autorisent le son qu'après un toucher. Si l'intro n'a pas
 * débloqué l'audio (page rechargée en pleine partie), le premier toucher le fait.
 */
export function debloquerAuPremierToucher() {
  const debloquer = () => {
    contexteAudio()?.resume().catch(() => {});
    window.removeEventListener('pointerdown', debloquer);
  };
  window.addEventListener('pointerdown', debloquer);
}

export type VariantePet = 'classique' | 'pouet' | 'trompette' | 'mouille';

/**
 * Un bruit de pet pour la fin du chrono. Une note grave et râpeuse dont le
 * volume est haché très vite (le « flottement » caractéristique), plus un
 * souffle filtré. Chaque variante change la durée, la hauteur et le hachage.
 */
export function pet(ctx: BaseAudioContext, quand: number, variante: VariantePet = 'classique') {
  const reglages = {
    // durée (s), hauteur de départ et d'arrivée (Hz), hachage de départ et d'arrivée (Hz), souffle
    classique: { duree: 0.75, f0: 105, f1: 70, h0: 28, h1: 18, souffle: 0.25 },
    pouet: { duree: 0.28, f0: 240, f1: 300, h0: 45, h1: 40, souffle: 0.1 },
    trompette: { duree: 1.6, f0: 130, f1: 55, h0: 22, h1: 9, souffle: 0.2 },
    mouille: { duree: 0.9, f0: 80, f1: 60, h0: 34, h1: 14, souffle: 0.9 },
  }[variante];
  const { duree, f0, f1, h0, h1, souffle } = reglages;
  const fin = quand + duree;
  const sortie = sortieAudio(ctx, 0.7);

  // Enveloppe générale : attaque franche, petite relance, extinction.
  const enveloppe = ctx.createGain();
  enveloppe.gain.setValueAtTime(0.0001, quand);
  enveloppe.gain.exponentialRampToValueAtTime(1, quand + 0.02);
  enveloppe.gain.setValueAtTime(1, quand + duree * 0.6);
  enveloppe.gain.exponentialRampToValueAtTime(0.0001, fin);
  enveloppe.connect(sortie);

  // Le hachage : le volume oscille très vite entre presque rien et plein.
  const hache = ctx.createGain();
  hache.gain.value = 0.5;
  const lfo = ctx.createOscillator();
  lfo.type = variante === 'mouille' ? 'square' : 'triangle';
  lfo.frequency.setValueAtTime(h0, quand);
  lfo.frequency.linearRampToValueAtTime(h1, fin);
  const ampleurLfo = ctx.createGain();
  ampleurLfo.gain.value = 0.5;
  lfo.connect(ampleurLfo).connect(hache.gain);
  hache.connect(enveloppe);

  // La note grave et râpeuse, adoucie par un filtre.
  const corps = ctx.createOscillator();
  corps.type = 'sawtooth';
  corps.frequency.setValueAtTime(f0, quand);
  corps.frequency.exponentialRampToValueAtTime(f1, fin);
  // Petites irrégularités de hauteur, pour que ce soit moins « électronique ».
  const tremble = ctx.createOscillator();
  tremble.frequency.value = 7;
  const ampleurTremble = ctx.createGain();
  ampleurTremble.gain.value = f0 * 0.08;
  tremble.connect(ampleurTremble).connect(corps.frequency);
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.value = variante === 'pouet' ? 1400 : 700;
  filtre.Q.value = 4;
  const gainCorps = ctx.createGain();
  gainCorps.gain.value = 0.9;
  corps.connect(filtre).connect(gainCorps).connect(hache);

  // Le souffle (bruit filtré), plus présent dans la version « mouillée ».
  const air = bruit(ctx, duree, (p) => 1 - p * 0.5);
  const filtreAir = ctx.createBiquadFilter();
  filtreAir.type = 'bandpass';
  filtreAir.frequency.value = variante === 'mouille' ? 450 : 300;
  filtreAir.Q.value = 1.5;
  const gainAir = ctx.createGain();
  gainAir.gain.value = souffle;
  air.connect(filtreAir).connect(gainAir).connect(hache);

  for (const o of [lfo, corps, tremble]) {
    o.start(quand);
    o.stop(fin + 0.05);
  }
  air.start(quand);

  // La trompette se termine par trois petits « pouet ».
  if (variante === 'trompette') {
    for (const d of [0.12, 0.3, 0.45]) pet(ctx, fin + d, 'pouet');
  }
}
