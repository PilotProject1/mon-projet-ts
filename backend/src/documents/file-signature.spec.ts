import { typeReel } from './file-signature';

/** Fabrique un contenu commençant par les octets donnés. */
function avecEnTete(octets: number[], suite = 'contenu quelconque'): Buffer {
  return Buffer.concat([Buffer.from(octets), Buffer.from(suite)]);
}

describe('typeReel', () => {
  it('reconnaît un PDF à sa signature', () => {
    expect(typeReel(avecEnTete([0x25, 0x50, 0x44, 0x46]))).toBe(
      'application/pdf',
    );
  });

  it('reconnaît un JPEG, un PNG et un WEBP', () => {
    expect(typeReel(avecEnTete([0xff, 0xd8, 0xff]))).toBe('image/jpeg');
    expect(
      typeReel(avecEnTete([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('image/png');
    expect(
      typeReel(
        Buffer.concat([
          Buffer.from([0x52, 0x49, 0x46, 0x46]),
          Buffer.from([0, 0, 0, 0]),
          Buffer.from('WEBP'),
        ]),
      ),
    ).toBe('image/webp');
  });

  it('démasque un exécutable renommé en PDF', () => {
    // « MZ » : en-tête d'un exécutable Windows. Le nom et le type déclaré
    // pouvaient dire « facture.pdf », le contenu, lui, ne ment pas.
    expect(typeReel(avecEnTete([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
  });

  it('refuse un RIFF qui n’est pas une image', () => {
    // Un WAV est aussi un conteneur RIFF : sans la marque WEBP, il passerait
    // pour une image.
    expect(
      typeReel(
        Buffer.concat([
          Buffer.from([0x52, 0x49, 0x46, 0x46]),
          Buffer.from([0, 0, 0, 0]),
          Buffer.from('WAVE'),
        ]),
      ),
    ).toBeNull();
  });

  it('refuse un fichier trop court pour être identifié', () => {
    expect(typeReel(Buffer.from([0x25]))).toBeNull();
  });

  it('refuse un texte brut, fût-il inoffensif', () => {
    expect(typeReel(Buffer.from('bonjour'))).toBeNull();
  });
});
