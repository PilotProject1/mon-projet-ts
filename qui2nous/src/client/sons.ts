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

/**
 * Un « BOOM » lourd, comme un gros objet qui tombe : un coup sourd dont la
 * hauteur plonge, un craquement d'impact filtré, et une harmonique un peu
 * saturée pour que le choc s'entende aussi sur un petit haut-parleur de
 * téléphone, qui ne restitue pas les graves profonds.
 * `force` va de 1 (léger) à 1.6 (le plus gros, pour le dernier mot).
 */
export function boom(ctx: BaseAudioContext, quand: number, force = 1) {
  const sortie = ctx.createGain();
  sortie.gain.value = 0.5;
  const compresseur = ctx.createDynamicsCompressor();
  compresseur.threshold.value = -14;
  compresseur.ratio.value = 6;
  sortie.connect(compresseur).connect(ctx.destination);

  const duree = 0.9 + 0.35 * force;

  // Le corps du choc : une sinusoïde grave qui plonge.
  const corps = ctx.createOscillator();
  corps.type = 'sine';
  corps.frequency.setValueAtTime(140 / force, quand);
  corps.frequency.exponentialRampToValueAtTime(34, quand + 0.5);
  const gainCorps = ctx.createGain();
  gainCorps.gain.setValueAtTime(0.0001, quand);
  gainCorps.gain.exponentialRampToValueAtTime(1, quand + 0.006);
  gainCorps.gain.exponentialRampToValueAtTime(0.0001, quand + duree);
  corps.connect(gainCorps).connect(sortie);
  corps.start(quand);
  corps.stop(quand + duree + 0.05);

  // L'harmonique saturée, audible sur un haut-parleur de téléphone.
  const harmonique = ctx.createOscillator();
  harmonique.type = 'triangle';
  harmonique.frequency.setValueAtTime(320 / force, quand);
  harmonique.frequency.exponentialRampToValueAtTime(90, quand + 0.35);
  const saturation = ctx.createWaveShaper();
  const courbe = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * 2 - 1;
    courbe[i] = Math.tanh(3 * x);
  }
  saturation.curve = courbe;
  const gainHarmonique = ctx.createGain();
  gainHarmonique.gain.setValueAtTime(0.0001, quand);
  gainHarmonique.gain.exponentialRampToValueAtTime(0.35 * force, quand + 0.004);
  gainHarmonique.gain.exponentialRampToValueAtTime(0.0001, quand + 0.45);
  harmonique.connect(saturation).connect(gainHarmonique).connect(sortie);
  harmonique.start(quand);
  harmonique.stop(quand + 0.5);

  // Le craquement de l'impact : un bruit bref, filtré vers le grave.
  const longueur = Math.floor(ctx.sampleRate * 0.35);
  const tampon = ctx.createBuffer(1, longueur, ctx.sampleRate);
  const donnees = tampon.getChannelData(0);
  for (let i = 0; i < longueur; i++) donnees[i] = (Math.random() * 2 - 1) * (1 - i / longueur) ** 3;
  const bruit = ctx.createBufferSource();
  bruit.buffer = tampon;
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.setValueAtTime(1400, quand);
  filtre.frequency.exponentialRampToValueAtTime(200, quand + 0.3);
  const gainBruit = ctx.createGain();
  gainBruit.gain.value = 0.55 * force;
  bruit.connect(filtre).connect(gainBruit).connect(sortie);
  bruit.start(quand);
}

/** Petite vibration du téléphone (Android ; l'iPhone ne le permet pas aux sites web). */
export function vibrer(motif: number | number[]) {
  try {
    navigator.vibrate?.(motif);
  } catch {
    /* pas de vibreur : tant pis */
  }
}
