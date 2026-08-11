import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { StorageService, StoredFile } from './storage.service';

const UPLOAD_ROOT = join(process.cwd(), 'uploads');

@Injectable()
export class LocalStorageService extends StorageService {
  async save(file: Express.Multer.File, ownerId: string): Promise<StoredFile> {
    const key = `${ownerId}/${randomUUID()}${extname(file.originalname)}`;
    const fullPath = join(UPLOAD_ROOT, key);

    await mkdir(join(UPLOAD_ROOT, ownerId), { recursive: true });
    await writeFile(fullPath, file.buffer);

    return { key, mimeType: file.mimetype, sizeBytes: file.size };
  }

  async delete(key: string): Promise<void> {
    await rm(join(UPLOAD_ROOT, key), { force: true });
  }

  createReadStream(key: string) {
    return createReadStream(join(UPLOAD_ROOT, key));
  }

  async getBuffer(key: string): Promise<Buffer> {
    return readFile(join(UPLOAD_ROOT, key));
  }
}
