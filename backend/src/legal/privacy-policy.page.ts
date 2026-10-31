import { createHash } from 'node:crypto';
import { PRIVACY_POLICY_BODY } from './privacy-policy.content.js';

export type PrivacyLang = keyof typeof PRIVACY_POLICY_BODY;

// Inline CSS, allowed by hash in the CSP: no 'unsafe-inline', no external stylesheet.
const STYLE = `
body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 760px; margin: 0 auto; padding: 16px; }
h1 { font-size: 1.6rem; }
h2 { font-size: 1.25rem; margin-top: 2rem; }
h3 { font-size: 1.05rem; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
a { color: #0b57d0; overflow-wrap: anywhere; }
`;

const TITLES: Record<PrivacyLang, string> = {
  fr: 'Politique de confidentialité de Return',
  en: 'Return Privacy Policy',
};

const STYLE_HASH = createHash('sha256').update(STYLE).digest('base64');

/** Strict CSP: the page needs nothing but its own inline style. */
export const PRIVACY_CSP = [
  "default-src 'none'",
  `style-src 'sha256-${STYLE_HASH}'`,
  "img-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const PAGES = Object.fromEntries(
  (Object.keys(PRIVACY_POLICY_BODY) as PrivacyLang[]).map((lang) => [
    lang,
    `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLES[lang]}</title>
<style>${STYLE}</style>
</head>
<body>
${PRIVACY_POLICY_BODY[lang]}</body>
</html>
`,
  ]),
) as Record<PrivacyLang, string>;

export function renderPrivacyPolicy(lang: PrivacyLang): string {
  return PAGES[lang];
}
