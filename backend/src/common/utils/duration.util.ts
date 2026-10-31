import type { ConfigService } from '@nestjs/config';

/** Access token lifetime when JWT_ACCESS_EXPIRATION is absent or unreadable (15 min). */
export const ACCESS_TOKEN_DEFAULT_TTL_SECONDS = 900;

const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Parses a `<number><unit>` duration (s/m/h/d, the format of the JWT_* expirations) into
 * milliseconds, or returns `fallbackMs` when the value cannot be read.
 */
export function parseDurationMs(duration: string, fallbackMs: number): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return fallbackMs;
  return parseInt(match[1], 10) * UNIT_MS[match[2]];
}

/** Lifetime of an access token in seconds, as configured by JWT_ACCESS_EXPIRATION. */
export function accessTokenTtlSeconds(config: ConfigService): number {
  const configured = config.get<string>('JWT_ACCESS_EXPIRATION', '15m');
  return Math.floor(parseDurationMs(configured, ACCESS_TOKEN_DEFAULT_TTL_SECONDS * 1000) / 1000);
}
