import { adressePour, jetonDansAdresse, nouveauJeton } from './adresse';

describe('adresse de dépôt', () => {
  const DOMAINE = 'depot.syneco.pro';

  it('tire un jeton sans voyelle, de longueur fixe', () => {
    for (let i = 0; i < 50; i += 1) {
      const jeton = nouveauJeton();
      expect(jeton).toHaveLength(16);
      expect(jeton).toMatch(/^[bcdfghjkmnpqrstvwxz23456789]+$/);
    }
  });

  it('ne rend jamais deux fois le même jeton', () => {
    const vus = new Set(Array.from({ length: 200 }, () => nouveauJeton()));
    expect(vus.size).toBe(200);
  });

  it('retrouve le jeton dans son adresse', () => {
    const jeton = nouveauJeton();
    expect(jetonDansAdresse(adressePour(jeton, DOMAINE), DOMAINE)).toBe(jeton);
  });

  /* Un serveur de messagerie change la casse et ajoute le nom affiché. */
  it('tolère la casse, les chevrons et un nom devant', () => {
    const jeton = nouveauJeton();
    const adresse = adressePour(jeton, DOMAINE);
    expect(jetonDansAdresse(adresse.toUpperCase(), DOMAINE)).toBe(jeton);
    expect(jetonDansAdresse(`SYNeco <${adresse}>`, DOMAINE)).toBe(jeton);
    expect(jetonDansAdresse(`  ${adresse}  `, DOMAINE)).toBe(jeton);
  });

  /*
   * Le cœur de la protection : tout ce qui n'est pas exactement la bonne
   * forme est refusé. Un message mal adressé doit être ignoré, jamais déposé
   * dans un compte approchant.
   */
  it('refuse ce qui ne colle pas exactement', () => {
    const jeton = nouveauJeton();
    expect(
      jetonDansAdresse(`depot-${jeton}@autre-domaine.fr`, DOMAINE),
    ).toBeNull();
    expect(jetonDansAdresse(`depot-${jeton}x@${DOMAINE}`, DOMAINE)).toBeNull();
    expect(jetonDansAdresse(`autre-${jeton}@${DOMAINE}`, DOMAINE)).toBeNull();
    expect(
      jetonDansAdresse(`depot-${jeton.slice(0, 8)}@${DOMAINE}`, DOMAINE),
    ).toBeNull();
    expect(jetonDansAdresse(`contact@${DOMAINE}`, DOMAINE)).toBeNull();
    expect(jetonDansAdresse('', DOMAINE)).toBeNull();
  });

  /* Un sous-domaine qui ressemble ne suffit pas. */
  it('refuse un domaine qui se termine par le bon sans être le bon', () => {
    const jeton = nouveauJeton();
    expect(
      jetonDansAdresse(
        `depot-${jeton}@mechant-depot.syneco.pro.attaquant.fr`,
        DOMAINE,
      ),
    ).toBeNull();
  });
});
