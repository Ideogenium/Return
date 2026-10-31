/**
 * Returns the minimum allowed return date (referenceDate + 2 days at 00:00:00).
 */
export function getMinReturnDate(referenceDate?: Date): Date {
  const base = referenceDate ?? new Date();
  const min = new Date(base);
  min.setDate(min.getDate() + 2);
  min.setHours(0, 0, 0, 0);
  return min;
}

/**
 * Formats a date using the app language so the output is consistent across machines.
 * Returns an empty string when the input is absent or not a valid date — never "Invalid Date".
 */
export function formatDate(date: string | Date | null | undefined, language: string): string {
  if (date == null) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(language);
}

/**
 * The calendar day of a local date as YYYY-MM-DD (the API's `format: date`).
 * Not `toISOString()`: late in the evening it would give the next day in UTC.
 */
export function toLocalIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
