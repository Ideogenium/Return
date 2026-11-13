import { Controller, Get, Header, Headers, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PRIVACY_CSP, renderPrivacyPolicy } from './privacy-policy.page.js';
import type { PrivacyLang } from './privacy-policy.page.js';

const DEFAULT_LANG: PrivacyLang = 'fr';

/** `?lang` wins; otherwise the first `en`/`fr` tag of Accept-Language decides; French by default. */
function resolveLang(queryLang: unknown, acceptLanguage: string | undefined): PrivacyLang {
  if (queryLang === 'fr' || queryLang === 'en') {
    return queryLang;
  }
  for (const entry of (acceptLanguage ?? '').split(',')) {
    const tag = entry.split(';')[0].trim().toLowerCase();
    if (tag === 'en' || tag.startsWith('en-')) return 'en';
    if (tag === 'fr' || tag.startsWith('fr-')) return 'fr';
  }
  return DEFAULT_LANG;
}

/**
 * Public web page required by the app stores. Served outside the `/v1` prefix and without JWT guard,
 * like `/health`; not part of the OpenAPI contract.
 */
@Controller()
export class PrivacyController {
  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Content-Security-Policy', PRIVACY_CSP)
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Referrer-Policy', 'no-referrer')
  @Header('Cache-Control', 'public, max-age=3600')
  @Header('Vary', 'Accept-Language')
  getPrivacyPolicy(
    @Query('lang') queryLang: unknown,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): string {
    const lang = resolveLang(queryLang, acceptLanguage);
    res.setHeader('Content-Language', lang);
    return renderPrivacyPolicy(lang);
  }
}
