import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PassThrough, Readable } from 'stream';
import { extname } from 'path';
// Version figée volontairement (voir package.json) : les versions plus récentes
// du SDK cassent la vérification de types de S3Client.send() avec ce tsconfig.
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { StorageService, StoredFile } from './storage.service';

@Injectable()
export class S3StorageService extends StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    super();
    const endpoint = process.env.S3_ENDPOINT;
    if (
      !endpoint ||
      !process.env.S3_BUCKET ||
      !process.env.S3_ACCESS_KEY_ID ||
      !process.env.S3_SECRET_ACCESS_KEY
    ) {
      throw new Error(
        'Configuration S3 incomplète : S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY sont requis quand STORAGE_DRIVER=s3',
      );
    }
    this.bucket = process.env.S3_BUCKET;
    this.client = new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? 'auto',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  async save(file: Express.Multer.File, ownerId: string): Promise<StoredFile> {
    const key = `${ownerId}/${randomUUID()}${extname(file.originalname)}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    return { key, mimeType: file.mimetype, sizeBytes: file.size };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  createReadStream(key: string): Readable {
    const pass = new PassThrough();
    this.client
      .send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
      .then((res) => {
        const body = res.Body as Readable;
        body.pipe(pass);
      })
      .catch((err) => pass.destroy(err));
    return pass;
  }

  async getBuffer(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const body = res.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
