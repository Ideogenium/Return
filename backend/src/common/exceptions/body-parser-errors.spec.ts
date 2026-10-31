import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import type { ProblemDetails } from './problem-details.exception.js';

// =============================================================================
// JSON body errors — real Express body parser, real AllExceptionsFilter
// =============================================================================
// The JSON parser runs before any route: its errors (body over the 100 KB default
// limit, unparsable JSON) are not HttpExceptions. They must still be answered in
// RFC 7807, with their own status, never as a 500.
// =============================================================================

jest.mock('../middleware/request-context.middleware.js', () => ({
  getRequestId: () => 'test-request-id',
}));

@Controller('echo')
class EchoController {
  @Post()
  echo(@Body() body: unknown): unknown {
    return body;
  }
}

describe('JSON body errors (body parser)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [EchoController] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('still accepts a normal JSON body', async () => {
    const res = await request(app.getHttpServer()).post('/echo').send({ name: 'Perceuse' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ name: 'Perceuse' });
  });

  it('answers a JSON body over the parser limit with an RFC 7807 413, not a 500', async () => {
    const res = await request(app.getHttpServer())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ notes: 'x'.repeat(200 * 1024) }));

    expect(res.status).toBe(413);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.body as ProblemDetails;
    expect(body).toMatchObject({
      type: 'https://api.return.app/errors/payload-too-large',
      title: 'Payload Too Large',
      status: 413,
      instance: '/echo',
      requestId: 'test-request-id',
    });
    expect(body.detail).toBe('The request body is larger than the 102400-byte limit.');
  });

  it('answers an unparsable JSON body with a 400 VALIDATION_ERROR, not a 500', async () => {
    const res = await request(app.getHttpServer())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"name": "Perceuse",');

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.body as ProblemDetails;
    expect(body.type).toBe('https://api.return.app/errors/validation-failed');
    // NestJS turns the parser's SyntaxError into a BadRequestException carrying only its message.
    expect(body.errors).toEqual([
      { field: 'unknown', code: 'VALIDATION_ERROR', message: expect.stringContaining('JSON') },
    ]);
  });

  it('answers another body parser client error (unsupported charset) with its own status, not a 500', async () => {
    const res = await request(app.getHttpServer())
      .post('/echo')
      .set('Content-Type', 'application/json; charset=klingon')
      .send('{"name":"Perceuse"}');

    expect(res.status).toBe(415);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body as ProblemDetails).toMatchObject({
      type: 'https://api.return.app/errors/http-error',
      status: 415,
      instance: '/echo',
    });
  });
});
