import type { ConfigService } from '@nestjs/config';

import { createPhotoStorage } from './photo-storage.factory.js';
import { LocalPhotoStorageService } from './local-photo-storage.service.js';
import { R2PhotoStorageService } from './r2-photo-storage.service.js';

describe('createPhotoStorage', () => {
  const configWith = (env: Record<string, string>): ConfigService =>
    ({
      get: (key: string, defaultValue?: string) => env[key] ?? defaultValue,
    }) as unknown as ConfigService;

  it('uses local disk storage when R2 is not configured', () => {
    expect(createPhotoStorage(configWith({}))).toBeInstanceOf(LocalPhotoStorageService);
  });

  it('uses Cloudflare R2 when R2 is fully configured', () => {
    const storage = createPhotoStorage(
      configWith({
        R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
        R2_ACCESS_KEY_ID: 'access-key',
        R2_SECRET_ACCESS_KEY: 'secret-key',
        R2_BUCKET_NAME: 'return-photos',
        R2_PUBLIC_URL: 'https://photos.example.r2.dev',
      }),
    );

    expect(storage).toBeInstanceOf(R2PhotoStorageService);
  });

  it('fails fast on a partial R2 configuration instead of falling back to local disk', () => {
    expect(() =>
      createPhotoStorage(configWith({ R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef' })),
    ).toThrow(/Incomplete Cloudflare R2 configuration/);
  });
});
