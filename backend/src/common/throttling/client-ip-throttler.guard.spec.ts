import { Controller, Get, INestApplication, Post, Req } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request } from 'express';
import request from 'supertest';
import { AllExceptionsFilter } from '../exceptions/all-exceptions.filter.js';
import { ClientIpThrottlerGuard } from './client-ip-throttler.guard.js';
import { ThrottleByBodyField } from './throttle-by-body-field.decorator.js';
import { applyTrustProxy } from './trust-proxy.js';

// =============================================================================
// Throttling per real client (FIX-37)
// =============================================================================
// Behind the Fly proxy every request comes from the proxy's address: counting by
// the socket address put every user in the same bucket, so 10 failed logins from
// anyone locked the login for everyone. These tests run the real guard, the real
// throttler storage and the real exception filter through HTTP.
// =============================================================================

jest.mock('../middleware/request-context.middleware.js', () => ({
  getRequestId: () => 'test-request-id',
}));

@Controller()
class ProbeController {
  @Get('ping')
  ping(): { ok: true } {
    return { ok: true };
  }

  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 2 } })
  @ThrottleByBodyField('email')
  login(): { ok: true } {
    return { ok: true };
  }

  @Get('whoami')
  whoami(@Req() req: Request): { ip: string | undefined } {
    return { ip: req.ip };
  }
}

async function createApp(
  env: Record<string, string>,
  trustProxyHops = 0,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ ignoreEnvFile: true, load: [() => env] }),
      ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 3 }] }),
    ],
    controllers: [ProbeController],
    providers: [{ provide: APP_GUARD, useClass: ClientIpThrottlerGuard }],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  applyTrustProxy(app, trustProxyHops);
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

const FLY = { CLIENT_IP_HEADER: 'fly-client-ip' };

describe('ClientIpThrottlerGuard', () => {
  describe('behind the Fly proxy (CLIENT_IP_HEADER set)', () => {
    let app: INestApplication;
    beforeEach(async () => {
      app = await createApp(FLY);
    });
    afterEach(async () => {
      await app.close();
    });

    const ping = (ip: string) => request(app.getHttpServer()).get('/ping').set('Fly-Client-IP', ip);
    const login = (ip: string, email: string) =>
      request(app.getHttpServer())
        .post('/login')
        .set('Fly-Client-IP', ip)
        .send({ email, password: 'wrong-password' });

    it('gives each client IP its own bucket: one client at the limit does not block another', async () => {
      for (let i = 0; i < 3; i++) await ping('203.0.113.1').expect(200);
      await ping('203.0.113.1').expect(429);
      await ping('203.0.113.2').expect(200);
    });

    it('answers the contract 429 rate-limit-exceeded once the limit is reached', async () => {
      for (let i = 0; i < 3; i++) await ping('203.0.113.3').expect(200);
      const res = await ping('203.0.113.3').expect(429);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.type).toBe('https://api.return.app/errors/rate-limit-exceeded');
    });

    it('blocks the same IP and the same email after the login limit', async () => {
      await login('203.0.113.4', 'alice@example.com').expect(201);
      await login('203.0.113.4', 'alice@example.com').expect(201);
      await login('203.0.113.4', 'alice@example.com').expect(429);
    });

    it('treats the email case and surrounding spaces as the same account', async () => {
      await login('203.0.113.5', 'Alice@Example.com').expect(201);
      await login('203.0.113.5', ' alice@example.com ').expect(201);
      await login('203.0.113.5', 'ALICE@EXAMPLE.COM').expect(429);
    });

    it('does not let attempts on one account block another account from the same IP', async () => {
      await login('203.0.113.6', 'alice@example.com').expect(201);
      await login('203.0.113.6', 'alice@example.com').expect(201);
      await login('203.0.113.6', 'alice@example.com').expect(429);
      await login('203.0.113.6', 'bob@example.com').expect(201);
    });

    it('does not let one IP block the same account for another IP', async () => {
      await login('203.0.113.7', 'carol@example.com').expect(201);
      await login('203.0.113.7', 'carol@example.com').expect(201);
      await login('203.0.113.7', 'carol@example.com').expect(429);
      await login('203.0.113.8', 'carol@example.com').expect(201);
    });
  });

  describe('without CLIENT_IP_HEADER (not behind Fly)', () => {
    let app: INestApplication;
    beforeEach(async () => {
      app = await createApp({});
    });
    afterEach(async () => {
      await app.close();
    });

    it('ignores a client-supplied Fly-Client-IP: changing it does not open a new bucket', async () => {
      const ping = (ip: string) =>
        request(app.getHttpServer()).get('/ping').set('Fly-Client-IP', ip);
      for (let i = 0; i < 3; i++) await ping(`198.51.100.${i + 1}`).expect(200);
      await ping('198.51.100.99').expect(429);
    });
  });
});

describe('applyTrustProxy', () => {
  it('takes the right-most X-Forwarded-For entry added by the trusted proxy, not the spoofable left one', async () => {
    const app = await createApp({}, 1);
    const res = await request(app.getHttpServer())
      .get('/whoami')
      .set('X-Forwarded-For', '10.0.0.66, 203.0.113.9')
      .expect(200);
    expect(res.body.ip).toBe('203.0.113.9');
    await app.close();
  });

  it('leaves X-Forwarded-For untrusted when no hop is configured', async () => {
    const app = await createApp({}, 0);
    const res = await request(app.getHttpServer())
      .get('/whoami')
      .set('X-Forwarded-For', '203.0.113.9')
      .expect(200);
    expect(res.body.ip).not.toBe('203.0.113.9');
    await app.close();
  });
});
