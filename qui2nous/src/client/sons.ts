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

/** Petite vibration du téléphone (Android ; l'iPhone ne le permet pas aux sites web). */
export function vibrer(motif: number | number[]) {
  try {
    navigator.vibrate?.(motif);
  } catch {
    /* pas de vibreur : tant pis */
  }
}
