import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerOptions } from '@nestjs/throttler';
import { THROTTLE_BY_BODY_FIELD } from './throttle-by-body-field.decorator.js';

/** Name of the per-IP ceiling throttler (see clientIpCeiling). */
export const CLIENT_IP_CEILING = 'client-ip';

/**
 * Per-IP ceiling for routes keyed by a body field (@ThrottleByBodyField).
 *
 * The login counts per IP AND email, so that one account never blocks another. Alone,
 * that key lets one IP try any number of different emails (password spraying): this
 * throttler adds a second counter per IP only, active on those routes only. The guard
 * keys it by client IP whatever the route's body field (ClientIpThrottlerGuard).
 */
export function clientIpCeiling(ttl: number, limit: number): ThrottlerOptions {
  return {
    name: CLIENT_IP_CEILING,
    ttl,
    limit,
    skipIf: (context: ExecutionContext) =>
      Reflect.getMetadata(THROTTLE_BY_BODY_FIELD, context.getHandler()) === undefined &&
      Reflect.getMetadata(THROTTLE_BY_BODY_FIELD, context.getClass()) === undefined,
  };
}
