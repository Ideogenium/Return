import { readR2Settings } from './r2-settings.js';

describe('readR2Settings', () => {
  const FULL_ENV: Record<string, string> = {
    R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
    R2_ACCESS_KEY_ID: 'access-key',
    R2_SECRET_ACCESS_KEY: 'secret-key',
    R2_BUCKET_NAME: 'return-photos',
    R2_PUBLIC_URL: 'https://photos.example.r2.dev',
  };

  const reader =
    (env: Record<string, string | undefined>) =>
    (key: string): string | undefined =>
      env[key];

  it('returns null when no R2 variable is set (local storage)', () => {
    expect(readR2Settings(reader({}))).toBeNull();
  });

  it('treats empty and blank values as unset, as in .env.example', () => {
    const blank = Object.fromEntries(Object.keys(FULL_ENV).map((k) => [k, ' ']));
    expect(readR2Settings(reader({ ...blank, R2_ACCOUNT_ID: '' }))).toBeNull();
  });

  it('returns the settings when every R2 variable is set', () => {
    expect(readR2Settings(reader(FULL_ENV))).toEqual({
      accountId: '0123456789abcdef0123456789abcdef',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      bucketName: 'return-photos',
      publicUrl: 'https://photos.example.r2.dev',
    });
  });

  it('strips trailing slashes from the public URL', () => {
    const settings = readR2Settings(
      reader({ ...FULL_ENV, R2_PUBLIC_URL: 'https://photos.example.r2.dev//' }),
    );
    expect(settings?.publicUrl).toBe('https://photos.example.r2.dev');
  });

  it('throws and names every missing variable when the configuration is partial', () => {
    const partial = {
      R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
      R2_BUCKET_NAME: 'return-photos',
    };
    expect(() => readR2Settings(reader(partial))).toThrow(
      /R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL/,
    );
  });

  it('never echoes secret values in the partial-configuration error', () => {
    const partial = { R2_SECRET_ACCESS_KEY: 'super-secret-value' };
    expect(() => readR2Settings(reader(partial))).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('super-secret-value') }),
    );
  });

  it.each([
    'https://user:pass@photos.example.r2.dev',
    'https://photos.example.r2.dev/?token=abc',
    'https://photos.example.r2.dev/#fragment',
  ])(
    'rejects a public URL carrying credentials, a query string or a fragment (%s)',
    (publicUrl) => {
      expect(() => readR2Settings(reader({ ...FULL_ENV, R2_PUBLIC_URL: publicUrl }))).toThrow(
        /R2_PUBLIC_URL/,
      );
    },
  );

  it('keeps a path prefix in the public URL', () => {
    const settings = readR2Settings(
      reader({ ...FULL_ENV, R2_PUBLIC_URL: 'https://cdn.example.com/photos/' }),
    );
    expect(settings?.publicUrl).toBe('https://cdn.example.com/photos');
  });

  it.each(['evil.example/x?', 'ACCOUNT', '0123456789abcdef'])(
    'rejects an account ID that is not a 32-character hex Cloudflare ID, since it becomes the request host (%s)',
    (accountId) => {
      expect(() => readR2Settings(reader({ ...FULL_ENV, R2_ACCOUNT_ID: accountId }))).toThrow(
        /R2_ACCOUNT_ID/,
      );
    },
  );

  it.each(['http://photos.example.r2.dev', 'photos.example.r2.dev', 'not a url'])(
    'rejects a public URL that is not an absolute https URL (%s)',
    (publicUrl) => {
      expect(() => readR2Settings(reader({ ...FULL_ENV, R2_PUBLIC_URL: publicUrl }))).toThrow(
        /R2_PUBLIC_URL/,
      );
    },
  );
});
