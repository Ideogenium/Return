import { startOfUtcDay } from './date.util.js';

describe('startOfUtcDay', () => {
  it('returns midnight UTC of the same UTC calendar day', () => {
    expect(startOfUtcDay(new Date('2026-10-28T15:42:10.123Z')).toISOString()).toBe(
      '2026-10-28T00:00:00.000Z',
    );
  });

  it('uses the UTC day, not the local day: 23:30 UTC is still that UTC day', () => {
    expect(startOfUtcDay(new Date('2026-10-28T23:30:00Z')).toISOString()).toBe(
      '2026-10-28T00:00:00.000Z',
    );
  });

  it('is midnight UTC itself at the exact boundary', () => {
    expect(startOfUtcDay(new Date('2026-10-29T00:00:00Z')).toISOString()).toBe(
      '2026-10-29T00:00:00.000Z',
    );
  });

  it('matches how a @db.Date return date is stored, so a loan due today is not before it', () => {
    const dueToday = new Date('2026-10-28');
    expect(dueToday < startOfUtcDay(new Date('2026-10-28T20:00:00Z'))).toBe(false);
    expect(new Date('2026-10-27') < startOfUtcDay(new Date('2026-10-28T20:00:00Z'))).toBe(true);
  });
});
