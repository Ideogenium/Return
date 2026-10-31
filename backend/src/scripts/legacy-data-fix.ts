import { LoanStatus, ReminderStatus, type Prisma, type PrismaClient } from '@prisma/client';
import { REMINDABLE_LOAN_STATUSES } from '../common/constants/loan-statuses.js';
import { startOfUtcDay } from '../common/utils/date.util.js';
import {
  DEFAULT_OVERDUE_BATCH_SIZE,
  DEFAULT_OVERDUE_MAX_SHARE,
  OPEN_LOANS_WHERE,
  collectLoansToClose,
  markAwaitingReturnWhere,
} from '../loans/overdue-queries.js';
import { ReminderPolicy } from '../reminders/reminder-policy.js';
import { rescheduleInTransaction } from '../reminders/reminders.service.js';

// =============================================================================
// One-off script for the D2 deployment: cleans legacy data that predates FEAT-11
// (reminder cancellation / replanning) and measures what the FEAT-10 overdue CRON
// will find on its first passes. Dry run by default; see backend docs for usage.
// =============================================================================

/** Statuses whose due date FEAT-11 replans (reschedule is a no-op for AWAITING_RETURN). */
const REPLANNABLE_STATUSES: LoanStatus[] = [LoanStatus.ACTIVE, LoanStatus.ACTIVE_BY_DEFAULT];

/** Page size used to read the close candidates (same pagination as the CRON). */
const CLOSE_PAGE_SIZE = 200;

const TRANSACTION_TIMEOUT_MS = 60_000;

export type LegacyFixDb = Prisma.TransactionClient & Pick<PrismaClient, '$transaction'>;

export interface LegacyFixReport {
  apply: boolean;
  /** a. SCHEDULED reminders of a closed or deleted loan, cancelled with --apply. */
  orphanReminderIds: string[];
  /** b. Open loans whose SCHEDULED reminders do not follow the current returnDate. */
  replannedLoanIds: string[];
  /** b. Same, but already past due: replanning creates reminders dated in the past. */
  replannedAlreadyOverdueCount: number;
  /** b. AWAITING_RETURN loans with stale reminders: FEAT-11 does not handle them, look by hand. */
  manualReviewLoanIds: string[];
  /** b. Among those, the ones whose returnDate was pushed to today or later. */
  manualReviewFutureDueCount: number;
  /** c. Loans the CRON step markAwaitingReturn would move. */
  toMarkAwaitingReturnIds: string[];
  /** c. Loans the CRON step closeExhausted would close (current due date rule included). */
  toCloseIds: string[];
  openLoansCount: number;
  /** c. Whether the CRON circuit breaker would trip with the default settings. */
  wouldTrip: { markAwaitingReturn: boolean; closeExhausted: boolean };
  /** Write results, only set with --apply. */
  applied?: { cancelledReminders: number; replannedLoans: number };
}

export function parseArgs(argv: string[]): { apply: boolean } {
  const unknown = argv.filter((arg) => arg !== '--apply');
  if (unknown.length > 0) {
    throw new Error(`Unknown argument(s): ${unknown.join(' ')}. Only --apply is supported.`);
  }
  return { apply: argv.includes('--apply') };
}

/** Same breaker rule as the CRON, applied with its default settings. */
function wouldTrip(candidates: number, open: number): boolean {
  return candidates > DEFAULT_OVERDUE_BATCH_SIZE && candidates > DEFAULT_OVERDUE_MAX_SHARE * open;
}

const ORPHAN_REMINDERS_WHERE: Prisma.ReminderWhereInput = {
  status: ReminderStatus.SCHEDULED,
  loan: {
    OR: [{ deletedAt: { not: null } }, { status: { notIn: REMINDABLE_LOAN_STATUSES } }],
  },
};

/**
 * True when one SCHEDULED reminder does not sit where the policy puts it for the
 * current returnDate. Dates are computed with a createdAt far in the past so that
 * every type (PREVENTIVE included) has an expected date: only dates are compared,
 * whether a PREVENTIVE should exist is the business of the original scheduling.
 */
function hasStaleScheduledReminders(
  returnDate: Date | null,
  scheduled: Array<{ type: string; scheduledFor: Date }>,
): boolean {
  const expected = new Map<string, number>(
    ReminderPolicy.calculateDates(returnDate, new Date(0)).map((schedule) => [
      schedule.type,
      schedule.scheduledFor.getTime(),
    ]),
  );
  return scheduled.some(
    (reminder) => expected.get(reminder.type) !== reminder.scheduledFor.getTime(),
  );
}

/** Steps a and b. With `write` false the database is only read. */
async function fixReminders(
  db: Prisma.TransactionClient,
  write: boolean,
  now: Date,
): Promise<
  Pick<
    LegacyFixReport,
    | 'orphanReminderIds'
    | 'replannedLoanIds'
    | 'replannedAlreadyOverdueCount'
    | 'manualReviewLoanIds'
    | 'manualReviewFutureDueCount'
    | 'applied'
  >
