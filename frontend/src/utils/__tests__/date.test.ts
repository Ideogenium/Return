import { getMinReturnDate, formatDate, toLocalIsoDate } from '../date';

describe('getMinReturnDate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 19, 14, 30, 0)); // 19 Mar 2026 14:30
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return a date 2 days from now', () => {
    const result = getMinReturnDate();

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(21);
  });

  it('should set hours to 00:00:00.000', () => {
    const result = getMinReturnDate();

    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('should work with a custom reference date', () => {
    const ref = new Date(2026, 0, 10, 15, 30, 0); // 10 Jan 2026 15:30
    const result = getMinReturnDate(ref);

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(12);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('should handle month transition (30 Jan + 2 = 1 Feb)', () => {
    const ref = new Date(2026, 0, 30); // 30 Jan 2026
    const result = getMinReturnDate(ref);

    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(1);
  });

  it('should handle year transition (30 Dec + 2 = 1 Jan next year)', () => {
    const ref = new Date(2026, 11, 30); // 30 Dec 2026
    const result = getMinReturnDate(ref);

    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });

  it('should handle leap year (27 Feb 2028 + 2 = 29 Feb)', () => {
    const ref = new Date(2028, 1, 27); // 27 Feb 2028 (leap year)
    const result = getMinReturnDate(ref);

    expect(result.getMonth()).toBe(1); // Still February
    expect(result.getDate()).toBe(29);
  });

  it('should handle non-leap year (27 Feb 2026 + 2 = 1 Mar)', () => {
    const ref = new Date(2026, 1, 27); // 27 Feb 2026
    const result = getMinReturnDate(ref);

    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(1);
  });

  it('should not mutate the reference date', () => {
    const ref = new Date(2026, 0, 10, 15, 30, 0);
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
