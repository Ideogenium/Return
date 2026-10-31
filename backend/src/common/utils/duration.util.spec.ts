import type { ConfigService } from '@nestjs/config';
import {
  ACCESS_TOKEN_DEFAULT_TTL_SECONDS,
  accessTokenTtlSeconds,
  parseDurationMs,
} from './duration.util.js';

describe('parseDurationMs', () => {
  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['30d', 2_592_000_000],
  ])('reads %s as %i ms', (duration, expected) => {
    expect(parseDurationMs(duration, 1)).toBe(expected);
  });

  it.each(['15', 'm', '15 m', '1w', ''])('falls back on an unreadable value (%p)', (duration) => {
    expect(parseDurationMs(duration, 42)).toBe(42);
  });
});

describe('accessTokenTtlSeconds', () => {
  const configWith = (value: string | undefined) =>
    ({
      get: (_key: string, fallback: string) => value ?? fallback,
    }) as unknown as ConfigService;

  it('reads JWT_ACCESS_EXPIRATION in seconds', () => {
    expect(accessTokenTtlSeconds(configWith('10m'))).toBe(600);
  });

  it('uses 15 min when the variable is absent or unreadable', () => {
    expect(accessTokenTtlSeconds(configWith(undefined))).toBe(ACCESS_TOKEN_DEFAULT_TTL_SECONDS);
    expect(accessTokenTtlSeconds(configWith('soon'))).toBe(ACCESS_TOKEN_DEFAULT_TTL_SECONDS);
    expect(ACCESS_TOKEN_DEFAULT_TTL_SECONDS).toBe(900);
  });
});
