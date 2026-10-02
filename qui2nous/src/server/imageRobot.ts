import { deflateSync } from 'node:zlib';

// « Photos » des robots : une petite image abstraite (dégradé et bulles de
// couleur) encodée en PNG à la main, pour tester Qui2Photo sans vraie photo.

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(octets: Buffer) {
  let c = 0xffffffff;
  for (const o of octets) c = TABLE_CRC[(c ^ o) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloc(type: string, donnees: Buffer) {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corps));
  return Buffer.concat([longueur, corps, crc]);
}

type Rvb = [number, number, number];

export function imageRobot(hasard: () => number, taille = 240): Buffer {
  const couleur = (): Rvb => [0, 0, 0].map(() => Math.floor(60 + hasard() * 195)) as Rvb;
  const [haut, bas] = [couleur(), couleur()];
  const bulles = Array.from({ length: 3 + Math.floor(hasard() * 4) }, () => ({
    x: hasard() * taille,
    y: hasard() * taille,
    r: taille * (0.08 + hasard() * 0.22),
    c: couleur(),
  }));

  const ligne = taille * 3 + 1;
  const brut = Buffer.alloc(ligne * taille);
  for (let y = 0; y < taille; y++) {
    brut[y * ligne] = 0; // pas de filtre
    for (let x = 0; x < taille; x++) {
      const t = (x + y) / (2 * taille);
      let px: Rvb = [0, 1, 2].map((i) => Math.round(haut[i] * (1 - t) + bas[i] * t)) as Rvb;
      for (const b of bulles) if ((x - b.x) ** 2 + (y - b.y) ** 2 < b.r ** 2) px = b.c;
      brut.set(px, y * ligne + 1 + x * 3);
    }
  }

  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(taille, 0);
  entete.writeUInt32BE(taille, 4);
  entete[8] = 8; // 8 bits par canal
  entete[9] = 2; // RVB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', entete),
    bloc('IDAT', deflateSync(brut)),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}
