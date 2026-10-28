import fr from '../locales/fr.json';
import en from '../locales/en.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...acc, [path]: value }
      : { ...acc, ...flatten(value, path) };
  }, {});
}

const locales = { fr: flatten(fr as Tree), en: flatten(en as Tree) };

describe('locales', () => {
  it('define exactly the same keys in French and English', () => {
    expect(Object.keys(locales.fr).sort()).toEqual(Object.keys(locales.en).sort());
  });

  it('use the same interpolation variables in French and English', () => {
    const variables = (text: string) => (text.match(/{{\s*\w+\s*}}/g) ?? []).sort();
    for (const key of Object.keys(locales.en)) {
      expect({ key, vars: variables(locales.fr[key] ?? '') }).toEqual({
        key,
        vars: variables(locales.en[key] ?? ''),
      });
    }
  });

  it.each(['fr', 'en'] as const)(
    'gives distinct labels to "overdue" and "returned late" on the lender statistics card (%s)',
    (lang) => {
      expect(locales[lang]['profile.overdueLoans']).not.toBe(locales[lang]['profile.returnedLate']);
    },
  );

  it.each(['fr', 'en'] as const)(
    'take the accepted special characters from one source in the password rules (%s)',
    (lang) => {
      expect(locales[lang]['auth.passwordRules']).toContain('{{allowed}}');
    },
  );
});
