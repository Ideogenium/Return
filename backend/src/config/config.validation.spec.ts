import 'reflect-metadata';
import { validate } from './config.validation.js';

describe('validate (environment)', () => {
  const BASE_ENV = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_ACCESS_SECRET: 'access-secret',
  };

  const R2_ENV = {
    R2_ACCOUNT_ID: 'account-123',
    R2_ACCESS_KEY_ID: 'access-key',
    R2_SECRET_ACCESS_KEY: 'secret-key',
    R2_BUCKET_NAME: 'return-photos',
    R2_PUBLIC_URL: 'https://photos.example.r2.dev',
  };

  it('accepts a development environment without R2 (local photo storage)', () => {
    expect(() => validate({ ...BASE_ENV, NODE_ENV: 'development' })).not.toThrow();
  });

  it('accepts a test environment without R2', () => {
    expect(() => validate({ ...BASE_ENV, NODE_ENV: 'test' })).not.toThrow();
  });

  it('refuses to start in production without R2, so photos can never silently go to ephemeral disk', () => {
    expect(() => validate({ ...BASE_ENV, NODE_ENV: 'production' })).toThrow(/R2/);
  });

  it('accepts production with a complete R2 configuration', () => {
    expect(() => validate({ ...BASE_ENV, ...R2_ENV, NODE_ENV: 'production' })).not.toThrow();
  });

  it('refuses a partial R2 configuration in any environment', () => {
    expect(() =>
      validate({ ...BASE_ENV, NODE_ENV: 'development', R2_ACCOUNT_ID: 'account-123' }),
    ).toThrow(/R2_ACCESS_KEY_ID/);
  });
});