> {
  const startOfTodayUtc = startOfUtcDay(now);

  const orphans = await db.reminder.findMany({
    where: ORPHAN_REMINDERS_WHERE,
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  const openWithScheduled = await db.loan.findMany({
    where: {
      ...OPEN_LOANS_WHERE,
      reminders: { some: { status: ReminderStatus.SCHEDULED } },
    },
    select: {
      id: true,
      status: true,
      returnDate: true,
      reminders: {
        where: { status: ReminderStatus.SCHEDULED },
        select: { type: true, scheduledFor: true },
      },
    },
    orderBy: { id: 'asc' },
  });
  const stale = openWithScheduled.filter((loan) =>
    hasStaleScheduledReminders(loan.returnDate, loan.reminders),
  );
  const replanned = stale.filter((loan) => REPLANNABLE_STATUSES.includes(loan.status));
  const manualReview = stale.filter((loan) => loan.status === LoanStatus.AWAITING_RETURN);

  const report = {
    orphanReminderIds: orphans.map((reminder) => reminder.id),
    replannedLoanIds: replanned.map((loan) => loan.id),
    replannedAlreadyOverdueCount: replanned.filter(
      (loan) => loan.returnDate !== null && loan.returnDate < startOfTodayUtc,
    ).length,
    manualReviewLoanIds: manualReview.map((loan) => loan.id),
    manualReviewFutureDueCount: manualReview.filter(
      (loan) => loan.returnDate !== null && loan.returnDate >= startOfTodayUtc,
    ).length,
  };
  if (!write) return report;

  // Orphans first: the loans of step b are open and not deleted, so the two never overlap.
  let cancelledReminders = 0;
  if (orphans.length > 0) {
    // Same where as the read above, inside the same transaction: nothing outside the
    // listed scope can be cancelled.
    const { count } = await db.reminder.updateMany({
      where: ORPHAN_REMINDERS_WHERE,
      data: { status: ReminderStatus.CANCELLED },
    });
    cancelledReminders = count;
  }

  // Replanned exactly like FEAT-11 (same function as RemindersService.reschedule).
  let replannedLoans = 0;
  for (const loan of replanned) {
    if ((await rescheduleInTransaction(db, loan.id, now)) !== null) replannedLoans++;
  }

  return { ...report, applied: { cancelledReminders, replannedLoans } };
}

/** Step c: read-only, uses the very same queries as the CRON. */
async function countCronWork(
  db: LegacyFixDb,
  now: Date,
): Promise<
  Pick<LegacyFixReport, 'toMarkAwaitingReturnIds' | 'toCloseIds' | 'openLoansCount' | 'wouldTrip'>
> {
  const [toMark, toClose, openLoansCount] = await Promise.all([
    db.loan.findMany({
      where: markAwaitingReturnWhere(startOfUtcDay(now)),
      select: { id: true },
      orderBy: { id: 'asc' },
    }),
    collectLoansToClose(db, Infinity, CLOSE_PAGE_SIZE),
    db.loan.count({ where: OPEN_LOANS_WHERE }),
  ]);

  return {
    toMarkAwaitingReturnIds: toMark.map((loan) => loan.id),
    toCloseIds: toClose.map((loan) => loan.id).sort(),
    openLoansCount,
    wouldTrip: {
      markAwaitingReturn: wouldTrip(toMark.length, openLoansCount),
      closeExhausted: wouldTrip(toClose.length, openLoansCount),
    },
  };
}

/**
 * Runs the script. Idempotent: once applied, a new run finds nothing to fix.
 * Without `apply` nothing is written; with it, steps a and b share one transaction
 * (all or nothing).
 */
export async function runLegacyDataFix(
  db: LegacyFixDb,
  options: { apply: boolean; now?: Date },
): Promise<LegacyFixReport> {
  const now = options.now ?? new Date();

  const fixes = options.apply
    ? await db.$transaction((tx) => fixReminders(tx, true, now), {
        timeout: TRANSACTION_TIMEOUT_MS,
      })
    : await fixReminders(db, false, now);

  // Read-only; in apply mode it runs after the fixes, which never change its figures.
  const cronWork = await countCronWork(db, now);

  return { apply: options.apply, ...fixes, ...cronWork };
}

function idList(label: string, ids: string[]): string[] {
  return ids.length === 0 ? [] : [`${label}:`, ...ids.map((id) => `  ${id}`)];
}

/** Human readable report. IDs (UUIDs) are listed in dry-run only, as per the runbook. */
export function formatReport(report: LegacyFixReport): string[] {
  const lines = [
    report.apply ? 'Legacy data fix — APPLY mode' : 'Legacy data fix — DRY RUN (nothing written)',
    `a. orphan SCHEDULED reminders (closed or deleted loan): ${report.orphanReminderIds.length}`,
    `b. open loans with reminders not matching their returnDate: ${report.replannedLoanIds.length}` +
      ` (${report.replannedAlreadyOverdueCount} already past due)`,
    `b. AWAITING_RETURN loans with stale reminders, to examine by hand: ${report.manualReviewLoanIds.length}` +
      ` (${report.manualReviewFutureDueCount} with a due date today or later)`,
    `c. markAwaitingReturn would move: ${report.toMarkAwaitingReturnIds.length}`,
    `c. closeExhausted would close: ${report.toCloseIds.length}`,
    `c. open loans: ${report.openLoansCount}`,
    `c. circuit breaker with default settings (batch ${DEFAULT_OVERDUE_BATCH_SIZE}, share ${DEFAULT_OVERDUE_MAX_SHARE}): ` +
      `markAwaitingReturn ${report.wouldTrip.markAwaitingReturn ? 'WOULD TRIP' : 'ok'}, ` +
      `closeExhausted ${report.wouldTrip.closeExhausted ? 'WOULD TRIP' : 'ok'}`,
  ];

  if (report.applied) {
    lines.push(
      `applied: ${report.applied.cancelledReminders} reminder(s) cancelled, ${report.applied.replannedLoans} loan(s) replanned`,
    );
  } else {
    lines.push(
      ...idList('a. reminder ids', report.orphanReminderIds),
      ...idList('b. loan ids to replan', report.replannedLoanIds),
      ...idList('b. loan ids to examine by hand', report.manualReviewLoanIds),
      ...idList('c. loan ids to mark AWAITING_RETURN', report.toMarkAwaitingReturnIds),
      ...idList('c. loan ids to close NOT_RETURNED', report.toCloseIds),
    );
  }
  return lines;
}
