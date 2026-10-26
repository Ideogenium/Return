import 'reflect-metadata';
import { validate } from './config.validation.js';

describe('validate (environment)', () => {
  const BASE_ENV = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_ACCESS_SECRET: 'access-secret',
  };

  const R2_ENV = {
    R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
    R2_ACCESS_KEY_ID: 'access-key',
    R2_SECRET_ACCESS_KEY: 'secret-key',
    R2_BUCKET_NAME: 'return-photos',
    R2_PUBLIC_URL: 'https://photos.example.r2.dev',
  };

  const PROD_ENV = {
    ...BASE_ENV,
    ...R2_ENV,
    NODE_ENV: 'production',
    CORS_ORIGIN: 'https://return-api.fly.dev',
  };

  it('accepts a development environment without R2 (local photo storage)', () => {
    expect(() => validate({ ...BASE_ENV, NODE_ENV: 'development' })).not.toThrow();
  });

  it('accepts a test environment without R2', () => {
    expect(() => validate({ ...BASE_ENV, NODE_ENV: 'test' })).not.toThrow();
  });

  it('refuses to start in production without R2, so photos can never silently go to ephemeral disk', () => {
    expect(() =>
      validate({ ...BASE_ENV, NODE_ENV: 'production', CORS_ORIGIN: PROD_ENV.CORS_ORIGIN }),
    ).toThrow(/R2/);
  });

  it('accepts production with a complete R2 configuration and an explicit CORS origin', () => {
    expect(() => validate(PROD_ENV)).not.toThrow();
  });

  it('refuses production without an explicit CORS_ORIGIN instead of silently allowing localhost', () => {
    const withoutCors: Record<string, unknown> = { ...PROD_ENV };
    delete withoutCors.CORS_ORIGIN;
    expect(() => validate(withoutCors)).toThrow(/CORS_ORIGIN/);
  });

  it.each(['http://localhost:8081', 'http://127.0.0.1:3000', 'https://localhost'])(
    'refuses a local CORS origin in production (%s)',
    (origin) => {
      expect(() => validate({ ...PROD_ENV, CORS_ORIGIN: origin })).toThrow(/CORS_ORIGIN/);
    },
  );

  it('keeps the localhost CORS default in development', () => {
    expect(validate({ ...BASE_ENV, NODE_ENV: 'development' }).CORS_ORIGIN).toBe(
      'http://localhost:8081',
    );
  });

  it('refuses production with an http public URL', () => {
    expect(() => validate({ ...PROD_ENV, R2_PUBLIC_URL: 'http://photos.example.r2.dev' })).toThrow(
      /R2_PUBLIC_URL/,
    );
  });

  it('refuses a partial R2 configuration in any environment', () => {
    expect(() =>
      validate({
        ...BASE_ENV,
        NODE_ENV: 'development',
        R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
      }),
    ).toThrow(/R2_ACCESS_KEY_ID/);
  });
});
