import { encoderBase32 } from './base32';
import { codePour, pasDeTemps, uriOtpauth, verifierCode } from './totp';

/*
 * Les vecteurs de la RFC 6238, annexe B. Ils y figurent sur huit chiffres ;
 * un code à six chiffres en est la fin, les deux calculs ne différant que par
 * le modulo appliqué au même nombre.
 *
 * Ce sont eux qui garantissent l'interopérabilité : un code qui ne les
 * respecte pas serait refusé par toutes les applications d'authentification
 * du monde, et le défaut n'apparaîtrait qu'entre les mains d'un utilisateur.
 */
const SECRET = encoderBase32(Buffer.from('12345678901234567890', 'utf8'));

const VECTEURS: [number, string][] = [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
  [20000000000, '353130'],
];

describe('totp', () => {
  it.each(VECTEURS)('à %p secondes, rend le code %p', (secondes, attendu) => {
    expect(codePour(SECRET, pasDeTemps(secondes))).toBe(attendu);
  });

  it('accepte le code de la tranche en cours', () => {
    const maintenant = 1_700_000_000;
    const code = codePour(SECRET, pasDeTemps(maintenant));
    expect(verifierCode(SECRET, code, { maintenant })).toEqual({
      pas: pasDeTemps(maintenant),
    });
  });

  it('tolère une horloge décalée d’une tranche, pas de deux', () => {
    const maintenant = 1_700_000_000;
    const precedent = codePour(SECRET, pasDeTemps(maintenant) - 1);
    const lointain = codePour(SECRET, pasDeTemps(maintenant) - 2);

    expect(verifierCode(SECRET, precedent, { maintenant })).not.toBeNull();
    expect(verifierCode(SECRET, lointain, { maintenant })).toBeNull();
  });

  /*
   * Le rejeu : sans ce refus, un code lu par-dessus l'épaule resterait
   * utilisable pendant la trentaine de secondes suivante.
   */
  it('refuse un code appartenant à une tranche déjà utilisée', () => {
    const maintenant = 1_700_000_000;
    const pas = pasDeTemps(maintenant);
    const code = codePour(SECRET, pas);

    expect(
      verifierCode(SECRET, code, { maintenant, apresPas: pas }),
    ).toBeNull();
    expect(
      verifierCode(SECRET, code, { maintenant, apresPas: pas - 1 }),
    ).not.toBeNull();
  });

  it('refuse ce qui n’a pas la forme d’un code', () => {
    const maintenant = 1_700_000_000;
    expect(verifierCode(SECRET, '', { maintenant })).toBeNull();
    expect(verifierCode(SECRET, '12345', { maintenant })).toBeNull();
    expect(verifierCode(SECRET, '1234567', { maintenant })).toBeNull();
    expect(verifierCode(SECRET, 'abcdef', { maintenant })).toBeNull();
  });

  it('écrit une adresse otpauth lisible par les applications courantes', () => {
    const uri = uriOtpauth({
      editeur: 'SYNeco',
      compte: 'client@exemple.fr',
      secret: SECRET,
    });

    expect(uri).toContain('otpauth://totp/SYNeco:client%40exemple.fr?');
    expect(uri).toContain('issuer=SYNeco');
    expect(uri).toContain('algorithm=SHA1');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
    // Le remplissage n'a pas cours dans une adresse otpauth.
    expect(uri).not.toContain('%3D');
  });
});
