import i18n from '../../config/i18n.config';
import { PASSWORD_PATTERN, forbiddenPasswordCharacters, validatePasswordRules } from '../password';

const t = i18n.t.bind(i18n);

describe('PASSWORD_PATTERN', () => {
  it('is exactly the pattern of the API contract (openapi.yaml RegisterDto.password)', () => {
    expect(PASSWORD_PATTERN.source).toBe(
      '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$',
    );
  });
});

describe('forbiddenPasswordCharacters', () => {
  it('lists each character the API refuses, once, in order of appearance', () => {
    expect(forbiddenPasswordCharacters('Retour#20.26#!')).toEqual(['#', '.']);
  });

  it('refuses accented letters and spaces too', () => {
    expect(forbiddenPasswordCharacters('Été 2026!')).toEqual(['É', 'é', ' ']);
  });

  it('returns nothing for a password made only of allowed characters', () => {
    expect(forbiddenPasswordCharacters('Retour2026!@$%*?&')).toEqual([]);
  });
});

describe('validatePasswordRules', () => {
  beforeAll(() => i18n.changeLanguage('en'));

  it('accepts a password that satisfies the contract', () => {
    expect(validatePasswordRules('Retour2026!', t)).toBe(true);
  });

  it('names the refused character and lists the accepted ones', () => {
    const message = validatePasswordRules('Retour2026#', t);

    expect(message).toContain('#');
    expect(message).toContain('@ $ ! % * ? &');
  });

  it('quotes the refused character with the typography of the current language', () => {
    expect(validatePasswordRules('Retour2026#', t)).not.toContain('«');
  });

  it('names a refused space explicitly', () => {
    expect(validatePasswordRules('Retour 2026!', t)).toContain('space');
  });

  it('explains the missing character classes when only allowed characters are used', () => {
    const message = validatePasswordRules('retour2026!', t);

    expect(message).not.toBe(true);
    expect(message).toContain('uppercase');
  });
});
