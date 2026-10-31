import { LoanStatus, ReminderStatus, ReminderType, type Prisma } from '@prisma/client';
import { ReminderPolicy } from '../reminders/reminder-policy.js';

// =============================================================================
// FEAT-10 overdue queries — shared by LoansCronService and the one-off legacy
// data script, so that the script counts exactly what the CRON would touch.
// =============================================================================

/** Loans processed per overdue step and per pass when OVERDUE_JOB_BATCH_SIZE is unset or invalid. */
export const DEFAULT_OVERDUE_BATCH_SIZE = 100;
/** Circuit-breaker threshold when OVERDUE_JOB_MAX_SHARE is unset or invalid. */
export const DEFAULT_OVERDUE_MAX_SHARE = 0.5;

/** Statuses counted as "open" by the overdue circuit breaker. */
export const OPEN_LOAN_STATUSES: LoanStatus[] = [
  LoanStatus.ACTIVE,
  LoanStatus.ACTIVE_BY_DEFAULT,
  LoanStatus.AWAITING_RETURN,
];

export const OPEN_LOANS_WHERE: Prisma.LoanWhereInput = {
  status: { in: OPEN_LOAN_STATUSES },
  deletedAt: null,
};

/** Loans the step "markAwaitingReturn" moves: due day strictly before today (UTC). */
export function markAwaitingReturnWhere(startOfTodayUtc: Date): Prisma.LoanWhereInput {
  return {
    status: { in: [LoanStatus.ACTIVE, LoanStatus.ACTIVE_BY_DEFAULT] },
    deletedAt: null,
    returnDate: { not: null, lt: startOfTodayUtc },
  };
}

const FINAL_OVERDUE_DONE_FILTER = {
  type: ReminderType.FINAL_OVERDUE,
  status: { in: [ReminderStatus.SENT, ReminderStatus.FAILED] },
} satisfies Prisma.ReminderWhereInput;

/** Loans the step "closeExhausted" may close (before the in-memory due-date check). */
export const CLOSE_CANDIDATES_WHERE: Prisma.LoanWhereInput = {
  status: LoanStatus.AWAITING_RETURN,
  deletedAt: null,
  reminders: { some: FINAL_OVERDUE_DONE_FILTER },
};

const CLOSE_CANDIDATE_SELECT = {
  id: true,
  borrowerId: true,
  lenderId: true,
  createdAt: true,
  returnDate: true,
  reminders: { where: FINAL_OVERDUE_DONE_FILTER, select: { status: true, scheduledFor: true } },
} satisfies Prisma.LoanSelect;

export type CloseCandidate = Prisma.LoanGetPayload<{ select: typeof CLOSE_CANDIDATE_SELECT }>;

/**
 * Only keep loans whose FINAL_OVERDUE matches the current returnDate: its scheduledFor
 * must not be earlier than the one the policy computes today (a FINAL_OVERDUE sent for
 * an older, since postponed, date must not close the loan).
 */
export function hasCurrentFinalOverdue(loan: CloseCandidate): boolean {
  const expected = ReminderPolicy.calculateDates(loan.returnDate, loan.createdAt).find(
    (schedule) => schedule.type === ReminderType.FINAL_OVERDUE,
  );
  if (!expected) return false;
  return loan.reminders.some(
    (reminder) =>
      reminder.status !== ReminderStatus.SCHEDULED &&
      reminder.scheduledFor.getTime() >= expected.scheduledFor.getTime(),
  );
}

/**
 * Collects up to `limit` loans that really have to be closed.
 *
 * The due-date check cannot be written in SQL (Prisma cannot compare a reminder column
 * with a value derived from the loan's returnDate), so it runs in memory. Reading a
 * single page of `limit` candidates would let stale ones (postponed loans: they stay
 * candidates at every pass) fill the whole batch and starve the real ones. Hence the
 * keyset pagination on `id`: pages are read until `limit` real closures are found or
 * the candidates run out.
 */
export async function collectLoansToClose(
  db: Pick<Prisma.TransactionClient, 'loan'>,
  limit: number,
  pageSize: number,
): Promise<CloseCandidate[]> {
  const toClose: CloseCandidate[] = [];
  let lastId: string | undefined;

  while (toClose.length < limit) {
    const page = await db.loan.findMany({
      where: { ...CLOSE_CANDIDATES_WHERE, ...(lastId ? { id: { gt: lastId } } : {}) },
      select: CLOSE_CANDIDATE_SELECT,
      orderBy: { id: 'asc' },
      take: pageSize,
    });

    for (const loan of page) {
      if (toClose.length >= limit) break;
      if (hasCurrentFinalOverdue(loan)) toClose.push(loan);
    }

    if (page.length < pageSize) break;
    lastId = page[page.length - 1].id;
  }

  return toClose;
}
