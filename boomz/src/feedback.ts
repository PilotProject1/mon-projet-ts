/**
 * Avis des testeurs : le formulaire produit un petit texte, envoyé par le
 * partage du téléphone (WhatsApp, SMS…) à la personne qui a invité le testeur.
 * Rien n'est stocké en ligne : le serveur gratuit s'efface à chaque mise en
 * veille, et un testeur extérieur n'a accès à aucun autre outil.
 */

export interface FeedbackAnswers {
  note: string;
  priseEnMain: string;
  reactivite: string;
  sons: string;
  bonusFort: string;
  arene: string;
  bug: string;
  remarque: string;
}

export interface TechnicalInfo {
  device: string;
  screen: string;
  network: string;
  /** Délai aller-retour médian avec le serveur, en ms (null : pas mesuré). */
  latencyMs: number | null;
  lastMatch: string;
}

/** Modèle approximatif d'après le navigateur : assez pour repérer un souci propre à un téléphone. */
export function describeDevice(userAgent: string): string {
  const ios = /(iPhone|iPad|iPod).*? OS (\d+)[_.](\d+)/.exec(userAgent);
  if (ios) return `${ios[1]} (iOS ${ios[2]}.${ios[3]})`;
  const android = /Android (\d+(?:\.\d+)?);\s*([^;)]+?)(?:\sBuild|\))/.exec(userAgent);
  if (android) return `${android[2].trim()} (Android ${android[1]})`;
  if (/Macintosh/.test(userAgent)) return 'Mac';
  if (/Windows/.test(userAgent)) return 'PC Windows';
  if (/Linux/.test(userAgent)) return 'Linux';
  return 'Appareil inconnu';
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length / 2)]);
}

export function composeFeedback(answers: FeedbackAnswers, info: TechnicalInfo): string {
  const note = Number(answers.note);
  const lines = ['Avis Boomz'];
  if (note >= 1 && note <= 5) lines.push(`Note : ${'★'.repeat(note)}${'☆'.repeat(5 - note)} (${note}/5)`);
  const add = (label: string, value: string) => {
    if (value.trim()) lines.push(`${label} : ${value.trim()}`);
  };
  add('Prise en main', answers.priseEnMain);
  add('Réactivité', answers.reactivite);
  add('Sons et musique', answers.sons);
  add('Bonus trop fort', answers.bonusFort);
  add('Arène préférée', answers.arene);
  add('Bug / affichage', answers.bug);
  add('Remarque', answers.remarque);
  lines.push('');
  lines.push(
    `— Technique : ${info.device}, écran ${info.screen}, réseau ${info.network}, ` +
      `délai ${info.latencyMs === null ? 'non mesuré' : `≈ ${info.latencyMs} ms`}, ${info.lastMatch}.`,
  );
  return lines.join('\n');
}
