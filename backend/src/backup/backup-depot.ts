import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { readdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

/*
 * Où se posent les sauvegardes.
 *
 * Une sauvegarde rangée à côté de ce qu'elle sauvegarde ne sauvegarde rien.
 * En production, elle part donc chez le prestataire de stockage — Cloudflare
 * R2 — qui n'est pas celui de la base : un incident chez l'hébergeur de la
 * base laisse les sauvegardes intactes.
 *
 * Ce que cela ne couvre pas, et il faut le savoir : une compromission du
 * compte de stockage lui-même. C'est précisément pour cela que le contenu est
 * chiffré avant d'arriver ici, avec une clé qui ne s'y trouve pas.
 *
 * Sans configuration S3 — en développement — les sauvegardes tombent dans un
 * dossier local. Le mécanisme reste donc exerçable ailleurs qu'en production,
 * ce qui est la seule façon d'avoir confiance en lui.
 */

export interface ObjetSauvegarde {
  cle: string;
  taille: number;
  date: Date;
}

@Injectable()
export class BackupDepot {
  private readonly logger = new Logger(BackupDepot.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly prefixe: string;
  private readonly dossierLocal: string;

  constructor() {
    this.prefixe = process.env.BACKUP_S3_PREFIX ?? 'sauvegardes/';
    this.bucket = process.env.BACKUP_S3_BUCKET ?? process.env.S3_BUCKET ?? '';
    this.dossierLocal = process.env.BACKUP_DIR ?? 'backups';

    const configureeS3 =
      process.env.S3_ENDPOINT &&
      this.bucket &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY;

    this.client = configureeS3
      ? new S3Client({
          endpoint: process.env.S3_ENDPOINT,
          region: process.env.S3_REGION ?? 'auto',
          forcePathStyle: true,
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
          },
        })
      : null;
  }

  /** `true` si les sauvegardes quittent réellement le serveur. */
  get deporte(): boolean {
    return this.client !== null;
  }

  get emplacement(): string {
    return this.deporte
      ? `${this.bucket}/${this.prefixe}`
      : `${this.dossierLocal}/ (local — non déporté)`;
  }

  async deposer(cle: string, contenu: Buffer): Promise<void> {
    if (this.client) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: this.prefixe + cle,
          Body: contenu,
          ContentType: 'application/octet-stream',
        }),
      );
      return;
    }
    mkdirSync(this.dossierLocal, { recursive: true });
    await writeFile(join(this.dossierLocal, cle), contenu);
  }

  async relire(cle: string): Promise<Buffer> {
    if (this.client) {
      const reponse = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.prefixe + cle }),
      );
      const octets = await reponse.Body?.transformToByteArray();
      if (!octets) throw new Error(`Sauvegarde illisible : ${cle}`);
      return Buffer.from(octets);
    }
    return readFile(join(this.dossierLocal, cle));
  }

  async lister(): Promise<ObjetSauvegarde[]> {
    if (this.client) {
      const objets: ObjetSauvegarde[] = [];
      let suite: string | undefined;
      do {
        const reponse = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: this.prefixe,
            ContinuationToken: suite,
          }),
        );
        for (const objet of reponse.Contents ?? []) {
          if (!objet.Key) continue;
          objets.push({
            cle: objet.Key.slice(this.prefixe.length),
            taille: objet.Size ?? 0,
            date: objet.LastModified ?? new Date(0),
          });
        }
        suite = reponse.IsTruncated ? reponse.NextContinuationToken : undefined;
      } while (suite);
      return objets.sort((a, b) => a.cle.localeCompare(b.cle));
    }

    if (!existsSync(this.dossierLocal)) return [];
    const noms = await readdir(this.dossierLocal);
    return noms
      .filter((nom) => nom.endsWith('.syneco'))
      .sort()
      .map((nom) => ({ cle: nom, taille: 0, date: new Date(0) }));
  }

  async supprimer(cle: string): Promise<void> {
    if (this.client) {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.prefixe + cle,
        }),
      );
      return;
    }
    await rm(join(this.dossierLocal, cle), { force: true });
  }
}
