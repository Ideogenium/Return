import { SetMetadata } from '@nestjs/common';

export const THROTTLE_BY_BODY_FIELD = 'return:throttle-by-body-field';

/**
 * Counts the route's rate limit per client IP AND per value of a body field, instead of
 * per client IP alone. On the login, keyed by email: brute force on one account stays
 * limited, while attempts on one account never block the others from the same network.
 */
export const ThrottleByBodyField = (field: string): MethodDecorator & ClassDecorator =>
  SetMetadata(THROTTLE_BY_BODY_FIELD, field);

/** Trimmed, lower-cased string value; undefined when absent or not a string. */
export function normalizeThrottleField(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}
