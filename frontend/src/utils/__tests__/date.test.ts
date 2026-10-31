import { getMinReturnDate, formatDate, toLocalIsoDate } from '../date';

// The minimum is "UTC day of the reference + 2", mirroring the API's startOfUtcDay: references are
// UTC instants so the expectations hold in any machine timezone (see the `test:tz` script).
describe('getMinReturnDate', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should default to the current instant', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-19T14:30:00Z'));

    expect(toLocalIsoDate(getMinReturnDate())).toBe('2026-03-21');
  });

  it('should use the UTC day, not the local one (late evening west of UTC)', () => {
    // 21:00 in UTC-5 is already 02:00 the next day in UTC: the API computes from Nov 1.
    expect(toLocalIsoDate(getMinReturnDate(new Date('2026-11-01T02:00:00Z')))).toBe('2026-11-03');
  });

  it('should use the UTC day, not the local one (just after local midnight east of UTC)', () => {
    expect(toLocalIsoDate(getMinReturnDate(new Date('2026-10-31T23:30:00Z')))).toBe('2026-11-02');
    expect(toLocalIsoDate(getMinReturnDate(new Date('2026-10-31T00:30:00Z')))).toBe('2026-11-02');
  });

  it('should return a local midnight', () => {
    const result = getMinReturnDate(new Date('2026-03-19T14:30:00Z'));

    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('should handle month transition (30 Jan + 2 = 1 Feb)', () => {
    expect(toLocalIsoDate(getMinReturnDate(new Date('2026-01-30T12:00:00Z')))).toBe('2026-02-01');
  });

  it('should handle year transition (30 Dec + 2 = 1 Jan next year)', () => {
    expect(toLocalIsoDate(getMinReturnDate(new Date('2026-12-30T12:00:00Z')))).toBe('2027-01-01');
  });

  it('should handle leap year (27 Feb 2028 + 2 = 29 Feb)', () => {
    expect(toLocalIsoDate(getMinReturnDate(new Date('2028-02-27T12:00:00Z')))).toBe('2028-02-29');
  });

  it('should handle non-leap year (27 Feb 2026 + 2 = 1 Mar)', () => {
    expect(toLocalIsoDate(getMinReturnDate(new Date('2026-02-27T12:00:00Z')))).toBe('2026-03-01');
  });

  it('should not mutate the reference date', () => {
    const ref = new Date('2026-01-10T15:30:00Z');
    const originalTime = ref.getTime();
    getMinReturnDate(ref);

    expect(ref.getTime()).toBe(originalTime);
  });
});

describe('formatDate', () => {
  it('should return empty string when date is null', () => {
    const result = formatDate(null, 'fr-FR');

    expect(result).toBe('');
  });

  it('should return empty string when date is undefined', () => {
    const result = formatDate(undefined, 'fr-FR');

    expect(result).toBe('');
  });

  it('should return empty string when date string is invalid', () => {
    const result = formatDate('not-a-date', 'fr-FR');

    expect(result).toBe('');
  });

  it('should format a valid ISO string with fr-FR locale (day first)', () => {
    // Arrange — unambiguous UTC noon to avoid local-timezone day shift
    const isoString = '2024-01-15T12:00:00Z';

    // Act
    const result = formatDate(isoString, 'fr-FR');

    // Assert — exact value expected when full ICU is available (Node ≥ 13 with full-icu)
    expect(result).toBe('15/01/2024');
  });

  it('should format a valid ISO string with en-US locale (month first)', () => {
    // Arrange
    const isoString = '2024-01-15T12:00:00Z';

    // Act
    const result = formatDate(isoString, 'en-US');

    // Assert — exact value expected when full ICU is available
    expect(result).toBe('1/15/2024');
  });

  it('should produce different output for fr-FR vs en-US (locale is honoured regardless of ICU completeness)', () => {
    // Robustness assertion: does not depend on exact ICU formatting,
    // only verifies that the locale argument is actually passed through.
    const isoString = '2024-01-15T12:00:00Z';

    const frResult = formatDate(isoString, 'fr-FR');
    const enResult = formatDate(isoString, 'en-US');

    expect(frResult).not.toBe(enResult);
  });

  it('should accept a Date object and return a non-empty formatted string', () => {
    // Arrange — constructed with UTC noon to avoid day shift across timezones
    const dateObject = new Date('2024-06-10T12:00:00Z');

    // Act
    const result = formatDate(dateObject, 'fr-FR');

    // Assert — a Date object input is accepted and produces a non-empty result
    expect(result).not.toBe('');
    expect(typeof result).toBe('string');
  });
});

describe('toLocalIsoDate', () => {
  it('formats the calendar day the user picked as YYYY-MM-DD', () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('keeps the local day late in the evening, where toISOString would roll over to UTC', () => {
    expect(toLocalIsoDate(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31');
  });
});
