// =============================================================================
// Date helpers — calendar-day rules shared by every "overdue" computation
// =============================================================================

/**
 * Start (00:00:00.000 UTC) of the UTC calendar day containing `now`.
 *
 * `Loan.returnDate` is a `@db.Date`, stored as midnight UTC of its day: a loan is
 * overdue when `returnDate < startOfUtcDay(now)`, so the due day itself is on time
 * (commit 7e1adc3). The lender statistics (FEAT-04) and the overdue transition
 * (FEAT-10) must both use this function so their "today" never diverges.
 */
export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
