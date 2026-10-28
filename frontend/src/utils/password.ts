import type { TFunction } from 'i18next';

// =============================================================================
// Password rules — mirror of the API contract (openapi.yaml, RegisterDto.password)
// =============================================================================
// The API accepts ONLY letters A-Z / a-z (no accents), digits and @$!%*?&.
// Every password form must use these helpers so the app never lets through a
// password the API will refuse.
// =============================================================================

/** Special characters accepted by the API, as shown to the user. */
export const PASSWORD_SPECIAL_CHARACTERS = '@ $ ! % * ? &';

export const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const ALLOWED_CHARACTER = /[A-Za-z\d@$!%*?&]/;

/** Characters of `password` the API refuses, each listed once, in order of appearance. */
export function forbiddenPasswordCharacters(password: string): string[] {
  return [...new Set([...password].filter((char) => !ALLOWED_CHARACTER.test(char)))];
}

/**
 * react-hook-form `validate` rule: `true` when the API will accept the password,
 * otherwise a message naming what is wrong. Length is checked by minLength/maxLength.
 */
export function validatePasswordRules(password: string, t: TFunction): true | string {
  const forbidden = forbiddenPasswordCharacters(password);
  if (forbidden.length > 0) {
    const chars = forbidden
      .map((char) => (char === ' ' ? t('auth.passwordSpaceCharacter') : `« ${char} »`))
      .join(', ');
    return t('auth.passwordForbiddenChars', { chars, allowed: PASSWORD_SPECIAL_CHARACTERS });
  }
  if (!PASSWORD_PATTERN.test(password)) {
    return t('auth.passwordStrength', { allowed: PASSWORD_SPECIAL_CHARACTERS });
  }
  return true;
}
