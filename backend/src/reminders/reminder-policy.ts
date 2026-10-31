import { ReminderType } from '@prisma/client';

export interface ReminderSchedule {
  type: ReminderType;
  scheduledFor: Date;
}

/** Calendar-day arithmetic in UTC: return dates are @db.Date (midnight UTC). */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function diffDays(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.floor((a.getTime() - b.getTime()) / msPerDay);
}

export const ReminderPolicy = {
  /**
   * Calculate the reminder dates based on the return date.
   * Policy: PREVENTIVE at J-3 (only when Δ≥3 days), ON_DUE_DATE (J),
   * FIRST_OVERDUE (J+7), SECOND_OVERDUE (J+14), FINAL_OVERDUE (J+21).
   *
   * FIX-05 vol. B: short loans (Δ<3 days) get no preventive reminder —
   * a J-1 notification on an already very short loan is noise, so the first
   * relevant reminder is ON_DUE_DATE. Overdue reminders are unchanged.
   */
  calculateDates(returnDate: Date | null, createdAt: Date): ReminderSchedule[] {
    if (!returnDate) return [];

    const delta = diffDays(returnDate, createdAt);
    const schedules: ReminderSchedule[] = [];

    if (delta >= 3) {
      schedules.push({ type: ReminderType.PREVENTIVE, scheduledFor: addDays(returnDate, -3) });
    }

    schedules.push(
      { type: ReminderType.ON_DUE_DATE, scheduledFor: new Date(returnDate) },
      { type: ReminderType.FIRST_OVERDUE, scheduledFor: addDays(returnDate, 7) },
      { type: ReminderType.SECOND_OVERDUE, scheduledFor: addDays(returnDate, 14) },
      { type: ReminderType.FINAL_OVERDUE, scheduledFor: addDays(returnDate, 21) },
    );

    return schedules;
  },
} as const;
