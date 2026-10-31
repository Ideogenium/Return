/**
 * Returns the minimum allowed return date as a local midnight whose year/month/day are the UTC
 * calendar day of referenceDate + 2 days. Aligned on the API (`startOfUtcDay` + 2), so that
 * `toLocalIsoDate(getMinReturnDate())` is exactly the earliest day the API accepts, in any
 * timezone: using the local day would offer a refused day near midnight (west of UTC) or hide a
 * valid one (east of UTC).
 */
export function getMinReturnDate(referenceDate?: Date): Date {
  const base = referenceDate ?? new Date();
  // Local midnight carrying the UTC calendar day + 2: the calendar (react-native-paper-dates)
  // reasons in local dates, but the API's bound is startOfUtcDay(now) + 2.
  return new Date(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + 2);
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
