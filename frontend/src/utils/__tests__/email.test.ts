import i18n from '../../config/i18n.config';
import { validateOptionalEmail, validateRequiredEmail, withNormalizedEmail } from '../email';

const t = i18n.t.bind(i18n);

describe('validateRequiredEmail', () => {
  it.each(['', '   '])('reports a missing email for "%s"', (value) => {
    expect(validateRequiredEmail(value, t)).toBe(t('auth.emailRequired'));
  });

  it('reports an invalid email', () => {
    expect(validateRequiredEmail('not-an-email', t)).toBe(t('auth.emailInvalid'));
  });

  it('accepts an email surrounded by spaces', () => {
    expect(validateRequiredEmail(' jane@example.com ', t)).toBe(true);
  });
});

describe('validateOptionalEmail', () => {
  it.each(['', '   ', null, undefined])('accepts a blank optional email (%s)', (value) => {
    expect(validateOptionalEmail(value, t)).toBe(true);
  });

  it('still refuses an invalid optional email', () => {
    expect(validateOptionalEmail('not-an-email', t)).toBe(t('auth.emailInvalid'));
  });
});

describe('withNormalizedEmail', () => {
  it('trims the email', () => {
    expect(withNormalizedEmail({ firstName: 'Jane', email: ' jane@example.com ' })).toEqual({
      firstName: 'Jane',
      email: 'jane@example.com',
    });
  });

  it('omits an email left blank', () => {
    expect(withNormalizedEmail({ firstName: 'Jane', email: '   ' })).toEqual({ firstName: 'Jane' });
  });

  it('leaves a payload without email untouched', () => {
    const data: { firstName: string; email?: string } = { firstName: 'Jane' };
    expect(withNormalizedEmail(data)).toBe(data);
  });
});
