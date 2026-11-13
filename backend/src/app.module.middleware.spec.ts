import {
  Controller,
  Get,
  INestApplication,
  Logger,
  MiddlewareConsumer,
  Module,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { applyRequestContext, getRequestId } from './common/middleware';

// Echoes the request id seen through AsyncLocalStorage, proving the middleware ran around the handler.
@Controller()
class ProbeController {
  @Get('health')
  health() {
    return { requestId: getRequestId() };
  }

  @Get('ready')
  ready() {
    return { requestId: getRequestId() };
  }

  @Get('privacy')
  privacy() {
    return { requestId: getRequestId() };
  }

  @Get('loans')
  root() {
    return { requestId: getRequestId() };
  }

  @Get('loans/:loanId/reminders')
  nested() {
    return { requestId: getRequestId() };
  }
}

// Same middleware configuration as AppModule.configure, without its infrastructure modules.
@Module({ controllers: [ProbeController] })
class ProbeModule {
  configure(consumer: MiddlewareConsumer): void {
    applyRequestContext(consumer);
  }
}

describe('AppModule middleware routes (FIX-29)', () => {
  let app: INestApplication;
  let warn: jest.SpyInstance;

  beforeAll(async () => {
    warn = jest.spyOn(Logger.prototype, 'warn');
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // Same prefix and exclusions as main.ts.
    app.setGlobalPrefix('v1', { exclude: ['health', 'ready', 'privacy'] });
    await app.init();
  });

  afterAll(async () => {
    warn.mockRestore();
    await app.close();
  });

  it.each(['/v1/loans', '/v1/loans/3b2a1c4d/reminders', '/health', '/ready', '/privacy'])(
    'runs the request context middleware on %s',
    async (path) => {
      const res = await request(app.getHttpServer()).get(path).set('X-Request-Id', 'req-probe');

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe('req-probe');
      expect(res.body).toEqual({ requestId: 'req-probe' });
    },
  );

  it('registers the middleware without a legacy route path warning', () => {
    const legacy = warn.mock.calls.filter(([message]) =>
      String(message).includes('Unsupported route path'),
    );
    expect(legacy).toEqual([]);
  });
});
