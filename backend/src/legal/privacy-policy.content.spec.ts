import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRIVACY_POLICY_BODY } from './privacy-policy.content';

// The HTML is a hand-synchronised copy of the Markdown sources; this guards against drift.
const LEGAL_DIR = join(__dirname, '..', '..', '..', 'docs', 'legal');
const SOURCES = {
  fr: 'politique-confidentialite.fr.md',
  en: 'privacy-policy.en.md',
} as const;

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

describe.each(Object.entries(SOURCES))('privacy policy content (%s)', (lang, file) => {
  const markdown = readFileSync(join(LEGAL_DIR, file), 'utf8');
  const html = PRIVACY_POLICY_BODY[lang as 'fr' | 'en'];

  it('contains every "##" heading of the Markdown', () => {
    const headings = [...markdown.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());

    expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings) {
      expect(html).toContain(`>${escapeHtml(heading)}</h2>`);
    }
  });

  it('contains both contact emails', () => {
    for (const email of ['egbedozin@gmail.com', 'nathan.aihou@gmail.com']) {
      expect(html).toContain(`href="mailto:${email}"`);
    }
  });

  it('keeps the pending-completion markers untouched', () => {
    expect(html).toContain(
      '<!-- À COMPLÉTER AVANT PUBLICATION : nom et adresse du responsable du traitement -->',
    );
    const placeholders = [...markdown.matchAll(/^- (\[[^\]]+\])$/gm)].map((m) => m[1]);
    expect(placeholders).toHaveLength(2);
    for (const placeholder of placeholders) {
      expect(html).toContain(placeholder);
    }
  });

  it('links the CNIL website', () => {
    expect(html).toContain('href="https://www.cnil.fr"');
  });
});
