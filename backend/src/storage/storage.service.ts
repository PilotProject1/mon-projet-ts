import type { Readable } from 'stream';

export interface StoredFile {
  key: string;
  mimeType: string;
  sizeBytes: number;
}

export abstract class StorageService {
  abstract save(file: Express.Multer.File, ownerId: string): Promise<StoredFile>;
  abstract delete(key: string): Promise<void>;
  abstract createReadStream(key: string): Readable;
}
