import { decoderBase32, encoderBase32 } from './base32';

/*
 * Les vecteurs de la RFC 4648, section 10. Ils ne prouvent pas seulement que
 * l'encodage fonctionne : ils prouvent qu'il est le même que celui de tout le
 * monde, ce qui est le seul intérêt d'un format d'échange.
 */
const VECTEURS: [string, string][] = [
  ['', ''],
  ['f', 'MY======'],
  ['fo', 'MZXQ===='],
  ['foo', 'MZXW6==='],
  ['foob', 'MZXW6YQ='],
  ['fooba', 'MZXW6YTB'],
  ['foobar', 'MZXW6YTBOI======'],
];

describe('base32', () => {
  it.each(VECTEURS)('encode %p en %p', (clair, encode) => {
    expect(encoderBase32(Buffer.from(clair, 'utf8'))).toBe(encode);
  });

  it.each(VECTEURS)('retrouve %p depuis %p', (clair, encode) => {
    expect(decoderBase32(encode).toString('utf8')).toBe(clair);
  });

  it('ignore les espaces et la casse, comme le fait une saisie humaine', () => {
    expect(decoderBase32('mzxw 6ytb oi======').toString('utf8')).toBe('foobar');
  });

  it('refuse un caractère hors alphabet plutôt que de rendre des octets faux', () => {
    expect(() => decoderBase32('MZXW6YT1')).toThrow(/base32/);
  });
});
