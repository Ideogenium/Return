import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Trusts `hops` proxies in front of the API for `req.ip` (Express `trust proxy`): the client
 * address is then the right-most X-Forwarded-For entry not added by a trusted proxy, which a
 * client cannot forge (only the left part of the header is under its control). 0 keeps the
 * socket address. On Fly, 2: the proxy appends its own address last in X-Forwarded-For
 * (`<forged…>, <client>, <Fly>`), after the client's.
 */
export function applyTrustProxy(app: NestExpressApplication, hops: number): void {
  if (hops > 0) app.set('trust proxy', hops);
}
