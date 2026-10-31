import { MiddlewareConsumer } from '@nestjs/common';
import { RequestContextMiddleware } from './request-context.middleware.js';

/**
 * Applies the request context (request id, user id) to every route: the `/v1` ones and those
 * excluded from the global prefix (`/health`, `/ready`). Named wildcard of path-to-regexp v8: a bare
 * `'*'` became `/v1/*`, legacy syntax that Nest 11 auto-converted with a warning at boot.
 */
export function applyRequestContext(consumer: MiddlewareConsumer): void {
  consumer.apply(RequestContextMiddleware).forRoutes('{*splat}');
}
