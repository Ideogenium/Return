import type { TFunction } from 'i18next';

/** Loose client-side email check; the API (`@IsEmail`) remains the authority. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email as it must be sent: iOS autocomplete often adds a trailing space. */
export function normalizeEmail(email: string): string {
  return email.trim();
}

/** react-hook-form `validate` rule of a required email: only spaces counts as missing. */
export function validateRequiredEmail(value: string, t: TFunction): true | string {
  const email = normalizeEmail(value ?? '');
  if (!email) return t('auth.emailRequired');
  return EMAIL_PATTERN.test(email) || t('auth.emailInvalid');
}

/** react-hook-form `validate` rule of an optional email: empty (or only spaces) is accepted. */
export function validateOptionalEmail(
  value: string | null | undefined,
  t: TFunction,
): true | string {
  const email = normalizeEmail(value ?? '');
  return !email || EMAIL_PATTERN.test(email) || t('auth.emailInvalid');
}

/** Payload as it must be sent: email normalized, and an optional email left blank is omitted. */
export function withNormalizedEmail<T extends { email?: string | null }>(data: T): T {
  const { email, ...rest } = data;
  if (email == null) return data;
  const normalized = normalizeEmail(email);
  return (normalized ? { ...rest, email: normalized } : rest) as T;
}
