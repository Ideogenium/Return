import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Environment, EnvironmentVariables } from './env.validation.js';
import { readR2Settings } from './r2-settings.js';

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Config validation error:\n${errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('\n')}`,
    );
  }

  const raw = (key: string): string | undefined => {
    const value = config[key];
    return typeof value === 'string' ? value : undefined;
  };

  const r2Settings = readR2Settings(raw);
  if (validated.NODE_ENV === Environment.Production) {
    if (!r2Settings) {
      throw new Error(
        'Config validation error:\nCloudflare R2 (R2_*) is required in production: ' +
          'the container disk is ephemeral and local photos would be lost on every deploy.',
      );
    }
    assertProductionCorsOrigin(raw('CORS_ORIGIN'));
    assertProductionRedisUrl(raw('REDIS_URL'));
    assertProductionClientIpSource(raw('CLIENT_IP_HEADER'));
  }

  return validated;
}

// The class default (localhost) is a development convenience; production must
// name its allowed origin explicitly, exactly as browsers send it (the CORS
// middleware compares strings: a trailing slash or a path never matches).
function assertProductionCorsOrigin(origin: string | undefined): void {
  const url = origin ? safeUrl(origin) : null;
  const valid =
    url !== null &&
    url.protocol === 'https:' &&
    url.origin === origin &&
    !isLocalHostname(url.hostname);
  if (!valid) {
    throw new Error(
      'Config validation error:\nCORS_ORIGIN must be set explicitly in production to a single ' +
        'non-local https origin such as https://app.example.com (no path, no trailing slash).',
    );
  }
}

// Same reasoning as CORS: the class default (localhost) must never silently apply in
// production, where a forgotten secret would leave the app without its Redis.
function assertProductionRedisUrl(redisUrl: string | undefined): void {
  const url = redisUrl ? safeUrl(redisUrl) : null;
  if (url === null || !['redis:', 'rediss:'].includes(url.protocol)) {
    throw new Error(
      'Config validation error:\nREDIS_URL must be set explicitly in production to a ' +
        'redis:// or rediss:// URL.',
    );
  }
}

// FIX-37: in production the API runs behind the Fly proxy. Without the header the proxy
// sets with the client address, rate limiting would count every request under the
// proxy's address, and one client could lock the login for every user. A hop count
// alone is not enough: Fly appends its own address last in X-Forwarded-For.
function assertProductionClientIpSource(header: string | undefined): void {
  if (!header) {
    throw new Error(
      'Config validation error:\nCLIENT_IP_HEADER (on Fly: fly-client-ip) must be set in ' +
        'production: behind a proxy, rate limiting would otherwise share one bucket between ' +
        'all users.',
    );
  }
}

function isLocalHostname(hostname: string): boolean {
  return (
    ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(hostname) ||
    hostname.endsWith('.localhost')
  );
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
