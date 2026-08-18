import { chiffrer, dechiffrer, chiffrementDisponible } from './backup-crypto';

describe('chiffrement des sauvegardes', () => {
  const cleInitiale = process.env.BACKUP_KEY;

  beforeEach(() => {
    process.env.BACKUP_KEY = 'cle-de-test-de-plus-de-trente-deux-caracteres';
  });

  afterAll(() => {
    if (cleInitiale === undefined) delete process.env.BACKUP_KEY;
    else process.env.BACKUP_KEY = cleInitiale;
  });

  it('rend exactement ce qui a été chiffré', () => {
    const clair = Buffer.from('{"User":[{"id":"abc"}]}', 'utf8');
    expect(dechiffrer(chiffrer(clair))).toEqual(clair);
  });

  it('supporte un contenu volumineux et binaire', () => {
    const clair = Buffer.alloc(500_000, 0xa7);
    expect(dechiffrer(chiffrer(clair)).equals(clair)).toBe(true);
  });

  it('ne produit jamais deux fois la même enveloppe', () => {
    const clair = Buffer.from('même contenu');
    expect(chiffrer(clair).equals(chiffrer(clair))).toBe(false);
  });

  it('ne laisse pas le contenu lisible en clair', () => {
    const enveloppe = chiffrer(Buffer.from('marie.dupont@exemple.fr'));
    expect(enveloppe.toString('latin1')).not.toContain('marie.dupont');
  });

  /*
   * Le point qui distingue une sauvegarde d'un fichier quelconque : une
   * corruption doit se voir au déchiffrement, et non se découvrir le jour de
   * la restauration.
   */
  it('refuse une sauvegarde altérée plutôt que de rendre des octets faux', () => {
    const enveloppe = chiffrer(Buffer.from('contenu important'));
    enveloppe[enveloppe.length - 1] ^= 0xff;
    expect(() => dechiffrer(enveloppe)).toThrow();
  });

  it('refuse un fichier qui n’est pas une sauvegarde', () => {
    expect(() => dechiffrer(Buffer.from('un fichier quelconque'))).toThrow(
      /sauvegarde SYNeco/,
    );
  });

  it('refuse une sauvegarde chiffrée avec une autre clé', () => {
    const enveloppe = chiffrer(Buffer.from('contenu'));
    process.env.BACKUP_KEY = 'une-toute-autre-cle-de-trente-deux-caracteres';
    expect(() => dechiffrer(enveloppe)).toThrow();
  });

  it('signale une clé absente ou trop courte', () => {
    delete process.env.BACKUP_KEY;
    expect(chiffrementDisponible()).toBe(false);
    expect(() => chiffrer(Buffer.from('x'))).toThrow(/BACKUP_KEY/);

    process.env.BACKUP_KEY = 'trop-courte';
    expect(chiffrementDisponible()).toBe(false);
  });
});
