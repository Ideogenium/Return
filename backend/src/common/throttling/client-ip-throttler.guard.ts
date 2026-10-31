import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerRequest,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { CLIENT_IP_CEILING } from './client-ip-ceiling.js';
import { resolveClientIp, type ClientIpRequest } from './client-ip.js';
import {
  normalizeThrottleField,
  THROTTLE_BY_BODY_FIELD,
} from './throttle-by-body-field.decorator.js';

/**
 * Global rate-limit guard keyed by the real client (FIX-37).
 *
 * The stock ThrottlerGuard counts by `req.ip`, which behind the Fly proxy is the proxy's
 * address: every user shared the same buckets. This guard counts by the client address
 * (resolveClientIp), and, on routes marked with @ThrottleByBodyField, by client address
 * plus the normalized body field (the email on the login). The per-IP ceiling of those
 * routes (clientIpCeiling) is always keyed by client address alone. Keys are hashed by
 * the throttler before storage: no email is kept in clear.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  protected override handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    if (requestProps.throttler.name !== CLIENT_IP_CEILING) return super.handleRequest(requestProps);
    return super.handleRequest({
      ...requestProps,
      getTracker: (req) => Promise.resolve(this.clientIp(req)),
    });
  }

  protected override getTracker(
    req: Record<string, unknown>,
    context?: ExecutionContext,
  ): Promise<string> {
    return Promise.resolve(this.trackerFor(req, context));
  }

  private trackerFor(req: Record<string, unknown>, context?: ExecutionContext): string {
    const ip = this.clientIp(req);
    if (!context) return ip;

    const field = this.reflector.getAllAndOverride<string | undefined>(THROTTLE_BY_BODY_FIELD, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!field) return ip;

    const body = req.body as Record<string, unknown> | undefined;
    const value = normalizeThrottleField(body?.[field]);
    return value ? `${ip}|${value}` : ip;
  }

  private clientIp(req: Record<string, unknown>): string {
    return resolveClientIp(
      req as unknown as ClientIpRequest,
      this.config.get<string>('CLIENT_IP_HEADER'),
    );
  }
}
