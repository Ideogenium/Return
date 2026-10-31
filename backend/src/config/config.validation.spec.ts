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
    REDIS_URL: 'redis://default:pass@return-redis.internal:6379',
    CLIENT_IP_HEADER: 'fly-client-ip',
    TRUST_PROXY_HOPS: '1',
  };

  // FIX-37: behind the Fly proxy the socket address is the proxy's. Without a
  // client IP source, every user would share the same rate-limit buckets.
  describe('client IP source in production', () => {
    it('refuses to start when neither CLIENT_IP_HEADER nor TRUST_PROXY_HOPS is set', () => {
      const env: Record<string, unknown> = { ...PROD_ENV };
      delete env.CLIENT_IP_HEADER;
      delete env.TRUST_PROXY_HOPS;
      expect(() => validate(env)).toThrow(/CLIENT_IP_HEADER/);
    });

    it('accepts either source alone', () => {
      const headerOnly: Record<string, unknown> = { ...PROD_ENV };
      delete headerOnly.TRUST_PROXY_HOPS;
      const hopsOnly: Record<string, unknown> = { ...PROD_ENV };
      delete hopsOnly.CLIENT_IP_HEADER;
      expect(() => validate(headerOnly)).not.toThrow();
      expect(() => validate(hopsOnly)).not.toThrow();
    });

    it('does not require a client IP source in development', () => {
      expect(() => validate(BASE_ENV)).not.toThrow();
    });
  });

  it.each(['fly client ip', 'x-real-ip:', ''])(
    'refuses an invalid CLIENT_IP_HEADER %p',
    (value) => {
      expect(() => validate({ ...BASE_ENV, CLIENT_IP_HEADER: value })).toThrow(/CLIENT_IP_HEADER/);
    },
  );

  it.each(['-1', '1.5', 'abc'])('refuses an invalid TRUST_PROXY_HOPS %p', (value) => {
    expect(() => validate({ ...BASE_ENV, TRUST_PROXY_HOPS: value })).toThrow(/TRUST_PROXY_HOPS/);
  });

  describe('REDIS_URL in production', () => {
    const prodWithoutRedis: Record<string, unknown> = { ...PROD_ENV };
    delete prodWithoutRedis.REDIS_URL;

    // The class default (redis://localhost:6379) is a development convenience: in
    // production a forgotten secret must stop the boot, not point the app at nothing.
    it('refuses to start when REDIS_URL is not set, instead of falling back to localhost', () => {
      expect(() => validate(prodWithoutRedis)).toThrow(/REDIS_URL/);
    });

    it.each(['', 'not a url', 'http://redis.example.com:6379'])(
      'refuses a value that is not a redis:// or rediss:// URL (%p)',
      (value) => {
        expect(() => validate({ ...PROD_ENV, REDIS_URL: value })).toThrow(/REDIS_URL/);
      },
    );

    it('accepts an explicit redis:// or rediss:// URL', () => {
      expect(() => validate(PROD_ENV)).not.toThrow();
      expect(() =>
        validate({ ...PROD_ENV, REDIS_URL: 'rediss://default:pass@eu1.upstash.io:6379' }),
      ).not.toThrow();
    });

    it('keeps the localhost default in development', () => {
      expect(() => validate({ ...BASE_ENV, NODE_ENV: 'development' })).not.toThrow();
    });
  });

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

  it.each([
    'https://return-api.fly.dev/',
    'https://return-api.fly.dev/app',
    'http://return-api.fly.dev',
    'https://a.example.com,https://b.example.com',
  ])(
    'refuses a production CORS origin that the CORS middleware could never match (%s)',
    (origin) => {
      expect(() => validate({ ...PROD_ENV, CORS_ORIGIN: origin })).toThrow(/CORS_ORIGIN/);
    },
  );

  it.each([
    'http://localhost:8081',
    'http://127.0.0.1:3000',
    'https://localhost',
    'https://0.0.0.0',
    'https://app.localhost',
  ])('refuses a local CORS origin in production (%s)', (origin) => {
    expect(() => validate({ ...PROD_ENV, CORS_ORIGIN: origin })).toThrow(/CORS_ORIGIN/);
  });

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
