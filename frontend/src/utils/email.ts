/** Loose client-side email check; the API (`@IsEmail`) remains the authority. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email as it must be sent: iOS autocomplete often adds a trailing space. */
export function normalizeEmail(email: string): string {
  return email.trim();
}
