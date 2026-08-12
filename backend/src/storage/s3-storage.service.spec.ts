import { S3StorageService } from './s3-storage.service';

describe('S3StorageService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('refuses to start without the required S3 configuration', () => {
    expect(() => new S3StorageService()).toThrow(/Configuration S3 incomplète/);
  });

  it('starts once all required variables are set', () => {
    process.env.S3_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
    process.env.S3_BUCKET = 'syneco-documents';
    process.env.S3_ACCESS_KEY_ID = 'key';
    process.env.S3_SECRET_ACCESS_KEY = 'secret';

    expect(() => new S3StorageService()).not.toThrow();
  });
});
