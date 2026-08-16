/*
 * Quand envoyer le point hebdomadaire.
 *
 * La règle tient en deux lignes, mais elle protège deux choses opposées :
 * ne jamais envoyer deux fois la même semaine, et ne jamais perdre un envoi
 * parce que le serveur dormait le lundi matin. La tournée est donc tentée
 * chaque jour, et c'est cette fonction qui tranche.
 */

const JOUR_MS = 86_400_000;

/** Sept jours pleins entre deux envois : jamais deux fois la même semaine. */
const INTERVALLE_MINIMAL_JOURS = 7;

/** Le lundi, à l'heure de Paris — le serveur, lui, vit en UTC. */
export function estLundi(date: Date): boolean {
  return (
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      weekday: 'long',
    }).format(date) === 'lundi'
  );
}

/**
 * Vrai lorsque le point hebdomadaire doit partir maintenant.
 *
 * Un compte qui n'en a jamais reçu attend le lundi suivant : le rendez-vous
 * doit être prévisible. Ensuite, sept jours suffisent — ce qui rattrape
 * naturellement une semaine où la tournée du lundi n'a pas eu lieu, sans
 * jamais doubler l'envoi.
 */
export function envoiDu(now: Date, dernierEnvoi: Date | null): boolean {
  if (dernierEnvoi === null) return estLundi(now);

  const jours = (now.getTime() - dernierEnvoi.getTime()) / JOUR_MS;
  return jours >= INTERVALLE_MINIMAL_JOURS;
}
