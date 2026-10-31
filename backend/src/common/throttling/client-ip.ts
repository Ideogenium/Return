import { isIP } from 'node:net';

/** The request fields used to find the client address (an Express request satisfies it). */
export interface ClientIpRequest {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * The address of the client that sent the request, for rate limiting.
 *
 * Behind the Fly proxy the socket address is the proxy's: the client address is in the
 * header the proxy sets on every request (`Fly-Client-IP`), named by `headerName`. The
 * header is read only when configured, since outside Fly a client could set it itself,
 * and only when it holds a valid IP address. Otherwise `req.ip` is used, which honours
 * Express's `trust proxy` setting (see applyTrustProxy).
 */
export function resolveClientIp(req: ClientIpRequest, headerName: string | undefined): string {
  if (headerName) {
    const raw = req.headers[headerName.toLowerCase()];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (value && isIP(value) !== 0) return value;
  }
  return req.ip ?? 'unknown';
}
