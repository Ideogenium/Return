import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrivacyController } from './privacy.controller';

describe('PrivacyController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // No JWT guard and no auth module here: the page must be reachable by an anonymous visitor.
    const moduleRef = await Test.createTestingModule({
      controllers: [PrivacyController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // Same prefix and exclusions as main.ts.
    app.setGlobalPrefix('v1', { exclude: ['health', 'ready', 'privacy'] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path = '/privacy') => request(app.getHttpServer()).get(path);

  it('serves the policy publicly as HTML, in French by default', async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(res.headers['content-language']).toBe('fr');
    expect(res.text).toContain('<html lang="fr">');
    expect(res.text).toContain('Politique de confidentialité de Return');
  });

  it('serves English with ?lang=en', async () => {
    const res = await get('/privacy?lang=en');

    expect(res.headers['content-language']).toBe('en');
    expect(res.text).toContain('<html lang="en">');
    expect(res.text).toContain('Return Privacy Policy');
  });

  it('serves English when Accept-Language prefers it', async () => {
    const res = await get().set('Accept-Language', 'en-US,en;q=0.9');

    expect(res.headers['content-language']).toBe('en');
  });

  it('stays French when French comes before English in Accept-Language', async () => {
    const res = await get().set('Accept-Language', 'fr-FR,en;q=0.5');

    expect(res.headers['content-language']).toBe('fr');
  });

  it('falls back to French for unsupported languages', async () => {
    const res = await get().set('Accept-Language', 'de-DE,de;q=0.9');

    expect(res.headers['content-language']).toBe('fr');
  });

  it('lets ?lang override Accept-Language', async () => {
    const fr = await get('/privacy?lang=fr').set('Accept-Language', 'en-US');
    const en = await get('/privacy?lang=en').set('Accept-Language', 'fr-FR');

    expect(fr.headers['content-language']).toBe('fr');
    expect(en.headers['content-language']).toBe('en');
  });

  it('ignores an unknown ?lang value and falls back to Accept-Language', async () => {
    const res = await get('/privacy?lang=xx').set('Accept-Language', 'en');

    expect(res.headers['content-language']).toBe('en');
  });

  it('sets a strict CSP whose style hash matches the inline style block', async () => {
    const res = await get();
    const csp = res.headers['content-security-policy'];
    const style = /<style>([\s\S]*?)<\/style>/.exec(res.text);

    expect(style).not.toBeNull();
    const hash = createHash('sha256').update(style![1]).digest('base64');
    expect(csp).toBe(
      `default-src 'none'; style-src 'sha256-${hash}'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    );
  });

  it('sets caching and hardening headers', async () => {
    const res = await get();

    expect(res.headers['vary']).toMatch(/Accept-Language/i);
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('contains no script nor external resource', async () => {
    const res = await get();

    expect(res.text).not.toMatch(/<script|<link|<img|<iframe/i);
  });

  it('is not exposed under the /v1 prefix', async () => {
    const res = await get('/v1/privacy');

    expect(res.status).toBe(404);
  });
});
